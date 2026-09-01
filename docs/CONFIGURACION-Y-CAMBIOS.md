# Qué se configuró en esta rama y por qué

Rama `fix/hallazgos-auditoria` · base `main` @ `8e271c2` · 2026-08-31
Autor: Jose Emmanuel Felipe Franco

Resumen ejecutivo de los cambios. El detalle de cada uno, con el antes/después
medido, está en [`BITACORA_CAMBIOS.md`](BITACORA_CAMBIOS.md).

---

## De dónde salen estos cambios

Se auditó el repositorio contra el documento académico
`docs/PROYECTO FINAL DESARROLLO WEB 2027.docx`, verificando cada punto **contra el
sistema en ejecución** en vez de contra la matriz del Excel. Aparecieron cuatro
cosas que la matriz daba por cerradas y no lo estaban.

---

## 1. Se eliminó `database/03-constancia-url.sql`

**Por qué:** el script usaba `ADD COLUMN IF NOT EXISTS`, sintaxis de MariaDB que
MySQL 8 rechaza con `ERROR 1064`. El entrypoint de `mysql:8.0` **corta la cadena de
inicialización** en cuanto un script falla, así que `05-seed-users-stock.sql` nunca
se ejecutaba.

**Consecuencia que tenía:** cualquiera que clonara el repositorio arrancaba con 2
usuarios en lugar de 5 — no se podía entrar como `supervisor`, `repartidor` ni
`comprador` — y con todo el stock a 50, así que los badges de «Agotado» y «Últimas
existencias» no se podían demostrar.

**Se elimina en vez de corregirse** porque era redundante: `02-ecommerce.sql` ya
crea la columna `pdf_constancia_url` dentro del `CREATE TABLE` de `ordenes`.

Se actualizaron las referencias en `docker-compose.yml`, `README.md`, `TIENDA.md` y
`ASIGNACIONES_EQUIPO.md`.

> **Aparte:** `ASIGNACIONES_EQUIPO.md` traía la contraseña root de MySQL en texto
> plano dentro de un repositorio público. Se sustituyó por la variable de entorno.
> **La contraseña sigue en el historial de commits anteriores: hay que cambiarla en
> el servidor real.**

## 2. Se corrigieron las cabeceras de seguridad de `frontend/nginx.conf`

**Por qué:** en nginx, los `add_header` **no se heredan** a un bloque que declare
los suyos propios. El `location` de estáticos define cabeceras de caché, y eso
descartaba en silencio las cuatro de seguridad.

Medido antes del cambio:

| Recurso | Cabeceras de seguridad |
|---|---|
| `/` (HTML) | **0** |
| `.css` y `.js` | **0** |
| `/api/` | 4 |

Es decir, faltaban justo en todo lo que renderiza el navegador, que es donde
`X-Frame-Options` protege del clickjacking. Además no existía
`Content-Security-Policy`, pese a que el README la anunciaba.

**Qué se hizo:** se añadió la CSP y se repitió el juego completo de cinco cabeceras
dentro del bloque de estáticos, con un comentario que explica por qué está
duplicado para que nadie lo «limpie» sin saber que rompe la herencia.

La política se construyó inventariando lo que el frontend carga de verdad. Mantiene
`'unsafe-inline'` porque quedan scripts y estilos embebidos en las vistas (migrarlos
a nonces es una refactorización aparte), y `'wasm-unsafe-eval'` que necesita
face-api para el reconocimiento facial.

## 3. Se añadió el escáner QR a la vista del repartidor

**Por qué:** el documento lo pide dos veces (puntos 3.o y 4.a) y no existía.
`entrega.html` solo cargaba `/js/api.js` y su única búsqueda era manual. El escáner
sí estaba implementado, pero **solo en `index.html`** para el login por QR.

**Qué se hizo:** se reutilizó la misma librería (`html5-qrcode`) con una
implementación más simple. El módulo del login son ~250 líneas con tres motores de
decodificación porque también lee códigos de barras Code128; aquí solo hace falta
leer un QR.

