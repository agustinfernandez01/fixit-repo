# Fix It API v1 – Peticiones para Postman

**Base URL:** `http://localhost:8000` (ajusta el puerto si usas otro)

**Headers para POST/PATCH:**  
`Content-Type: application/json`

---

## Cómo probar (orden sugerido)

1. **Usuarios y roles** (ya los tenés): crear al menos un usuario y saber su `id_usuario` para usarlo en reparaciones, canje y marketplace.
2. **Inventario:** crear **modelo** → **equipo** → opcional: **depósito**, **equipo-depósito**, **equipo-usado-detalle**.
3. **Reparaciones:** crear **tipo de reparación** → crear **solicitud de reparación** (con `id_usuario`).
4. **Marketplace:** crear **publicación** (con `id_usuario`) → opcional: **revisión**.
5. **Canje:** crear **equipo ofrecido** (con `id_usuario`) → crear **solicitud de canje** (con `id_usuario`, `id_equipo_ofrecido`, `id_producto_interes`).

---

## 1. INVENTARIO — `/api/v1/inventario`

### Modelos de equipo
| Método | URL | Descripción |
|--------|-----|-------------|
| GET | `http://localhost:8000/api/v1/inventario/modelos` | Listar (query: `?skip=0&limit=50`) |
| POST | `http://localhost:8000/api/v1/inventario/modelos` | Crear |
| GET | `http://localhost:8000/api/v1/inventario/modelos/{id_modelo}` | Obtener uno |
| PATCH | `http://localhost:8000/api/v1/inventario/modelos/{id_modelo}` | Actualizar |
| DELETE | `http://localhost:8000/api/v1/inventario/modelos/{id_modelo}` | Borrar |

**POST body ejemplo (modelo):**
```json
{
  "nombre_modelo": "iPhone 14",
  "capacidad_gb": 128,
  "color": "Negro",
  "descripcion": "Modelo 2022",
  "activo": true
}
```

### Equipos
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/inventario/equipos` |
| POST | `http://localhost:8000/api/v1/inventario/equipos` |
| GET | `http://localhost:8000/api/v1/inventario/equipos/{id_equipo}` |
| PATCH | `http://localhost:8000/api/v1/inventario/equipos/{id_equipo}` |
| DELETE | `http://localhost:8000/api/v1/inventario/equipos/{id_equipo}` |

**POST body ejemplo (equipo):**
```json
{
  "id_modelo": 1,
  "imei": "123456789012345",
  "tipo_equipo": "smartphone",
  "estado_comercial": "nuevo",
  "activo": true
}
```

### Equipos usados (detalle)
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/inventario/equipos-usados-detalle` |
| POST | `http://localhost:8000/api/v1/inventario/equipos-usados-detalle` |
| GET | `http://localhost:8000/api/v1/inventario/equipos-usados-detalle/{id_detalle_usado}` |
| PATCH | `http://localhost:8000/api/v1/inventario/equipos-usados-detalle/{id_detalle_usado}` |
| DELETE | `http://localhost:8000/api/v1/inventario/equipos-usados-detalle/{id_detalle_usado}` |

**POST body ejemplo:**
```json
{
  "id_equipo": 1,
  "bateria_porcentaje": 85,
  "estado_estetico": "bueno",
  "estado_funcional": "perfecto",
  "detalle_pantalla": "sin rayas",
  "detalle_carcasa": "marcas leves",
  "incluye_caja": false,
  "incluye_cargador": true,
  "observaciones": "Primer dueño"
}
```

### Depósitos
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/inventario/depositos` |
| POST | `http://localhost:8000/api/v1/inventario/depositos` |
| GET | `http://localhost:8000/api/v1/inventario/depositos/{id_deposito}` |
| PATCH | `http://localhost:8000/api/v1/inventario/depositos/{id_deposito}` |
| DELETE | `http://localhost:8000/api/v1/inventario/depositos/{id_deposito}` |

**POST body ejemplo:**
```json
{
  "nombre": "Depósito Central",
  "direccion": "Av. Siempre Viva 123",
  "descripcion": "Principal",
  "activo": true
}
```

### Equipo–Depósito (asignar equipo a depósito)
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/inventario/equipo-deposito` |
| POST | `http://localhost:8000/api/v1/inventario/equipo-deposito` |
| GET | `http://localhost:8000/api/v1/inventario/equipo-deposito/{id_equipo_deposito}` |
| PATCH | `http://localhost:8000/api/v1/inventario/equipo-deposito/{id_equipo_deposito}` |
| DELETE | `http://localhost:8000/api/v1/inventario/equipo-deposito/{id_equipo_deposito}` |

**POST body ejemplo:**  
`id_equipo` puede ser un equipo **nuevo** o **usado**: primero creás el equipo con `POST /equipos` (con `tipo_equipo: "nuevo"` o `"usado"`), luego asignás ese `id_equipo` al depósito con este endpoint.
```json
{
  "id_equipo": 1,
  "id_deposito": 1
}
```

---

## 2. REPARACIONES — `/api/v1/reparaciones`

### Tipos de reparación
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/reparaciones/tipos` |
| POST | `http://localhost:8000/api/v1/reparaciones/tipos` |
| GET | `http://localhost:8000/api/v1/reparaciones/tipos/{id_tipo_reparacion}` |
| PATCH | `http://localhost:8000/api/v1/reparaciones/tipos/{id_tipo_reparacion}` |
| DELETE | `http://localhost:8000/api/v1/reparaciones/tipos/{id_tipo_reparacion}` |

**POST body ejemplo (tipo):**
```json
{
  "nombre": "Cambio de pantalla",
  "descripcion": "Pantalla original",
  "precio_base": "150.00",
  "tiempo_estimado": 60
}
```

