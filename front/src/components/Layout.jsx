import { NavLink, Outlet } from 'react-router-dom'
import { isDemoMode } from '../lib/env.js'

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-700 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export default function Layout() {
  const demo = isDemoMode()
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-700 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 5h16M4 12h10M4 19h7" />
                <path d="M17 16l4 4-4 4" transform="translate(0 -7)" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                Triaje Inteligente de Reclamos
              </h1>
              <p className="text-xs text-slate-500">
                Clasificación asistida por IA para atención ciudadana
              </p>
            </div>
          </div>
          <nav className="flex gap-1" aria-label="Navegación principal">
            <NavLink to="/upload" className={navLinkClass}>
              Subir reclamos
            </NavLink>
            <NavLink to="/resultados" className={navLinkClass}>
              Ver resultados
            </NavLink>
          </nav>
        </div>
        {demo && (
          <div className="border-t border-amber-200 bg-amber-50">
            <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-amber-900 sm:px-6">
              <strong>Modo demo activo:</strong> las subidas y consultas se simulan
              localmente. Configura <code className="rounded bg-amber-100 px-1">VITE_DEMO_MODE=false</code>{' '}
              y las URLs reales en <code className="rounded bg-amber-100 px-1">.env</code> para
              conectar al backend.
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-500 sm:px-6">
          Plataforma de triaje · Hackathon 2026
        </div>
      </footer>
    </div>
  )
}
