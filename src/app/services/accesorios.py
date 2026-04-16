from decimal import Decimal
from pymysql import IntegrityError
from sqlalchemy.orm import Session
from typing import Optional
from app.models.productos import CategoriaProducto, Productos
from app.models.accesorios import Accesorios
from app.schemas.accesorios import AccesoriosCreate, AccesoriosPatch, AccesoriosResponse  


TIPOS_ACCESORIO_ALIAS = {
    "cargador": "cable",
    "cabezal": "cabezal",
    "fundas": "funda",
    "templados": "templado",
    "protector": "templado",
    "glass": "templado",
    "vidrio": "templado",
}


def _normalizar_tipo(tipo: str | None) -> str | None:
    if tipo is None:
        return None
    texto = tipo.strip().lower()
    if not texto:
        return None
    return TIPOS_ACCESORIO_ALIAS.get(texto, texto)


def _ensure_categoria_accesorios(db: Session) -> CategoriaProducto:
    categoria = (
        db.query(CategoriaProducto)
        .filter(CategoriaProducto.nombre.ilike("%accesorios%"), CategoriaProducto.activo.is_(True))
        .first()
    )
    if categoria:
        return categoria

    categoria = db.query(CategoriaProducto).filter(CategoriaProducto.activo.is_(True)).first()
    if categoria:
        return categoria

    categoria = CategoriaProducto(
        nombre="Accesorios",
        descripcion="Autogenerada por el alta de accesorios",
        activo=True,
    )
    db.add(categoria)
    db.flush()
    return categoria


#accesorios

#listar accesorios
def get_accesorios_list(db:Session):
    rows = db.query(Accesorios).all()
    hubo_cambios = False
    for row in rows:
        tipo_canonico = _normalizar_tipo(row.tipo)
        if tipo_canonico and row.tipo != tipo_canonico:
            row.tipo = tipo_canonico
            hubo_cambios = True
    if hubo_cambios:
        db.commit()
        for row in rows:
            db.refresh(row)
    return rows

#buscar accesorio por id
def get_accesorios_by_id(db:Session, id:int):
    row = db.query(Accesorios).filter(Accesorios.id == id).first()
    if not row:
        return None
    tipo_canonico = _normalizar_tipo(row.tipo)
    if tipo_canonico and row.tipo != tipo_canonico:
        row.tipo = tipo_canonico
        db.commit()
        db.refresh(row)
    return row

#crear accesorio
def create_accesorios(db: Session, payload: AccesoriosCreate) -> AccesoriosResponse:
    try:
        tipo = _normalizar_tipo(payload.tipo)
        if tipo is None:
            raise ValueError("El tipo de accesorio es obligatorio")
        nombre = payload.nombre.strip()
        color = payload.color.strip()
        descripcion = payload.descripcion.strip()

        accesorio_existente = (
            db.query(Accesorios)
            .filter(
                Accesorios.nombre == nombre,
                Accesorios.tipo == tipo
            )
            .first()
        )

        if accesorio_existente:
            raise ValueError("Este accesorio ya existe")

        nombre_producto = f"{tipo} - {nombre}"
        categoria = _ensure_categoria_accesorios(db)

        producto_catalogo = (
            db.query(Productos)
            .filter(
                Productos.nombre == nombre_producto,
                Productos.id_categoria == categoria.id,
            )
            .first()
        )

        if not producto_catalogo:
            producto_catalogo = Productos(
                nombre=nombre_producto,
                descripcion=descripcion,
                precio=Decimal(payload.precio),
                id_categoria=categoria.id,
                activo=payload.estado,
            )
            db.add(producto_catalogo)
            db.flush()  # obtiene el id sin hacer commit

        nuevo_accesorio = Accesorios(
            tipo=tipo,
            nombre=nombre,
            color=color,
            descripcion=descripcion,
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
            if field in {"tipo", "nombre", "color", "descripcion"} and isinstance(value, str):
                value = value.strip()
                if field == "tipo":
                    value = _normalizar_tipo(value)
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
    