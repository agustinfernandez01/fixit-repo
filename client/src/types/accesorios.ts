export type Accesorio = {
  id: number
  tipo: string
  nombre: string
  color: string
  descripcion: string
  estado: boolean
  id_producto: number
  foto_url?: string | null
}

export type AccesorioCreatePayload = {
  tipo: string
  nombre: string
  color: string
  descripcion: string
  precio: number
  estado: boolean
}

export type AccesorioPatchPayload = Partial<AccesorioCreatePayload> & {
  id_producto?: number | null
}