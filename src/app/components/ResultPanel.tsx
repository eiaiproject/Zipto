import type { ConversionReport, ConversionStatus } from '../../types/conversion'

type ResultPanelProps = {
  status: Extract<ConversionStatus, 'completed' | 'cancelled'>
  report: ConversionReport
  downloadUrl?: string
  outputFilename: string
  outputContent?: string
}

export function ResultPanel({
  status,
  report,
  downloadUrl,
  outputFilename,
  outputContent,
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
        {downloadUrl ? (
          <a
            className="button button-primary result-action"
            href={downloadUrl}
            download={outputFilename}
          >
            Download Markdown
          </a>
        ) : null}
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
            {report.warnings.slice(0, 5).map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
