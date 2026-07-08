import { useEffect, useRef, useState } from 'react'
import { ErrorPanel } from './components/ErrorPanel'
import { ProgressPanel } from './components/ProgressPanel'
import { ResultPanel } from './components/ResultPanel'
import { UploadDropzone } from './components/UploadDropzone'
import { ZipSummary } from './components/ZipSummary'
import './styles/app.css'
import type {
  ConversionOptions,
  ConversionProgress,
  ConversionReport,
  ConversionStatus,
  UnsafePathResult,
  WorkerRequest,
  WorkerResponse,
  ZipEntry,
} from '../types/conversion'
import { readZipEntries } from '../zip/readZip'

type AppError = {
  message: string
  details?: string
}

const defaultOptions: ConversionOptions = {
  preserveFolderStructure: true,
  includeConversionReport: true,
  copyMarkdownFiles: true,
  skipUnsupportedFiles: true,
  addTitleFromFilename: false,
}

function App() {
  const [status, setStatus] = useState<ConversionStatus>('idle')
  const [sourceFile, setSourceFile] = useState<File>()
  const [entries, setEntries] = useState<ZipEntry[]>([])
  const [unsafePaths, setUnsafePaths] = useState<UnsafePathResult[]>([])
  const [error, setError] = useState<AppError>()
  const [progress, setProgress] = useState<ConversionProgress>()
  const [report, setReport] = useState<ConversionReport>()
  const [downloadUrl, setDownloadUrl] = useState<string>()
  const [outputFilename, setOutputFilename] = useState('markdown-output.zip')
  const [cancelRequested, setCancelRequested] = useState(false)
  const workerRef = useRef<Worker | undefined>(undefined)
  const downloadUrlRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      revokeDownloadUrl()
    }
  }, [])

  async function handleFileSelected(file: File) {
    workerRef.current?.terminate()
    workerRef.current = undefined
    revokeDownloadUrl()
    setError(undefined)
    setEntries([])
    setUnsafePaths([])
    setSourceFile(undefined)
    setProgress(undefined)
    setReport(undefined)
    setDownloadUrl(undefined)
    setCancelRequested(false)

    if (!isZipFile(file)) {
      setStatus('failed')
      setError({
        message: 'Select a ZIP file.',
        details: 'The selected file does not look like a .zip archive.',
      })
      return
    }

    setStatus('reading')
    setSourceFile(file)

    try {
      const result = await readZipEntries(file)
      setEntries(result.entries)
      setUnsafePaths(result.unsafePaths)
      setStatus('ready')
    } catch (readError) {
      setStatus('failed')
      setSourceFile(undefined)
      setError({
        message: 'The ZIP could not be read.',
        details:
          readError instanceof Error
            ? readError.message
            : 'The archive may be corrupt or unsupported by this browser.',
      })
    }
  }

  function startConversion() {
    if (!sourceFile) {
      return
    }

    workerRef.current?.terminate()
    revokeDownloadUrl()
    setDownloadUrl(undefined)
    setReport(undefined)
    setError(undefined)
    setCancelRequested(false)
    setStatus('converting')
    setProgress({
      status: 'converting',
      totalFiles: entries.filter((entry) => !entry.isDirectory).length,
      processedFiles: 0,
      convertedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      elapsedMs: 0,
    })

    const worker = new Worker(new URL('../worker/conversion.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      handleWorkerMessage(event.data)
    }

    worker.onerror = (event) => {
      setStatus('failed')
      setError({
        message: 'The conversion worker stopped unexpectedly.',
        details: event.message,
      })
      cleanupWorker()
    }

    const request: WorkerRequest = {
      type: 'START_CONVERSION',
      file: sourceFile,
      options: defaultOptions,
    }
    worker.postMessage(request)
  }

  function handleWorkerMessage(message: WorkerResponse) {
    switch (message.type) {
      case 'ZIP_READ_PROGRESS':
        return
      case 'PROGRESS':
        setProgress(message.progress)
        return
      case 'COMPLETED':
        handleWorkerResult('completed', message.outputBlob, message.report)
        return
      case 'CANCELLED':
        handleWorkerResult('cancelled', message.partialOutputBlob, message.report)
        return
      case 'ERROR':
        setStatus('failed')
        setError({
          message: message.message,
          details: message.details,
        })
        cleanupWorker()
        return
    }
  }

  function handleWorkerResult(
    nextStatus: Extract<ConversionStatus, 'completed' | 'cancelled'>,
    outputBlob: Blob | undefined,
    nextReport: ConversionReport | undefined,
  ) {
    setStatus(nextStatus)
    setCancelRequested(false)

    if (nextReport) {
      setReport(nextReport)
      setProgress(reportToProgress(nextReport, nextStatus))
    }

    if (outputBlob && sourceFile) {
      const url = URL.createObjectURL(outputBlob)
      downloadUrlRef.current = url
      setDownloadUrl(url)
      setOutputFilename(createOutputFilename(sourceFile.name))
    }

    cleanupWorker()
  }

  function cancelConversion() {
    if (!workerRef.current || cancelRequested) {
      return
    }

    setCancelRequested(true)
    const request: WorkerRequest = { type: 'CANCEL' }
    workerRef.current.postMessage(request)
  }

  function cleanupWorker() {
    workerRef.current?.terminate()
    workerRef.current = undefined
  }

  function revokeDownloadUrl() {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current)
      downloadUrlRef.current = undefined
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img src="/pwa-icon.svg" alt="" width="40" height="40" />
          <div>
            <p className="eyebrow">Local-first PWA</p>
            <h1>ZIP to Markdown Converter</h1>
          </div>
        </div>
        <p className={`status-pill status-${status}`}>{getStatusLabel(status)}</p>
      </header>

      <section className="intro">
        <p>
          Convert supported files inside a ZIP archive into Markdown and export
          a new ZIP with the original folder structure preserved.
        </p>
        <p className="privacy-note">
          All files are processed locally in your browser. Nothing is uploaded
          to a server.
        </p>
      </section>

      <div className="workspace">
        <UploadDropzone
          disabled={status === 'reading' || status === 'converting'}
          onFileSelected={handleFileSelected}
        />

        {status === 'reading' ? (
          <section className="panel state-panel" aria-live="polite">
            Reading ZIP structure...
          </section>
        ) : null}

        <ErrorPanel message={error?.message} details={error?.details} />

        {sourceFile && status === 'ready' ? (
          <ZipSummary
            file={sourceFile}
            entries={entries}
            unsafePaths={unsafePaths}
            onConvert={startConversion}
          />
        ) : null}

        {status === 'converting' && progress ? (
          <ProgressPanel
            progress={progress}
            cancelRequested={cancelRequested}
            onCancel={cancelConversion}
          />
        ) : null}

        {(status === 'completed' || status === 'cancelled') && report ? (
          <ResultPanel
            status={status}
            report={report}
            downloadUrl={downloadUrl}
            outputFilename={outputFilename}
          />
        ) : null}
      </div>
    </main>
  )
}

function isZipFile(file: File): boolean {
  const hasZipName = file.name.toLowerCase().endsWith('.zip')
  const hasZipType =
    file.type === 'application/zip' || file.type === 'application/x-zip-compressed'

  return hasZipName || hasZipType
}

function createOutputFilename(sourceName: string): string {
  return `${sourceName.replace(/\.zip$/i, '')}-markdown.zip`
}

function reportToProgress(
  report: ConversionReport,
  status: ConversionStatus,
): ConversionProgress {
  return {
    status,
    totalFiles: report.totalFiles,
    processedFiles: report.processedFiles,
    convertedFiles: report.convertedFiles,
    skippedFiles: report.skippedFiles,
    failedFiles: report.failedFiles,
    elapsedMs: 0,
  }
}

function getStatusLabel(status: ConversionStatus): string {
  const labels: Record<ConversionStatus, string> = {
    idle: 'Idle',
    reading: 'Reading ZIP',
    ready: 'Ready',
    converting: 'Converting',
    completed: 'Completed',
    cancelled: 'Cancelled',
    failed: 'Failed',
  }

  return labels[status]
}

export default App
