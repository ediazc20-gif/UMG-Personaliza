# Bitácora de cambios — rama `fix/hallazgos-auditoria`

Registro de qué se movió, por qué, y cómo se verificó. Un apartado por cambio.

- **Autor:** Jose Emmanuel Felipe Franco
- **Rama base:** `main` @ `8e271c2`
- **Fecha de inicio:** 2026-08-31

Origen de los cambios: auditoría del repositorio contra el documento académico
`docs/PROYECTO FINAL DESARROLLO WEB 2027.docx`. Cada apartado enlaza con el requisito
del documento que cierra.

---

## Estado base verificado antes de tocar nada

Capturado el 2026-08-31 12:52 con el stack levantado (`docker compose ps`: los 3
contenedores arriba, mysql *healthy*).

| Comprobación | Resultado base |
|---|---|
| 11 vistas HTML | Todas HTTP 200 |
| Login `admin` / `supervisor` / `repartidor` / `test` | `ok: true` en los 4 |
| `GET /api/tienda/productos` | HTTP 200, 6 productos |
| Cabeceras de seguridad en `/` | **Ninguna** (ver cambio 3) |
| Cabeceras de seguridad en `/api/` | 4 presentes |

Cualquier cambio debe mantener estos resultados. Se vuelven a medir después de cada uno.

---

## Cambio 1 — Eliminar `03-constancia-url.sql`, que rompía la inicialización

**Requisito que toca:** ninguno directamente; desbloquea el arranque limpio para todo
el equipo y es condición previa para verificar cualquier otra cosa.

### Qué estaba mal

El script contenía una sola sentencia:

```sql
ALTER TABLE `ordenes`
  ADD COLUMN IF NOT EXISTS `pdf_constancia_url` VARCHAR(255) DEFAULT NULL AFTER `qr_entrega`;
```

`ADD COLUMN IF NOT EXISTS` es sintaxis de MariaDB. MySQL 8 no la soporta y responde
`ERROR 1064 (42000)`. El entrypoint de la imagen `mysql:8.0` aborta la cadena de
inicialización en cuanto un script falla, así que **`05-seed-users-stock.sql` nunca
llegaba a ejecutarse**.

Consecuencia en cualquier clon nuevo del repositorio:

- 2 usuarios en la base en lugar de 5 → no se podía entrar como `supervisor`,
  `repartidor` ni `comprador`.
- Todo el stock a 50, así que los badges de «Agotado» y «Últimas existencias»
  no se podían demostrar.

### Por qué se elimina en vez de corregirse

El script era además **redundante**. `database/02-ecommerce.sql` ya crea la columna
dentro del `CREATE TABLE` de `ordenes`, en la misma posición:

```
línea 19:  `qr_entrega`         TEXT DEFAULT NULL,
línea 20:  `pdf_constancia_url` VARCHAR(255) DEFAULT NULL,
```

Corregir la sintaxis habría dejado una migración que no aporta nada. Se elimina.

### Archivos tocados

| Archivo | Cambio |
|---|---|
| `database/03-constancia-url.sql` | Eliminado |
| `docker-compose.yml` | Quitado el montaje a `/docker-entrypoint-initdb.d/` |
| `README.md` | Quitado del árbol de directorios |
| `TIENDA.md` | Quitado el comando de migración |
| `ASIGNACIONES_EQUIPO.md` | Quitada la referencia en Persona F y el comando |

**Extra de seguridad:** `ASIGNACIONES_EQUIPO.md` traía la contraseña root de MySQL
en texto plano (`-pSistemaIA2025`) dentro de un repositorio público. Se sustituyó por
`-p"$MYSQL_ROOT_PASSWORD"`, igual que ya hacía `TIENDA.md`.

> La contraseña estuvo expuesta en el historial público. Cambiarla en el servidor
> real es responsabilidad pendiente de quien administre el despliegue: quitarla del
> archivo no la borra de los commits anteriores.

### Cómo se verificó

Se destruyó el volumen de MySQL y se reconstruyó desde cero (`docker compose down -v`
seguido de `docker compose up -d`), que es exactamente lo que vive un integrante que
clona el repositorio por primera vez.

