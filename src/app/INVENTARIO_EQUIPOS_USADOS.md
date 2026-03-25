# Inventario: Modelos, Equipos y Equipos Usados

## 1. Las tres piezas del dominio

| Entidad | Tabla | Rol |
|--------|--------|-----|
| **Modelo de equipo** | `modelos_equipo` | Catálogo de “tipos” de equipo (ej. iPhone 14 128GB Negro). No es una unidad física. |
| **Equipo** | `equipos` | Una unidad física concreta: un celular con IMEI, estado comercial, tipo (nuevo/usado). Siempre pertenece a un modelo. |
| **Detalle de equipo usado** | `equipos_usados_detalle` | Condición de **un** equipo cuando es “usado”: batería, estado estético/funcional, pantalla, caja, etc. Opcional: solo si el equipo es usado. |

---

## 2. Relaciones (cómo se arma todo)

```
ModeloEquipo (1) ──────< (N) Equipo
     │                        │
     │                        │ 0..1 (opcional)
     │                        └──────────> EquipoUsadoDetalle
     │
     └── Un modelo tiene muchos equipos.
         Cada equipo tiene un solo modelo (id_modelo).
         Cada equipo puede tener o no un “detalle usado” (1:1).
```

- **Modelo** → muchos **Equipos**.  
  Ej.: modelo “iPhone 14 128GB” → equipo #1, #2, #3…
- **Equipo** → un **Modelo**.  
  Cada equipo tiene `id_modelo` (qué “tipo” es).
- **Equipo** → opcionalmente un **EquipoUsadoDetalle**.  
  Si el equipo es **usado**, creás un registro en `equipos_usados_detalle` con `id_equipo`; si es **nuevo**, no hay detalle usado.

En el modelo de datos:
- `Equipo.tipo_equipo` puede ser `"nuevo"` o `"usado"`.
- Si es usado, conviene tener un registro en `EquipoUsadoDetalle` para esa unidad (batería, rayas, caja, etc.).

---

## 3. Flujo de uso

### Equipo NUEVO

1. Crear **modelo** (si no existe):  
   `POST /api/v1/inventario/modelos` → ej. "iPhone 14", 128GB, Negro.
2. Crear **equipo** ligado a ese modelo:  
   `POST /api/v1/inventario/equipos` con `id_modelo`, IMEI, `tipo_equipo: "nuevo"`, `estado_comercial` (ej. "disponible").
3. Consultar:  
   `GET /api/v1/inventario/equipos` o `GET /api/v1/inventario/equipos/{id}` → respuesta incluye el **modelo** anidado (nombre, capacidad, color, etc.).

No se usa “equipo usado detalle” para equipos nuevos.

### Equipo USADO

1. **Modelo** y **Equipo** igual que arriba: primero el modelo, luego el equipo con `tipo_equipo: "usado"`.
2. Crear **detalle usado** para ese equipo:  
   `POST /api/v1/inventario/equipos-usados-detalle` con:
   - `id_equipo`: el id del equipo que creaste.
   - Batería %, estado estético/funcional, detalle pantalla/carcasa, si incluye caja/cargador, observaciones.
3. Para listar/ver usados:  
   `GET /api/v1/inventario/equipos-usados-detalle` y/o `GET /api/v1/inventario/equipos-usados-detalle/{id_detalle_usado}`.  
   Hoy la respuesta solo trae `id_equipo`; si querés “usado completo” (detalle + equipo + modelo), se puede agregar un endpoint o response con join (equipo + modelo anidado).

Resumen:
- **Modelo** = tipo de producto (catálogo).
- **Equipo** = unidad física (nuevo o usado).
- **Equipo usado detalle** = condición de esa unidad cuando es usada (una sola fila por equipo usado).

---

## 4. Campos importantes

### Modelo de equipo
- `nombre_modelo`, `capacidad_gb`, `color`, `descripcion`, `activo`.

### Equipo
- `id_modelo` (FK al modelo).
- `imei` (único por unidad).
- `tipo_equipo`: ej. `"nuevo"` o `"usado"`.
- `estado_comercial`: ej. `"disponible"`, `"vendido"`, `"reservado"`.
- `fecha_ingreso`, `activo`.

### Detalle equipo usado
- `id_equipo` (FK al equipo; un equipo usado tiene un solo detalle).
- `bateria_porcentaje`, `estado_estetico`, `estado_funcional`.
- `detalle_pantalla`, `detalle_carcasa`.
- `incluye_caja`, `incluye_cargador`, `observaciones`.

---

## 5. API (inventario)

| Recurso | GET list | GET one | POST | PATCH | DELETE |
|---------|----------|---------|------|-------|--------|
| **Modelos** | `/api/v1/inventario/modelos` | `/api/v1/inventario/modelos/{id_modelo}` | ✓ | ✓ | ✓ |
| **Equipos** | `/api/v1/inventario/equipos` (con **modelo** anidado) | `/api/v1/inventario/equipos/{id_equipo}` (con modelo) | ✓ | ✓ | ✓ |
| **Equipos usados (detalle)** | `/api/v1/inventario/equipos-usados-detalle` | `/api/v1/inventario/equipos-usados-detalle/{id_detalle_usado}` | ✓ | ✓ | ✓ |

- Crear **equipo**: siempre con `id_modelo` válido.
- Crear **detalle usado**: con `id_equipo` de un equipo que sea usado (y típicamente con `tipo_equipo: "usado"`).

---

## 6. Resumen en una frase

- **Modelo** = tipo (ej. iPhone 14 128GB).
- **Equipo** = una unidad concreta (nuevo o usado), ligada a un modelo.
- **Equipo usado detalle** = la “ficha de condición” de esa unidad cuando es usada (batería, rayas, caja, etc.); solo para equipos usados.
