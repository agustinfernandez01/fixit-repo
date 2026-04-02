import type {
  Deposito,
  Equipo,
  EquipoConModelo,
  EquipoDeposito,
  EquipoUsadoDetalle,
  ModeloEquipo,
} from '../types/inventario'
import { fetchJson } from './api'

const P = '/api/v1/inventario'

const q = (skip: number, limit: number) =>
  `?skip=${skip}&limit=${limit}`

export const inventarioApi = {

  modelos: {
    list: (skip = 0, limit = 50) =>
      fetchJson<ModeloEquipo[]>(`${P}/modelos${q(skip, limit)}`),
    get: (id: number) => fetchJson<ModeloEquipo>(`${P}/modelos/${id}`),
    create: (body: Record<string, unknown>) =>
      fetchJson<ModeloEquipo>(`${P}/modelos`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: Record<string, unknown>) =>
      fetchJson<ModeloEquipo>(`${P}/modelos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/modelos/${id}`, { method: 'DELETE' }),
  },

  equipos: {
    list: (skip = 0, limit = 50) =>
      (void skip, void limit, fetchJson<EquipoConModelo[]>(`/equipos/get`)),
    get: (id: number) => fetchJson<EquipoConModelo>(`${P}/equipos/${id}`),
    create: (body: Record<string, unknown>) =>
      fetchJson<Equipo>(`${P}/equipos`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: Record<string, unknown>) =>
      fetchJson<Equipo>(`${P}/equipos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/equipos/${id}`, { method: 'DELETE' }),
  },

  depositos: {
    list: (skip = 0, limit = 50) =>
      fetchJson<Deposito[]>(`${P}/depositos${q(skip, limit)}`),
    get: (id: number) => fetchJson<Deposito>(`${P}/depositos/${id}`),
    create: (body: Record<string, unknown>) =>
      fetchJson<Deposito>(`${P}/depositos`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: Record<string, unknown>) =>
      fetchJson<Deposito>(`${P}/depositos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/depositos/${id}`, { method: 'DELETE' }),
  },

  equipoDeposito: {
    list: (skip = 0, limit = 50) =>
      fetchJson<EquipoDeposito[]>(`${P}/equipo-deposito${q(skip, limit)}`),
    get: (id: number) =>
      fetchJson<EquipoDeposito>(`${P}/equipo-deposito/${id}`),
    create: (body: Record<string, unknown>) =>
      fetchJson<EquipoDeposito>(`${P}/equipo-deposito`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: Record<string, unknown>) =>
      fetchJson<EquipoDeposito>(`${P}/equipo-deposito/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/equipo-deposito/${id}`, { method: 'DELETE' }),
  },
  
  equiposUsadosDetalle: {
    list: (skip = 0, limit = 50) =>
      fetchJson<EquipoUsadoDetalle[]>(
        `${P}/equipos-usados-detalle${q(skip, limit)}`,
      ),
    get: (id: number) =>
      fetchJson<EquipoUsadoDetalle>(`${P}/equipos-usados-detalle/${id}`),
    create: (body: Record<string, unknown>) =>
      fetchJson<EquipoUsadoDetalle>(`${P}/equipos-usados-detalle`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: Record<string, unknown>) =>
      fetchJson<EquipoUsadoDetalle>(
        `${P}/equipos-usados-detalle/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
      ),
    delete: (id: number) =>
      fetchJson<void>(`${P}/equipos-usados-detalle/${id}`, {
        method: 'DELETE',
      }),
  },
}
