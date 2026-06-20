import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

let counter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (toast) => {
      const id = ++counter
      const item = { id, type: 'info', duration: 4500, ...toast }
      setToasts((prev) => [...prev, item])
      if (item.duration > 0) {
        setTimeout(() => remove(id), item.duration)
      }
      return id
    },
    [remove],
  )

  const api = {
    success: (message, opts) => push({ ...opts, message, type: 'success' }),
    error: (message, opts) => push({ ...opts, message, type: 'error' }),
    info: (message, opts) => push({ ...opts, message, type: 'info' }),
    dismiss: remove,
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto w-full max-w-sm rounded-md border px-4 py-3 shadow-md ${toneClasses(t.type)}`}
          role={t.type === 'error' ? 'alert' : 'status'}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg leading-none">{toneIcon(t.type)}</span>
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function toneClasses(type) {
  switch (type) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900'
    case 'error':
      return 'border-red-200 bg-red-50 text-red-900'
    default:
      return 'border-slate-200 bg-white text-slate-800'
  }
}

function toneIcon(type) {
  switch (type) {
    case 'success':
      return '✓'
    case 'error':
      return '!'
    default:
      return 'i'
  }
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
