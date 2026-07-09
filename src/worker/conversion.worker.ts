import { strFromU8, Unzip, UnzipInflate, type UnzipFile } from 'fflate'
import { convertToMarkdown } from '../converters'
import {
  createConversionReportMarkdown,
  createReport,
  formatConversionTimestamp,
} from '../report/createConversionReport'
import type {
  ConversionOptions,
  ConversionResult,
  UnsafePathResult,
  WorkerRequest,
  WorkerResponse,
  ZipEntry,
} from '../types/conversion'
import { createOutputZip, markdownToBytes, type OutputZipFiles } from '../zip/createOutputZip'
import { readZipEntriesFromData } from '../zip/readZip'


const textDecoder = new TextDecoder()
const streamChunkBytes = 64 * 1024

let cancelRequested = false
let running = false
let activeTerminators = new Set<() => void>()

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === 'CANCEL') {
    cancelRequested = true
    activeTerminators.forEach((terminate) => terminate())
    activeTerminators = new Set()
    return
  }

  if (!running) {
    void startConversion(event.data)
  }
}

async function startConversion(request: Extract<WorkerRequest, { type: 'START_CONVERSION' }>) {
  running = true
  cancelRequested = false

  const startedAt = Date.now()
  const results: ConversionResult[] = []
  const warnings: string[] = []
  const outputFiles: OutputZipFiles = {}
  const sections: string[] = []
  let unsafePaths: UnsafePathResult[] = []
  let totalFiles = 0
  let processedFiles = 0
  let convertedFiles = 0
  let skippedFiles = 0
  let failedFiles = 0

  const postProgress = (currentFile?: string) => {
    postWorkerMessage({
      type: 'PROGRESS',
      progress: {
        status: 'converting',
        totalFiles,
        processedFiles,
        convertedFiles,
        skippedFiles,
        failedFiles,
        currentFile,
        elapsedMs: Date.now() - startedAt,
      },
    })
  }

  const recordSkipped = (entry: ZipEntry, reason: string) => {
    processedFiles += 1
    skippedFiles += 1
    results.push({
      sourcePath: entry.path,
      status: 'skipped',
      reason,
    })
    postProgress(entry.path)
  }

  const recordFailed = (entry: ZipEntry, reason: string) => {
    processedFiles += 1
    failedFiles += 1
    results.push({
      sourcePath: entry.path,
      status: 'failed',
      reason,
    })
    postProgress(entry.path)
  }

  const recordConverted = (entry: ZipEntry, outputPath: string) => {
    processedFiles += 1
    convertedFiles += 1
    results.push({
      sourcePath: entry.path,
      outputPath,
      status: 'converted',
    })
    postProgress(entry.path)
  }

  try {
    const data = new Uint8Array(await request.file.arrayBuffer())
    const zipRead = readZipEntriesFromData(data)
    unsafePaths = zipRead.unsafePaths
    const fileEntries = zipRead.entries.filter((entry) => !entry.isDirectory)
    totalFiles = fileEntries.length

    postWorkerMessage({
      type: 'ZIP_READ_PROGRESS',
      totalEntries: zipRead.entries.length,
    })
    postProgress()

    await processZipStream({
      data,
      fileEntries,
      options: request.options,
      outputFiles,
      sections,
      warnings,
      recordSkipped,
      recordFailed,
      recordConverted,
      postProgress,
    })

    const cancelled = cancelRequested && processedFiles < totalFiles
    const report = createReport({
      sourceZipName: request.file.name,
      convertedAt: formatConversionTimestamp(),
      completed: !cancelled,
      cancelled,
      totalFiles,
      processedFiles,
      convertedFiles,
      skippedFiles,
      failedFiles,
      results,
      warnings,
      unsafePaths,
    })

    if (request.options.includeConversionReport) {
      outputFiles['conversion-report.md'] = markdownToBytes(
        createConversionReportMarkdown(report),
      )
    }

    outputFiles['output.md'] = markdownToBytes(sections.join('\n\n'))
    const outputBlob = createOutputZip(outputFiles)

    if (cancelled) {
      postWorkerMessage({
        type: 'CANCELLED',
        partialOutputBlob: outputBlob,
        report,
      })
    } else {
      postWorkerMessage({
        type: 'COMPLETED',
        outputBlob,
        report,
      })
    }
  } catch (error) {
    postWorkerMessage({
      type: 'ERROR',
      message: 'Conversion failed.',
      details:
        error instanceof Error
          ? error.message
          : 'The browser could not finish processing this ZIP.',
    })
  } finally {
    running = false
    cancelRequested = false
    activeTerminators = new Set()
  }
}

