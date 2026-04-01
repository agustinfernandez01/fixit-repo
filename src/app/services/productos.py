from sqlalchemy.orm import Session
from app.models.productos import Productos
from app.models.equipos import Equipos
from app.schemas.productos import ProductoCreate, ProductoPatch, ProductoBase

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