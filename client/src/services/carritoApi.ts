import { authHeaders } from '../lib/auth'
import { emitCartChanged, getCartToken } from '../lib/cart'
import { fetchJson } from './api'
import type {
  Carrito,
  CarritoCheckoutPayload,
  CarritoCheckoutResponse,
  CarritoDetalle,
  CarritoResumen,
} from '../types/carrito'

const P = '/api/v1/carrito'

function cartHeaders(withAuth = false): Record<string, string> {
  return {
    'X-Carrito-Token': getCartToken(),
    ...(withAuth ? authHeaders() : {}),
  }
}

export const carritoApi = {
  ensure: (withAuth = false) =>
    fetchJson<Carrito>(P, {
      method: 'POST',
      headers: cartHeaders(withAuth),
    }),
  summary: (withAuth = false) =>
    fetchJson<CarritoResumen>(P, {
      method: 'GET',
      headers: cartHeaders(withAuth),
    }),
  items: (withAuth = false) =>
    fetchJson<CarritoDetalle[]>(`${P}/items`, {
      method: 'GET',
      headers: cartHeaders(withAuth),
    }),
  addItem: async (idProducto: number, cant = 1, withAuth = false) => {
    const summary = await fetchJson<CarritoResumen>(`${P}/items`, {
      method: 'POST',
      headers: cartHeaders(withAuth),
      body: JSON.stringify({ id_producto: idProducto, cant }),
    })
    emitCartChanged({ totalUnidades: summary.total_unidades, summary })
    return summary
  },
  updateItem: async (detalleId: number, cant: number, withAuth = false) => {
    const summary = await fetchJson<CarritoResumen>(`${P}/items/${detalleId}`, {
      method: 'PATCH',
      headers: cartHeaders(withAuth),
      body: JSON.stringify({ cant }),
    })
    emitCartChanged({ totalUnidades: summary.total_unidades, summary })
    return summary
  },
  removeItem: async (detalleId: number, withAuth = false) => {
    const summary = await fetchJson<CarritoResumen>(`${P}/items/${detalleId}`, {
      method: 'DELETE',
      headers: cartHeaders(withAuth),
    })
    emitCartChanged({ totalUnidades: summary.total_unidades, summary })
    return summary
  },
  clear: async (withAuth = false) => {
    const summary = await fetchJson<CarritoResumen>(`${P}/items`, {
      method: 'DELETE',
      headers: cartHeaders(withAuth),
    })
    emitCartChanged({ totalUnidades: summary.total_unidades, summary })
    return summary
  },
  checkout: async (payload: CarritoCheckoutPayload, withAuth = true) => {
    const result = await fetchJson<CarritoCheckoutResponse>(`${P}/checkout`, {
      method: 'POST',
      headers: cartHeaders(withAuth),
      body: JSON.stringify(payload),
    })
    emitCartChanged({ totalUnidades: 0 })
    return result
  },
}