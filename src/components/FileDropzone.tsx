import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react'

type Props = {
  onFileText: (fileName: string, text: string) => void
  disabled?: boolean
}

export function FileDropzone({ onFileText, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      onFileText(file.name, text)
    },
    [onFileText],
  )

  const onBrowseClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const onChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      await handleFile(file)
      // allow re-uploading same file
      e.target.value = ''
    },
    [handleFile],
  )

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    if (disabled) return
    setIsDragging(true)
  }, [disabled])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files?.[0]
      if (!file) return
      await handleFile(file)
    },
    [disabled, handleFile],
  )

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--dragging' : ''} ${disabled ? 'dropzone--disabled' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-disabled={disabled ? 'true' : 'false'}
      onClick={disabled ? undefined : onBrowseClick}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') onBrowseClick()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <div className="dropzone__title">Drop your CSV here, or click to choose a file</div>
      <div className="dropzone__hint">Everything stays in your browser.</div>
    </div>
  )
}

