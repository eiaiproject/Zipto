import { useRef, useState, type MutableRefObject } from 'react'
import type { ConversionReport, ConversionStatus } from '../../types/conversion'
import type { PdfWorkerRequest, PdfWorkerResponse } from '../../worker/pdf.worker'

type ResultPanelProps = {
  readonly status: Extract<ConversionStatus, 'completed' | 'cancelled'>
  readonly report: ConversionReport
  readonly downloadUrl?: string
  readonly outputFilename: string
  readonly outputContent?: string
  readonly outputBlob?: Blob
}

const PDF_WARN_BYTES = 10 * 1024 * 1024

export function ResultPanel({
  status,
  report,
  downloadUrl,
  outputFilename,
  outputContent,
  outputBlob,
}: ResultPanelProps) {
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError] = useState<string>()
  const pdfWorkerRef = useRef<Worker | undefined>(undefined)

  async function handlePdfDownload() {
    if (!outputBlob || pdfGenerating) return
    setPdfGenerating(true)
    setPdfError(undefined)
    try {
      const blob = await generatePdfInWorker(outputBlob, pdfWorkerRef)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = toPdfFilename(outputFilename)
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke after a delay so Safari/Firefox can finish starting the download
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF.')
    } finally {
      setPdfGenerating(false)
    }
  }

  const showPdfWarning = (outputBlob?.size ?? 0) > PDF_WARN_BYTES

  return (
    <section className="panel result-panel">
      <div className="result-head">
        {/* Text marks carry the outcome (done vs paused); no icon set needed. */}
        <span className={`result-tick ${status === 'cancelled' ? 'is-cancelled' : ''}`} aria-hidden="true">
          {status === 'completed' ? '✓' : '⏸'}
        </span>
        <h2 className="result-title">
          {status === 'completed' ? 'Conversion complete' : 'Conversion cancelled'}
        </h2>
        <div className="result-actions" style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          {downloadUrl ? (
            <a
              className="button button-primary result-action"
              href={downloadUrl}
              download={outputFilename}
            >
              Download Markdown
            </a>
          ) : null}
          {outputBlob ? (
            <button
              className="button button-secondary result-action"
              type="button"
              disabled={pdfGenerating}
              onClick={() => void handlePdfDownload()}
            >
              {pdfGenerating ? 'Generating PDF…' : 'Download PDF'}
            </button>
          ) : null}
        </div>
      </div>

      <dl className="summary-grid result-grid">
        <div>
          <dt>Total files</dt>
          <dd>{report.totalFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Processed</dt>
          <dd>{report.processedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Converted</dt>
          <dd>{report.convertedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd>{report.skippedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{report.failedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Unsafe paths</dt>
          <dd>{report.unsafePaths.length.toLocaleString()}</dd>
        </div>
      </dl>

      {report.skippedFiles > 0 ? (
        <div className="notice notice-warning" role="status">
          <strong>{report.skippedFiles} file{report.skippedFiles !== 1 ? 's' : ''} skipped.</strong>
          {' '}See the conversion report at the top of the downloaded <code>.md</code>.
        </div>
      ) : null}

      {showPdfWarning ? (
        <div className="notice notice-warning" role="status">
          Output is large ({formatBytes(outputBlob?.size ?? 0)}). PDF generation runs in the
          background and may take a while.
        </div>
      ) : null}

      {pdfError ? (
        <div className="notice notice-danger" role="alert">
          <strong>PDF generation failed.</strong>
          <p>{pdfError}</p>
        </div>
      ) : null}

      {outputContent ? (
        <div className="output-preview">
          <h3>Output preview</h3>
          <pre className="preview-content" tabIndex={0}><code>{outputContent}</code></pre>
        </div>
      ) : null}

      <div className="report-summary">
        <h3>Conversion report</h3>
        <p>
          The first section of the downloaded <code>.md</code> file lists skipped
          files, failed files, unsafe paths, and warnings.
        </p>
        {report.warnings.length > 0 ? (
          <ul>
            {report.warnings.slice(0, 5).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

function toPdfFilename(outputFilename: string): string {
  return /\.md$/i.test(outputFilename)
    ? outputFilename.replace(/\.md$/i, '.pdf')
    : `${outputFilename}.pdf`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[index]}`
}

function generatePdfInWorker(
  blob: Blob,
  workerRef: MutableRefObject<Worker | undefined>,
): Promise<Blob> {
  workerRef.current?.terminate()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../worker/pdf.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    const timeout = window.setTimeout(() => {
      worker.terminate()
      workerRef.current = undefined
      reject(new Error('PDF generation timed out. Try a smaller archive.'))
    }, 120_000)
    worker.onmessage = (event: MessageEvent<PdfWorkerResponse>) => {
      window.clearTimeout(timeout)
      worker.terminate()
      workerRef.current = undefined
      if (event.data.type === 'PDF_DONE') resolve(event.data.blob)
      else reject(new Error(event.data.message))
    }
    worker.onerror = () => {
      window.clearTimeout(timeout)
      worker.terminate()
      workerRef.current = undefined
      reject(new Error('PDF worker crashed.'))
    }
    const request: PdfWorkerRequest = { type: 'GENERATE_PDF', blob }
    worker.postMessage(request)
  })
}
