import type { Accesorio, AccesorioCreatePayload, AccesorioPatchPayload } from '../types/accesorios'
import { apiUrl, fetchJson } from './api'

const P = '/api/v1/accesorios'
const COLLECTION = `${P}/`

async function _uploadFotoMultipart(url: string, files: File[], field: string): Promise<Accesorio> {
  const fd = new FormData()
  for (const f of files) fd.append(field, f)
  const res = await fetch(apiUrl(url), { method: 'POST', body: fd })
  const text = await res.text()
  if (!res.ok) {
    let detail = res.statusText
    try { const j = JSON.parse(text) as { detail?: string }; if (typeof j.detail === 'string') detail = j.detail } catch { if (text) detail = text }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return text ? (JSON.parse(text) as Accesorio) : (undefined as unknown as Accesorio)
}

export const accesoriosApi = {
  list: () => fetchJson<Accesorio[]>(COLLECTION),
  get: (id: number) => fetchJson<Accesorio>(`${P}/${id}`),
  create: (body: AccesorioCreatePayload) =>
    fetchJson<Accesorio>(COLLECTION, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patch: (id: number, body: AccesorioPatchPayload) =>
    fetchJson<Accesorio>(`${P}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: number) => fetchJson<void>(`${P}/${id}`, { method: 'DELETE' }),
  uploadFoto: (id: number, file: File) =>
    _uploadFotoMultipart(`${P}/${id}/foto`, [file], 'foto'),
  uploadFotos: (id: number, files: File[]) =>
    _uploadFotoMultipart(`${P}/${id}/fotos`, files, 'fotos'),
  deleteFotos: (id: number) => fetchJson<void>(`${P}/${id}/fotos`, { method: 'DELETE' }),
}