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
  /** Catálogo tienda: una tarjeta por modelo con variantes (solo API v1). */
  listTiendaCatalogo: () => fetchJson<ProductoCompra[]>(`${V1}/catalogo/tienda`),
  /**
   * Intenta el catálogo agrupado; si falla (p. ej. esquema desactualizado), usa el listado plano.
   */
  async listTiendaCatalogoWithFallback(): Promise<{ data: ProductoCompra[]; agrupado: boolean }> {
    try {
      const [catalogoAgrupado, listadoPlano] = await Promise.all([
        fetchJson<ProductoCompra[]>(`${V1}/catalogo/tienda`),
        withLegacyFallback<ProductoCompra[]>(V1, `${LEGACY}/get`),
      ])
      // El catálogo agrupado incluye solo equipos nuevos.
      // Sumamos accesorios del listado plano para mantener filtros completos en Tienda.
      const accesorios = listadoPlano.filter((p) => p.tipo_producto === 'accesorio')
      return { data: [...catalogoAgrupado, ...accesorios], agrupado: true }
    } catch {
      const data = await withLegacyFallback<ProductoCompra[]>(V1, `${LEGACY}/get`)
      return { data, agrupado: false }
    }
  },
  get: (idProducto: number) =>
    withLegacyFallback<ProductoDetalle>(`${V1}/${idProducto}`, `${LEGACY}/get/${idProducto}`),
}