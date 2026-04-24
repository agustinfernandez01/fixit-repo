import type { UsuarioPerfil, UsuarioRegistroRequest, UsuarioRegistroResponse } from '../types/usuario'
import { authHeaders } from '../lib/auth'
import { fetchJson } from './api'

const LEGACY = '/usuarios/me'
const V1 = '/api/v1/auth/me'

async function withLegacyFallback<T>(v1Path: string, legacyPath: string): Promise<T> {
  try {
    return await fetchJson<T>(v1Path, { headers: authHeaders() })
  } catch (error) {
    if (error instanceof Error && /404|Not Found/i.test(error.message)) {
      return fetchJson<T>(legacyPath, { headers: authHeaders() })
    }
    throw error
  }
}

export const usuarioApi = {
  me: () => withLegacyFallback<UsuarioPerfil>(V1, LEGACY),
  register: (body: UsuarioRegistroRequest) =>
    fetchJson<UsuarioRegistroResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}