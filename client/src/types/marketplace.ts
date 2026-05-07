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
  tiene_caja: boolean | null
  tiene_cargador: boolean | null
  vendedor_nombre: string | null
  vendedor_telefono: string | null
}

export type RevisionPublicacion = {
  id_revision: number
  id_publicacion: number
  estado_revision: string | null
  observaciones: string | null
  fecha_revision: string | null
}

export type InteresPublicacion = {
  id_interes: number
  id_publicacion: number
  id_usuario_interesado: number
  mensaje: string | null
  estado: string | null
  fecha_interes: string | null
  comprador_nombre: string | null
  comprador_email: string | null
  comprador_telefono: string | null
  publicacion_titulo: string | null
  publicacion_modelo: string | null
  whatsapp_url: string | null
}
