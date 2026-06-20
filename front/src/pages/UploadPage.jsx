import { useState } from 'react'
import Papa from 'papaparse'
import { useNavigate } from 'react-router-dom'
import CsvDropzone from '../components/CsvDropzone.jsx'
import CsvPreview, { validateCsvHeaders } from '../components/CsvPreview.jsx'
import UploadStages from '../components/UploadStages.jsx'
import { uploadCsv } from '../lib/uploadService.js'
import { useToast } from '../context/ToastContext.jsx'

const PREVIEW_ROWS = 5

export default function UploadPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [parseError, setParseError] = useState(null)
  const [validation, setValidation] = useState({ ok: false, missing: [] })
  const [stage, setStage] = useState(null) // null | 'requesting' | 'uploading' | 'queued' | 'done'
  const [uploadError, setUploadError] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)

  function resetAll() {
    setFile(null)
    setHeaders([])
    setPreviewRows([])
    setTotalRows(0)
    setParseError(null)
    setValidation({ ok: false, missing: [] })
    setStage(null)
    setUploadError(null)
    setUploadResult(null)
  }

  function handleFile(selected, error) {
    if (error) {
      toast.error(error)
      return
    }
    resetAll()
    setFile(selected)
    if (!selected) return

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors?.length) {
          const first = results.errors[0]
          setParseError(`Error al leer el CSV: ${first.message}`)
          toast.error('No se pudo parsear el CSV. Revisa el formato.')
          return
        }
        const hdrs = results.meta.fields || []
        const rows = results.data || []
        setHeaders(hdrs)
        setPreviewRows(rows.slice(0, PREVIEW_ROWS))
        setTotalRows(rows.length)
        const v = validateCsvHeaders(hdrs)
        setValidation(v)
        if (!v.ok) {
          toast.error(`Falta(n) columna(s) obligatoria(s): ${v.missing.join(', ')}`)
        }
      },
      error: (err) => {
        setParseError(`Error al leer el CSV: ${err.message}`)
        toast.error('No se pudo leer el archivo.')
      },
    })
  }

  async function handleUpload() {
    if (!file || !validation.ok) return
    setUploadError(null)
    try {
      const result = await uploadCsv({ file, onProgress: setStage })
      setStage('done')
      setUploadResult(result)
      toast.success(
        result.demo
          ? 'Carga simulada (modo demo). Ya puedes ver los resultados.'
          : 'Archivo subido. Los reclamos se están procesando en segundo plano.',
      )
    } catch (err) {
      console.error(err)
      setUploadError(err.message || 'Error desconocido al subir el archivo.')
      setStage(null)
      toast.error(err.message || 'Error al subir el archivo.')
    }
  }

  const uploading = stage !== null && stage !== 'done'
  const canUpload = file && validation.ok && !uploading && stage !== 'done'

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Subir reclamos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Carga un archivo CSV con los reclamos a triajear. Cada fila será procesada por el
          motor de IA y derivada al área correspondiente.
        </p>
      </section>

      <CsvDropzone onFileSelected={handleFile} disabled={uploading} />

      {parseError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {parseError}
        </div>
      )}

      {file && headers.length > 0 && (
        <CsvPreview headers={headers} rows={previewRows} totalRows={totalRows} />
      )}

      {file && (
        <div className="card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-slate-500">
                {formatBytes(file.size)} · {totalRows} filas detectadas
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                onClick={resetAll}
                disabled={uploading}
              >
                Quitar archivo
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={!canUpload}
              >
                {uploading ? 'Subiendo…' : 'Iniciar procesamiento'}
              </button>
            </div>
          </div>

          {(stage || uploadError) && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              {uploadError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {uploadError}
                </div>
              ) : (
                <UploadStages current={stage} />
              )}
            </div>
          )}

          {stage === 'done' && uploadResult && (
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">¡Listo!</p>
                <p>
                  Key del archivo:{' '}
                  <code className="rounded bg-white px-1 text-xs">{uploadResult.key}</code>
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => navigate('/resultados')}
              >
                Ver resultados
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