| Comprobación | Antes | Después |
|---|---|---|
| Errores en la inicialización | `ERROR 1064` en el script 03 | Ninguno |
| Scripts ejecutados | 01, 02, 03 ✗ (corta) | 01, 02, 05 — todos |
| Usuarios en la base | 2 | 5 |
| Stock | todo a 50 | 35 / 4 / 0 / 20 / 2 / 15 |
| Columna `ordenes.pdf_constancia_url` | existe | sigue existiendo |
| 11 vistas HTML | 200 | 200 |
| Login de los 5 usuarios | 4 (tras seed manual) | 5, automático |
| `GET /api/tienda/productos` | 200 | 200 |

---

## Cambio 2 — Reescribir `.github/workflows/deploy.yml`, que era de otro proyecto

**Requisito que toca:** NF-4 (repositorio Git operativo) y la tarea «CI/CD
actualizado» de Persona F.

### Qué estaba mal

El workflow era una copia literal de un proyecto de compiladores:

- Desplegaba `/opt/proyectos_universidad/proyecto_compiladores`.
- Anunciaba el dominio `compiladores.seguridadglobalumg.com`.
- Se disparaba en `push` a la rama `test`, **que no existe en este repositorio**.
- Pedía `runs-on: self-hosted`, sin ningún runner dado de alta.

O sea: no podía ejecutarse nunca, y si alguien creaba una rama `test` habría
intentado desplegar el proyecto equivocado. Era código muerto que desinformaba.

### Qué se hizo

Se reemplazó por dos trabajos con responsabilidades separadas.

**`validar`** — corre en cada push y pull request a `main`, sobre `ubuntu-latest`
(sin runner propio, funciona desde ya):

1. Valida la sintaxis de `docker-compose.yml`.
2. Levanta un MySQL 8 y aplica los scripts de `database/` **en el orden real**.
3. Comprueba que quedan al menos 5 usuarios y los 4 roles cubiertos.
4. Construye las imágenes.

El paso 3 es la red de seguridad del Cambio 1: si alguien vuelve a introducir un
script SQL que aborte la cadena, el CI falla en vez de que el fallo aparezca
semanas después en la máquina de otro integrante.

**`desplegar`** — solo manual (`workflow_dispatch`), nunca automático. Falla con un
mensaje claro si no están configuradas las variables del repositorio, en lugar de
desplegar a una ruta inventada. Lleva anotado en comentarios qué falta para
habilitarlo.

### Dos errores propios detectados durante el cambio

Ambos se corrigieron antes de commitear:

1. **`secrets` en un condicional `if`.** Se escribió
   `if: ${{ always() && secrets.TELEGRAM_TOKEN != '' }}`, pero el contexto `secrets`
   no está disponible en los `if` de GitHub Actions (solo en `env`, `with` y `run`).
   La comprobación se movió dentro del `run`.

2. **Orden equivocado de los scripts SQL.** La primera versión usaba
   `ls database/*.sql | sort`, que pone `02-ecommerce.sql` antes que `init.sql`.
   Pero `docker-compose.yml` monta `init.sql` como `01-init.sql`, así que va
   primero. Con el orden alfabético el CI habría fallado siempre. Se sustituyó por
   la lista explícita, más un paso que compara esa lista contra los montajes de
   `docker-compose.yml` para que no se desincronicen.

### Cómo se verificó

- YAML parseado sin errores con `js-yaml`.
- Estructura inspeccionada: 2 trabajos, 7 y 3 pasos, disparadores `push`,
  `pull_request` y `workflow_dispatch`.
- La lógica del chequeo de deriva se ejecutó a mano contra el
  `docker-compose.yml` actual: coincide.

> El workflow no se ha ejecutado todavía en GitHub — solo corre en `main` y en
> pull requests hacia `main`. Su primera ejecución real será la de este PR.

---

## Cambio 3 — Cabeceras de seguridad que no se aplicaban, y CSP

**Requisito que toca:** CT-05 (seguridad OWASP). El README y la matriz del Excel
daban este punto por cumplido.

