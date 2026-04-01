from datetime import datetime
from pymysql import IntegrityError
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.accesorios import Accesorios
from app.schemas.accesorios import AccesoriosCreate, AccesoriosPatch, AccesoriosResponse  


#accesorios

def get_accesorios_list(db:Session):
    return db.query(Accesorios).all()

def get_accesorios_by_id(db:Session, id:int):
    return db.query(Accesorios).filter(Accesorios.id == id).first()

def create_accesorios(db:Session, payload:AccesoriosCreate) -> AccesoriosResponse:
    try:
        nombre_existente = db.query(Accesorios).filter(Accesorios.nombre == payload.nombre).first()
        tipo_existente = db.query(Accesorios).filter(Accesorios.tipo == payload.tipo).first()

        if nombre_existente == payload.nombre and tipo_existente == payload.tipo:
            raise ValueError("Este accesorio ya existe")
        
        accesorio = Accesorios(
            tipo=payload.tipo,
            nombre=payload.nombre,
            color=payload.color,
            descripcion=payload.descripcion,
            estado=payload.estado,
            id_producto=payload.id_producto
        )
        db.add(accesorio)
        db.commit()
        db.refresh(accesorio)
        return accesorio
        
    except IntegrityError:
        db.rollback()
        raise ValueError("Error al crear el accesorio")