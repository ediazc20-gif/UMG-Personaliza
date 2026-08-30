# UMG Personaliza — Asignaciones equipo (Desarrollo Web 2027)

Estado del proyecto: **~80%** del documento académico. Core e-commerce funcional en local.

**QA pre-asignaciones (2026-08-28):** `qa/qa-tienda-smoke.ps1` → **35/35 PASS**. Admin responsive (menú hamburguesa). Ver `qa/REPORTE_QA_TIENDA.md`.

## Lo ya implementado (no reasignar)

| Modulo | Estado |
|--------|--------|
| Auth (password, QR, facial con detección) + registro wizard | Listo ✅ |
| Roles: Comprador, Repartidor, Admin, Supervisor | Listo ✅ |
| Catalogo con buscador en vivo, filtros y ordenamiento | Listo ✅ |
| Control de stock y badges de agotado en productos | Listo ✅ |
| Carrito, checkout y reordenar con 1 clic en historial | Listo ✅ |
| Personalizacion Lado A/B (foto + filtros faciales dinámicos + texto) | Listo ✅ |
| PDF constancia post-compra con descarga directa | Listo ✅ |
| Admin CRUD productos y Áreas de Entrega | Listo ✅ |
| Dashboard ventas supervisor con Exportación CSV | Listo ✅ |
| Repartidor: buscar orden, foto, firma manuscrita digital en canvas, pago efectivo | Listo ✅ |
| Perfil comprador (nickname) y Perfil Administrador | Listo ✅ |
| Tracking estilo Cargo Expreso público con No. de guía y WebSocket en vivo | Listo ✅ |
| Admin gestion ordenes / estados con Exportación CSV | Listo ✅ |
| Notificaciones automáticas por correo de estado de orden | Listo ✅ |
| Servidor WhatsApp Open Source (Baileys Multi-Device, QR, alertas y PDF sin costo) | Listo ✅ |
| Registro de auditoría automático en BD para acciones de tienda | Listo ✅ |
| Rate limiting en Login y Checkout | Listo ✅ |
| Seguridad HTTP Nginx (X-Frame-Options, CSP, nosniff) | Listo ✅ |
| Recuperacion de contrasena (correo + codigo) | Listo ✅ |
| Scripts de arranque rápido en 1 clic (`iniciar-proyecto.ps1` y `.sh`) | Listo ✅ |
| Diseño editorial unificado (Arquetipo Nómada - Adrian Sáenz) | Listo ✅ |

---

## Asignaciones sugeridas

### Persona A — Integraciones y pasarela de pago
**Prioridad: Alta**

- Integrar **Recurrente** real (API sandbox/produccion) reemplazando `MOCK-RCC-*`
- Webhook de confirmacion de pago
- Guardar `ref_pago` en BD (`database/04-ref-pago.sql`)
- Pruebas Postman collection `/api/tienda/checkout`

**Entregables:** Postman export, doc integracion Recurrente, 3 casos de prueba (aprobado/rechazado/timeout)

---

### Persona B — Tracking tiempo real y experiencia de usuario
**Prioridad: Media**

- ~~WebSocket tracking en vivo~~ ✅ (`/ws/tienda`, comprador tracking.html)
- ~~Email automático de estados~~ ✅ (`mailer.js`)
- Notificacion push en navegador / badge visual reactivo en navbar comprador
- Mejoras de feedback acústico o micro-animaciones al recibir estado

---

### Persona C — Documentacion academica y QA
**Prioridad: Alta (entrega curso)**

- Manual de usuario comprador (PDF con capturas del flujo completo en tema Nómada)
- Video demo en **ingles** (3–5 min): registro → compra → tracking
- Casos de prueba E2E documentados
- UML: casos de uso e-commerce, diagrama ER tienda, flujo Bizagi (checkout)

**Entregables:** carpeta `docs/entrega/` con PDFs + link video

---

### Persona D — Seguridad y auditoría
**Prioridad: Media**

- ~~Recuperacion de contraseña (email + token)~~ ✅ (`/recuperar.html`)
- ~~Rate limit login / checkout~~ ✅
- Registro de logs de auditoria en base de datos para acciones de tienda
- Configurar reCAPTCHA produccion en `.env` (si se adquieren keys reales)

**Entregables:** checklist OWASP basico, script de verificación de seguridad

---

### Persona E — Operaciones y datos de prueba
**Prioridad: Media**

- ~~UI admin: gestion **areas de entrega**~~ ✅
- ~~Vista ordenes / cambiar estado~~ ✅ (seccion Ordenes tienda)
- ~~Export CSV ventas y órdenes~~ ✅
- Poblar catálogo inicial con fotos reales de artículos UMG (tazas, sudaderos, stickers)
- Crear seed de usuarios Repartidor de prueba adicionales en base de datos

**Entregables:** catálogo inicial cargado con imágenes, datos demo listos

---

### Persona F — DevOps y despliegue
**Prioridad: Media**

- CI/CD actualizado para despliegue automatizado
- Migraciones SQL documentadas (`02-ecommerce.sql`, `03-constancia-url.sql`)
- Nginx produccion: configuración SSL/TLS y volumen de `/uploads` persistente
- Variables `.env.example` sincronizadas con documentación

**Entregables:** README deploy actualizado, verificación en servidor de producción

---

## Migraciones BD (Base de Datos Unificada)

```bash
docker compose exec -T mysql mysql -u root -pSistemaIA2025 umg_personaliza_db < database/02-ecommerce.sql
docker compose exec -T mysql mysql -u root -pSistemaIA2025 umg_personaliza_db < database/03-constancia-url.sql
```

## URLs locales

| Rol | URL |
|-----|-----|
| Login | http://localhost:8081/ |
| Tienda | http://localhost:8081/comprador/tienda.html |
| Admin | http://localhost:8081/admin/administrador.html |
| Supervisor | http://localhost:8081/supervisor/dashboard.html |
| Repartidor | http://localhost:8081/repartidor/entrega.html |

## Credenciales

| Usuario | Password | Rol |
|---------|----------|-----|
| admin | admin123 | Administrador |
| test | test123 | Comprador |

## Reunion sugerida (30 min)

1. Demo flujo comprador (10 min)
2. Asignar A–F segun preferencia (10 min)
3. Fecha entrega parcial + integracion Recurrente (10 min)

---

*Generado para reparto de tareas — ajustar nombres del equipo antes de enviar.*
