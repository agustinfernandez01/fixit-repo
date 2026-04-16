# Home - Regla de deduplicacion

Este documento describe la logica usada por el Home del cliente para mostrar tarjetas sin repetidos.

## Objetivo

Mostrar una sola tarjeta representativa por modelo en la seccion destacada de equipos, evitando ruido visual cuando hay multiples unidades del mismo modelo.

## Fuente de datos

- Vista: client/src/pages/client/HomeView.tsx
- API: GET /api/v1/inventario/equipos

## Filtro inicial

Solo se consideran equipos que cumplan todo lo siguiente:

- activo = true
- nombre del modelo contiene "iphone"
- estado comercial es "nuevo" (o comienza con "nuevo")

## Orden de prioridad

Antes de deduplicar se ordena con esta prioridad:

1. Equipos con id_producto vinculado primero
2. Equipos con foto_url primero
3. Fecha de ingreso mas reciente primero

Esto hace que la tarjeta representativa elegida por modelo sea la mas vendible para ecommerce.

## Clave de deduplicacion

- Clave principal: id_modelo
- Fallback: id_equipo (si por algun motivo no existe id_modelo)

Regla: al recorrer la lista ordenada, el primer equipo de cada clave es el que se muestra en Home.

## Impacto funcional

- Reduce tarjetas duplicadas por modelo.
- Prioriza tarjetas listas para compra (producto vinculado).
- Mejora calidad visual al preferir equipos con foto.

## Nota de mantenimiento

Si se cambia esta logica, validar que siga alineada con:

- Ruta dedicada de detalle (/producto/:id)
- Boton "Ver detalle" desde Home
- Boton "Agregar al carrito" en card y detalle
