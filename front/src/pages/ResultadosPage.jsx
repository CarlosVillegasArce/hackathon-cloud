import { useMemo, useState } from 'react'
import ReclamoCard from '../components/ReclamoCard.jsx'
import ReclamoModal from '../components/ReclamoModal.jsx'
import { useReclamos } from '../hooks/useReclamos.js'

const URGENCIAS = ['Alta', 'Media', 'Baja']

export default function ResultadosPage() {
  const { items, loading, error, lastUpdated, isDemo, refetch } = useReclamos()
  const [filterUrgencia, setFilterUrgencia] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [selected, setSelected] = useState(null)

  const areas = useMemo(() => {
    const set = new Set()
    items.forEach((r) => r.area && set.add(r.area))
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (filterUrgencia && (r.urgencia || '').toLowerCase() !== filterUrgencia.toLowerCase()) {
        return false
      }
      if (filterArea && r.area !== filterArea) return false
      return true
    })
  }, [items, filterUrgencia, filterArea])

  const counts = useMemo(() => {
    return items.reduce(
      (acc, r) => {
        const k = (r.urgencia || '').toLowerCase()
        if (k === 'alta') acc.alta += 1
        else if (k === 'media') acc.media += 1
        else if (k === 'baja') acc.baja += 1
        return acc
      },
      { alta: 0, media: 0, baja: 0 },
    )
  }, [items])

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Resultados del triaje</h2>
          <p className="mt-1 text-sm text-slate-600">
            Reclamos clasificados por el motor de IA. La vista se actualiza automáticamente cada
            pocos segundos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refetch}
            className="btn-secondary"
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Refrescar'}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Urgencia alta" value={counts.alta} tone="red" />
        <StatCard label="Urgencia media" value={counts.media} tone="amber" />
        <StatCard label="Urgencia baja" value={counts.baja} tone="emerald" />
      </section>

      <section className="card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Filtrar por urgencia"
            value={filterUrgencia}
            onChange={setFilterUrgencia}
            options={URGENCIAS}
          />
          <FilterSelect
            label="Filtrar por área"
            value={filterArea}
            onChange={setFilterArea}
            options={areas}
          />
          <div className="flex items-end">
            <button
              className="btn-secondary w-full"
              onClick={() => {
                setFilterUrgencia('')
                setFilterArea('')
              }}
              disabled={!filterUrgencia && !filterArea}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <EmptyState
          title="No pudimos cargar los reclamos"
          message={error}
          hint={
            isDemo
              ? null
              : 'Verifica que el backend esté desplegado y que VITE_API_URL apunte al endpoint correcto.'
          }
          action={
            <button className="btn-primary" onClick={refetch}>
              Reintentar
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        loading ? (
          <SkeletonGrid />
        ) : (
          <EmptyState
            title={items.length === 0 ? 'Aún no hay resultados' : 'Sin coincidencias'}
            message={
              items.length === 0
                ? 'Sube un CSV de reclamos desde la sección "Subir reclamos" o espera a que el Worker procese los pendientes.'
                : 'Ningún reclamo coincide con los filtros activos.'
            }
          />
        )
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ReclamoCard key={r.id_reclamo} reclamo={r} onSelect={setSelected} />
          ))}
        </section>
      )}

      <ReclamoModal reclamo={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="">Todos</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatCard({ label, value, tone }) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function EmptyState({ title, message, hint, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="max-w-md text-sm text-slate-600">{message}</p>
      {hint && <p className="max-w-md text-xs text-slate-500">{hint}</p>}
      {action}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card animate-pulse space-y-3 p-4">
          <div className="h-3 w-1/4 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="h-3 w-full rounded bg-slate-200" />
          <div className="h-3 w-5/6 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}
