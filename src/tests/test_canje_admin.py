from datetime import datetime, timedelta, timezone
from decimal import Decimal

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra modelos
from app.api.v1 import api_router
from app.config import SECRET_KEY
from app.db import Base, get_db
from app.models.canje import EquipoOfrecidoCanje, SolicitudCanje
from app.models.productos import CategoriaProducto, Productos
from app.models.roles import Rol
from app.models.usuarios import Usuario
from app.models.equipos import Equipo, ModeloEquipo
from app.services.tokens import ALGORITHM


def _make_access_token(sub: int, rol: str) -> str:
    payload = {
        "sub": str(sub),
        "email": "admin_local",
        "nombre": "Admin",
        "apellido": "User",
        "rol": rol,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@pytest.fixture
def client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_completar_solicitud_canje_descuenta_stock_y_marca_estado(client: TestClient):
    db = next(client.app.dependency_overrides[get_db]())
    try:
        rol_admin = Rol(nombre="admin")
        rol_cliente = Rol(nombre="cliente")
        db.add_all([rol_admin, rol_cliente])
        db.flush()

        admin = Usuario(
            nombre="Ada",
            apellido="Admin",
            email="admin_local",
            telefono="phone-admin",
            password_hash="x",
            id_rol=rol_admin.id,
        )
        cliente = Usuario(
            nombre="Luna",
            apellido="Cliente",
            email="cliente_local",
            telefono="phone-cliente",
            password_hash="x",
            id_rol=rol_cliente.id,
        )
        db.add_all([admin, cliente])
        db.flush()

        categoria = CategoriaProducto(nombre="Smartphones", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="iPhone 15 128GB",
            descripcion="",
            precio=Decimal("1000.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="iPhone 13", capacidad_gb=128, color="Negro", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="IMEI-12345",
            tipo_equipo="smartphone",
            estado_comercial="nuevo",
            activo=True,
        )
        db.add(equipo)
        db.flush()

        equipo_ofrecido = EquipoOfrecidoCanje(
            id_usuario=cliente.id,
            modelo="iPhone 13",
            capacidad_gb=128,
            color="Negro",
            bateria_porcentaje=90,
            estado_estetico="bueno",
            estado_funcional="bueno",
            activo=True,
        )
        db.add(equipo_ofrecido)
        db.flush()

        solicitud = SolicitudCanje(
            id_usuario=cliente.id,
            id_equipo_ofrecido=equipo_ofrecido.id_equipo_ofrecido,
            id_producto_interes=producto.id,
            valor_estimado=Decimal("450.00"),
            diferencia_a_pagar=Decimal("550.00"),
            metodo_pago="transferencia",
            estado="pendiente",
            fecha_solicitud=datetime.now(timezone.utc),
        )
        db.add(solicitud)
        db.commit()

        token = _make_access_token(admin.id, "admin")
        response = client.post(
            f"/api/v1/canje/solicitudes-admin/{solicitud.id_solicitud_canje}/completar",
            json={"metodo_pago": "transferencia"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["estado"] == "completado"
        assert body["metodo_pago"] == "transferencia"

        db.refresh(producto)
        db.refresh(equipo)
        db.refresh(solicitud)
        assert producto.activo is False
        assert equipo.activo is False
        assert equipo.estado_comercial == "vendido"
        assert solicitud.estado == "completado"
    finally:
        db.close()