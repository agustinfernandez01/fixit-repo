import type { UsuarioPerfil, UsuarioRegistroRequest, UsuarioRegistroResponse } from '../types/usuario'
import { authHeaders } from '../lib/auth'
import { fetchJson } from './api'

export const usuarioApi = {
  me: () => fetchJson<UsuarioPerfil>('/api/v1/auth/me', { headers: authHeaders() }),
  register: (body: UsuarioRegistroRequest) =>
    fetchJson<UsuarioRegistroResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}