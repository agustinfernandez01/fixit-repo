/** Alineado con `app/schemas/marketplace.py` */

export type Publicacion = {
  id_publicacion: number
  id_usuario: number
  modelo: string | null
  capacidad_gb: number | null
  color: string | null
  imei: string | null
  bateria_porcentaje: number | null
  estado_estetico: string | null
  estado_funcional: string | null
  titulo: string | null
  descripcion: string | null
  precio_publicado: string | number | null
  estado: string | null
  fecha_publicacion: string | null
  fotos_urls: string[] | null
}

export type RevisionPublicacion = {
  id_revision: number
  id_publicacion: number
  estado_revision: string | null
  observaciones: string | null
  fecha_revision: string | null
}
