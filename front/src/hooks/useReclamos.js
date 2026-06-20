import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchReclamos } from '../lib/reclamosService.js'

const POLL_INTERVAL_MS = 6000

export function useReclamos({ enabled = true } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isDemo, setIsDemo] = useState(false)
  const controllerRef = useRef(null)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const { items: data, demo } = await fetchReclamos({ signal: controller.signal })
      setItems(data)
      setIsDemo(demo)
      setLastUpdated(new Date())
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || 'No se pudo cargar los reclamos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    load()
    timerRef.current = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      clearInterval(timerRef.current)
      controllerRef.current?.abort()
    }
  }, [enabled, load])

  return { items, loading, error, lastUpdated, isDemo, refetch: load }
}