### Qué estaba mal

Dos problemas, y el primero es más grave que el que se había reportado.

**a) Las cabeceras existentes no llegaban a ninguna página.**
`nginx.conf` declaraba las cuatro cabeceras de seguridad a nivel `server`. Pero en
nginx los `add_header` **no se heredan** a un bloque que declare sus propios
`add_header`. El bloque `location ~* \.(html|js|css)$` define tres cabeceras de
caché, y eso descartaba en silencio las cuatro de seguridad.

Resultado medido antes del cambio:

| Recurso | Cabeceras de seguridad |
|---|---|
| `/` (HTML) | **0** |
| `/css/umg-glass.css` | **0** |
| `/js/api.js` | **0** |
| `/api/tienda/productos` | 4 |

Es decir: llegaban solo a las respuestas de la API, y faltaban justo en todo lo que
un navegador renderiza — que es donde `X-Frame-Options` protege del clickjacking.

**b) No había `Content-Security-Policy`.** Ni a nivel `server` ni en ningún
`location`, pese a que el README la anunciaba.

### Qué se hizo

1. Se añadió `Content-Security-Policy` al bloque `server`.
2. Se repitió el juego completo de cinco cabeceras dentro del `location` de
   estáticos, con un comentario que explica por qué está duplicado, para que nadie
   lo «limpie» sin darse cuenta de que rompe la herencia.

La política se construyó a partir de un inventario de lo que el frontend carga de
verdad, no a ojo:

| Directiva | Orígenes y motivo |
|---|---|
| `script-src` | `cdn.jsdelivr.net` (face-api, Chart.js, Bootstrap), `unpkg.com` (html5-qrcode, ZXing), `cdnjs.cloudflare.com`, `www.google.com` + `www.gstatic.com` (reCAPTCHA) |
| `style-src` | `cdn.jsdelivr.net`, `cdnjs.cloudflare.com` (Font Awesome), `fonts.googleapis.com` |
| `font-src` | `fonts.gstatic.com`, `cdnjs.cloudflare.com`, `data:` |
| `img-src` | `data:` y `blob:` (canvas y fotos base64), `ui-avatars.com` |
| `connect-src` | `ws:` / `wss:` para el tracking en `/ws/tienda` |
| `frame-src` | `www.google.com` para el iframe de reCAPTCHA |
| `object-src` | `'none'` |

**Concesiones conscientes**, anotadas también en el propio `nginx.conf`:

- `'unsafe-inline'` en `script-src` y `style-src`. Las vistas tienen `<script>`
  embebidos en 7 archivos, 87 atributos `style=` y 5 handlers `onclick`. Migrarlos
  a nonces es una refactorización grande; queda como deuda. Tener CSP con
  `unsafe-inline` sigue siendo mejor que no tenerla: `object-src 'none'`,
  `base-uri`, `form-action` y la lista blanca de orígenes sí protegen.
- `'wasm-unsafe-eval'`, que necesita face-api / TensorFlow.js para el
  reconocimiento facial.

### Cómo se verificó

Primero en consola:

- `nginx -t` dentro del contenedor **antes** de recargar, con rollback automático
  preparado por si fallaba.
- Cabeceras contadas por tipo de recurso tras reconstruir la imagen:
  `/`, `.css`, `.js`, `/api/` y `entrega.html` → **5 de 5 en todos**.
- Las 11 vistas siguen devolviendo 200.

Y después en un navegador real (Chrome), que es donde una CSP mal escrita se nota:

| Página | Resultado |
|---|---|
| `/` (landing) | Renderiza completa. `faceapi`, `Html5Qrcode` y `ZXing` definidos; 111 fuentes y 6 hojas de estilo cargadas |
| `/supervisor/dashboard.html` | `Chart` v4.4.0 cargado y dibujando ejes en el canvas |
| `/admin/administrador.html` | SPA completa: sidebar, iconos, tabla con los 5 usuarios |
| `/repartidor/entrega.html` | Renderiza; CSP activa confirmada en la respuesta |

