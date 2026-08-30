# UMG Personaliza — Tienda Online de Productos Personalizables

Plataforma de comercio electrónico para el campus universitario **UMG Personaliza** (Proyecto Final de Desarrollo Web). Permite a los estudiantes y usuarios comprar y personalizar artículos universitarios (llaveros, playeras, tazas, tarjetas), realizar pagos en efectivo o tarjeta, dar seguimiento a su orden con tracking en tiempo real vía WebSockets, generar constancias y credenciales PDF con códigos QR, y gestionar pedidos con roles de Administrador, Supervisor, Repartidor y Comprador.

---

## 🏛️ Arquitectura del Sistema

```
UMG-Personaliza/
├── backend/                       # API REST + WebSocket (Node.js 20, Express 4)
│   ├── config/                    # Configuración de entorno y correo Nodemailer
│   ├── middlewares/               # Middleware de autenticación JWT y roles
│   ├── routes/
│   │   ├── auth/                  # Login (Pass/Facial/QR), Registro, OTP, Reset Password
│   │   ├── face/                  # Reconocimiento facial (face-api.js / TF.js)
│   │   ├── messaging/             # Notificaciones WhatsApp (Baileys / Twilio)
│   │   ├── tienda/                # Catálogo, Personalización A/B, Carrito, Órdenes, Perfil
│   │   └── usuarios/              # Gestión de usuarios, roles y auditoría
│   ├── utils/                     # Autómatas FSM, firma PDF, QR, bitácora de auditoría
│   ├── database.js                # Pool MySQL unificado (umg_personaliza_db)
│   └── server.js                  # Punto de entrada del servidor Express y WebSocket
│
├── frontend/                      # Cliente Web Responsive (Vanilla JS + Glassmorphism Nómada)
│   ├── nginx.conf                 # Configuración de Nginx proxy reverso y cabeceras de seguridad
│   └── src/
│       ├── admin/                 # Panel SPA de Administración (Usuarios, Roles, Auditoría, Órdenes, Dashboard, Áreas, WhatsApp)
│       ├── comprador/             # Vistas del Comprador (Tienda, Personalizador, Carrito, Checkout, Tracking en vivo, Historial, Perfil)
│       ├── repartidor/            # Vista móvil de Repartidor (Escaneo QR, Firma digital, Fotografía de entrega)
│       ├── supervisor/            # Dashboard de Ventas en tiempo real con métricas y exportación CSV
│       ├── css/                   # Sistema de diseño Nómada (Regla 60-30-10, Glassmorphism, tokens CSS)
│       ├── js/                    # API client, Auth, Cámara/Reconocimiento Facial, Notificaciones
│       ├── lib/                   # Librerías cliente (GSAP, ScrollTrigger, Lenis)
│       ├── models/                # Modelos pre-entrenados de detección y reconocimiento facial
│       └── index.html             # Landing page con acceso triple (Contraseña, QR, Facial)
│
├── database/                      # Scripts SQL estructurados para inicialización y datos de prueba
│   ├── init.sql                   # Estructura principal unificada (Roles, usuarios, auditoría)
│   ├── 02-ecommerce.sql           # Tablas de catálogo, carritos, órdenes, entregas y áreas
│   ├── 03-constancia-url.sql      # Extensión para constancias PDF y trazabilidad
│   └── 05-seed-users-stock.sql    # Usuarios de prueba para todos los roles y stock de productos
│
├── docs/                          # Documentación del proyecto
│   └── PROYECTO FINAL DESARROLLO WEB 2027.docx
│
├── qa/                            # Reportes de calidad y pruebas funcionales de extremo a extremo
│   ├── REPORTE_QA_COMPLETO.md
│   ├── REPORTE_QA_TIENDA.md
│   └── qa-tienda-smoke.ps1
│
├── docker-compose.yml             # Orquestación de contenedores (Frontend Nginx, Backend Node, MySQL 8)
├── .env.example                   # Plantilla de variables de entorno seguras
└── iniciar-proyecto.ps1           # Script de inicio rápido en 1 solo clic
```

---

## 👥 Roles del Sistema

| Rol | Vistas y Accesos | Funcionalidades Principales |
|---|---|---|
| **ADMIN** | `/admin/administrador.html` | Gestión de usuarios, asignación de roles, auditoría de accesos, productos, áreas de entrega del campus, WhatsApp y control de órdenes. |
| **SUPERVISOR** | `/supervisor/dashboard.html` | Dashboard de ventas en tiempo real, KPIs financieros, órdenes por estado, productos más vendidos y exportación de reportes CSV. |
| **REPARTIDOR** | `/repartidor/entrega.html` | Búsqueda por código UMG o escaneo QR, salida a ruta, confirmación de entrega con firma digital, foto de comprobante y registro de "No encontrado". |
| **COMPRADOR** | `/comprador/tienda.html` | Catálogo de productos, personalizador 3D interactivo Lado A / Lado B (filtros/stickers/texto), carrito, checkout, tracking y constancias PDF. |

---

## 🚀 Inicio Rápido con Docker

### 1. Requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución.
- Node.js 20+ (opcional para desarrollo local sin Docker).

### 2. Configuración de Entorno
Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

### 3. Levantar Contenedores
```bash
docker compose up -d --build
```
Esto iniciará automáticamente:
- **Frontend:** `http://localhost:8081` (Nginx)
- **Backend API:** `http://localhost:3000` (Node.js Express + WebSocket `/ws/tienda`)
- **Base de datos:** `localhost:3307` (MySQL 8.0 `umg_personaliza_db`)

---

## 🧪 Credenciales de Prueba

| Rol | Usuario | Contraseña |
|---|---|---|
| **Administrador** | `admin` | `admin123` |
| **Supervisor** | `supervisor` | `supervisor123` |
| **Repartidor** | `repartidor` | `repartidor123` |
| **Comprador** | `test` | `test123` |

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** Vanilla JavaScript (ES6+), HTML5 Canvas, CSS3 Glassmorphism (Paleta Nómada - Regla 60-30-10), GSAP, Chart.js, HTML5-QRCode.
- **Backend:** Node.js 20, Express 4, WebSockets (`ws`), JWT (JsonWebToken), Bcrypt, PDF-Lib, QRCode, Multer.
- **IA / Biometría Facial:** `@vladmandic/face-api`, TensorFlow.js (Extracción de descriptores faciales euclidianos de 128 dimensiones).
- **Base de Datos:** MySQL 8.0 relacional con pool de conexiones optimizado y auditoría auditable.
- **Mensajería:** Baileys (WhatsApp Web API open source) y Nodemailer (Gmail SMTP).
- **Seguridad:** Encriptación de contraseñas con bcrypt, sanitización contra SQL Injection y XSS, Rate Limiting, reCAPTCHA v2 y cabeceras de seguridad HTTP Nginx.
