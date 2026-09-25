# Evidencia de pruebas — UMG Personaliza

Pruebas unitarias, de caja blanca y de caja negra del backend, con sus
resultados. Todas se ejecutaron el 2026-09-24 contra el sistema levantado con
Docker (Node 20.20.2, MySQL 8.0) y se pueden repetir con los comandos de la
sección 2.

---

## 1. Resumen

| Tipo de prueba | Herramienta | Casos | Pasan | Evidencia |
|---|---|---:|---:|---|
| Unitarias | `node:test` (runner integrado de Node 20) | 50 | 50 | `qa/evidencia/pruebas-unitarias.tap` |
| Caja blanca | Grafo de flujo y caminos básicos, cobertura de `node --test` | 32 caminos | 32 | Sección 4 de este documento |
| Caja negra | Postman + Newman, 128 aserciones | 86 | 86 | `qa/evidencia/postman-newman.txt` |
| Interfaz, responsive y roles (2026-08-28) | Playwright + smoke de API | 75 | 75 | `qa/REPORTE_QA_COMPLETO.md` |

Las pruebas encontraron **10 defectos** en el backend. Todos están corregidos y
tienen una prueba que los cubre (sección 6).

---

## 2. Cómo repetir las pruebas

Con el sistema levantado (`docker compose up -d --build`):

```bash
# Pruebas unitarias y cobertura, dentro del contenedor del backend
docker compose exec backend npm test
docker compose exec backend npm run test:coverage

# Pruebas de caja negra: toda la colección Postman
cd docs/entrega/fuentes
npx newman run UMG_Personaliza.postman_collection.json --env-var baseUrl=http://localhost:8081
```

Las pruebas unitarias viven en `backend/tests/` y no necesitan base de datos:
prueban funciones puras y el middleware de autenticación con objetos falsos de
`req` y `res`. No se añadió ninguna dependencia; `node:test` y `node:assert`
vienen con Node.

La colección se puede ejecutar varias veces seguidas: todo lo que crea
(comprador, producto, área) lleva datos únicos y después se da de baja, y las
peticiones que modifican cuentas de demostración reenvían el valor que ya tenían.
El límite anti fuerza bruta del login admite unas 3 ejecuciones cada 5 minutos.

---

## 3. Pruebas unitarias

### 3.1 Casos por módulo

| Archivo | Módulo probado | Casos | Qué verifica |
|---|---|---:|---|
| `ordenAutomata.test.js` | `utils/ordenAutomata.js` | 10 | Estados, aristas del grafo, estados terminales y permisos por rol del autómata de pedidos |
| `auth.test.js` | `middlewares/auth.js` | 16 | JWT en cabecera y cookie, roles, firma falsa, algoritmo `none`, expiración y renovación con refresh |
| `password.test.js` | `utils/password.js` | 6 | bcrypt, hashes heredados sha256/sha512, límites de longitud, entradas vacías |
| `credencial.test.js` | `utils/credential_security.js` | 6 | Cifrado AES-256-GCM del QR, detección de QR alterado, firma RSA, generación del PNG |
| `pagos.test.js` | `utils/recurrente.js`, `utils/ordenCodigo.js` | 4 | Conversión a centavos, mínimo de la pasarela, códigos de orden únicos |
| `conversiones.test.js` | `utils/bit.js`, `utils/notificaciones.js` | 4 | Conversión de columnas `BIT` de MySQL y de los checkbox del formulario |
| `rateLimit.test.js` | `utils/rateLimit.js` | 4 | Límite de intentos, contador por IP y reinicio de la ventana |
| **Total** | | **50** | **50 pasan, 0 fallan (1.4 s)** |

### 3.2 Cobertura

Resultado de `npm run test:coverage` sobre los módulos probados:

