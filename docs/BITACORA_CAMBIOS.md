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