type StreamParams = {
  data: Uint8Array
  fileEntries: ZipEntry[]
  options: ConversionOptions
  outputFiles: OutputZipFiles
  sections: string[]
  warnings: string[]
  recordSkipped: (entry: ZipEntry, reason: string) => void
  recordFailed: (entry: ZipEntry, reason: string) => void
  recordConverted: (entry: ZipEntry, outputPath: string) => void
  postProgress: (currentFile?: string) => void
}

function processZipStream(params: StreamParams): Promise<void> {
  const entryMap = new Map(params.fileEntries.map((entry) => [entry.path, entry]))

  return new Promise((resolve, reject) => {
    let parsingDone = false
    let activeFiles = 0
    let settled = false

    const finish = () => {
      if (!settled && (cancelRequested || (parsingDone && activeFiles === 0))) {
        settled = true
        resolve()
      }
    }

    const fail = (error: unknown) => {
      if (!settled) {
        settled = true
        reject(error)
      }
    }

    const unzip = new Unzip((file) => {
      if (cancelRequested) {
        return
      }

      const entry = entryMap.get(file.name)

      if (!entry) {
        return
      }

      if (entry.isUnsafe) {
        params.recordSkipped(entry, entry.unsafeReason ?? 'Unsafe path')
        activeFiles += 1
        drainSkippedFile(file, () => {
          activeFiles -= 1
          finish()
        })
        return
      }



      if (entry.extension === 'md') {
        // ponytail: always include markdown as-is in combined output
      }

      params.postProgress(entry.path)
      activeFiles += 1

      const chunks: Uint8Array[] = []
      let byteLength = 0
      let cleanedUp = false
      const terminate = () => file.terminate()
      activeTerminators.add(terminate)

      const cleanup = () => {
        if (cleanedUp) {
          return
        }

        cleanedUp = true
        activeFiles -= 1
        activeTerminators.delete(terminate)
        finish()
      }

      file.ondata = (error, chunk, final) => {
        if (cancelRequested) {
          cleanup()
          return
        }

        if (error) {
          params.recordFailed(entry, error.message)
          cleanup()
          return
        }

        if (chunk.length > 0) {
          chunks.push(chunk)
          byteLength += chunk.length
        }

        if (final) {
          try {
            const bytes = concatChunks(chunks, byteLength)
            const content = decodeText(bytes)
            const conversion = convertToMarkdown(entry.extension, content)
            const displayPath = params.options.preserveFolderStructure ? entry.safePath : entry.name

            params.sections.push(`## ${displayPath}\n\n${conversion.markdown}`)
            params.warnings.push(
              ...conversion.warnings.map((warning) => `${entry.path}: ${warning}`),
            )
            params.recordConverted(entry, displayPath)
          } catch (conversionError) {
            params.recordFailed(
              entry,
              conversionError instanceof Error
                ? conversionError.message
                : 'Unable to convert file',
            )
          } finally {
            cleanup()
          }
        }
      }

      try {
        file.start()
      } catch (error) {
        params.recordFailed(
          entry,
          error instanceof Error ? error.message : 'Unable to read file data',
        )
        cleanup()
      }
    })

    unzip.register(UnzipInflate)

    void pushChunks(unzip, params.data)
      .then(() => {
        parsingDone = true
        finish()
      })
      .catch(fail)
  })
}

function drainSkippedFile(file: UnzipFile, cleanup: () => void) {
  let cleanedUp = false

  const finish = () => {
    if (cleanedUp) {
      return
    }

    cleanedUp = true
    cleanup()
  }

  file.ondata = (error, _chunk, final) => {
    if (error || final || cancelRequested) {
      finish()
    }
  }

  try {
    file.start()
  } catch {
    finish()
  }
}

async function pushChunks(unzip: Unzip, data: Uint8Array): Promise<void> {
  if (data.length === 0) {
    unzip.push(data, true)
    return
  }

  for (let offset = 0; offset < data.length; offset += streamChunkBytes) {
    if (cancelRequested) {
      activeTerminators.forEach((terminate) => terminate())
      activeTerminators = new Set()
      return
    }

    const end = Math.min(offset + streamChunkBytes, data.length)
    unzip.push(data.subarray(offset, end), end === data.length)
    await yieldToWorker()
  }
}

function concatChunks(chunks: Uint8Array[], byteLength: number): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0] ?? new Uint8Array()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }

  return bytes
}

function decodeText(bytes: Uint8Array): string {
  try {
    return textDecoder.decode(bytes)
  } catch {
    return strFromU8(bytes)
  }
}


function yieldToWorker(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function postWorkerMessage(message: WorkerResponse) {
  self.postMessage(message)
}

export {}
