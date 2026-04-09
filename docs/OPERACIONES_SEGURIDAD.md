# Operaciones - Migraciones y SECRET_KEY

Guia resumida para evitar errores entre entornos y endurecer autenticacion.

## 1) Migracion minima de sesiones_login

Problema que evita:

- diferencias de esquema entre entornos (por ejemplo `id_sesion` vs `id`),
- errores al iniciar sesion por tipos incompatibles.

### Ejecutar

Desde `src`:

```bash
python -m app.scripts.migrate_sesiones_login_schema --dry-run
python -m app.scripts.migrate_sesiones_login_schema --apply
```

## 2) Rotacion de SECRET_KEY para JWT

Problema que evita:

- clave debil para HS256,
- warnings y menor seguridad de tokens.

### Generar una clave robusta

Desde `src`:

```bash
python -m app.scripts.generate_secret_key
```

Copiar el resultado en `src/.env`:

```env
SECRET_KEY=<pegar_valor_generado>
```

### Reiniciar servicios

Luego de cambiar la clave, reiniciar backend y frontend.

Nota: al rotar SECRET_KEY, los tokens actuales dejan de ser validos y los usuarios deben volver a iniciar sesion.
