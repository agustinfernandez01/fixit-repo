import { fetchJson } from './api'
import type { EquipoOfrecidoCanje } from '../types/canje'

const P = '/api/v1/canje'

export const canjeApi = {
  equiposOfrecidos: {
    list: (skip = 0, limit = 50, activo?: boolean | null) => {
      const params = new URLSearchParams({
        skip: String(skip),
        limit: String(limit),
      })
      if (activo !== undefined && activo !== null) {
        params.set('activo', String(activo))
      }
      return fetchJson<EquipoOfrecidoCanje[]>(`${P}/equipos-ofrecidos?${params.toString()}`)
    },
  },
}