| Módulo | Líneas | Ramas | Funciones | Sin cubrir |
|---|---:|---:|---:|---|
| `middlewares/auth.js` | 97.9 % | 78.7 % | 88.9 % | `clearAllAuthCookies` (la usa la ruta de logout) |
| `utils/ordenAutomata.js` | 100 % | 77.8 % | 100 % | — |
| `utils/password.js` | 100 % | 95.7 % | 100 % | — |
| `utils/credential_security.js` | 97.0 % | 66.7 % | 93.8 % | Error de arranque sin secreto y el código de barras Code128 |
| `utils/rateLimit.js` | 100 % | 100 % | 100 % | — |
| `utils/bit.js` | 100 % | 100 % | 100 % | — |
| `utils/notificaciones.js` | 100 % | 100 % | 100 % | — |
| `utils/ordenCodigo.js` | 100 % | 100 % | 100 % | — |
| `utils/recurrente.js` | 52.3 % | 100 % | 57.1 % | `crearCheckout`: llama a la API real de Recurrente, se prueba de punta a punta |

Las ramas que el informe da por no cubiertas en `ordenAutomata.js` son los
valores por defecto de las etiquetas (`LABELS_ESTADOS[x] || x`), no decisiones
del autómata: los 7 caminos básicos de la sección 4.1 están todos cubiertos.

---

## 4. Pruebas de caja blanca

Técnica: **prueba del camino básico**. Para cada función crítica se construye
su grafo de flujo, se calcula la complejidad ciclomática V(G) = nodos de
decisión + 1 y se diseña un caso por cada camino independiente. Se eligieron
las tres funciones de las que depende la seguridad y la integridad de los
pedidos.

### 4.1 `validarTransicionAutomata(estadoActual, nuevoEstado, rol)`

Decide si una orden puede pasar de un estado a otro. Nodos de decisión:

| Nodo | Condición |
|---|---|
| D1 | `!estadoActual \|\| !MAQUINA_ESTADOS[estadoActual]` |
| D2 | `estadoActual === nuevoEstado` |
| D3 | `transicionesPermitidas.length === 0` (estado terminal) |
| D4 | `!transicionesPermitidas.includes(nuevoEstado)` |
| D5 | el rol no es ADMIN ni ADMINISTRADOR |
| D6 | `!rolesPermitidos.includes(rol)` |

**V(G) = 6 + 1 = 7 caminos independientes.**

| Camino | Recorrido | Entrada de prueba | Resultado esperado | Prueba unitaria |
|---|---|---|---|---|
| C1 | D1 verdadero | `('inventado', 'en_ruta', 'ADMIN')` | inválido, "Estado actual desconocido" | rechaza un estado actual desconocido o vacío |
| C2 | D1 F → D2 V | `('en_ruta', 'en_ruta', 'REPARTIDOR')` | válido, `sinCambio` | mantener el mismo estado es válido… |
| C3 | D2 F → D3 V | `('entregada', 'en_ruta', 'ADMIN')` | inválido, "estado final" | los estados terminales no admiten más cambios |
| C4 | D3 F → D4 V | `('recibida', 'entregada', 'ADMIN')` | inválido, "Transición inválida" | rechaza saltos que no son aristas del grafo |
| C5 | D4 F → D5 F | `('en_ruta', 'entregada', 'administrador')` | válido | ADMINISTRADOR se trata igual que ADMIN… |
| C6 | D5 V → D6 V | `('recibida', 'en_elaboracion', 'REPARTIDOR')` | inválido, "no tiene autorización" | aplica los permisos por rol |
| C7 | D5 V → D6 F | `('en_ruta', 'entregada', 'REPARTIDOR')` | válido | aplica los permisos por rol |

Resultado: **7 de 7 caminos cubiertos y correctos.** Además, la prueba "acepta
todas las aristas del grafo" recorre las 14 transiciones legales del autómata.

### 4.2 `verificarPassword(plano, hashGuardado)`

Compara una contraseña con el hash guardado, que puede estar en tres formatos.
Nodos de decisión: entrada vacía; hash bcrypt (y dentro: candidata bcrypt,
candidata sha); hash sha256 (y dentro: candidata sha256, candidata sha512 o
bcrypt); hash sha512 (y dentro: candidata sha512, candidata sha256 o bcrypt).

**V(G) = 10 + 1 = 11 caminos independientes.**

