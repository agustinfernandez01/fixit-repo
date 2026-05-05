export type CarritoProducto = {
  id: number
  nombre: string
  precio: string | number
  activo: boolean
  tipo_producto?: 'equipo' | 'accesorio' | null
  id_origen?: number | null
  foto_url?: string | null
}

export type CarritoDetalle = {
  id: number
  id_carrito: number
  id_producto: number
  cant: number
  precio_unitario: string | number
  subtotal: string | number
  producto: CarritoProducto | null
  /** Unidades vendibles para este producto (tope para cantidad en carrito). */
  stock_disponible?: number
}

export type Carrito = {
  id: number
  id_usuario: number | null
  id_pedido: number | null
  token_identificador: string | null
  estado: boolean
  fecha_creacion: string
}

export type CarritoResumen = {
  carrito: Carrito
  items: CarritoDetalle[]
  total_unidades: number
  total_importe: string | number
}

export type CarritoCheckoutPayload = {
  metodo_pago: string
  observaciones?: string | null
}

export type CarritoCheckoutResponse = {
  id_pedido: number
  id_pago: number
  estado_pedido: string
  estado_pago: string
  referencia_externa: string | null
  whatsapp_url: string
  total: string | number
  mensaje: string
}

export type VarianteTienda = {
  id_producto: number
  color?: string | null
  precio: number
  precio_usd?: number | null
  foto_url?: string | null
  nombre_corto?: string | null
  stock?: number | null
  disponible?: boolean
  atributos?: Record<string, string>
}

export type VarianteAtributoDisponible = {
  code: string
  label: string
  options: string[]
}

export type ProductoCompra = {
  id: number
  nombre: string
  descripcion: string | null
  foto_url?: string | null
  precio: string | number
  precio_usd?: string | number | null
  id_categoria: number
  activo: boolean
  tipo_producto?: 'equipo' | 'accesorio' | null
  id_origen?: number | null
  tipo_equipo?: string | null
  estado_comercial?: string | null
  /** Catálogo tienda agrupado (backend): variantes por unidad / color */
  tipo_catalogo?: 'grupo_equipo' | string | null
  id_modelo?: number | null
  /** Accesorios: stock numérico en `productos`; equipos: suele venir de variantes */
  stock?: number | null
  variantes_tienda?: VarianteTienda[] | null
}

export type ProductoEquipoDetalle = {
  id_equipo: number
  id_modelo?: number | null
  nombre_modelo?: string | null
  capacidad_gb?: number | null
  color?: string | null
  tipo_equipo?: string | null
  estado_comercial?: string | null
  foto_url?: string | null
}

export type ProductoAccesorioDetalle = {
  id_accesorio: number
  tipo: string
  nombre: string
  color?: string | null
  descripcion?: string | null
  estado: boolean
}

export type ProductoDetalle = ProductoCompra & {
  detalle_equipo?: ProductoEquipoDetalle | null
  detalle_accesorio?: ProductoAccesorioDetalle | null
  variantes_tienda?: VarianteTienda[] | null
  atributos_disponibles?: VarianteAtributoDisponible[] | null
}