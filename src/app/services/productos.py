from sqlalchemy.orm import Session
from app.models.productos import Productos
from app.models.accesorios import Accesorios
from app.models.equipos import Equipos
from app.schemas.productos import ProductoCreate, ProductoPatch, ProductoBase

#get - listar productos
def get_productos(db: Session) -> list[dict]:
    productos = db.query(Productos).all()

    equipos_rows = (
        db.query(Equipos.id, Equipos.id_producto)
        .filter(Equipos.id_producto.is_not(None))
        .all()
    )
    equipos_por_producto = {id_producto: id_equipo for id_equipo, id_producto in equipos_rows}

    accesorios_rows = db.query(Accesorios.id, Accesorios.id_producto).all()
    accesorios_por_producto = {}
    for id_accesorio, id_producto in accesorios_rows:
        if id_producto not in accesorios_por_producto:
            accesorios_por_producto[id_producto] = id_accesorio

    response: list[dict] = []
    for p in productos:
        tipo_producto = None
        id_origen = None

        if p.id in equipos_por_producto:
            tipo_producto = "equipo"
            id_origen = equipos_por_producto[p.id]
        elif p.id in accesorios_por_producto:
            tipo_producto = "accesorio"
            id_origen = accesorios_por_producto[p.id]

        response.append(
            {
                "id": p.id,
                "nombre": p.nombre,
                "descripcion": p.descripcion,
                "precio": p.precio,
                "id_categoria": p.id_categoria,
                "activo": p.activo,
                "tipo_producto": tipo_producto,
                "id_origen": id_origen,
            }
        )

    return response

def create_producto(db: Session, producto: Productos) -> Productos:
    db.add(producto)
    db.flush()
    db.refresh(producto)
    return producto

# Verficiar cuantos equipos estan activos, si no hay activos se inhabilita
def desactivar_productos_si_no_hay_equipos_activos(db: Session, id_modelo: int) -> bool:
    equipo_activo = (
        db.query(Equipos)
        .filter(
            Equipos.id_modelo == id_modelo,
            Equipos.activo.is_(True)
        )
        .first()
    )

    if equipo_activo:
        return False

    productos_asociados = (
        db.query(Productos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .filter(
            Equipos.id_modelo == id_modelo,
            Productos.activo.is_(True)
        )
        .distinct()
        .all()
    )

    if not productos_asociados:
        return False

    for producto in productos_asociados:
        producto.activo = False

    return True
# Verificar si hay equipos activos, si hay se activa el producto
def activar_productos_si_hay_equipos_activos(db: Session, id_modelo: int) -> bool:
    equipo_activo = (
        db.query(Equipos)
        .filter(
            Equipos.id_modelo == id_modelo,
            Equipos.activo.is_(True)
        )
        .first()
    )

    if not equipo_activo:
        return False

    productos_asociados = (
        db.query(Productos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .filter(Equipos.id_modelo == id_modelo)
        .distinct()
        .all()
    )

    if not productos_asociados:
        return False

    for producto in productos_asociados:
        producto.activo = True

    return True