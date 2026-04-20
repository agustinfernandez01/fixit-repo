from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import ListaPrecioReparacion


def _d(value: str | int | float) -> Decimal:
    return Decimal(str(value))


def seed_lista_precios_reparacion(db: Session) -> int:
    """
    Carga (upsert simple) la lista de precios visible en Reparaciones.
    Fuente: planillas/imagenes compartidas en el repo (abril 2026).
    """

    rows: list[dict] = []

    def add(categoria: str, modelo: str, usd: int, ars: int, orden: int):
        rows.append(
            {
                "categoria": categoria,
                "modelo": modelo,
                "orden": orden,
                "precio_usd_original": _d(usd),
                "precio_ars_original": _d(ars),
                "precio_usd_alternativo": None,
                "precio_ars_alternativo": None,
            }
        )

    def add_many(categoria: str, data: list[tuple[str, int, int]]):
        for i, (modelo, usd, ars) in enumerate(data):
            add(categoria, modelo, usd, ars, i)

    add_many(
        "tapas_traseras",
        [
            ("IPHONE 8G", 30, 42000),
            ("IPHONE SE 2nd GEN", 35, 49000),
            ("IPHONE 8 PLUS", 35, 49000),
            ("IPHONE X", 35, 49000),
            ("IPHONE XR", 35, 49000),
            ("IPHONE XS", 40, 56000),
            ("IPHONE XS MAX", 40, 56000),
            ("IPHONE 11", 45, 63000),
            ("IPHONE 11 PRO", 45, 63000),
            ("IPHONE 11 PRO MAX", 45, 63000),
            ("IPHONE 12", 45, 63000),
            ("IPHONE 12 MINI", 45, 63000),
            ("IPHONE 12 PRO", 50, 71000),
            ("IPHONE 12 PRO MAX", 50, 71000),
            ("IPHONE 13", 50, 71000),
            ("IPHONE 13 MINI", 50, 71000),
            ("IPHONE 13 PRO", 55, 78000),
            ("IPHONE 13 PRO MAX", 65, 92000),
            ("IPHONE 14", 65, 92000),
            ("IPHONE 14 PLUS", 65, 92000),
            ("IPHONE 14 PRO", 70, 99000),
            ("IPHONE 14 PRO MAX", 75, 106000),
            ("IPHONE 15", 100, 141000),
            ("IPHONE 15 PLUS", 100, 141000),
            ("IPHONE 15 PRO", 100, 141000),
            ("IPHONE 15 PRO MAX", 100, 141000),
            ("IPHONE 16", 120, 169000),
            ("IPHONE 16 PLUS", 120, 169000),
            ("IPHONE 16 PRO", 150, 212000),
            ("IPHONE 16 PRO MAX", 150, 212000),
        ],
    )

    add_many(
        "flex_carga",
        [
            ("IPHONE 6S", 18, 25000),
            ("IPHONE 6S PLUS", 25, 35000),
            ("IPHONE 7", 25, 35000),
            ("IPHONE 7 PLUS", 30, 42000),
            ("IPHONE 8", 30, 42000),
            ("IPHONE 8 PLUS", 35, 49000),
            ("IPHONE X", 40, 56000),
            ("IPHONE XR", 55, 78000),
            ("IPHONE XS", 55, 78000),
            ("IPHONE XS MAX", 60, 85000),
            ("IPHONE 11", 60, 85000),
            ("IPHONE 11 PRO", 65, 92000),
            ("IPHONE 11 PRO MAX", 65, 92000),
            ("IPHONE 12/12 PRO", 60, 85000),
            ("IPHONE 12 MINI", 60, 85000),
            ("IPHONE 12 PRO MAX", 65, 92000),
            ("IPHONE 13", 70, 99000),
            ("IPHONE 13 PRO", 80, 113000),
            ("IPHONE 13 PRO MAX", 85, 120000),
            ("IPHONE 14", 100, 141000),
            ("IPHONE 14 PLUS", 100, 141000),
            ("IPHONE 14 PRO", 120, 169000),
            ("IPHONE 14 PRO MAX", 130, 183000),
            ("IPHONE 15", 140, 197000),
            ("IPHONE 15 PLUS", 140, 197000),
            ("IPHONE 15 PRO", 150, 212000),
            ("IPHONE 15 PRO MAX", 160, 226000),
            ("IPHONE 16", 150, 210000),
            ("IPHONE 16 PLUS", 200, 280000),
            ("IPHONE 16 PRO", 160, 230000),
            ("IPHONE 16 PRO MAX", 180, 250000),
        ],
    )

    add_many(
        "camara_principal",
        [
            ("IPHONE 7G", 35, 50000),
            ("IPHONE 7 PLUS", 40, 60000),
            ("IPHONE 8G/SE 1era GEN", 40, 60000),
            ("IPHONE 8 PLUS", 50, 70000),
            ("IPHONE X", 50, 70000),
            ("IPHONE XR", 60, 80000),
            ("IPHONE XS", 60, 80000),
            ("IPHONE XS MAX", 60, 80000),
            ("IPHONE 11", 60, 80000),
            ("IPHONE 11 PRO", 75, 110000),
            ("IPHONE 11 PRO MAX", 75, 110000),
            ("IPHONE 12", 75, 110000),
            ("IPHONE 12 MINI", 65, 90000),
            ("IPHONE 12 PRO", 100, 140000),
            ("IPHONE 12 PRO MAX", 110, 160000),
            ("IPHONE 13", 100, 140000),
            ("IPHONE 13 MINI", 100, 140000),
            ("IPHONE 13 PRO", 145, 200000),
            ("IPHONE 13 PRO MAX", 145, 200000),
            ("IPHONE 14", 100, 140000),
            ("IPHONE 14 PLUS", 75, 110000),
            ("IPHONE 14 PRO", 150, 210000),
            ("IPHONE 14 PRO MAX", 180, 250000),
            ("IPHONE 15", 130, 180000),
            ("IPHONE 15 PLUS", 100, 140000),
            ("IPHONE 15 PRO", 150, 210000),
            ("IPHONE 15 PRO MAX", 180, 250000),
            ("IPHONE 16", 150, 210000),
            ("IPHONE 16 PLUS", 150, 210000),
            ("IPHONE 16 PRO", 200, 280000),
            ("IPHONE 16 PRO MAX", 300, 420000),
        ],
    )

    add_many(
        "bateria",
        [
            ("IPHONE 6 PLUS", 20, 30000),
            ("IPHONE 6S", 25, 35000),
            ("IPHONE 6S PLUS", 30, 40000),
            ("IPHONE 7G", 30, 40000),
            ("IPHONE 7 PLUS", 35, 50000),
            ("IPHONE 8G", 30, 40000),
            ("IPHONE 8 PLUS", 35, 50000),
            ("IPHONE X", 40, 55000),
            ("IPHONE XR/SE 2nd GEN", 50, 70000),
            ("IPHONE XS", 55, 80000),
            ("IPHONE XS MAX", 60, 85000),
            ("IPHONE 11", 65, 90000),
            ("IPHONE 11 PRO", 65, 90000),
            ("IPHONE 11 PRO MAX", 70, 100000),
            ("IPHONE 12/12 PRO", 65, 90000),
            ("IPHONE 12 MINI", 65, 90000),
            ("IPHONE 12 PRO MAX", 70, 100000),
            ("IPHONE 13", 75, 105000),
            ("IPHONE 13 MINI", 75, 105000),
            ("IPHONE 13 PRO", 75, 105000),
            ("IPHONE 13 PRO MAX", 85, 120000),
            ("IPHONE 14", 90, 125000),
            ("IPHONE 14 PLUS", 90, 125000),
            ("IPHONE 14 PRO", 95, 135000),
            ("IPHONE 14 PRO MAX", 105, 150000),
            ("IPHONE 15", 100, 140000),
            ("IPHONE 15 PLUS", 100, 140000),
            ("IPHONE 15 PRO", 120, 170000),
            ("IPHONE 15 PRO MAX", 130, 185000),
        ],
    )

    upserted = 0
    for r in rows:
        existing = (
            db.query(ListaPrecioReparacion)
            .filter(
                ListaPrecioReparacion.categoria == r["categoria"],
                ListaPrecioReparacion.modelo == r["modelo"],
            )
            .first()
        )
        if existing:
            for k, v in r.items():
                setattr(existing, k, v)
        else:
            db.add(ListaPrecioReparacion(**r))
        upserted += 1

    db.commit()
    return upserted


def main() -> None:
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        n = seed_lista_precios_reparacion(db)
        print(f"Seed lista_precios_reparacion: {n} filas upserted")
    finally:
        db.close()


if __name__ == "__main__":
    main()

