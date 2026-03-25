/**
 * Base URL vacía en dev: Vite reenvía `/api` al backend (vite.config).
 * En producción: `VITE_API_BASE=https://tu-api.com`
 */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE ?? ''
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = JSON.parse(text) as { detail?: string | unknown }
      if (typeof j.detail === 'string') detail = j.detail
      else if (j.detail) detail = JSON.stringify(j.detail)
    } catch {
      if (text) detail = text
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
