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