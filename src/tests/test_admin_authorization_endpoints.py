from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra modelos en Base.metadata
from app.api.v1 import api_router
from app.config import SECRET_KEY
from app.db import Base, get_db
from app.services.tokens import ALGORITHM


def _make_access_token(sub: int, rol: str) -> str:
    payload = {
        "sub": str(sub),
        "email": "test@example.com",
        "nombre": "Test",
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


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/carrito/pedidos-pendientes",
        "/api/v1/marketplace/revisiones",
    ],
)
def test_admin_endpoints_require_authentication(client: TestClient, path: str):
    response = client.get(path)
    assert response.status_code == 401
    assert response.json()["detail"] == "Debes iniciar sesión."


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/carrito/pedidos-pendientes",
        "/api/v1/marketplace/revisiones",
    ],
)
def test_admin_endpoints_forbid_non_admin_role(client: TestClient, path: str):
    token = _make_access_token(sub=101, rol="cliente")
    response = client.get(path, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403
    assert "rol admin" in response.json()["detail"].lower()


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/carrito/pedidos-pendientes",
        "/api/v1/marketplace/revisiones",
    ],
)
def test_admin_endpoints_allow_admin_role(client: TestClient, path: str):
    token = _make_access_token(sub=1, rol="admin")
    response = client.get(path, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert isinstance(response.json(), list)
