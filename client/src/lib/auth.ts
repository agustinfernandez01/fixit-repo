const ACCESS_TOKEN_KEY = 'fixit_access_token'
const REFRESH_TOKEN_KEY = 'fixit_refresh_token'
export const AUTH_UPDATED_EVENT = 'fixit:auth-updated'
export const AUTH_REFRESH_STATE_EVENT = 'fixit:auth-refresh-state'

let authRefreshInProgress = false

function emitAuthUpdated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT))
}

function emitAuthRefreshState(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(AUTH_REFRESH_STATE_EVENT, {
      detail: { inProgress: authRefreshInProgress },
    }),
  )
}

export function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setAuthTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  emitAuthUpdated()
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  emitAuthUpdated()
}

export function setAuthRefreshInProgress(inProgress: boolean): void {
  authRefreshInProgress = inProgress
  emitAuthRefreshState()
}

export function isAuthRefreshInProgress(): boolean {
  return authRefreshInProgress
}

export function authHeaders(): Record<string, string> {
  const t = getAccessToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (b64.length % 4)) % 4
    const padded = b64 + '='.repeat(padLen)
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getCurrentUserRole(): string | null {
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwtPayload(token)
  const role = payload?.rol
  return typeof role === 'string' && role.trim() ? role : null
}

export function getCurrentUserProfile(): {
  nombre: string | null
  apellido: string | null
  email: string | null
  role: string | null
} | null {
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload) return null

  return {
    nombre: typeof payload.nombre === 'string' ? payload.nombre : null,
    apellido: typeof payload.apellido === 'string' ? payload.apellido : null,
    email: typeof payload.email === 'string' ? payload.email : null,
    role: typeof payload.rol === 'string' ? payload.rol : null,
  }
}

export function getCurrentUserId(): number | null {
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwtPayload(token)
  const sub = payload?.sub
  if (typeof sub === 'number' && Number.isInteger(sub)) return sub
  if (typeof sub === 'string') {
    const parsed = Number(sub)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  const idUsuario = payload?.id_usuario
  if (typeof idUsuario === 'number' && Number.isInteger(idUsuario)) return idUsuario
  return null
}
