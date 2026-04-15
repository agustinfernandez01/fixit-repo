import type { UsuarioPerfil } from '../types/usuario'
import { authHeaders } from '../lib/auth'
import { fetchJson } from './api'

const P = '/usuarios'

export const usuarioApi = {
  me: () => fetchJson<UsuarioPerfil>(`${P}/me`, { headers: authHeaders() }),
}