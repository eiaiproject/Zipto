import { useRef, useState } from 'react'

type UploadDropzoneProps = {
  readonly disabled?: boolean
  readonly onFileSelected: (file: File) => void
}

export function UploadDropzone({
  disabled = false,
  onFileSelected,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) {
      onFileSelected(file)
    }
  }

  return (
    <section
      className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
      aria-label="ZIP upload"
      onDragEnter={(event) => {
        event.preventDefault()
        if (!disabled) {
          dragCounter.current++
          setIsDragging(true)
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        dragCounter.current--
        if (dragCounter.current <= 0) {
          dragCounter.current = 0
          setIsDragging(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        dragCounter.current = 0
        if (!disabled) {
          handleFiles(event.dataTransfer.files)
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        hidden
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />
      <div className="dropzone-text">
        <p className="dropzone-title">Drop a ZIP archive here</p>
        <p className="dropzone-copy">
          Text, Markdown, HTML, CSV, JSON, code files, and more.
        </p>
      </div>
      <button
        type="button"
        className="button button-primary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose ZIP file
      </button>
    </section>
  )
}
