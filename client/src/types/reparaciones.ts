export type TipoReparacion = {
  id_tipo_reparacion: number
  nombre: string
  descripcion?: string | null
  /** Decimal viene como string desde FastAPI/Pydantic */
  precio_base?: string | null
  /** Minutos (convención actual) */
  tiempo_estimado?: number | null
}

