/** Alineado con `app/schemas/inventario.py` (respuestas API). */

export type ModeloEquipo = {
  id_modelo: number
  nombre_modelo: string
  capacidad_gb: number | null
  color: string | null
  descripcion: string | null
  activo: boolean
}

export type Equipo = {
  id_equipo: number
  id_modelo: number
  imei: string | null
  tipo_equipo: string | null
  estado_comercial: string | null
  activo: boolean
  id_producto: number | null
  fecha_ingreso: string | null
  foto_url: string | null
}

export type EquipoConModelo = Equipo & {
  modelo: ModeloEquipo
}

export type Deposito = {
  id_deposito: number
  nombre: string
  direccion: string | null
  descripcion: string | null
  activo: boolean
}

export type EquipoDeposito = {
  id_equipo_deposito: number
  id_equipo: number
  id_deposito: number
  fecha_asignacion: string | null
}

export type EquipoUsadoDetalle = {
  id_detalle_usado: number
  id_equipo: number
  bateria_porcentaje: number | null
  estado_estetico: string | null
  estado_funcional: string | null
  detalle_pantalla: string | null
  detalle_carcasa: string | null
  incluye_caja: boolean
  incluye_cargador: boolean
  observaciones: string | null
}
