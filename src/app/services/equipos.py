from datetime import datetime
from pymysql import IntegrityError
from sqlalchemy.orm import Session
from app.models.equipos import Equipos, ModelosEquipo
from app.models.productos import Productos
from app.schemas.equipos import EquipoCreate, EquipoPatch, EquipoResponse, ModeloEquipoCreate, ModeloEquipoPatch
from typing import List, Optional

## ------------ MODELOS DE EQUIPO ------------ ##

def get_modelos(db:Session):
    return db.query(ModelosEquipo).all()

def get_modelo_by_id(db:Session, id_buscar:int):
    return db.query(ModelosEquipo).filter(ModelosEquipo.id == id_buscar).first()

def get_modelos_filtered(db:Session, nombre_modelo: Optional[str] = None, capacidad_gb: Optional[int] = None, color: Optional[str] = None, activo: Optional[bool] = None):
    query = db.query(ModelosEquipo)
    
    if nombre_modelo is not None:
        query = query.filter(ModelosEquipo.nombre_modelo.ilike(f"%{nombre_modelo}%"))
    if capacidad_gb is not None:
        query = query.filter(ModelosEquipo.capacidad_gb == capacidad_gb)
    if color is not None:
        query = query.filter(ModelosEquipo.color.ilike(f"%{color}%"))
    if activo is not None:
        query = query.filter(ModelosEquipo.activo == activo)
    
    return query.all()

def create_modelo(db:Session, modelo:ModeloEquipoCreate):
    db_modelo = ModelosEquipo(
        nombre_modelo=modelo.nombre_modelo,
        capacidad_gb=modelo.capacidad_gb,
        color=modelo.color,
        activo=modelo.activo
    )
    db.add(db_modelo)
    db.commit()
    db.refresh(db_modelo)
    return db_modelo

def patch_modelo(db:Session, id_modelo:int, modelo_patch:ModeloEquipoPatch):
    db_modelo = get_modelo_by_id(db, id_modelo)
    if not db_modelo:
        return None
    
    if modelo_patch.nombre_modelo is not None:
        db_modelo.nombre_modelo = modelo_patch.nombre_modelo
    if modelo_patch.capacidad_gb is not None:
        db_modelo.capacidad_gb = modelo_patch.capacidad_gb
    if modelo_patch.color is not None:
        db_modelo.color = modelo_patch.color
    if modelo_patch.activo is not None:
        db_modelo.activo = modelo_patch.activo
    
    db.commit()
    db.refresh(db_modelo)
    return db_modelo

def delete_modelo(db:Session, id_modelo:int):
    db_modelo = get_modelo_by_id(db, id_modelo)
    if not db_modelo:
        return None
    
    db.delete(db_modelo)
    db.commit()
    return db_modelo

## ------------ EQUIPOS ------------ ##

def get_equipos(db:Session):
    return db.query(Equipos).all()

def get_equipo_by_id(db: Session, id_equipo: int):
    return db.query(Equipos).filter(Equipos.id == id_equipo).first()

def get_equipos_filtered(
    db:Session, 
    id_modelo: Optional[int] = None, 
    imei: Optional[str] = None, 
    tipo_equipo: Optional[str] = None, 
    estado_comercial: Optional[str] = None, 
    fecha_ingreso: Optional[datetime.datetime] = None, 
    activo: Optional[bool] = None):
    
    query = db.query(Equipos)
    
    if id_modelo is not None:
        query = query.filter(Equipos.id_modelo == id_modelo)
    if imei is not None:
        query = query.filter(Equipos.imei.ilike(f"%{imei}%"))
    if tipo_equipo is not None:
        query = query.filter(Equipos.tipo_equipo.ilike(f"%{tipo_equipo}%"))
    if estado_comercial is not None:
        query = query.filter(Equipos.estado_comercial.ilike(f"%{estado_comercial}%"))
    if fecha_ingreso is not None:
        query = query.filter(Equipos.fecha_ingreso == fecha_ingreso)
    if activo is not None:
        query = query.filter(Equipos.activo == activo)
    
    return query.all()

# El proceso de creación de un equipo implica crear un producto asociado al equipo, y luego crear el equipo con el id del producto creado. Esto se debe a que cada equipo registrado en el sistema debe tener un producto asociado para poder ser vendido o gestionado dentro del catálogo de productos.
def create_equipo(db: Session, equipo: EquipoCreate):
    try:
        buscar_modelo = get_modelo_by_id(db, equipo.id_modelo)
        if not buscar_modelo:
            raise ValueError("El modelo no existe")

        imei_existente = db.query(Equipos).filter(Equipos.imei == equipo.imei).first()
        if imei_existente:
            raise ValueError("El IMEI ya existe en inventario")

        color_modelo = (buscar_modelo.color or "Sin color").strip()
        capacidad_modelo = (
            f"{buscar_modelo.capacidad_gb}GB"
            if buscar_modelo.capacidad_gb is not None
            else "s/capacidad"
        )
        nombre_producto = f"{buscar_modelo.nombre_modelo} - {capacidad_modelo} - {color_modelo}"

        producto_catalogo = (
            db.query(Productos)
            .filter(
                Productos.id_categoria == equipo.id_categoria,
                Productos.nombre == nombre_producto,
            )
            .first()
        )

        if not producto_catalogo:
            producto_catalogo = Productos(
                id_categoria=equipo.id_categoria,
                nombre=nombre_producto,
                descripcion=equipo.descripcion,
                precio=equipo.precio,
                activo=True,
            )
            db.add(producto_catalogo)
            db.flush()
        else:
            if not producto_catalogo.activo:
                producto_catalogo.activo = True

        nuevo_equipo = Equipos(
            id_modelo=equipo.id_modelo,
            id_producto=producto_catalogo.id,
            imei=equipo.imei,
            tipo_equipo=equipo.tipo_equipo,
            estado_comercial=equipo.estado_comercial,
            fecha_ingreso=equipo.fecha_ingreso,
            activo=True,
        )

        db.add(nuevo_equipo)
        db.commit()
        db.refresh(nuevo_equipo)

        return nuevo_equipo

    except IntegrityError:
        db.rollback()
        raise ValueError("Error de integridad en base de datos. Verificá IMEI o relaciones únicas.")
    except Exception:
        db.rollback()
        raise
    
def patch_equipo(db: Session, id_equipo: int, equipo_patch: EquipoPatch):
    db_equipo = get_equipo_by_id(db, id_equipo)
    if not db_equipo:
        return None

    update_data = equipo_patch.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_equipo, key, value)

    db.commit()
    db.refresh(db_equipo)
    return db_equipo




def delete_equipo(db:Session, id_equipo:int):
    db_equipo = get_equipo_by_id(db, id_equipo)
    if not db_equipo:
        return None
    
    db.delete(db_equipo)
    db.commit()
    return db_equipo