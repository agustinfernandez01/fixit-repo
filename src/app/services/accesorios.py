from datetime import datetime
from pymysql import IntegrityError
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.accesorios import Accesorios
from app.models.productos import Productos
from app.schemas.accesorios import AccesoriosCreate, AccesoriosPatch, AccesoriosResponse  


#accesorios

#listar accesorios
def get_accesorios_list(db:Session):
    return db.query(Accesorios).all()

#buscar accesorio por id
def get_accesorios_by_id(db:Session, id:int):
    return db.query(Accesorios).filter(Accesorios.id == id).first()

#crear accesorio
def create_accesorios(db: Session, payload: AccesoriosCreate) -> AccesoriosResponse:
    try:
        accesorio_existente = (
            db.query(Accesorios)
            .filter(
                Accesorios.nombre == payload.nombre,
                Accesorios.tipo == payload.tipo
            )
            .first()
        )

        if accesorio_existente:
            raise ValueError("Este accesorio ya existe")

        nombre_producto = f"{payload.tipo} - {payload.nombre}"

        producto_catalogo = (
            db.query(Productos)
            .filter(Productos.nombre == nombre_producto)
            .first()
        )

        if not producto_catalogo:
            producto_catalogo = Productos(
                nombre=nombre_producto,
                descripcion=payload.descripcion,
                precio=payload.precio,
                estado=payload.estado,
                id_categoria=payload.id_categoria
            )
            db.add(producto_catalogo)
            db.flush()  # obtiene el id sin hacer commit

        nuevo_accesorio = Accesorios(
            tipo=payload.tipo,
            nombre=payload.nombre,
            color=payload.color,
            descripcion=payload.descripcion,
            estado=payload.estado,
            id_producto=producto_catalogo.id
        )

        db.add(nuevo_accesorio)
        db.commit()
        db.refresh(nuevo_accesorio)
        return nuevo_accesorio

    except IntegrityError:
        db.rollback()
        raise ValueError("Error de integridad al crear el accesorio")

    except ValueError:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al crear el accesorio")
    
#editar accesorio
def patch_accesorios(db:Session, id:int, payload:AccesoriosPatch) -> AccesoriosResponse:
    try:
        accesorio = get_accesorios_by_id(db, id)
        if not accesorio:
            raise ValueError("Accesorio no encontrado")
        
        accesorio_a_editar = payload.model_dump(exclude_unset=True)

        for field, value in accesorio_a_editar.items():
            setattr(accesorio, field, value)

        db.commit()
        db.refresh(accesorio)
        return accesorio
    
    except IntegrityError:
        db.rollback()
        raise ValueError("Error al editar el accesorio")
    
#eliminar accesorio
def delete_accesorios(db:Session, id:int) -> AccesoriosResponse:
    try:
        accesorio = get_accesorios_by_id(db, id)

        if not accesorio:
            raise ValueError("Accesorio no encontrado")
        
        db.delete(accesorio)
        db.commit()
        return accesorio
    
    except IntegrityError:
        db.rollback()
        raise ValueError("Error al eliminar el accesorio")
    