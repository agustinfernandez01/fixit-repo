"""
Módulo INVENTARIO DE EQUIPOS (mi alcance).
Solo: modelos de equipo, equipos, detalle usados, depósitos, equipo-depósito.
No incluye: catálogo productos, pedidos ni pagos (los hace el compañero).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    ModeloEquipo,
    Equipo,
    EquipoUsadoDetalle,
    Deposito,
    EquipoDeposito,
)
from app.schemas.inventario import (
    ModeloEquipoCreate,
    ModeloEquipoUpdate,
    ModeloEquipoResponse,
    EquipoCreate,
    EquipoUpdate,
    EquipoResponse,
    EquipoUsadoDetalleCreate,
    EquipoUsadoDetalleUpdate,
    EquipoUsadoDetalleResponse,
    DepositoCreate,
    DepositoUpdate,
    DepositoResponse,
    EquipoDepositoCreate,
    EquipoDepositoUpdate,
    EquipoDepositoResponse,
)

router = APIRouter()


@router.get("/modelos", response_model=list[ModeloEquipoResponse])
def listar_modelos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(ModeloEquipo).offset(skip).limit(limit).all()


@router.post("/modelos", response_model=ModeloEquipoResponse, status_code=status.HTTP_201_CREATED)
def crear_modelo(payload: ModeloEquipoCreate, db: Session = Depends(get_db)):
    obj = ModeloEquipo(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/modelos/{id_modelo}", response_model=ModeloEquipoResponse)
def obtener_modelo(id_modelo: int, db: Session = Depends(get_db)):
    obj = db.query(ModeloEquipo).filter(ModeloEquipo.id_modelo == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    return obj


@router.patch("/modelos/{id_modelo}", response_model=ModeloEquipoResponse)
def actualizar_modelo(id_modelo: int, payload: ModeloEquipoUpdate, db: Session = Depends(get_db)):
    obj = db.query(ModeloEquipo).filter(ModeloEquipo.id_modelo == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/modelos/{id_modelo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_modelo(id_modelo: int, db: Session = Depends(get_db)):
    obj = db.query(ModeloEquipo).filter(ModeloEquipo.id_modelo == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/equipos", response_model=list[EquipoResponse])
def listar_equipos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(Equipo).offset(skip).limit(limit).all()


@router.post("/equipos", response_model=EquipoResponse, status_code=status.HTTP_201_CREATED)
def crear_equipo(payload: EquipoCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_ingreso") is None:
        data["fecha_ingreso"] = datetime.now(timezone.utc)
    obj = Equipo(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/equipos/{id_equipo}", response_model=EquipoResponse)
def obtener_equipo(id_equipo: int, db: Session = Depends(get_db)):
    obj = db.query(Equipo).filter(Equipo.id_equipo == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return obj


@router.patch("/equipos/{id_equipo}", response_model=EquipoResponse)
def actualizar_equipo(id_equipo: int, payload: EquipoUpdate, db: Session = Depends(get_db)):
    obj = db.query(Equipo).filter(Equipo.id_equipo == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/equipos/{id_equipo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_equipo(id_equipo: int, db: Session = Depends(get_db)):
    obj = db.query(Equipo).filter(Equipo.id_equipo == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/equipos-usados-detalle", response_model=list[EquipoUsadoDetalleResponse])
def listar_equipos_usados_detalle(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(EquipoUsadoDetalle).offset(skip).limit(limit).all()


@router.post(
    "/equipos-usados-detalle",
    response_model=EquipoUsadoDetalleResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_equipo_usado_detalle(payload: EquipoUsadoDetalleCreate, db: Session = Depends(get_db)):
    obj = EquipoUsadoDetalle(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/equipos-usados-detalle/{id_detalle_usado}", response_model=EquipoUsadoDetalleResponse)
def obtener_equipo_usado_detalle(id_detalle_usado: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoUsadoDetalle)
        .filter(EquipoUsadoDetalle.id_detalle_usado == id_detalle_usado)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Detalle de usado no encontrado")
    return obj


@router.patch("/equipos-usados-detalle/{id_detalle_usado}", response_model=EquipoUsadoDetalleResponse)
def actualizar_equipo_usado_detalle(
    id_detalle_usado: int,
    payload: EquipoUsadoDetalleUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(EquipoUsadoDetalle)
        .filter(EquipoUsadoDetalle.id_detalle_usado == id_detalle_usado)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Detalle de usado no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/equipos-usados-detalle/{id_detalle_usado}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_equipo_usado_detalle(id_detalle_usado: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoUsadoDetalle)
        .filter(EquipoUsadoDetalle.id_detalle_usado == id_detalle_usado)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Detalle de usado no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/depositos", response_model=list[DepositoResponse])
def listar_depositos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(Deposito).offset(skip).limit(limit).all()


@router.post("/depositos", response_model=DepositoResponse, status_code=status.HTTP_201_CREATED)
def crear_deposito(payload: DepositoCreate, db: Session = Depends(get_db)):
    obj = Deposito(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/depositos/{id_deposito}", response_model=DepositoResponse)
def obtener_deposito(id_deposito: int, db: Session = Depends(get_db)):
    obj = db.query(Deposito).filter(Deposito.id_deposito == id_deposito).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")
    return obj


@router.patch("/depositos/{id_deposito}", response_model=DepositoResponse)
def actualizar_deposito(id_deposito: int, payload: DepositoUpdate, db: Session = Depends(get_db)):
    obj = db.query(Deposito).filter(Deposito.id_deposito == id_deposito).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/depositos/{id_deposito}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_deposito(id_deposito: int, db: Session = Depends(get_db)):
    obj = db.query(Deposito).filter(Deposito.id_deposito == id_deposito).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/equipo-deposito", response_model=list[EquipoDepositoResponse])
def listar_equipo_deposito(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(EquipoDeposito).offset(skip).limit(limit).all()


@router.post(
    "/equipo-deposito",
    response_model=EquipoDepositoResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_equipo_deposito(payload: EquipoDepositoCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_asignacion") is None:
        data["fecha_asignacion"] = datetime.now(timezone.utc)
    obj = EquipoDeposito(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/equipo-deposito/{id_equipo_deposito}", response_model=EquipoDepositoResponse)
def obtener_equipo_deposito(id_equipo_deposito: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoDeposito)
        .filter(EquipoDeposito.id_equipo_deposito == id_equipo_deposito)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Registro equipo-depósito no encontrado")
    return obj


@router.patch("/equipo-deposito/{id_equipo_deposito}", response_model=EquipoDepositoResponse)
def actualizar_equipo_deposito(
    id_equipo_deposito: int,
    payload: EquipoDepositoUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(EquipoDeposito)
        .filter(EquipoDeposito.id_equipo_deposito == id_equipo_deposito)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Registro equipo-depósito no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/equipo-deposito/{id_equipo_deposito}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_equipo_deposito(id_equipo_deposito: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoDeposito)
        .filter(EquipoDeposito.id_equipo_deposito == id_equipo_deposito)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Registro equipo-depósito no encontrado")
    db.delete(obj)
    db.commit()
    return None
