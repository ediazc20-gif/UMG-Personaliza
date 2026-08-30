# UMG Personaliza — Tienda online

## Inicio rapido

```bash
docker compose up -d --build
```

| Rol | URL |
|-----|-----|
| Login | http://localhost:8081/ |
| Tienda | http://localhost:8081/comprador/tienda.html |
| Perfil | http://localhost:8081/comprador/perfil.html |
| Admin | http://localhost:8081/admin/administrador.html |
| Supervisor | http://localhost:8081/supervisor/dashboard.html |
| Repartidor | http://localhost:8081/repartidor/entrega.html |

### Credenciales

| Usuario | Password | Rol |
|---------|----------|-----|
| admin | admin123 | Administrador |
| test | test123 | Comprador |

## Migraciones BD (volumen MySQL ya existente)

```bash
docker compose exec -T mysql mysql -u root -pSistemaIA2025 umg_personaliza_db < database/02-ecommerce.sql
docker compose exec -T mysql mysql -u root -pSistemaIA2025 umg_personaliza_db < database/03-constancia-url.sql
```

## API tienda (principal)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/tienda/productos` | Catalogo publico |
| GET | `/api/tienda/productos/admin/list` | Admin: todos los productos |
| POST/PUT/DELETE | `/api/tienda/productos` | CRUD admin |
| POST | `/api/tienda/personalizacion/imagen` | Subir foto personalizada |
| GET/POST | `/api/tienda/carrito` | Carrito |
| POST | `/api/tienda/checkout` | Crear orden (+ reCAPTCHA opcional) |
| GET | `/api/tienda/ordenes/mis` | Historial |
| GET | `/api/tienda/ordenes/:codigo` | Tracking |
| GET | `/api/tienda/ordenes/:codigo/constancia` | PDF constancia |
| POST | `/api/tienda/ordenes/:id/entrega` | Repartidor confirma entrega |
| GET/PUT | `/api/tienda/perfil` | Perfil comprador |
| GET | `/api/tienda/dashboard/ventas` | Dashboard supervisor |
| GET | `/api/tienda/ordenes/admin/list` | Admin: listado ordenes |
| PUT | `/api/tienda/ordenes/:id/estado` | Cambiar estado (staff) |
| POST | `/api/auth/forgot-password` | Solicitar codigo reset |
| POST | `/api/auth/reset-password` | Nueva contrasena con codigo |
| WS | `/ws/tienda?codigo=XXX` | Tracking en vivo |

## reCAPTCHA (opcional)

En `.env`:

```
RECAPTCHA_SITE_KEY=tu_site_key
RECAPTCHA_SECRET_KEY=tu_secret_key
```

Sin keys, checkout funciona en modo desarrollo (verificacion omitida).

## Seguridad (actualizado)

- Sin fallbacks de Gmail ni `credential-default-secret` en codigo
- `docker-compose` exige `JWT_SECRET` y `MYSQL_ROOT_PASSWORD` desde `.env`
- reCAPTCHA fail-closed en produccion; local usa `RECAPTCHA_SKIP=true`
- WebSocket `/ws/tienda` requiere JWT + ownership de la orden
- Codigos de orden con CSPRNG; rate limit en forgot/reset
- Dependencias: multer 2.x, axios 1.20, nodemailer 9, express 4.21, ws 8.21

## Progreso vs docx ~80%

**Listo:** auth, tienda, personalizacion, carrito, checkout, PDF, tracking en vivo (WS auth), admin productos + ordenes, repartidor, dashboard, reset password, UI premium, hardening seguridad basico.

**Pendiente equipo:** Recurrente real, email notificaciones, docs UML/Bizagi, video ingles, deploy produccion, rotar App Password de Gmail si estuvo en git.

Ver **ASIGNACIONES_EQUIPO.md** para reparto de tareas.

## Rover legacy

`ROVER_ENABLED=false` por defecto. Compilador desactivado en flujo principal.
