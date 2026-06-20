import { useRef, useState } from 'react'

export default function CsvDropzone({ onFileSelected, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files) {
    const file = files?.[0]
    if (!file) return
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      onFileSelected(null, 'El archivo debe tener extensión .csv')
      return
    }
    onFileSelected(file, null)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (disabled) return
        handleFiles(e.dataTransfer.files)
      }}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
          : dragging
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-slate-300 bg-white text-slate-600 hover:border-brand-400 hover:bg-slate-50'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-3 h-10 w-10"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="text-sm font-medium">
        Arrastra tu archivo CSV aquí o{' '}
        <button
          type="button"
          className="text-brand-700 underline-offset-4 hover:underline disabled:no-underline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          selecciónalo
        </button>
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Debe incluir las columnas <code className="rounded bg-slate-100 px-1">id_reclamo</code>{' '}
        y <code className="rounded bg-slate-100 px-1">texto</code>.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
    </div>
  )
}
