# Release Checklist - Ecommerce y flujo WhatsApp

Checklist operativo para validar el flujo completo antes de release.

## Flujo objetivo (definido)

1. Cliente arma su pedido en carrito.
2. Cliente se dirige a WhatsApp con mensaje predeterminado del pedido.
3. Cliente acuerda el pago con admin por WhatsApp/local.
4. Admin confirma la venta en el panel de pedidos.

## Precondiciones

- Backend arriba en http://127.0.0.1:8000
- Frontend arriba en http://localhost:5173
- Base de datos con productos activos y al menos un equipo con id_producto
- Usuario admin disponible para confirmar pedidos

## E2E funcional - Cliente

- Home muestra tarjetas sin duplicados por modelo
- "Ver detalle" abre /producto/:id y muestra datos del producto
- Desde detalle se puede agregar al carrito
- En carrito se pueden modificar cantidades y eliminar items
- Checkout genera pedido pendiente y link de WhatsApp
- Mensaje de WhatsApp incluye resumen del pedido

## E2E funcional - Admin

- Pedido nuevo aparece en panel admin de pedidos
- Confirmacion normal cambia estado a confirmado
- Si aplica verificacion comercial, aparece warning
- Admin puede confirmar forzado luego de verificar por WhatsApp/local

## Integridad y compatibilidad

- Endpoint legacy /equipos/post responde 410 (deprecado)
- Equipos activos usados para venta tienen id_producto no nulo
- Detalle de producto responde JSON valido (sin fallback HTML)

## Pruebas tecnicas

- Frontend: npm run build
- Frontend tests: npm test
- Backend tests foco carrito: pytest -q src/tests/test_checkout_carrito.py

## Hardening tecnico (post-MVP)

### Ya resuelto

- Home: key estable en cards para evitar warning de React por keys duplicadas.
- ORM: limpieza de relacion Equipo/Productos (sin overlaps warning en tests).
- Login/sesion: compatibilidad con esquema real de sesiones_login.
- Carrito: recuperacion automatica cuando el token local apunta a carrito viejo/cerrado.
- Admin pedidos: pedidos duplicados o sin stock se procesan como cancelado_sin_stock, sin quedar atascados.

### Pendiente recomendado antes de produccion

- Definir migraciones formales de DB (Alembic o equivalente) para evitar deriva de esquema entre entornos.
- Rotar SECRET_KEY JWT por una clave >= 32 bytes y guardarla en secreto seguro.
- Ejecutar una corrida E2E manual completa con evidencia (capturas o log de pasos).

## Criterio de salida

Se considera listo para release cuando:

- Todos los checks anteriores estan en verde
- No hay bloqueantes en flujo de compra/confirmacion
- Admin puede cerrar ventas sin inconsistencias de stock/estado
