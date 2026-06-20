export const API_URL = import.meta.env.VITE_API_URL || ''
export const PRESIGN_URL = import.meta.env.VITE_PRESIGN_URL || ''
export const BUCKET_NAME = import.meta.env.VITE_BUCKET_NAME || ''

export function isDemoMode() {
  const flag = import.meta.env.VITE_DEMO_MODE
  if (flag === undefined) return !API_URL && !PRESIGN_URL
  return String(flag).toLowerCase() === 'true'
}
