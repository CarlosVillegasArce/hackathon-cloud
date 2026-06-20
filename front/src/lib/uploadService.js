import { PRESIGN_URL, isDemoMode } from './env.js'
import { resetDemoBatch } from './demoData.js'

/**
 * Sube un CSV directamente a S3 usando una URL prefirmada (presigned URL)
 * que solicita al backend. Si está activo el modo demo, simula el flujo
 * sin contactar al backend.
 *
 * Flujo real esperado:
 *   1) POST {PRESIGN_URL} con { filename } -> { uploadUrl, key }
 *   2) PUT {uploadUrl} con el archivo (Content-Type: text/csv)
 *
 * @param {object} args
 * @param {File}   args.file       Archivo CSV.
 * @param {(stage: 'requesting'|'uploading'|'queued', detail?: object) => void} [args.onProgress]
 * @returns {Promise<{ key: string, demo: boolean }>}
 */
export async function uploadCsv({ file, onProgress }) {
  if (!file) throw new Error('No se recibió ningún archivo.')

  if (isDemoMode()) {
    return runDemoUpload({ file, onProgress })
  }

  if (!PRESIGN_URL) {
    throw new Error(
      'No hay endpoint de presigned URL configurado. Define VITE_PRESIGN_URL en .env o activa VITE_DEMO_MODE=true.',
    )
  }

  onProgress?.('requesting')
  const presignRes = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: 'text/csv' }),
  })

  if (!presignRes.ok) {
    const detail = await safeText(presignRes)
    throw new Error(
      `No se pudo obtener la URL prefirmada (${presignRes.status}). ${detail}`,
    )
  }

  const { uploadUrl, key } = await presignRes.json()
  if (!uploadUrl) {
    throw new Error('La respuesta de presigned URL no incluye uploadUrl.')
  }

  onProgress?.('uploading')
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/csv' },
    body: file,
  })

  if (!putRes.ok) {
    const detail = await safeText(putRes)
    throw new Error(`La subida a S3 falló (${putRes.status}). ${detail}`)
  }

  onProgress?.('queued', { key })
  return { key, demo: false }
}

async function runDemoUpload({ file, onProgress }) {
  resetDemoBatch()
  onProgress?.('requesting')
  await wait(600)
  onProgress?.('uploading')
  await wait(900)
  onProgress?.('queued', { key: `demo/${Date.now()}-${file.name}` })
  return { key: `demo/${file.name}`, demo: true }
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
