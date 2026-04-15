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
  incluye_caja: boolean
  incluye_cargador: boolean
  observaciones: string | null
  fecha_registro: string | null
  activo: boolean
}
