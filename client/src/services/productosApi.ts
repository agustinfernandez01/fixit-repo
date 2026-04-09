import type { ProductoCompra, ProductoDetalle } from '../types/carrito'
import { fetchJson } from './api'

const P = '/productos'

export const productosApi = {
  list: () => fetchJson<ProductoCompra[]>(`${P}/get`),
  get: (idProducto: number) => fetchJson<ProductoDetalle>(`${P}/get/${idProducto}`),
}