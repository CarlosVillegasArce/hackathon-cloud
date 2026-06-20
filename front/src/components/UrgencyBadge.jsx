const STYLES = {
  alta: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  media: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  baja: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
}

export default function UrgencyBadge({ value }) {
  const key = String(value || '').toLowerCase()
  const cls = STYLES[key] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-300'
  return <span className={`badge ${cls}`}>{value || 'Sin clasificar'}</span>
}
