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
    // El catálogo agrupado incluye solo equipos nuevos; los accesorios salen del
    // listado plano. Antes las dos descargas eran en paralelo **siempre**, así que
    // el listado plano completo viajaba dos veces (una entera, otra para filtrar
    // accesorios). Ahora el plano solo se pide si el agrupado funcionó, y si el
    // agrupado falla se reusa esa misma respuesta como fallback.
    let catalogoAgrupado: ProductoCompra[] | null = null
    try {
      catalogoAgrupado = await fetchJson<ProductoCompra[]>(`${V1}/catalogo/tienda`)
    } catch {
      catalogoAgrupado = null
    }

    const listadoPlano = await fetchJson<ProductoCompra[]>(V1)
    if (catalogoAgrupado === null) {
      return { data: listadoPlano, agrupado: false }
    }
    const accesorios = listadoPlano.filter((p) => p.tipo_producto === 'accesorio')
    return { data: [...catalogoAgrupado, ...accesorios], agrupado: true }
  },
  get: (idProducto: number) => fetchJson<ProductoDetalle>(`${V1}/${idProducto}`),
}