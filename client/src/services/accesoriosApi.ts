import type { Accesorio, AccesorioCreatePayload, AccesorioPatchPayload } from '../types/accesorios'
import { fetchJson } from './api'

const P = '/api/v1/accesorios'
const COLLECTION = `${P}/`

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
}