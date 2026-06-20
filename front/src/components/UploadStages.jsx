const STAGES = [
  { id: 'requesting', label: 'Solicitando URL prefirmada' },
  { id: 'uploading', label: 'Subiendo a S3' },
  { id: 'queued', label: 'Encolando para procesamiento' },
  { id: 'done', label: 'Listo' },
]

export default function UploadStages({ current }) {
  const currentIdx = STAGES.findIndex((s) => s.id === current)

  return (
    <ol className="space-y-2">
      {STAGES.map((stage, idx) => {
        const state =
          idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'pending'
        return (
          <li key={stage.id} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                state === 'done'
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : state === 'active'
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {state === 'done' ? '✓' : idx + 1}
            </span>
            <span
              className={
                state === 'pending'
                  ? 'text-slate-400'
                  : state === 'active'
                    ? 'font-medium text-brand-800'
                    : 'text-slate-700'
              }
            >
              {stage.label}
              {state === 'active' && <span className="ml-2 animate-pulse">…</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
