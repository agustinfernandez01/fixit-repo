export type CarritoProducto = {
  id: number
  nombre: string
  precio: string | number
  activo: boolean
}

export type CarritoDetalle = {
  id: number
  id_carrito: number
  id_producto: number
  cant: number
  precio_unitario: string | number
  subtotal: string | number
  producto: CarritoProducto | null
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

export type ProductoCompra = {
  id: number
  nombre: string
  descripcion: string
  precio: string | number
  id_categoria: number
  activo: boolean
}