| Camino | Hash guardado | Contraseña recibida | Esperado | Obtenido |
|---|---|---|---|---|
| P1 | cualquiera | vacía o `null` | `false` | `false` |
| P2 | bcrypt | el mismo hash bcrypt | `true` | `true` |
| P3 | bcrypt | un hash sha256 | `false` | `false` |
| P4 | bcrypt | texto (correcto / incorrecto) | `true` / `false` | `true` / `false` |
| P5 | sha256 | el hash sha256 en mayúsculas | `true` | `true` |
| P6 | sha256 | un hash sha512 | `false` | `false` |
| P7 | sha256 | texto (correcto / incorrecto) | `true` / `false` | `true` / `false` |
| P8 | sha512 | el mismo hash sha512 | `true` | `true` |
| P9 | sha512 | un hash sha256 | `false` | `false` |
| P10 | sha512 | texto (correcto / incorrecto) | `true` / `false` | `true` / `false` |
| P11 | formato desconocido | texto | `false` | `false` |

Resultado: **11 de 11 caminos cubiertos** (pruebas de `password.test.js`). La
comparación usa `crypto.timingSafeEqual`, así que el tiempo de respuesta no
revela cuántos caracteres del hash coinciden.

### 4.3 `makeAuth(...)` — middleware de autenticación

Valida el JWT de cada petición protegida y lo renueva con el refresh token.

**V(G) = 13 + 1 = 14 caminos independientes.**

| Camino | Situación | Esperado | Prueba unitaria |
|---|---|---|---|
| A1 | Sin token, ruta protegida | 401 `no_token` | sin token responde 401… |
| A2 | Sin token, ruta opcional | pasa como anónimo | sin token deja pasar… |
| A3 | Token válido, sin restricción de rol | pasa y puebla `req.auth` | token válido en la cabecera… |
| A4 | Token válido, rol permitido | pasa | el rol se compara sin distinguir mayúsculas |
| A5 | Token válido, rol no permitido | 403 `forbidden` | un rol no permitido recibe 403 |
| A6 | Token firmado sin `sub` ni `uid` | 401 `invalid_token` | un token bien firmado pero sin sub ni uid… |
| A7 | Firma falsa o algoritmo `none`, ruta protegida | 401 `invalid_token` | un token firmado con otro secreto…, rechaza el algoritmo none |
| A8 | Token inválido, ruta opcional | pasa como anónimo | un token inválido en una ruta opcional… |
| A9 | Expirado sin refresh, ruta protegida | 401 `token_expired` | token expirado sin refresh… |
| A10 | Expirado sin refresh, ruta opcional | pasa como anónimo | en una ruta opcional, cualquier fallo del refresh… |
| A11 | Refresh sin la marca `rt` | 401 `invalid_refresh` (o anónimo si es opcional) | un refresh sin la marca rt… |
| A12 | Refresh con firma falsa | 401 `refresh_failed` (o anónimo si es opcional) | un refresh con firma falsa… |
| A13 | Refresh válido | cookies nuevas y el rol se conserva | token expirado con refresh válido… |
| A14 | Token solo en la cookie | pasa | también acepta el token desde la cookie |

Resultado: **14 de 14 caminos cubiertos.**

---

## 5. Pruebas de caja negra

Se prueba la API sin mirar el código, solo con entradas y salidas. El diseño de
los casos usa cuatro técnicas:

- **Particiones de equivalencia:** para cada endpoint hay al menos un caso de la
  clase válida y, donde tiene sentido, uno de la clase inválida (datos que
  faltan, duplicados, recursos inexistentes, sin sesión, rol equivocado).
- **Valores límite:** en los rangos numéricos se prueba justo a cada lado del
  límite.
- **Transición de estados:** el ciclo de vida de una orden se recorre completo
  y se intentan transiciones prohibidas.
- **Tabla de decisión:** qué rol puede hacer qué.

### 5.1 Valores límite

| Regla | Límite | Valores probados | Resultado |
|---|---|---|---|
| Longitud de contraseña nueva | 6 a 200 caracteres | 5 ✗ · 6 ✓ · 200 ✓ · 201 ✗ | Pasa |
| Mínimo de cobro de la pasarela (GTQ) | 500 centavos | 499 ✗ · 500 ✓ | Pasa |
| Mínimo de cobro de la pasarela (USD) | 100 centavos | 99 ✗ · 100 ✓ | Pasa |
| Intentos de login | 25 cada 5 min por IP | intento 25 ✓ · 26 → 429 | Pasa (también observado en vivo) |
| Nickname del perfil | mínimo 2 caracteres | 1 ✗ (CN-39) | Pasa |
| Precio de un producto | ≥ 0 | −1 ✗ (CN-77) | Pasa |
| Estado de un usuario | 0 o 1 | 5 ✗ (CN-62) | Pasa |

