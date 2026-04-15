"""
Migracion minima para alinear `sesiones_login` con el modelo actual.

Objetivo:
- asegurar columna `id` entera autoincremental como PK,
- preservar columnas existentes sin borrar datos innecesariamente.

Uso (desde `src`):

    python -m app.scripts.migrate_sesiones_login_schema --dry-run
    python -m app.scripts.migrate_sesiones_login_schema --apply
"""

from __future__ import annotations

import argparse

from sqlalchemy import inspect, text

from app.db import engine


def _type_name(column_type: object) -> str:
    return column_type.__class__.__name__.lower()


def build_plan() -> list[str]:
    insp = inspect(engine)
    if not insp.has_table("sesiones_login"):
        return []

    cols = {c["name"]: c for c in insp.get_columns("sesiones_login")}
    pk_cols = insp.get_pk_constraint("sesiones_login").get("constrained_columns") or []
    statements: list[str] = []

    has_id = "id" in cols
    has_legacy_id = "id_sesion" in cols

    if has_id:
        id_type = _type_name(cols["id"]["type"])
        if "int" not in id_type:
            # Si existe `id` pero no es entero, la migracion automatica segura
            # es compleja (depende de datos reales). Lo dejamos como validacion
            # para resolver manualmente si aparece.
            raise RuntimeError(
                "La columna sesiones_login.id existe pero no es INT. "
                "Requiere migracion manual."
            )

        if pk_cols != ["id"]:
            if pk_cols:
                statements.append("ALTER TABLE sesiones_login DROP PRIMARY KEY")
            statements.append("ALTER TABLE sesiones_login ADD PRIMARY KEY (id)")

    else:
        if pk_cols and pk_cols != ["id"]:
            statements.append("ALTER TABLE sesiones_login DROP PRIMARY KEY")

        statements.append(
            "ALTER TABLE sesiones_login "
            "ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST"
        )

        if has_legacy_id:
            # Mantener columna legacy para trazabilidad; el modelo ya no la usa.
            pass

    return statements


def run(apply: bool) -> None:
    plan = build_plan()
    if not plan:
        print("[OK] No hay cambios necesarios para sesiones_login.")
        return

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"[{mode}] Plan de migracion sesiones_login:")
    for i, stmt in enumerate(plan, start=1):
        print(f"  {i}. {stmt}")

    if not apply:
        return

    with engine.begin() as conn:
        for stmt in plan:
            conn.execute(text(stmt))

    print("[OK] Migracion aplicada correctamente.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migracion de sesiones_login")
    parser.add_argument("--apply", action="store_true", help="Aplica cambios en DB")
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra cambios")
    args = parser.parse_args()

    # Por defecto: dry-run
    apply = bool(args.apply)
    run(apply=apply)


if __name__ == "__main__":
    main()
