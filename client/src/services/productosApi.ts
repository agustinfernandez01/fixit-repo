import type { ProductoCompra, ProductoDetalle } from '../types/carrito'
import { fetchJson } from './api'

const LEGACY = '/productos'
const V1 = '/api/v1/productos'

async function withLegacyFallback<T>(v1Path: string, legacyPath: string): Promise<T> {
  try {
    return await fetchJson<T>(v1Path)
  } catch (error) {
    // During gradual migration, keep legacy route as fallback.
    if (error instanceof Error && /404|Not Found/i.test(error.message)) {
      return fetchJson<T>(legacyPath)
    }
    throw error
  }
}

export const productosApi = {
  list: () => withLegacyFallback<ProductoCompra[]>(V1, `${LEGACY}/get`),
  get: (idProducto: number) =>
    withLegacyFallback<ProductoDetalle>(`${V1}/${idProducto}`, `${LEGACY}/get/${idProducto}`),
}