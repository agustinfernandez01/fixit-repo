"""
Backfill de equipos legacy sin id_producto.

Objetivo:
- detectar equipos con id_producto = NULL,
- crear o reutilizar un producto del catalogo,
- vincular el equipo a ese producto.

Uso (desde la carpeta src):

    python -m app.scripts.backfill_equipos_sin_producto --dry-run
    python -m app.scripts.backfill_equipos_sin_producto
"""

from __future__ import annotations

import argparse
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

import app.models  # noqa: F401 - registra todos los modelos
from app.db import SessionLocal
from app.models.equipos import Equipo
from app.models.productos import CategoriaProducto, Productos


def _ensure_categoria_smartphones(db: Session) -> CategoriaProducto:
    categoria = (
        db.query(CategoriaProducto)
        .filter(
            CategoriaProducto.nombre.ilike("%smartphone%"),
            CategoriaProducto.activo.is_(True),
        )
        .first()
    )
    if categoria:
        return categoria

    categoria = db.query(CategoriaProducto).filter(CategoriaProducto.activo.is_(True)).first()
    if categoria:
        return categoria

    categoria = CategoriaProducto(
        nombre="Smartphones",
        descripcion="Autogenerada por backfill de equipos sin producto",
        activo=True,
    )
    db.add(categoria)
    db.flush()
    return categoria


def _nombre_producto_para_equipo(equipo: Equipo) -> str:
    modelo = equipo.modelo
    if not modelo:
        return f"Equipo {equipo.id}"

    capacidad = f"{modelo.capacidad_gb}GB" if modelo.capacidad_gb is not None else "s/capacidad"
    color = (modelo.color or "sin color").strip()
    return f"{modelo.nombre_modelo} - {capacidad} - {color}"


def _buscar_producto_existente(db: Session, nombre: str, id_categoria: int) -> Productos | None:
    producto = (
        db.query(Productos)
        .filter(
            Productos.id_categoria == id_categoria,
            Productos.nombre == nombre,
        )
        .first()
    )
    if producto:
        return producto

    return db.query(Productos).filter(Productos.nombre == nombre).first()


def backfill(db: Session, dry_run: bool = False, include_inactive: bool = False) -> dict[str, int]:
    query = (
        db.query(Equipo)
        .options(joinedload(Equipo.modelo))
        .filter(Equipo.id_producto.is_(None))
    )
    if not include_inactive:
        query = query.filter(Equipo.activo.is_(True))

    equipos = query.all()
    stats = {
        "candidatos": len(equipos),
        "actualizados": 0,
        "productos_creados": 0,
        "productos_reutilizados": 0,
        "omitidos_sin_modelo": 0,
    }

    if not equipos:
        return stats

    categoria = _ensure_categoria_smartphones(db)

    for equipo in equipos:
        if not equipo.modelo:
            stats["omitidos_sin_modelo"] += 1
            continue

        nombre_producto = _nombre_producto_para_equipo(equipo)
        producto = _buscar_producto_existente(db, nombre_producto, categoria.id)

        if producto is None:
            producto = Productos(
                nombre=nombre_producto,
                descripcion="Producto autogenerado por backfill para equipo legacy",
                precio=Decimal("0.00"),
                id_categoria=categoria.id,
                activo=bool(equipo.activo),
            )
            db.add(producto)
            db.flush()
            stats["productos_creados"] += 1
        else:
            stats["productos_reutilizados"] += 1

        equipo.id_producto = producto.id
        stats["actualizados"] += 1

    if dry_run:
        db.rollback()
    else:
        db.commit()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill de equipos sin id_producto")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula cambios sin persistirlos en la DB",
    )
    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="Incluye equipos inactivos en el backfill",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        stats = backfill(
            db,
            dry_run=args.dry_run,
            include_inactive=args.include_inactive,
        )
        mode = "DRY-RUN" if args.dry_run else "APLICADO"
        print(f"[{mode}] Backfill equipos sin producto")
        print(f"- candidatos: {stats['candidatos']}")
        print(f"- actualizados: {stats['actualizados']}")
        print(f"- productos creados: {stats['productos_creados']}")
        print(f"- productos reutilizados: {stats['productos_reutilizados']}")
        print(f"- omitidos sin modelo: {stats['omitidos_sin_modelo']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
