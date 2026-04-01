import type { Publicacion, RevisionPublicacion } from '../types/marketplace'
import { authHeaders } from '../lib/auth'
import { apiUrl, fetchJson } from './api'

const P = '/api/v1/marketplace'

const q = (skip: number, limit: number) =>
  `?skip=${skip}&limit=${limit}`

export async function uploadMarketplaceFoto(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(apiUrl('/api/v1/marketplace/upload-foto'), {
    method: 'POST',
    body: fd,
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (typeof j.detail === 'string') msg = j.detail
    } catch {
      if (text) msg = text
    }
    throw new Error(msg)
  }
  const j = JSON.parse(text) as { url: string }
  return j.url
}

export const marketplaceApi = {
  publicaciones: {
    list: (skip = 0, limit = 50, estado?: string | null) => {
      const params = new URLSearchParams({
        skip: String(skip),
        limit: String(limit),
      })
      if (estado) params.set('estado', estado)
      return fetchJson<Publicacion[]>(`${P}/publicaciones?${params.toString()}`)
    },
    get: (id: number) =>
      fetchJson<Publicacion>(`${P}/publicaciones/${id}`),
    /** `withAuth: true` envía Bearer para asociar la publicación al usuario logueado. */
    create: (body: Record<string, unknown>, opts?: { withAuth?: boolean }) =>
      fetchJson<Publicacion>(`${P}/publicaciones`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: opts?.withAuth ? { ...authHeaders() } : undefined,
      }),
    patch: (id: number, body: Record<string, unknown>) =>
      fetchJson<Publicacion>(`${P}/publicaciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/publicaciones/${id}`, { method: 'DELETE' }),
  },
  revisiones: {
    list: (skip = 0, limit = 50) =>
      fetchJson<RevisionPublicacion[]>(`${P}/revisiones${q(skip, limit)}`),
    get: (id: number) =>
      fetchJson<RevisionPublicacion>(`${P}/revisiones/${id}`),
    create: (body: Record<string, unknown>) =>
      fetchJson<RevisionPublicacion>(`${P}/revisiones`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: Record<string, unknown>) =>
      fetchJson<RevisionPublicacion>(`${P}/revisiones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/revisiones/${id}`, { method: 'DELETE' }),
  },
}
