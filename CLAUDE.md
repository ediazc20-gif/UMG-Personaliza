# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the application (dev mode, from backend/)
cd backend && npm start    # node server.js on port 3000, serves frontend as fallback

# Docker (preferred for full environment)
docker compose up -d --build
docker compose down
docker compose logs -f
```

## Project Structure

```
UMG-Personaliza/
├── backend/          # Node.js/Express API server + WebSocket tracking
├── frontend/         # Static files served by Nginx (or Express in dev)
│   └── src/          # HTML, CSS, JS, models, fonts, assets
├── database/         # SQL initialization scripts
├── docker-compose.yml
└── .env              # Shared environment config
```

## Architecture

**UMG Personaliza** — Tienda online de productos personalizables con reconocimiento facial, tracking en tiempo real, constancias PDF con QR, notificaciones multicanal y panel administrativo.

### Stack
- **Backend:** Node.js 20, Express 4, WebSockets (`ws`) (in `backend/`)
- **Frontend:** Vanilla JS, served by Nginx in production, Express fallback in dev (in `frontend/src/`)
- **Database:** MySQL 8.0 (`umg_personaliza_db`)
- **Auth:** JWT (access + refresh tokens), bcrypt passwords, OTP por correo/WhatsApp
- **Face Recognition:** `@vladmandic/face-api` + TensorFlow.js; models in `frontend/src/models/`
- **PDF/QR:** pdf-lib + qrcode (credenciales y constancias de compra)
- **Containerization:** Docker Compose (Nginx frontend + Node.js backend + MySQL 8.0)

### Key Files
- `backend/server.js` — Express app init, route mounting, WebSocket tracking init
- `backend/database.js` — MySQL connection pool (`umg_personaliza_db`); exports query helpers
- `backend/middlewares/auth.js` — `makeAuth({ requireAuth, allowedRoles })` factory; JWT from header or cookie; auto-refresh
- `backend/routes/tienda/` — Carrito, órdenes, productos, personalización Lado A/B y perfil
- `backend/routes/auth/` — Login (contraseña, QR, facial), registro, OTP y reset password
- `backend/routes/messaging/whatsapp.js` — Integración WhatsApp (Baileys / Twilio)
- `backend/utils/ordenAutomata.js` — Máquina de estados finitos (FSM) para el ciclo de vida de pedidos
- `frontend/src/admin/administrador.html` — Panel administrativo SPA (Gestión, roles, productos, áreas, órdenes, WhatsApp, dashboard)
- `frontend/src/comprador/tienda.html` — Catálogo y personalizador interactivo
- `frontend/src/comprador/tracking.html` — Rastreo de envíos en tiempo real (WebSocket)
- `frontend/src/repartidor/entrega.html` — Interfaz de entrega con firma digital y escaneo QR
- `frontend/src/supervisor/dashboard.html` — Dashboard de métricas y ventas del campus
