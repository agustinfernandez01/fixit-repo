from app.services.usuarios import (
    delete_usuario,
    get_usuario_by_id,
    get_usuario_filtered,
    get_usuarios,
    patch_usuario,
    post_usuario,
    put_usuario_completo,
)
from app.schemas.usuarios import UsuarioCreate, UsuarioPerfilResponse, UsuarioResponse, UsuarioPut, UsuarioPatch   
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.routers.legacy import mark_legacy_route_used
import traceback
from typing import Optional
from app.deps.auth import get_optional_user_id_from_access_token
from app.models.usuarios import Usuario
from app.models.roles import Rol

router = APIRouter()


@router.get("/me", response_model=UsuarioPerfilResponse)
def obtener_mi_perfil(
    raw_request: Request,
    response: Response,
    db: Session = Depends(get_db),
    id_usuario: int | None = Depends(get_optional_user_id_from_access_token),
):
    mark_legacy_route_used(
        response=response,
        request=raw_request,
        successor_path="/auth/me",
        legacy_route="/usuarios/me",
    )
    if id_usuario is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Debes iniciar sesión.")

    try:
        usuario = (
            db.query(Usuario, Rol.nombre.label("rol_nombre"))
            .join(Rol, Usuario.id_rol == Rol.id)
            .filter(Usuario.id == id_usuario)
            .first()
        )
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        user, rol_nombre = usuario
        payload = {
            "id": user.id,
            "nombre": user.nombre,
            "apellido": user.apellido,
            "email": user.email,
            "telefono": user.telefono,
            "id_rol": user.id_rol,
            "rol_nombre": rol_nombre,
            "activo": True,
        }
        return payload
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al obtener mi perfil: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

#GET - Obtener usuario por id
@router.get("/get/{id}", response_model=UsuarioResponse)
def obtener_usuario_por_id(id: int, db: Session = Depends(get_db)):
    try:
        usuario = get_usuario_by_id(db, id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return usuario
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al obtener usuario por id: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

#GET ALL | FILTERED
@router.get("/get", response_model=list[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    email: Optional[str] = None,
    nombre: Optional[str] = None,
    apellido: Optional[str] = None,
    telefono: Optional[str] = None,
):
    try:
        if any([email, nombre, apellido, telefono]):
            usuarios = get_usuario_filtered(
                db,
                email=email,
                nombre=nombre,
                apellido=apellido,
                telefono=telefono,
            )
        else:
            usuarios = get_usuarios(db)

        if not usuarios:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        return usuarios

    except HTTPException:
        raise

    except Exception as e:
        print(f"Error al listar usuarios: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error interno del servidor")
      

#POST - Crear usuario
@router.post("/post", response_model=UsuarioResponse)
def crear_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    try:
        nuevo_usuario = post_usuario(db, usuario)
        return nuevo_usuario
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al crear usuario: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

#PUT - Actualizar usuario completo
@router.put("/put/{id}", response_model=UsuarioResponse)
def actualizar_usuario_completo(id: int, usuario: UsuarioPut, db: Session = Depends(get_db)):
    try:
        usuario_actualizado = put_usuario_completo(db, id, usuario)
        return usuario_actualizado
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al actualizar usuario completo: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

#PATCH - Actualizar usuario parcial
@router.patch("/patch/{id}", response_model=UsuarioResponse)
def actualizar_usuario_parcial(id: int, usuario: UsuarioPatch, db: Session = Depends(get_db)):
    try:
        usuario_actualizado = patch_usuario(db, id, usuario)
        return usuario_actualizado
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al actualizar usuario parcial: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

#DELETE - Eliminar usuario
@router.delete("/delete/{id}", response_model=bool)
def eliminar_usuario(id: int, db: Session = Depends(get_db)):
    try:
        usuario_eliminado = delete_usuario(db, id)
        return usuario_eliminado
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al eliminar usuario: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))







