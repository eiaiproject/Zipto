import type { UnsafePathResult, ZipEntry } from '../../types/conversion'

type ZipSummaryProps = {
  file: File
  entries: ZipEntry[]
  unsafePaths: UnsafePathResult[]
  onConvert: () => void
}

export function ZipSummary({
  file,
  entries,
  unsafePaths,
  onConvert,
}: ZipSummaryProps) {
  const files = entries.filter((entry) => !entry.isDirectory)
  const previewEntries = entries.slice(0, 80)
  const remainingEntries = entries.length - previewEntries.length

  return (
    <section className="panel zip-summary">
      <div className="zip-summary-head">
        <div>
          <h2 className="zip-summary-filename">{file.name}</h2>
          <p className="zip-summary-meta">Ready to convert</p>
        </div>
        <button
          type="button"
          className="button button-primary zip-summary-action"
          disabled={files.length === 0}
          onClick={onConvert}
        >
          Convert to Markdown
        </button>
      </div>

      <dl className="summary-grid">
        <div>
          <dt>Compressed size</dt>
          <dd>{formatBytes(file.size)}</dd>
        </div>
        <div>
          <dt>Detected entries</dt>
          <dd>{entries.length.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Detected files</dt>
          <dd>{files.length.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Unsafe paths</dt>
          <dd>{unsafePaths.length.toLocaleString()}</dd>
        </div>
      </dl>

      <p className="notice notice-warning">
        Large archives may take a while and use significant memory. You can cancel at any time.
      </p>

      <ul className="file-list" aria-label="ZIP file list">
        {previewEntries.map((entry) => (
          <li
            className={`file-row ${entry.isUnsafe ? 'is-unsafe' : ''}`}
            key={`${entry.path}-${entry.compressedSize ?? 0}`}
          >
            <span>{entry.isDirectory ? 'Folder' : entry.extension || 'File'}</span>
            <code>{entry.path}</code>
          </li>
        ))}
      </ul>
      {remainingEntries > 0 ? (
        <p className="file-list-more">
          {remainingEntries.toLocaleString()} more entries not shown in this preview.
        </p>
      ) : null}
    </section>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 10 ? 1 : 2,
  })} ${units[index]}`
}
