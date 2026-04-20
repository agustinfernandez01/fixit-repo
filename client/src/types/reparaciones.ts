export type TipoReparacion = {
  id_tipo_reparacion: number
  nombre: string
  descripcion?: string | null
  /** Decimal viene como string desde FastAPI/Pydantic */
  precio_base?: string | null
  /** Minutos (convención actual) */
  tiempo_estimado?: number | null
}

export type CategoriaListaSlug =
  | 'modulo_pantalla'
  | 'bateria'
  | 'camara_principal'
  | 'flex_carga'
  | 'tapas_traseras'

export type ListaPrecioReparacion = {
  id_lista_precio: number
  categoria: CategoriaListaSlug
  modelo: string
  orden: number
  precio_usd_original?: string | null
  precio_ars_original?: string | null
  precio_usd_alternativo?: string | null
  precio_ars_alternativo?: string | null
}

export type ReparacionCarritoProductoRequest = {
  categoria: string
  modelo: string
  precio_ars?: string | number | null
  precio_usd?: string | number | null
}

export type ReparacionCarritoProductoResponse = {
  id_producto: number
  nombre: string
  /** Decimal viene como string desde FastAPI/Pydantic */
  precio_ars: string
  /** Decimal viene como string desde FastAPI/Pydantic */
  precio_usd?: string | null
}