### 5.2 Transición de estados de una orden

Recorrido ejecutado con una orden real creada por la colección:

| Paso | Actor | Transición | Esperado | Caso |
|---|---|---|---|---|
| 1 | Comprador | checkout → **recibida** | 201 | CN-31 |
| 2 | Repartidor | entregar una orden que no salió del taller | 409 | CN-44 |
| 3 | Repartidor | recibida → en_elaboracion (sin permiso) | 409 | CN-45 |
| 4 | Supervisor | → **en_elaboracion** | 200 | CN-46 |
| 5 | Supervisor | en_elaboracion → **en_ruta** | 200 | CN-47 |
| 6 | Repartidor | en_ruta → **entregada**, con foto y pago | 200 | CN-48 |
| 7 | Supervisor | entregada → en_ruta (estado terminal) | 409 | CN-49 |

### 5.3 Tabla de decisión de roles

| Acción | Sin sesión | Comprador | Repartidor | Supervisor | Administrador |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver carrito | 401 (CN-24) | ✓ | — | — | — |
| Ver dashboard de ventas | — | 403 (CN-53) | — | ✓ | — |
| Listar usuarios | — | 403 (CN-58) | — | — | ✓ |
| Mandar una orden al taller | — | — | 409 (CN-45) | ✓ | ✓ |
| Ver el perfil de otro usuario | — | — | — | — | 403 (CN-65) |

### 5.4 Resultados de la colección Postman

Ejecución con Newman: **86 peticiones, 128 aserciones, 0 fallos**, 11.7 s en
total y 46 ms de respuesta media. 29 casos son de la clase inválida.

