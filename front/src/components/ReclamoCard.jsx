import UrgencyBadge from './UrgencyBadge.jsx'

export default function ReclamoCard({ reclamo, onSelect }) {
  return (
    <button
      onClick={() => onSelect(reclamo)}
      className="card flex w-full flex-col gap-3 p-4 text-left transition hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            #{reclamo.id_reclamo}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{reclamo.tipo}</p>
        </div>
        <UrgencyBadge value={reclamo.urgencia} />
      </div>
      <p className="text-sm text-slate-700 line-clamp-3">{reclamo.resumen}</p>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="truncate">{reclamo.area}</span>
        <span className="text-brand-700">Ver detalle →</span>
      </div>
    </button>
  )
}
