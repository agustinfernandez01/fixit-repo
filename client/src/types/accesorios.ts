export type Accesorio = {
  id: number
  tipo: string
  nombre: string
  color: string
  descripcion: string
  estado: boolean
  id_producto: number
  /** Unidades disponibles (viene de `productos.stock`). */
  stock: number
  foto_url?: string | null
}

export type AccesorioCreatePayload = {
  tipo: string
  nombre: string
  color: string
  descripcion: string
  precio: number
  estado: boolean
  stock?: number
}

export type AccesorioPatchPayload = Partial<AccesorioCreatePayload> & {
  id_producto?: number | null
}