| ID | Caso | Petición | Clase | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|---|
| CN-01 | Login — contraseña (Comprador) | `POST /login` | Válida | 200 | 200 | Pasa |
| CN-02 | Login — contraseña (Administrador) | `POST /login` | Válida | 200 | 200 | Pasa |
| CN-03 | Login — contraseña (Supervisor) | `POST /login` | Válida | 200 | 200 | Pasa |
| CN-04 | Login — contraseña (Repartidor) | `POST /login` | Válida | 200 | 200 | Pasa |
| CN-05 | Login con contraseña incorrecta (caso negativo) | `POST /login` | Inválida | 401 | 401 | Pasa |
| CN-06 | Login — reconocimiento facial (usuario sin foto) | `POST /login` | Inválida | 400 | 400 | Pasa |
| CN-07 | Login — código QR inválido (caso negativo) | `POST /login` | Inválida | 401 | 401 | Pasa |
| CN-08 | Registro de comprador | `POST /registro` | Válida | 201 | 201 | Pasa |
| CN-09 | Registro con usuario repetido (caso negativo) | `POST /registro` | Inválida | 400 | 400 | Pasa |
| CN-10 | Registro sin canal de notificación (caso negativo) | `POST /registro` | Inválida | 400 | 400 | Pasa |
| CN-11 | Verificar código de registro (código incorrecto) | `POST /verify-registration-code` | Inválida | 400 | 400 | Pasa |
| CN-12 | Reenviar código de verificación | `POST /resend-verification-code` | Válida | 200 | 200 | Pasa |
| CN-13 | Solicitar recuperación de contraseña | `POST /api/auth/forgot-password` | Válida | 200 | 200 | Pasa |
| CN-14 | Restablecer contraseña (código incorrecto) | `POST /api/auth/reset-password` | Inválida | 400 | 400 | Pasa |
| CN-15 | Validar usuario ya registrado | `POST /validar_unico` | Válida | 200 | 200 | Pasa |
| CN-16 | Validar usuario disponible | `POST /validar_unico` | Válida | 200 | 200 | Pasa |
| CN-17 | Validar sin parámetros (caso negativo) | `POST /validar_unico` | Inválida | 400 | 400 | Pasa |
| CN-18 | Listar productos | `GET /api/tienda/productos` | Válida | 200 | 200 | Pasa |
| CN-19 | Detalle de un producto | `GET /api/tienda/productos/1` | Válida | 200 | 200 | Pasa |
| CN-20 | Producto inexistente (caso negativo) | `GET /api/tienda/productos/{id}` | Inválida | 404 | 404 | Pasa |
| CN-21 | Listar categorías | `GET /api/tienda/categorias` | Válida | 200 | 200 | Pasa |
| CN-22 | Listar áreas de entrega | `GET /api/tienda/areas` | Válida | 200 | 200 | Pasa |
| CN-23 | Ver carrito | `GET /api/tienda/carrito` | Válida | 200 | 200 | Pasa |
| CN-24 | Ver carrito sin sesión (caso negativo) | `GET /api/tienda/carrito` | Inválida | 401 | 401 | Pasa |
| CN-25 | Agregar artículo al carrito | `POST /api/tienda/carrito/items` | Válida | 201 | 201 | Pasa |
| CN-26 | Cambiar cantidad de un artículo | `PUT /api/tienda/carrito/items/{id}` | Válida | 200 | 200 | Pasa |
| CN-27 | Quitar artículo del carrito | `DELETE /api/tienda/carrito/items/{id}` | Válida | 200 | 200 | Pasa |
| CN-28 | Agregar producto inexistente (caso negativo) | `POST /api/tienda/carrito/items` | Inválida | 404 | 404 | Pasa |
| CN-29 | Agregar artículo para el checkout | `POST /api/tienda/carrito/items` | Válida | 201 | 201 | Pasa |
| CN-30 | Checkout sin área de entrega (caso negativo) | `POST /api/tienda/checkout` | Inválida | 400 | 400 | Pasa |
| CN-31 | Realizar checkout | `POST /api/tienda/checkout` | Válida | 201 | 201 | Pasa |
| CN-32 | Checkout con carrito vacío (caso negativo) | `POST /api/tienda/checkout` | Inválida | 400 | 400 | Pasa |
| CN-33 | Mis órdenes (historial) | `GET /api/tienda/ordenes/mis` | Válida | 200 | 200 | Pasa |
| CN-34 | Detalle de una orden | `GET /api/tienda/ordenes/{codigo}` | Válida | 200 | 200 | Pasa |
| CN-35 | Descargar constancia PDF | `GET /api/tienda/ordenes/{codigo}/constancia` | Válida | 200 | 200 | Pasa |
| CN-36 | Reordenar una compra anterior | `POST /api/tienda/ordenes/{id}/reordenar` | Válida | 200 | 200 | Pasa |
| CN-37 | Ver perfil | `GET /api/tienda/perfil` | Válida | 200 | 200 | Pasa |
| CN-38 | Actualizar perfil | `PUT /api/tienda/perfil` | Válida | 200 | 200 | Pasa |
| CN-39 | Actualizar perfil con nickname corto (caso negativo) | `PUT /api/tienda/perfil` | Inválida | 400 | 400 | Pasa |
| CN-40 | Subir imagen personalizada | `POST /api/tienda/personalizacion/imagen` | Válida | 201 | 201 | Pasa |
| CN-41 | Rastrear orden por número de guía | `GET /api/tienda/ordenes/rastreo/{codigo}` | Válida | 200 | 200 | Pasa |
| CN-42 | Rastrear guía inexistente (caso negativo) | `GET /api/tienda/ordenes/rastreo/UMG-NOEXISTE00` | Inválida | 404 | 404 | Pasa |
| CN-43 | Buscar orden por código | `GET /api/tienda/ordenes/buscar/{codigo}` | Válida | 200 | 200 | Pasa |
| CN-44 | Entregar una orden que aún no sale del taller (caso negativo) | `POST /api/tienda/ordenes/{id}/entrega` | Inválida | 409 | 409 | Pasa |
| CN-45 | Repartidor intenta mandar al taller (caso negativo) | `PUT /api/tienda/ordenes/{id}/estado` | Inválida | 409 | 409 | Pasa |
| CN-46 | Pasar la orden a elaboración | `PUT /api/tienda/ordenes/{id}/estado` | Válida | 200 | 200 | Pasa |
| CN-47 | Salir a ruta | `PUT /api/tienda/ordenes/{id}/estado` | Válida | 200 | 200 | Pasa |
| CN-48 | Registrar entrega | `POST /api/tienda/ordenes/{id}/entrega` | Válida | 200 | 200 | Pasa |
| CN-49 | Cambiar el estado de una orden entregada (caso negativo) | `PUT /api/tienda/ordenes/{id}/estado` | Inválida | 409 | 409 | Pasa |
| CN-50 | Dashboard de ventas | `GET /api/tienda/dashboard/ventas` | Válida | 200 | 200 | Pasa |
| CN-51 | Listado de órdenes | `GET /api/tienda/ordenes/admin/list` | Válida | 200 | 200 | Pasa |
| CN-52 | Exportar órdenes a CSV | `GET /api/tienda/ordenes/export/csv` | Válida | 200 | 200 | Pasa |
| CN-53 | Dashboard con rol comprador (caso negativo) | `GET /api/tienda/dashboard/ventas` | Inválida | 403 | 403 | Pasa |
| CN-54 | Ping del módulo admin | `GET /admin/__ping` | Válida | 200 | 200 | Pasa |
| CN-55 | Roles (público) | `GET /admin/roles-public` | Válida | 200 | 200 | Pasa |
| CN-56 | Listar roles | `GET /admin/roles` | Válida | 200 | 200 | Pasa |
| CN-57 | Listar usuarios | `GET /admin/usuarios` | Válida | 200 | 200 | Pasa |
| CN-58 | Listar usuarios con rol comprador (caso negativo) | `GET /admin/usuarios` | Inválida | 403 | 403 | Pasa |
| CN-59 | Cambiar el rol de un usuario | `PUT /admin/usuarios/2/rol` | Válida | 200 | 200 | Pasa |
| CN-60 | Cambiar a un rol inexistente (caso negativo) | `PUT /admin/usuarios/2/rol` | Inválida | 400 | 400 | Pasa |
| CN-61 | Activar o desactivar un usuario | `PUT /admin/usuarios/2/estado` | Válida | 200 | 200 | Pasa |
| CN-62 | Estado fuera de rango (caso negativo) | `PUT /admin/usuarios/2/estado` | Inválida | 400 | 400 | Pasa |
| CN-63 | Ver mi propio perfil | `GET /admin/perfil/1` | Válida | 200 | 200 | Pasa |
| CN-64 | Actualizar mi propio perfil | `PUT /admin/perfil/1` | Válida | 200 | 200 | Pasa |
| CN-65 | Ver el perfil de otro usuario (caso negativo) | `GET /admin/perfil/2` | Inválida | 403 | 403 | Pasa |
| CN-66 | Subir foto de perfil sin archivo (caso negativo) | `POST /admin/perfil/foto` | Inválida | 400 | 400 | Pasa |
| CN-67 | Bitácora de auditoría | `GET /admin/auditoria` | Válida | 200 | 200 | Pasa |
| CN-68 | Bitácora de accesos | `GET /admin/access-logs` | Válida | 200 | 200 | Pasa |
| CN-69 | Estadísticas de acceso | `GET /admin/access-logs/stats` | Válida | 200 | 200 | Pasa |
| CN-70 | Exportar reportes | `POST /admin/reportes/export` | Válida | 200 | 200 | Pasa |
| CN-71 | Listar repartidores | `GET /admin/conductores` | Válida | 200 | 200 | Pasa |
| CN-72 | Historial de un repartidor | `GET /admin/conductores/{id}/historial` | Válida | 200 | 200 | Pasa |
| CN-73 | Crear producto | `POST /api/tienda/productos` | Válida | 201 | 201 | Pasa |
| CN-74 | Crear producto con slug repetido (caso negativo) | `POST /api/tienda/productos` | Inválida | 409 | 409 | Pasa |
| CN-75 | Crear producto sin precio (caso negativo) | `POST /api/tienda/productos` | Inválida | 400 | 400 | Pasa |
| CN-76 | Editar producto | `PUT /api/tienda/productos/{id}` | Válida | 200 | 200 | Pasa |
| CN-77 | Editar producto con precio negativo (caso negativo) | `PUT /api/tienda/productos/{id}` | Inválida | 400 | 400 | Pasa |
| CN-78 | Eliminar producto | `DELETE /api/tienda/productos/{id}` | Válida | 200 | 200 | Pasa |
| CN-79 | Catálogo completo (admin) | `GET /api/tienda/productos/admin/list` | Válida | 200 | 200 | Pasa |
| CN-80 | Áreas de entrega (admin) | `GET /api/tienda/areas/admin` | Válida | 200 | 200 | Pasa |
| CN-81 | Crear área de entrega | `POST /api/tienda/areas` | Válida | 201 | 201 | Pasa |
| CN-82 | Crear área sin nombre (caso negativo) | `POST /api/tienda/areas` | Inválida | 400 | 400 | Pasa |
| CN-83 | Editar área de entrega | `PUT /api/tienda/areas/{id}` | Válida | 200 | 200 | Pasa |
| CN-84 | Eliminar área de entrega | `DELETE /api/tienda/areas/{id}` | Válida | 200 | 200 | Pasa |
| CN-85 | Eliminar área inexistente (caso negativo) | `DELETE /api/tienda/areas/{id}` | Inválida | 404 | 404 | Pasa |
| CN-86 | Cerrar sesión | `POST /logout` | Válida | 200 | 200 | Pasa |

