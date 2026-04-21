import { apiUrl, fetchJson } from './api'
import { authHeaders } from '../lib/auth'
import type {
  CotizacionCanje,
  CotizarCanjeRequest,
  CotizarCanjeResponse,
  CotizacionCanjeCreate,
  CotizacionCanjeUpdate,
  EquipoOfrecidoCanje,
  EquipoOfrecidoCanjeCreate,
  ModeloCanje,
  ModeloCanjeCreate,
  ModeloCanjeUpdate,
  PresupuestoCanjeRequest,
  PresupuestoCanjeResponse,
  SolicitudCanje,
  SolicitudCanjeAdminResponse,
  SolicitudCanjeDecisionRequest,
  SolicitudCanjeCreate,
} from '../types/canje'

const P = '/api/v1/canje'

export const canjeApi = {
  modelos: {
    list: (skip = 0, limit = 50, activo?: boolean | null) => {
      const params = new URLSearchParams({
        skip: String(skip),
        limit: String(limit),
      })
      if (activo !== undefined && activo !== null) {
        params.set('activo', String(activo))
      }
      return fetchJson<ModeloCanje[]>(`${P}/modelos?${params.toString()}`)
    },
    create: (body: ModeloCanjeCreate) =>
      fetchJson<ModeloCanje>(`${P}/modelos`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: ModeloCanjeUpdate) =>
      fetchJson<ModeloCanje>(`${P}/modelos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/modelos/${id}`, {
        method: 'DELETE',
      }),
    uploadFoto: async (id: number, file: File) => {
      const fd = new FormData()
      fd.append('foto', file)
      const res = await fetch(apiUrl(`${P}/modelos/${id}/foto`), {
        method: 'POST',
        body: fd,
      })
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
      return text ? (JSON.parse(text) as ModeloCanje) : (undefined as unknown as ModeloCanje)
    },
  },
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
    create: (body: EquipoOfrecidoCanjeCreate) =>
      fetchJson<EquipoOfrecidoCanje>(`${P}/equipos-ofrecidos`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      }),
  },
  cotizaciones: {
    list: (id_modelo_canje?: number | null, activo?: boolean | null) => {
      const params = new URLSearchParams()
      if (id_modelo_canje !== undefined && id_modelo_canje !== null) {
        params.set('id_modelo_canje', String(id_modelo_canje))
      }
      if (activo !== undefined && activo !== null) {
        params.set('activo', String(activo))
      }
      const suffix = params.toString() ? `?${params.toString()}` : ''
      return fetchJson<CotizacionCanje[]>(`${P}/cotizaciones${suffix}`)
    },
    create: (body: CotizacionCanjeCreate) =>
      fetchJson<CotizacionCanje>(`${P}/cotizaciones`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (id: number, body: CotizacionCanjeUpdate) =>
      fetchJson<CotizacionCanje>(`${P}/cotizaciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchJson<void>(`${P}/cotizaciones/${id}`, {
        method: 'DELETE',
      }),
  },
  presupuesto: {
    calcular: (body: PresupuestoCanjeRequest) =>
      fetchJson<PresupuestoCanjeResponse>(`${P}/presupuesto`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  cotizador: {
    cotizar: (body: CotizarCanjeRequest) =>
      fetchJson<CotizarCanjeResponse>(`${P}/cotizar`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  solicitudes: {
    create: (body: SolicitudCanjeCreate) =>
      fetchJson<SolicitudCanje>(`${P}/solicitudes`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      }),
  },
  solicitudesAdmin: {
    list: (skip = 0, limit = 50, estado?: string | null) => {
      const params = new URLSearchParams({
        skip: String(skip),
        limit: String(limit),
      })
      if (estado) params.set('estado', estado)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      return fetchJson<SolicitudCanjeAdminResponse[]>(`${P}/solicitudes-admin${suffix}`, {
        headers: {
          ...authHeaders(),
        },
      })
    },
    completar: (id: number, body: SolicitudCanjeDecisionRequest) =>
      fetchJson<SolicitudCanjeAdminResponse>(`${P}/solicitudes-admin/${id}/completar`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      }),
    rechazar: (id: number, body: SolicitudCanjeDecisionRequest) =>
      fetchJson<SolicitudCanjeAdminResponse>(`${P}/solicitudes-admin/${id}/rechazar`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      }),
  },
}
