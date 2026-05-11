import type { ProductoCompra, ProductoDetalle } from '../types/carrito'
import { fetchJson } from './api'

const V1 = '/api/v1/productos'

export const productosApi = {
  list: () => fetchJson<ProductoCompra[]>(V1),
  /** Catálogo tienda: una tarjeta por modelo con variantes. */
  listTiendaCatalogo: () => fetchJson<ProductoCompra[]>(`${V1}/catalogo/tienda`),
  /**
   * Intenta el catálogo agrupado; si falla (p. ej. esquema desactualizado), usa el listado plano.
   */
  async listTiendaCatalogoWithFallback(): Promise<{ data: ProductoCompra[]; agrupado: boolean }> {
    try {
      const [catalogoAgrupado, listadoPlano] = await Promise.all([
        fetchJson<ProductoCompra[]>(`${V1}/catalogo/tienda`),
        fetchJson<ProductoCompra[]>(V1),
      ])
      // El catálogo agrupado incluye solo equipos nuevos.
      // Sumamos accesorios del listado plano para mantener filtros completos en Tienda.
      const accesorios = listadoPlano.filter((p) => p.tipo_producto === 'accesorio')
      return { data: [...catalogoAgrupado, ...accesorios], agrupado: true }
    } catch {
      const data = await fetchJson<ProductoCompra[]>(V1)
      return { data, agrupado: false }
    }
  },
  get: (idProducto: number) => fetchJson<ProductoDetalle>(`${V1}/${idProducto}`),
}