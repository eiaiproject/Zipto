import { useRef, useState } from 'react'

type UploadDropzoneProps = {
  disabled?: boolean
  onFileSelected: (file: File) => void
}

export function UploadDropzone({
  disabled = false,
  onFileSelected,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

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
          setIsDragging(true)
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        setIsDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
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
      <div>
        <p className="dropzone-title">Drop a ZIP archive here</p>
        <p className="dropzone-copy">
          TXT, MD, HTML, CSV, JSON, XML, YAML, and LOG files can be converted.
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