El QR de la constancia contiene el código de orden en texto plano
(`constanciaCompra.js` usa `QRCode.toBuffer(orden.codigo)`), así que el escáner
vuelca el texto en el campo existente y dispara la búsqueda que ya había. **No se
modificó ninguna línea de la lógica de búsqueda ni de registro de entrega**: el
cambio es +96 líneas y 0 eliminadas.

Si la cámara falla, muestra un mensaje claro y reactiva el botón, de modo que nunca
bloquea la vía manual.

> **Pendiente de validar:** la decodificación real con una cámara física no se pudo
> probar. Hay que hacerlo en un móvil con una constancia impresa antes de la entrega.

## 4. Se reescribió `.github/workflows/deploy.yml`

**Por qué:** era una copia literal de otro proyecto. Desplegaba
`/opt/proyectos_universidad/proyecto_compiladores`, anunciaba el dominio
`compiladores.seguridadglobalumg.com` y se disparaba en una rama `test` que no
existe aquí. No podía ejecutarse nunca.

**Qué se hizo:** se reemplazó por dos trabajos.

- **`validar`** — corre en cada push y PR a `main` sobre `ubuntu-latest`. Valida el
  compose, levanta MySQL 8, aplica los scripts de `database/` en el orden real y
  **comprueba que queden al menos 5 usuarios y los 4 roles**. Es la red de seguridad
  del cambio 1: si alguien vuelve a introducir un SQL que aborte la inicialización,
  el CI falla de inmediato en vez de que el fallo aparezca semanas después en la
  máquina de otro integrante.
- **`desplegar`** — solo manual. Falla con un mensaje claro si no están configuradas
  las variables del repositorio, en lugar de desplegar a una ruta inventada. Lleva
  anotado qué falta para habilitarlo.

---

## Entregables añadidos

Cinco diagramas, todos derivados del código y del esquema reales:

| Diagrama | Cómo se generó |
|---|---|
| **Entidad-relación** | Consultando `information_schema` sobre la base en ejecución |
| **Arquitectura** | Inspeccionando los contenedores: IPs, puertos y red reales |
| **BPMN del proceso** | Estados y transiciones de `ordenAutomata.js`, verificadas ejecutando `validarTransicionAutomata()` |
| **Casos de uso** | Las 54 rutas de `backend/routes/` y sus `allowedRoles` |
| **Diagrama de clases** | Las 15 entidades del esquema + los módulos de `backend/utils/` |

```
docs/entrega/
├── fuentes/                                   editables y reimportables
└── imagenes de diagramas - Documentos - pdf/  los 5 PDFs entregables
```

Los fuentes se conservan porque son la única forma de reeditar los diagramas: la
cuenta de Lucid alcanzó el límite de documentos del plan gratuito.

---

## Qué NO se tocó

- **`backend/`** — ni una línea. Toda la lógica de servidor queda intacta.
- **`frontend/src/js/`**, los CSS y las otras 10 vistas HTML.
- **`database/init.sql`**, `02-ecommerce.sql` y `05-seed-users-stock.sql`.

De los 20 archivos de la rama, 12 son documentación nueva y solo 2 tocan código
ejecutable.

## Cómo verificar que nada se rompió

```bash
docker compose down -v && docker compose up -d --build
```

Debe dar: inicialización sin errores, 5 usuarios, stock variado, las 11 vistas en
HTTP 200 y 5 cabeceras de seguridad en `/`.

---

## Lo que sigue pendiente

Cinco bloqueos que **no se resuelven con código**:

1. **Sitio público con dominio y SSL** — falta para la primera revisión.
   `VALIDATION_SIGNING_PRODUCTION.md` indica que ya existe
   `seguridadglobalumg.com` con túnel y certificado: conviene preguntar antes de
   contratar un servidor nuevo.
2. **Repositorio privado + agregar a `jcordone1@miumg.edu.gt`** — requisito
   explícito del documento. Requiere permisos de administrador.
3. **Base de datos centralizada** — el documento dice «se proporciona la siguiente
   cadena de conexión» y no la incluye. Hay que pedirla.
4. **Commits de cada participante** — requisito evaluable; hoy hay 2 autores de 6.
5. **Pruebas unitarias, caja blanca y caja negra** — no hay ninguna y nadie las
   tiene asignadas. El trabajo `validar` del CI ya es el sitio donde correrían.
