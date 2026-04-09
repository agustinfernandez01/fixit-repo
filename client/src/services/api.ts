import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from '../lib/auth'

/**
 * Base URL vacía en dev: Vite reenvía `/api` al backend (vite.config).
 * En producción: `VITE_API_BASE=https://tu-api.com`
 */
/** Errores 422 de FastAPI: lista de { loc, msg, type } */
function formatFastApiValidation(
  items: Array<{ loc?: unknown[]; msg?: string }>,
): string {
  return items
    .map((item) => {
      const loc = Array.isArray(item.loc)
        ? item.loc.filter((x) => x !== 'body' && x !== 'query').join('.')
        : ''
      const msg = item.msg ?? 'Error de validación'
      return loc ? `${loc}: ${msg}` : msg
    })
    .join(' · ')
}

/** URL absoluta para /uploads/... (proxy en dev o VITE_API_BASE en prod). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = import.meta.env.VITE_API_BASE ?? ''
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE ?? ''
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

type RefreshResponse = {
  access_token: string
  refresh_token: string
  token_type: string
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    const out: Record<string, string> = {}
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return headers
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false

  try {
    const res = await fetch(
      apiUrl(`/refresh/post?refresh_token=${encodeURIComponent(refresh)}`),
      { method: 'POST' },
    )
    if (!res.ok) {
      clearAuthTokens()
      return false
    }
    const text = await res.text()
    if (!text) {
      clearAuthTokens()
      return false
    }
    const j = JSON.parse(text) as RefreshResponse
    if (!j.access_token || !j.refresh_token) {
      clearAuthTokens()
      return false
    }
    setAuthTokens(j.access_token, j.refresh_token)
    return true
  } catch {
    clearAuthTokens()
    return false
  }
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseHeaders = normalizeHeaders(init?.headers)

  async function doRequest() {
    return fetch(apiUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...baseHeaders,
      },
    })
  }

  let res = await doRequest()
  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken()
    if (refreshed) {
      const access = getAccessToken()
      const authHeader: Record<string, string> = access
        ? { Authorization: `Bearer ${access}` }
        : {}
      res = await fetch(apiUrl(path), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...baseHeaders,
          ...authHeader,
        },
      })
    }
  }
  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = JSON.parse(text) as { detail?: string | unknown }
      if (typeof j.detail === 'string') {
        detail = j.detail
      } else if (Array.isArray(j.detail)) {
        detail = formatFastApiValidation(j.detail)
      } else if (j.detail) {
        detail = JSON.stringify(j.detail)
      }
    } catch {
      if (text) detail = text
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
