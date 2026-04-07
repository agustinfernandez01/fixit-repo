import type { ProductoCompra } from '../types/carrito'
import { fetchJson } from './api'

const P = '/productos'

export const productosApi = {
  list: () => fetchJson<ProductoCompra[]>(`${P}/get`),
}