`performance.getEntriesByType('resource')` reportó **0 recursos fallidos** en todas
ellas. Login por `fetch` a `/login` correcto, lo que valida `connect-src`.

### Observación ajena a este cambio

En el panel de admin, los desplegables de rol muestran «Administrador» para
*Comprador Pruebas*, *Repartidor Campus* y *Test Usuario*, cuando en la base sus
roles son Comprador, Repartidor y Comprador. *Supervisor Ventas* sí aparece bien.
Parece que el `<select>` no preselecciona el rol real. **Es un fallo previo, no
introducido aquí**, y no se tocó para no mezclar cambios. Queda anotado para
revisarlo aparte.

---

## Cambio 4 — Escáner QR en la vista del repartidor

**Requisitos que cierra:** 3.o y 4.a del documento académico. Eran los dos únicos
requisitos funcionales en rojo.

### Qué estaba mal

El documento lo pide dos veces:

> 3.o — «el repartidor deberá **escanear el código QR**, verificar el estado de la
> compra y proceder a realizar la entrega»
>
> 4.a — «podrá buscar una compra mediante ingreso directo por teclado **y**
> escáner de un código QR»

La matriz del Excel daba REQ-23 por cumplido, citando «HTML5-QRCode scanner
integrado». No era cierto: `entrega.html` solo cargaba `/js/api.js` y sus únicos
controles de búsqueda eran el campo `#codigo` y el botón `#btnBuscar`.
Comprobado también en el navegador antes de tocar nada: `Html5Qrcode` no estaba
definido en esa página.

El escáner sí existía, pero **solo en `index.html`**, para el login por QR.

### Qué se hizo

Se añadió el escáner a `entrega.html` reutilizando la misma librería que ya usa
el login (`html5-qrcode` desde unpkg), pero con una implementación deliberadamente
más simple.

**Por qué no se reutilizó el código de `auth.js`:** ese módulo son unas 250 líneas
con tres motores de decodificación (BarcodeDetector nativo, ZXing y Html5Qrcode),
recorte de imagen y filtro de alto contraste. Toda esa complejidad existe porque el
login también lee **códigos de barras Code128** de las credenciales. El repartidor
solo necesita leer un QR, así que basta con `Html5Qrcode.start()`. Duplicar 250
líneas para no usar el 80% habría sido peor.

**Qué contiene el QR:** `backend/utils/constanciaCompra.js:58` lo genera con
`QRCode.toBuffer(orden.codigo)`, es decir el código de orden en texto plano
(formato `UMG-XXXX…`). Por eso el escáner solo tiene que volcar el texto leído en
`#codigo` y disparar el botón de búsqueda que ya existía: **no se tocó nada de la
lógica de búsqueda ni de registro de entrega**.

Detalles de la implementación:

- Cámara trasera por defecto (`facingMode: 'environment'`), que es la útil en un
  móvil.
- Bandera `escaneando` para que un QR no dispare la búsqueda varias veces mientras
  la cámara sigue enfocándolo.
- La cámara se libera al cancelar, al leer un código y en `pagehide`, para no
  dejarla encendida si se abandona la vista.
- Mensajes distintos según el fallo: permiso denegado, sin cámara, o error
  genérico. En los tres casos se reactiva el botón y se invita a teclear el código,
  de modo que **el escáner nunca bloquea la vía manual**.

### Cómo se verificó

| Comprobación | Resultado |
|---|---|
| Sintaxis del bloque `<script>` (253 líneas) | Válida, parseada con `new Function` |
| `Html5Qrcode` definido en la página | Sí (antes: no) |
| Carga de unpkg bajo la nueva CSP | Correcta, 0 recursos fallidos |
| Botón, contenedor y handler presentes | Sí; panel oculto al inicio |
| Camino de error sin cámara disponible | Muestra «No se pudo abrir la camara. Escribe el codigo a mano.» y reactiva el botón |
| Punto de integración (rellenar `#codigo` + `click` en `#btnBuscar`) | Ejecuta la búsqueda y pinta el resultado |
| Las 11 vistas | 200 |
| Login de los 5 usuarios | Correcto |