---

## 6. Defectos encontrados y corregidos

| # | Defecto | Cómo se detectó | Corrección | Prueba que lo cubre |
|---|---|---|---|---|
| 1 | Crear un área de entrega respondía 500 **después** de insertarla | Caja negra | `queryLocal` no devuelve una tupla; se quitó la desestructuración | CN-81 |
| 2 | Editar un área sin enviar `activo` la desactivaba | Revisión del caso anterior | Se conserva el valor actual si no llega | CN-83 |
| 3 | Crear un producto con un slug repetido respondía 500 | Caja negra | Responde 409 | CN-74 |
| 4 | Editar un producto enviando solo algunos campos respondía 500 y lo habría desactivado | Caja negra | Edición parcial: lo que no llega conserva su valor | CN-76, CN-77 |
| 5 | Cambiar el estado de un usuario con un valor ausente o inválido respondía 500 | Caja negra | Solo acepta 0 o 1, responde 400 | CN-62 |
| 6 | Listar repartidores respondía 500 siempre: consultaba la tabla `conductores`, que no existe | Caja negra | Se obtienen de los usuarios con rol Repartidor y de la bitácora de accesos | CN-71, CN-72 |
| 7 | En el registro, `notif_whatsapp=0` activaba WhatsApp: la cadena `'0'` es verdadera en JavaScript | Caja negra y unitaria | Se interpreta con `notificacionActiva` | CN-10, prueba unitaria de `notificacionActiva` |
| 8 | Registrar un usuario repetido respondía 500 culpando al envío del código | Caja negra | Responde 400 con el motivo | CN-09 |
| 9 | Un QR inválido respondía 400 "Faltan datos" y la pantalla de login no mostraba el aviso de QR | Caja negra | Responde 401 "QR inválido o expirado" | CN-07 |
| 10 | Se podía registrar la entrega de una orden en cualquier estado, incluso cancelada | Caja negra (transición de estados) | Solo se entregan órdenes en ruta, listas para entrega o no encontradas | CN-44 |

