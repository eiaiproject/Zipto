import type { ConversionProgress } from '../../types/conversion'

type ProgressPanelProps = {
  readonly progress: ConversionProgress
  readonly cancelRequested: boolean
  readonly onCancel: () => void
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
    <section className="panel progress-panel" aria-label="Conversion progress">
      <div className="progress-head">
        <p className="progress-headline">
          {cancelRequested ? 'Cancelling…' : `Converting — ${percent}%`}
        </p>
        <p className="progress-sub">
          {progress.processedFiles} of {progress.totalFiles} files · {formatElapsed(progress.elapsedMs)} elapsed
        </p>
        <span className="sr-only" aria-live="polite">{percent}% processed — {progress.processedFiles} of {progress.totalFiles} files</span>
      </div>

      <progress className="progress-track" value={percent} max={100} aria-label={`${percent}% processed`} />

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
          <dt>Elapsed</dt>
          <dd>{formatElapsed(progress.elapsedMs)}</dd>
        </div>
      </dl>

      <p className="current-file">
        <span>Current file</span>
        <code>{progress.currentFile ?? 'Preparing ZIP…'}</code>
      </p>

      <button
        type="button"
        className="button button-secondary"
        style={{ justifySelf: 'end' }}
        disabled={cancelRequested}
        onClick={onCancel}
      >
        {cancelRequested ? 'Cancelling…' : 'Cancel conversion'}
      </button>
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
