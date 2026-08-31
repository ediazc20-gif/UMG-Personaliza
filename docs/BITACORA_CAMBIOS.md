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