Además, los errores 500 de las áreas de entrega y del registro ya no devuelven
`err.message` al navegador, porque podía traer detalles internos de la base de
datos.

---

## 7. Alcance y limitaciones

- **Verificación del registro y restablecimiento de contraseña:** la colección
  los prueba en negativo porque el código de 6 dígitos llega por correo o
  WhatsApp. El caso positivo del registro está verificado en la auditoría del
  2026-09-20 leyendo el código real de la tabla `verificaciones` (hoja
  "Evidencia 1ra Revisión" de la matriz, pruebas 3.6 a 3.8).
- **Login facial y login con un QR real: pendientes de prueba manual.** Necesitan
  cámara, una persona y una credencial impresa, y el reporte de QA los deja
  expresamente para el equipo. Antes de la entrega hay que probar con un
  comprador recién registrado: (1) login con su rostro, (2) login con el rostro
  de otra persona, que debe fallar, y (3) login escaneando su credencial PDF.
- **Pago con tarjeta:** depende de las claves de Recurrente. `crearCheckout` no
  tiene prueba unitaria porque llama a la API real; sus reglas de negocio
  (centavos y mínimo) sí están probadas.
- **Frontend:** no tiene pruebas unitarias. Sus flujos, el diseño responsive y
  los permisos por rol están cubiertos por las 40 pruebas de interfaz con
  Playwright del reporte de QA.
