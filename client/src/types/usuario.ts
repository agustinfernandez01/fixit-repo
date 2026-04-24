export type UsuarioPerfil = {
  id_usuario: number
  nombre: string
  apellido: string
  email: string
  telefono?: string | null
  id_rol: number
  rol_nombre: string
  activo: boolean
}

export type UsuarioRegistroRequest = {
  nombre: string
  apellido: string
  email: string
  telefono: string
  password: string
}

export type UsuarioRegistroResponse = {
  id_usuario: number
  nombre: string
  apellido: string
  email: string
  telefono?: string | null
}