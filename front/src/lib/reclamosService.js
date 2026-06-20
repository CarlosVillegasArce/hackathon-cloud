import { API_URL, isDemoMode } from './env.js'
import { nextDemoBatch } from './demoData.js'

/**
 * Obtiene los reclamos procesados. Hace GET a `${API_URL}/reclamos`.
 * En modo demo devuelve un lote local creciente para simular el avance del Worker.
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ items: Array, demo: boolean }>}
 */
export async function fetchReclamos({ signal } = {}) {
  if (isDemoMode()) {
    await wait(400)
    return { items: nextDemoBatch(), demo: true }
  }

  if (!API_URL) {
    throw new Error(
      'No hay endpoint de reclamos configurado. Define VITE_API_URL en .env o activa VITE_DEMO_MODE=true.',
    )
  }

  const url = joinUrl(API_URL, '/reclamos')
  const res = await fetch(url, { signal })

  if (!res.ok) {
    const detail = await safeText(res)
    throw new Error(`GET /reclamos falló (${res.status}). ${detail}`.trim())
  }

  const data = await res.json()
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return { items, demo: false }
}

function joinUrl(base, path) {
  if (!base) return path
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function safeText(res) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}
