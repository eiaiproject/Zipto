import { strFromU8, Unzip, UnzipInflate, type UnzipFile } from 'fflate'
import { convertToMarkdown, isSupportedExtension } from '../converters'
import { createConversionReportMarkdown, createReport, formatConversionTimestamp } from '../report/createConversionReport'
import type {
  ConversionResult,
  UnsafePathResult,
  WorkerRequest,
  WorkerResponse,
  ZipEntry,
} from '../types/conversion'
import { readZipEntriesFromData } from '../zip/readZip'


const TEXT_DECODER = new TextDecoder()
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

async function startConversion(request: WorkerRequest & { type: 'START_CONVERSION' }) {
  running = true
  cancelRequested = false

  const startedAt = Date.now()
  const results: ConversionResult[] = []
  const warnings: string[] = []
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

  // GitHub source ZIPs hold thousands of tiny files; sending a message per
  // file floods the main thread, so progress is throttled and flushed at the end
  let lastProgressAt = 0
  let pendingProgressFile: string | undefined
  let hasPendingProgress = false
  const PROGRESS_THROTTLE_MS = 100

  const queueProgress = (currentFile?: string) => {
    pendingProgressFile = currentFile
    hasPendingProgress = true
    const now = Date.now()
    if (now - lastProgressAt < PROGRESS_THROTTLE_MS) return
    lastProgressAt = now
    hasPendingProgress = false
    postProgress(pendingProgressFile)
    pendingProgressFile = undefined
  }

  const flushProgress = () => {
    if (!hasPendingProgress) return
    hasPendingProgress = false
    lastProgressAt = Date.now()
    postProgress(pendingProgressFile)
    pendingProgressFile = undefined
  }

  const recordSkipped = (entry: ZipEntry, reason: string) => {
    processedFiles += 1
    skippedFiles += 1
    results.push({
      sourcePath: entry.path,
      status: 'skipped',
      reason,
    })
    queueProgress(entry.path)
  }

  const recordFailed = (entry: ZipEntry, reason: string) => {
    processedFiles += 1
    failedFiles += 1
    results.push({
      sourcePath: entry.path,
      status: 'failed',
      reason,
    })
    queueProgress(entry.path)
  }

  const recordConverted = (entry: ZipEntry, outputPath: string) => {
    processedFiles += 1
    convertedFiles += 1
    results.push({
      sourcePath: entry.path,
      outputPath,
      status: 'converted',
    })
    queueProgress(entry.path)
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
      sections,
      warnings,
      recordSkipped,
      recordFailed,
      recordConverted,
      postProgress: queueProgress,
    })
    flushProgress()

    const cancelled = cancelRequested && (totalFiles === 0 || processedFiles < totalFiles)
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

    const reportMarkdown = createConversionReportMarkdown(report)
    // Build the Blob from parts so the full output never exists twice as one giant string
    const blobParts: BlobPart[] = [reportMarkdown]
    for (const section of sections) blobParts.push('\n\n---\n\n', section)
    const outputBlob = new Blob(blobParts, { type: 'text/markdown;charset=utf-8' })

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
  sections: string[]
  warnings: string[]
  recordSkipped: (entry: ZipEntry, reason: string) => void
  recordFailed: (entry: ZipEntry, reason: string) => void
  recordConverted: (entry: ZipEntry, outputPath: string) => void
  postProgress: (currentFile?: string) => void
}

function createFileDataHandler(
  params: StreamParams,
  entry: ZipEntry,
  onDone: () => void,
): { ondata: UnzipFile['ondata']; terminate: () => void; cleanup: () => void } {
  const chunks: Uint8Array[] = []
  let byteLength = 0
  let cleanedUp = false
  let terminated = false

  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    onDone()
  }

  const terminate = () => {
    terminated = true
    cleanup()
  }

  const ondata: UnzipFile['ondata'] = (error, chunk, final) => {
    if (cancelRequested || terminated) {
      cleanup()
      return
    }

    if (error) {
      params.recordFailed(entry, error.message)
      cleanup()
      return
    }

    if (chunk && chunk.length > 0) {
      chunks.push(chunk)
      byteLength += chunk.length
    }

    if (final) {
      // Async because CSV parsing lazy-loads PapaParse; cleanup stays in
      // finally so the file slot is held until conversion settles
      void (async () => {
        try {
          const bytes = concatChunks(chunks, byteLength)
          const content = decodeText(bytes)
          const conversion = await convertToMarkdown(entry.extension, content)
          if (cancelRequested || terminated) return
          const displayPath = entry.safePath

          params.sections.push(`## ${displayPath}\n\n${conversion.markdown}`)
          params.warnings.push(
            ...conversion.warnings.map((warning) => `${entry.path}: ${warning}`),
          )
          params.recordConverted(entry, displayPath)
        } catch (conversionError) {
          if (cancelRequested || terminated) return
          params.recordFailed(
            entry,
            conversionError instanceof Error
              ? conversionError.message
              : 'Unable to convert file',
          )
        } finally {
          cleanup()
        }
      })()
    }
  }

  return { ondata, terminate, cleanup }
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

      if (!isSupportedExtension(entry.extension)) {
        params.recordSkipped(entry, 'Unsupported file type')
        activeFiles += 1
        drainSkippedFile(file, () => {
          activeFiles -= 1
          finish()
        })
        return
      }

      params.postProgress(entry.path)
      activeFiles += 1

      const handle = createFileDataHandler(params, entry, () => {
        activeFiles -= 1
        finish()
      })
      file.ondata = handle.ondata
      activeTerminators.add(handle.terminate)

      try {
        file.start()
      } catch (error) {
        params.recordFailed(
          entry,
          error instanceof Error ? error.message : 'Unable to read file data',
        )
        handle.cleanup()
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

  await pushChunkAt(unzip, data, 0)
}

async function pushChunkAt(unzip: Unzip, data: Uint8Array, offset: number): Promise<void> {
  if (cancelRequested) {
    activeTerminators.forEach((terminate) => terminate())
    activeTerminators = new Set()
    return
  }

  const end = Math.min(offset + streamChunkBytes, data.length)
  const isLast = end === data.length
  unzip.push(data.subarray(offset, end), isLast)
  if (isLast) return
  await yieldToWorker()
  return pushChunkAt(unzip, data, end)
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
    return TEXT_DECODER.decode(bytes)
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




