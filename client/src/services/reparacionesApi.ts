import type { ListaPrecioReparacion, TipoReparacion } from '../types/reparaciones'
import { fetchJson } from './api'

const P = '/api/v1/reparaciones'

export const reparacionesApi = {
  tipos: {
    list: (skip = 0, limit = 50) =>
      fetchJson<TipoReparacion[]>(
        `${P}/tipos?skip=${encodeURIComponent(String(skip))}&limit=${encodeURIComponent(String(limit))}`,
      ),
    get: (id: number) => fetchJson<TipoReparacion>(`${P}/tipos/${id}`),
  },
  listaPrecios: {
    list: () => fetchJson<ListaPrecioReparacion[]>(`${P}/lista-precios`),
  },
}
