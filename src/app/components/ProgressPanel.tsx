import type { ConversionProgress } from '../../types/conversion'

type ProgressPanelProps = {
  progress: ConversionProgress
  cancelRequested: boolean
  onCancel: () => void
}

export function ProgressPanel({
  progress,
  cancelRequested,
  onCancel,
}: ProgressPanelProps) {
  const percent =
    progress.totalFiles > 0
      ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
      : 0

  return (
    <section className="panel progress-panel" aria-live="polite">
      <div className="panel-header">
        <div>
          <p className="section-label">Progress</p>
          <h2>{cancelRequested ? 'Cancelling...' : 'Converting files'}</h2>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={cancelRequested}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      <div className="progress-track" aria-label={`${percent}% processed`}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <dl className="summary-grid progress-grid">
        <div>
          <dt>Total files</dt>
          <dd>{progress.totalFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Processed</dt>
          <dd>{progress.processedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Converted</dt>
          <dd>{progress.convertedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd>{progress.skippedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{progress.failedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{formatElapsed(progress.elapsedMs)}</dd>
        </div>
      </dl>

      <p className="current-file">
        <span>Current file</span>
        <code>{progress.currentFile ?? 'Preparing ZIP...'}</code>
      </p>
    </section>
  )
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
