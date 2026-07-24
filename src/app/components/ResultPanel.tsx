import type { ConversionReport, ConversionStatus } from '../../types/conversion'
import { markdownToPdfBlob } from '../../pdf/markdownToPdf'

type ResultPanelProps = {
  readonly status: Extract<ConversionStatus, 'completed' | 'cancelled'>
  readonly report: ConversionReport
  readonly downloadUrl?: string
  readonly outputFilename: string
  readonly outputContent?: string
  readonly outputBlob?: Blob
}

export function ResultPanel({
  status,
  report,
  downloadUrl,
  outputFilename,
  outputContent,
  outputBlob,
}: ResultPanelProps) {
  return (
    <section className="panel result-panel">
      <div className="result-head">
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
              onClick={async () => {
                if (!outputBlob) return
                const text = await outputBlob.text()
                const pdfBlob = markdownToPdfBlob(text)
                const url = URL.createObjectURL(pdfBlob)
                const a = document.createElement('a')
                a.href = url
                a.download = outputFilename.replace(/\.md$/i, '.pdf')
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              }}
            >
              Download PDF
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
        <output className="notice notice-warning">
          <strong>{report.skippedFiles} file{report.skippedFiles !== 1 ? 's' : ''} skipped.</strong>
          {' '}See the conversion report at the top of the downloaded <code>.md</code>.
        </output>
      ) : null}

      {outputContent ? (
        <div className="output-preview">
          <h3>Output preview</h3>
          <pre className="preview-content" tabIndex={-1}><code>{outputContent}</code></pre>
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
