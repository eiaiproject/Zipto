import type { ConversionReport, ConversionStatus } from '../../types/conversion'

type ResultPanelProps = {
  status: Extract<ConversionStatus, 'completed' | 'cancelled'>
  report: ConversionReport
  downloadUrl?: string
  outputFilename: string
}

export function ResultPanel({
  status,
  report,
  downloadUrl,
  outputFilename,
}: ResultPanelProps) {
  return (
    <section className="panel result-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Result</p>
          <h2>{status === 'completed' ? 'Conversion completed' : 'Conversion cancelled'}</h2>
        </div>
        {downloadUrl ? (
          <a className="button button-primary" href={downloadUrl} download={outputFilename}>
            Download output ZIP
          </a>
        ) : null}
      </div>

      <dl className="summary-grid">
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

      <div className="report-summary">
        <h3>Conversion report summary</h3>
        <p>
          The output ZIP includes <code>conversion-report.md</code> with skipped
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
