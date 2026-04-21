export type EquipoOfrecidoCanje = {
  id_equipo_ofrecido: number
  id_usuario: number
  modelo: string | null
  capacidad_gb: number | null
  color: string | null
  imei: string | null
  bateria_porcentaje: number | null
  estado_estetico: string | null
  estado_funcional: string | null
  detalle_pantalla: string | null
  detalle_carcasa: string | null
  foto_url: string | null
  fotos_urls: string[]
  incluye_caja: boolean
  incluye_cargador: boolean
  observaciones: string | null
  fecha_registro: string | null
  activo: boolean
}

export type EquipoOfrecidoCanjeCreate = {
  id_usuario: number
  modelo?: string | null
  capacidad_gb?: number | null
  color?: string | null
  imei?: string | null
  bateria_porcentaje?: number | null
  estado_estetico?: string | null
  estado_funcional?: string | null
  detalle_pantalla?: string | null
  detalle_carcasa?: string | null
  foto_url?: string | null
  incluye_caja?: boolean
  incluye_cargador?: boolean
  observaciones?: string | null
  activo?: boolean
}

export type ModeloCanje = {
  id_modelo_canje: number
  nombre_modelo: string
  capacidad_gb: number | null
  foto_url: string | null
  activo: boolean
}

export type ModeloCanjeCreate = {
  nombre_modelo: string
  capacidad_gb?: number | null
  foto_url?: string | null
  activo?: boolean
}

export type ModeloCanjeUpdate = Partial<ModeloCanjeCreate>

export type CotizacionCanje = {
  id_cotizacion: number
  id_modelo_canje: number
  bateria_min: number
  bateria_max: number
  valor_toma: number
  activo: boolean
}

export type CotizacionCanjeCreate = {
  id_modelo_canje: number
  bateria_min: number
  bateria_max: number
  valor_toma: number
  activo?: boolean
}

export type CotizacionCanjeUpdate = Partial<CotizacionCanjeCreate>

export type PresupuestoCanjeRequest = {
  id_equipo_ofrecido: number
  id_producto_interes: number
}

export type ResultadoCotizacionCanje =
  | 'APROBADO'
  | 'BATERIA_INVALIDA'
  | 'MODELO_NO_ENCONTRADO'
  | 'PRODUCTO_NO_ENCONTRADO'
  | 'COTIZACION_NO_DISPONIBLE'
  | 'SIN_DIFERENCIA'

export type CotizarCanjeRequest = {
  id_modelo_canje: number
  bateria_porcentaje: number
  id_producto_interes: number
}

export type CotizarCanjeResponse = {
  codigo_resultado: ResultadoCotizacionCanje
  mensaje_usuario: string
  aprobado: boolean
  id_modelo_canje: number | null
  bateria_porcentaje: number
  id_producto_interes: number
  valor_toma: number | null
  precio_producto_interes: number | null
  diferencia_a_pagar: number
}

export type PresupuestoCanjeResponse = {
  id_equipo_ofrecido: number
  id_producto_interes: number
  id_modelo_canje: number
  bateria_porcentaje: number
  valor_toma: number
  precio_producto_interes: number
  diferencia_a_pagar: number
  aprobado: boolean
  motivo_rechazo: string | null
}

export type SolicitudCanje = {
  id_solicitud_canje: number
  id_usuario: number
  id_equipo_ofrecido: number
  id_producto_interes: number
  valor_estimado: number | null
  diferencia_a_pagar: number | null
  metodo_pago: string | null
  estado: string | null
  fecha_solicitud: string | null
  fecha_respuesta: string | null
}

export type SolicitudCanjeCreate = {
  id_usuario: number
  id_equipo_ofrecido: number
  id_producto_interes: number
  metodo_pago?: string | null
}

export type SolicitudCanjeAdminResponse = {
  id_solicitud_canje: number
  id_usuario: number
  cliente_nombre: string | null
  cliente_email: string | null
  id_equipo_ofrecido: number
  equipo_modelo: string | null
  equipo_capacidad_gb: number | null
  equipo_color: string | null
  equipo_bateria_porcentaje: number | null
  equipo_estado_estetico: string | null
  equipo_estado_funcional: string | null
  equipo_foto_url: string | null
  equipo_fotos_urls: string[]
  id_producto_interes: number
  producto_interes_nombre: string | null
  producto_interes_precio: number | null
  producto_interes_activo: boolean | null
  valor_estimado: number | null
  diferencia_a_pagar: number | null
  metodo_pago: string | null
  estado: string | null
  fecha_solicitud: string | null
  fecha_respuesta: string | null
  observaciones: string | null
}

export type SolicitudCanjeDecisionRequest = {
  metodo_pago?: string | null
}
