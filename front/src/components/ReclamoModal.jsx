import { useEffect } from 'react'
import UrgencyBadge from './UrgencyBadge.jsx'

export default function ReclamoModal({ reclamo, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!reclamo) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/50 p-4 pt-16"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reclamo-modal-title"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Reclamo #{reclamo.id_reclamo}
            </p>
            <h3 id="reclamo-modal-title" className="text-lg font-semibold text-slate-900">
              {reclamo.tipo}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Urgencia">
              <UrgencyBadge value={reclamo.urgencia} />
            </Field>
            <Field label="Área de derivación">
              <span className="text-sm text-slate-800">{reclamo.area}</span>
            </Field>
          </div>

          <Field label="Resumen ejecutivo">
            <p className="text-sm text-slate-800">{reclamo.resumen}</p>
          </Field>

          <Field label="Texto original">
            <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {reclamo.texto_original}
            </p>
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
