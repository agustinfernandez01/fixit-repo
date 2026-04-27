/** Alineado con `app/schemas/inventario.py` (respuestas API). */

export type ModeloEquipo = {
  id: number
  id_modelo?: number
  nombre_modelo: string
  capacidad_gb: number | null
  descripcion?: string | null
  activo: boolean
  atributos?: ModeloAtributo[]
}

export type ModeloAtributoOpcion = {
  id: number
  id_atributo: number
  valor: string
  label: string
  color_hex?: string | null
  orden: number
  activo: boolean
}

export type ModeloAtributo = {
  id: number
  id_modelo: number
  code: string
  label: string
  tipo_ui: string
  requerido: boolean
  orden: number
  activo: boolean
  opciones: ModeloAtributoOpcion[]
}

export type Equipo = {
  id: number
  id_equipo?: number
  id_modelo?: number | null
  id_producto: number | null
  imei: string | null
  color: string | null
  tipo_equipo: string | null
  estado_comercial: string | null
  activo: boolean
  fecha_ingreso: string | null
  modelo: {
    id: number
    id_modelo?: number
    nombre_modelo: string
    capacidad_gb: number | null
  }
  foto_url: string | null
  configuracion?: {
    id: number
    id_equipo: number
    id_atributo: number
    id_opcion: number
    atributo_code?: string | null
    atributo_label?: string | null
    opcion_valor?: string | null
    opcion_label?: string | null
  }[]
}

export type EquipoConModelo = Equipo

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
