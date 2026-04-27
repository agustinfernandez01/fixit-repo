import type { ProductoCompra } from '../types/carrito'

export function normalizeCatalogText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function isRepairProduct(producto: ProductoCompra): boolean {
  const name = normalizeCatalogText(producto.nombre)
  const desc = normalizeCatalogText(producto.descripcion ?? '')
  return (
    name.startsWith('reparación') ||
    name.startsWith('reparacion') ||
    name.includes('reparación -') ||
    name.includes('reparacion -') ||
    desc.includes('servicio de reparación') ||
    desc.includes('servicio de reparacion')
  )
}

export function getProductCondition(producto: ProductoCompra): 'nuevo' | 'usado' {
  const estado = normalizeCatalogText(producto.estado_comercial)
  if (estado === 'nuevo' || estado === 'usado') {
    return estado
  }
  const tipoEquipo = normalizeCatalogText(producto.tipo_equipo)
  const nombre = normalizeCatalogText(producto.nombre)
  if (
    tipoEquipo.includes('usad') ||
    tipoEquipo.includes('reacond') ||
    tipoEquipo.includes('semi') ||
    nombre.includes('usado') ||
    nombre.includes('reacondicionado') ||
    nombre.endsWith('- usado')
  ) {
    return 'usado'
  }
  return 'nuevo'
}

export function isUsedProduct(producto: ProductoCompra): boolean {
  return getProductCondition(producto) === 'usado'
}