### Solicitudes de reparación
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/reparaciones/solicitudes` |
| GET | `http://localhost:8000/api/v1/reparaciones/solicitudes?estado=ingresado` |
| POST | `http://localhost:8000/api/v1/reparaciones/solicitudes` |
| GET | `http://localhost:8000/api/v1/reparaciones/solicitudes/{id_reparacion}` |
| PATCH | `http://localhost:8000/api/v1/reparaciones/solicitudes/{id_reparacion}` |
| DELETE | `http://localhost:8000/api/v1/reparaciones/solicitudes/{id_reparacion}` |

**POST body ejemplo (solicitud):**  
Reemplazá `id_usuario` por un ID real de tu tabla usuarios.
```json
{
  "id_usuario": 1,
  "modelo": "iPhone 14",
  "capacidad_gb": 128,
  "color": "Negro",
  "imei": "123456789012345",
  "falla_reportada": "Pantalla rota",
  "estado": "ingresado",
  "precio_estimado": "150.00",
  "observaciones": "Garantía vigente"
}
```

---

## 3. MARKETPLACE (usados) — `/api/v1/marketplace`

### Publicaciones
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/marketplace/publicaciones` |
| GET | `http://localhost:8000/api/v1/marketplace/publicaciones?estado=aprobado` |
| POST | `http://localhost:8000/api/v1/marketplace/publicaciones` |
| GET | `http://localhost:8000/api/v1/marketplace/publicaciones/{id_publicacion}` |
| PATCH | `http://localhost:8000/api/v1/marketplace/publicaciones/{id_publicacion}` |
| DELETE | `http://localhost:8000/api/v1/marketplace/publicaciones/{id_publicacion}` |

**POST body ejemplo:**  
Reemplazá `id_usuario` por un ID real.
```json
{
  "id_usuario": 1,
  "modelo": "Samsung Galaxy S21",
  "capacidad_gb": 256,
  "color": "Phantom Black",
  "titulo": "S21 256GB impecable",
  "descripcion": "Poco uso, con caja",
  "precio_publicado": "450.00",
  "estado": "pendiente_revision"
}
```

### Revisiones de publicación
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/marketplace/revisiones` |
| POST | `http://localhost:8000/api/v1/marketplace/revisiones` |
| GET | `http://localhost:8000/api/v1/marketplace/revisiones/{id_revision}` |
| PATCH | `http://localhost:8000/api/v1/marketplace/revisiones/{id_revision}` |
| DELETE | `http://localhost:8000/api/v1/marketplace/revisiones/{id_revision}` |

**POST body ejemplo (revisión):**
```json
{
  "id_publicacion": 1,
  "estado_revision": "aprobado",
  "observaciones": "Todo correcto"
}
```

---

## 4. CANJE — `/api/v1/canje`

### Equipos ofrecidos para canje
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/canje/equipos-ofrecidos` |
| GET | `http://localhost:8000/api/v1/canje/equipos-ofrecidos?activo=true` |
| POST | `http://localhost:8000/api/v1/canje/equipos-ofrecidos` |
| GET | `http://localhost:8000/api/v1/canje/equipos-ofrecidos/{id_equipo_ofrecido}` |
| PATCH | `http://localhost:8000/api/v1/canje/equipos-ofrecidos/{id_equipo_ofrecido}` |
| DELETE | `http://localhost:8000/api/v1/canje/equipos-ofrecidos/{id_equipo_ofrecido}` |

**POST body ejemplo:**  
Reemplazá `id_usuario` por un ID real.
```json
{
  "id_usuario": 1,
  "modelo": "iPhone 12",
  "capacidad_gb": 64,
  "color": "Blanco",
  "bateria_porcentaje": 88,
  "estado_estetico": "bueno",
  "estado_funcional": "perfecto",
  "incluye_caja": false,
  "incluye_cargador": true,
  "activo": true
}
```

### Solicitudes de canje
| Método | URL |
|--------|-----|
| GET | `http://localhost:8000/api/v1/canje/solicitudes` |
| GET | `http://localhost:8000/api/v1/canje/solicitudes?estado=pendiente` |
| POST | `http://localhost:8000/api/v1/canje/solicitudes` |
| GET | `http://localhost:8000/api/v1/canje/solicitudes/{id_solicitud_canje}` |
| PATCH | `http://localhost:8000/api/v1/canje/solicitudes/{id_solicitud_canje}` |
| DELETE | `http://localhost:8000/api/v1/canje/solicitudes/{id_solicitud_canje}` |

**POST body ejemplo:**  
`id_usuario`, `id_equipo_ofrecido` y `id_producto_interes` deben existir en la DB (producto puede ser de catálogo del compañero; si no tenés tabla productos, este endpoint puede fallar por FK).
```json
{
  "id_usuario": 1,
  "id_equipo_ofrecido": 1,
  "id_producto_interes": 1,
  "valor_estimado": "200.00",
  "diferencia_a_pagar": "150.00",
  "estado": "pendiente"
}
```

---

## Resumen rápido por módulo

| Módulo      | Prefijo base                         |
|------------|--------------------------------------|
| Inventario | `GET/POST .../api/v1/inventario/...` |
| Reparaciones | `GET/POST .../api/v1/reparaciones/...` |
| Marketplace | `GET/POST .../api/v1/marketplace/...` |
| Canje      | `GET/POST .../api/v1/canje/...`      |

- **GET** sin body.  
- **POST / PATCH:** Body raw → JSON, y header `Content-Type: application/json`.  
- **DELETE:** sin body; 204 = éxito.  
- Reemplazá `{id_...}` por el número que devolvió un POST o un GET previo.  
- Si la API corre en otro host/puerto, cambia `http://localhost:8000` por tu base URL.

Documentación interactiva: **http://localhost:8000/docs**
