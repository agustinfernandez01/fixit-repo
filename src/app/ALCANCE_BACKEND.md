# Alcance del backend – Fix It

División clara de responsabilidades en el backend.

---

## Yo desarrollo (mis módulos)

Estos **routers y lógica** los implemento yo. Las tablas están en el ER y los modelos en `app.models`; las rutas están bajo `/api/v1/`.

| Módulo | Prefijo API | Tablas que uso |
|--------|-------------|----------------|
| **Inventario de equipos** | `/api/v1/inventario` | `modelos_equipo`, `equipos`, `equipos_usados_detalle`, `depositos`, `equipo_deposito` |
| **Marketplace de usados** | `/api/v1/marketplace` | `publicaciones`, `revision_publicacion` |
| **Reparaciones** | `/api/v1/reparaciones` | `tipos_reparacion`, `reparaciones` |
| **Canje** | `/api/v1/canje` | `equipos_ofrecidos_canje`, `solicitudes_canje` |

Solo expongo endpoints para estas tablas. Uso `usuarios` y `productos` como **FK** (p. ej. en canje), pero no creo rutas de ABM de usuarios ni de catálogo.

---

## Mi compañero desarrolla (sus módulos)

Él implementa **autenticación/usuarios**, **catálogo de productos** y **carrito/compra/pedido/pago**. Yo no toco esas rutas ni esa lógica.

| Área | Tablas (él las usa) | Notas |
|------|---------------------|--------|
| **Autenticación / usuarios** | `roles`, `usuarios`, `sesiones_login` | Login, registro, perfiles, roles. |
| **Catálogo de productos** | `categoria_producto`, `productos` | CRUD categorías y productos. |
| **Carrito / compra / pedido / pago** | `pedidos`, `detalle_pedido`, `pagos` | Flujo de compra, carrito, checkout. |

Las **tablas** pueden estar creadas en el mismo proyecto (y en `app.models`) para que las FK de mis tablas funcionen; lo que queda claro es que **las rutas y la lógica de esos flujos son de él**.

---

## Resumen

- **Yo:** inventario de equipos, marketplace usados, reparaciones, canje → solo `/api/v1/inventario`, `/api/v1/marketplace`, `/api/v1/reparaciones`, `/api/v1/canje`.
- **Compañero:** autenticación/usuarios, catálogo productos, carrito/pedido/pago → sus propios routers y endpoints (no incluidos en los que yo desarrollo).