> **Lo que NO se pudo probar aquí:** la decodificación real de un QR con una cámara
> física. El entorno de prueba no tiene cámara utilizable, así que se verificó el
> camino de error y el punto de integración, no el escaneo en sí. **Antes de la
> entrega hay que probarlo en un móvil real** con una constancia impresa o en
> pantalla. Es la única parte de estos cuatro cambios que queda pendiente de
> validación en dispositivo.

### Deuda anotada

`index.html` y ahora `entrega.html` cargan `https://unpkg.com/html5-qrcode` **sin
fijar versión**. Si unpkg sirve una versión mayor con cambios incompatibles, el
escaneo puede romperse sin que nadie toque el repositorio. Conviene fijar la
versión en ambos sitios. No se cambió aquí para no alterar el login en el mismo
commit.

---

## Cambio 5 — Diagrama entidad-relación

**Requisitos que cierra:** CT-13 y entregable 1.1.2.7. También el punto «Diagrama de
base de datos» de la **primera revisión**, que vale 2 puntos y estaba sin hacer.

**Riesgo: ninguno.** Es un archivo nuevo, `docs/entrega/DIAGRAMA_ER.md`. No toca
código, ni configuración, ni base de datos. Estrena además la carpeta
`docs/entrega/` que el plan del equipo daba por existente.

### Cómo se generó

No está dibujado a mano ni deducido del modelo previsto: se consultó
`information_schema` sobre la base **levantada desde cero** con Docker Compose. Los
tipos, claves e índices son los que MySQL reporta.

El diagrama va en formato Mermaid, que GitHub renderiza solo al abrir el archivo, y
se puede exportar a imagen desde mermaid.live para la presentación.

### Qué contiene

- Las 15 entidades con todas sus columnas, tipos y claves.
- Las 16 relaciones con su cardinalidad.
- Tabla de las 12 claves foráneas declaradas.
- Tabla de las 4 relaciones **sin declarar** (ver abajo).
- Cuatro observaciones sobre decisiones de diseño del modelo.
- Los comandos exactos para regenerarlo si el esquema cambia.

### Hallazgo: cuatro relaciones sin restricción

| Columna | Debería apuntar a |
|---|---|
| `carritos.id_usuario` | `usuarios.Id_Usuario` |
| `ordenes.id_usuario` | `usuarios.Id_Usuario` |
| `orden_items.id_producto` | `productos.id` |
| `entregas.id_repartidor` | `usuarios.Id_Usuario` |

Funcionan como clave foránea en el código, pero la base **no las verifica**: hoy
nada impide insertar una orden con un `id_usuario` inexistente. Se documenta pero
**no se corrige aquí**, porque añadir cuatro `FOREIGN KEY` a tablas con datos es un
cambio de esquema que merece su propia migración y sus propias pruebas.

### Cómo se verificó

Las 15 entidades del diagrama se compararon una a una contra las 15 tablas reales
de `information_schema.TABLES`: **coinciden exactamente, sin diferencias**. El
bloque Mermaid se parseó para confirmar que no hay entidades duplicadas (15
entidades, 16 relaciones).

---

## Resumen de la rama

| # | Cambio | Requisito | Archivos |
|---|---|---|---|
| 1 | Eliminar `03-constancia-url.sql` | Arranque limpio | 5 archivos, 1 eliminado |
| 2 | Reescribir el workflow de CI | NF-4 | `.github/workflows/deploy.yml` |
| 3 | Cabeceras de seguridad + CSP | CT-05 | `frontend/nginx.conf` |
| 4 | Escáner QR del repartidor | 3.o y 4.a | `frontend/src/repartidor/entrega.html` |
| 5 | Diagrama entidad-relación | CT-13 y 1.1.2.7 | `docs/entrega/DIAGRAMA_ER.md` (nuevo) |

Estado final verificado: 11 vistas en 200, los 5 usuarios autentican, 5/5 cabeceras
de seguridad en todos los tipos de recurso, API respondiendo, y la base se levanta
desde cero sin errores ni intervención manual.

