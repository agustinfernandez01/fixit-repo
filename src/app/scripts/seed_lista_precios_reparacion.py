"""
Carga la lista de precios Fixit (módulos, baterías, cámara, flex) en la tabla lista_precios_reparacion.

Uso (desde la carpeta src, con .env y MySQL configurados):

    python -m app.scripts.seed_lista_precios_reparacion
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.reparacion import ListaPrecioReparacion

CAT_MODULO = "modulo_pantalla"
CAT_BATERIA = "bateria"
CAT_CAMARA = "camara_principal"
CAT_FLEX = "flex_carga"

# (modelo, usd_orig, ars_orig, usd_alt, ars_alt) — None = sin dato / consultar
MODULOS: list[tuple[str, str | None, str | None, str | None, str | None]] = [
    ("iPhone 6S Blanco", None, None, "35", "50000"),
    ("iPhone 6S Negro", None, None, "35", "50000"),
    ("iPhone 6S Plus Blanco", None, None, "45", "60000"),
    ("iPhone 6S Plus Negro", None, None, "45", "60000"),
    ("iPhone 7 Blanco", None, None, "40", "60000"),
    ("iPhone 7 Negro", None, None, "40", "60000"),
    ("iPhone 7 Plus Blanco", None, None, "45", "60000"),
    ("iPhone 7 Plus Negro", None, None, "45", "60000"),
    ("iPhone 8 Blanco", None, None, "45", "60000"),
    ("iPhone 8 Negro", None, None, "45", "60000"),
    ("iPhone 8 Plus Blanco", None, None, "50", "71000"),
    ("iPhone 8 Plus Negro", None, None, "50", "71000"),
    ("iPhone X", "100", "140000", "60", "80000"),
    ("iPhone XR", "75", "110000", None, None),
    ("iPhone XS", "100", "140000", "60", "80000"),
    ("iPhone XS Max", "105", "150000", "70", "100000"),
    ("iPhone 11", "100", "140000", "70", "100000"),
    ("iPhone 11 Pro", "130", "180000", "80", "110000"),
    ("iPhone 11 Pro Max", "140", "200000", "80", "110000"),
    ("iPhone 12 / 12 Pro", "150", "210000", "80", "110000"),
    ("iPhone 12 mini", "150", "210000", "90", "130000"),
    ("iPhone 12 Pro Max", "200", "280000", "110", "160000"),
    ("iPhone 13", "200", "280000", "100", "140000"),
    ("iPhone 13 Pro", "300", "420000", "180", "250000"),
    ("iPhone 13 Pro Max", "300", "420000", "200", "280000"),
    ("iPhone 14", "300", "420000", "130", "180000"),
    ("iPhone 14 Plus", "250", "350000", "150", "210000"),
    ("iPhone 14 Pro", "300", "420000", "200", "280000"),
    ("iPhone 14 Pro Max", "300", "420000", "200", "280000"),
    ("iPhone 15", "300", "420000", "165", "230000"),
    ("iPhone 15 Plus", "350", "490000", "220", "310000"),
    ("iPhone 15 Pro", "350", "490000", "200", "280000"),
    ("iPhone 15 Pro Max", "500", "710000", "310", "440000"),
    ("iPhone 16", "350", "490000", "200", "280000"),
    ("iPhone 16 Plus", None, None, None, None),
    ("iPhone 16 Pro", None, None, None, None),
    ("iPhone 16 Pro Max", None, None, None, None),
]

# (modelo, usd, ars)
BATERIAS: list[tuple[str, str | None, str | None]] = [
    ("iPhone 6 Plus", "20", "30000"),
    ("iPhone 6S", "25", "35000"),
    ("iPhone 6S Plus", "30", "40000"),
    ("iPhone 7", "30", "40000"),
    ("iPhone 7 Plus", "35", "50000"),
    ("iPhone 8", "30", "40000"),
    ("iPhone 8 Plus", "35", "50000"),
    ("iPhone X", "40", "55000"),
    ("iPhone XR / SE 2.ª gen", "50", "70000"),
    ("iPhone XS", "55", "80000"),
    ("iPhone XS Max", "60", "85000"),
    ("iPhone 11", "65", "90000"),
    ("iPhone 11 Pro", "65", "90000"),
    ("iPhone 11 Pro Max", "70", "100000"),
    ("iPhone 12 / 12 Pro", "65", "90000"),
    ("iPhone 12 mini", "65", "90000"),
    ("iPhone 12 Pro Max", "70", "100000"),
    ("iPhone 13", "75", "105000"),
    ("iPhone 13 mini", "75", "105000"),
    ("iPhone 13 Pro", "75", "105000"),
    ("iPhone 13 Pro Max", "85", "120000"),
    ("iPhone 14", "90", "125000"),
    ("iPhone 14 Plus", "90", "125000"),
    ("iPhone 14 Pro", "95", "135000"),
    ("iPhone 14 Pro Max", "105", "150000"),
    ("iPhone 15", "100", "140000"),
    ("iPhone 15 Plus", "100", "140000"),
    ("iPhone 15 Pro", "120", "170000"),
    ("iPhone 15 Pro Max", "130", "185000"),
    ("iPhone 16", None, None),
    ("iPhone 16 Plus", None, None),
    ("iPhone 16 Pro", None, None),
    ("iPhone 16 Pro Max", None, None),
]

CAMARAS: list[tuple[str, str | None, str | None]] = [
    ("iPhone 7", "35", "50000"),
    ("iPhone 7 Plus", "40", "60000"),
    ("iPhone 8 / SE 1.ª gen", "40", "60000"),
    ("iPhone 8 Plus", "50", "70000"),
    ("iPhone X", "50", "70000"),
    ("iPhone XR", "60", "80000"),
    ("iPhone XS", "60", "80000"),
    ("iPhone XS Max", "60", "80000"),
    ("iPhone 11", "60", "80000"),
    ("iPhone 11 Pro", "75", "110000"),
    ("iPhone 11 Pro Max", "75", "110000"),
    ("iPhone 12", "75", "110000"),
    ("iPhone 12 mini", "65", "90000"),
    ("iPhone 12 Pro", "100", "140000"),
    ("iPhone 12 Pro Max", "110", "160000"),
    ("iPhone 13", "100", "140000"),
    ("iPhone 13 mini", "100", "140000"),
    ("iPhone 13 Pro", "145", "200000"),
    ("iPhone 13 Pro Max", "145", "200000"),
    ("iPhone 14", "100", "140000"),
    ("iPhone 14 Plus", "75", "110000"),
    ("iPhone 14 Pro", "150", "210000"),
    ("iPhone 14 Pro Max", "180", "250000"),
    ("iPhone 15", "130", "180000"),
    ("iPhone 15 Plus", "100", "140000"),
    ("iPhone 15 Pro", "150", "210000"),
    ("iPhone 15 Pro Max", "180", "250000"),
    ("iPhone 16", "150", "210000"),
    ("iPhone 16 Plus", "150", "210000"),
    ("iPhone 16 Pro", "200", "280000"),
    ("iPhone 16 Pro Max", "300", "420000"),
]

FLEX: list[tuple[str, str | None, str | None]] = [
    ("iPhone 6S", "18", "25000"),
    ("iPhone 6S Plus", "25", "35000"),
    ("iPhone 7", "25", "35000"),
    ("iPhone 7 Plus", "30", "42000"),
    ("iPhone 8", "30", "42000"),
    ("iPhone 8 Plus", "35", "49000"),
    ("iPhone X", "40", "56000"),
    ("iPhone XR", "55", "78000"),
    ("iPhone XS", "55", "78000"),
    ("iPhone XS Max", "60", "85000"),
    ("iPhone 11", "60", "85000"),
    ("iPhone 11 Pro", "65", "92000"),
    ("iPhone 11 Pro Max", "65", "92000"),
    ("iPhone 12 / 12 Pro", "60", "85000"),
    ("iPhone 12 mini", "60", "85000"),
    ("iPhone 12 Pro Max", "65", "92000"),
    ("iPhone 13", "70", "99000"),
    ("iPhone 13 Pro", "80", "113000"),
    ("iPhone 13 Pro Max", "85", "120000"),
    ("iPhone 14", "100", "141000"),
    ("iPhone 14 Plus", "100", "141000"),
    ("iPhone 14 Pro", "120", "169000"),
    ("iPhone 14 Pro Max", "130", "183000"),
    ("iPhone 15", "140", "197000"),
    ("iPhone 15 Plus", "140", "197000"),
    ("iPhone 15 Pro", "150", "212000"),
    ("iPhone 15 Pro Max", "160", "226000"),
    ("iPhone 16", "150", "210000"),
    ("iPhone 16 Plus", "200", "280000"),
    ("iPhone 16 Pro", "160", "230000"),
    ("iPhone 16 Pro Max", "180", "250000"),
]


def _d(x: str | None) -> Decimal | None:
    if x is None:
        return None
    return Decimal(x)


def seed(db: Session) -> int:
    db.query(ListaPrecioReparacion).delete()
    db.commit()

    out: list[ListaPrecioReparacion] = []

    for i, (m, uo, ao, ua, aa) in enumerate(MODULOS):
        out.append(
            ListaPrecioReparacion(
                categoria=CAT_MODULO,
                modelo=m,
                orden=i,
                precio_usd_original=_d(uo),
                precio_ars_original=_d(ao),
                precio_usd_alternativo=_d(ua),
                precio_ars_alternativo=_d(aa),
            )
        )

    for i, (m, u, a) in enumerate(BATERIAS):
        out.append(
            ListaPrecioReparacion(
                categoria=CAT_BATERIA,
                modelo=m,
                orden=i,
                precio_usd_original=_d(u),
                precio_ars_original=_d(a),
                precio_usd_alternativo=None,
                precio_ars_alternativo=None,
            )
        )

    for i, (m, u, a) in enumerate(CAMARAS):
        out.append(
            ListaPrecioReparacion(
                categoria=CAT_CAMARA,
                modelo=m,
                orden=i,
                precio_usd_original=_d(u),
                precio_ars_original=_d(a),
                precio_usd_alternativo=None,
                precio_ars_alternativo=None,
            )
        )

    for i, (m, u, a) in enumerate(FLEX):
        out.append(
            ListaPrecioReparacion(
                categoria=CAT_FLEX,
                modelo=m,
                orden=i,
                precio_usd_original=_d(u),
                precio_ars_original=_d(a),
                precio_usd_alternativo=None,
                precio_ars_alternativo=None,
            )
        )

    db.add_all(out)
    db.commit()
    return len(out)


def main() -> None:
    db = SessionLocal()
    try:
        n = seed(db)
        print(f"OK: {n} filas en lista_precios_reparacion.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
