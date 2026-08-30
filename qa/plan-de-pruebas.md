# Plan Maestro de Testing — SZ8
**Responsable:** ALEX  
**Fecha:** 2026-04-16  
**Total casos:** 49

## Módulo 1: Registro y Login (req #1–#10)

| ID | Descripción | Pasos | Resultado esperado | Prioridad |
|----|-------------|-------|--------------------|-----------|
| TC01 | Registro con datos válidos | Ingresar nombre, usuario, correo, contraseña válidos → Enviar | Usuario creado, código OTP enviado por correo | Alta |
| TC02 | Registro con correo duplicado | Intentar registrar correo ya existente | Error: "Correo ya registrado" | Alta |
| TC03 | Registro con usuario duplicado | Intentar registrar usuario ya existente | Error: "Usuario ya en uso" | Alta |
| TC04 | Verificación OTP válido | Ingresar código de 6 dígitos correcto | Registro completado, credencial generada | Alta |
| TC05 | Verificación OTP expirado | Ingresar código OTP después de 15 min | Error: "Código expirado" | Media |
| TC06 | Login con contraseña | Ingresar usuario y contraseña correctos | Sesión iniciada, redirect a dashboard | Alta |
| TC07 | Login con credenciales incorrectas | Contraseña equivocada | Error: "Credenciales inválidas" | Alta |
| TC08 | Login por reconocimiento facial | Activar cámara y mostrar rostro registrado | Sesión iniciada correctamente | Alta |
| TC09 | Login por QR | Escanear QR de la credencial PDF | Sesión iniciada correctamente | Alta |
| TC10 | Logout | Click en cerrar sesión | Sesión terminada, redirect a login | Alta |

## Módulo 2: Credencial PDF (req #11–#15)

| ID | Descripción | Pasos | Resultado esperado | Prioridad |
|----|-------------|-------|--------------------|-----------|
| TC11 | Generar credencial PDF | Completar registro → esperar generación | PDF con QR cifrado, firma, avatar, logo UMG | Alta |
| TC12 | QR cifrado en credencial | Escanear QR del PDF | Datos del usuario descifrados correctamente | Alta |
| TC13 | Firma digital en PDF | Verificar firma con utilidad externa | Firma válida RSA-2048 | Media |
| TC14 | Envío por correo | Revisar bandeja de entrada | Correo con PDF adjunto recibido | Media |
| TC15 | Envío por WhatsApp | Revisar WhatsApp del número registrado | Mensaje con PDF recibido | Baja |

## Módulo 3: Editor y Compilador (req #16–#25)

| ID | Descripción | Pasos | Resultado esperado | Prioridad |
|----|-------------|-------|--------------------|-----------|
| TC16 | Abrir editor | Navegar a /usuario/editor.html | Editor Monaco cargado con splash screen | Alta |
| TC17 | Syntax highlighting | Escribir `avanzar_mts(1);` | Comando en celeste, número en verde | Alta |
| TC18 | Compilar código válido (F5) | Escribir programa correcto → F5 | "Compilación exitosa — N comandos" | Alta |
| TC19 | Compilar código con error léxico | Escribir `@error;` | Mensaje de error en consola | Alta |
| TC20 | Compilar código con error sintáctico | Omitir `;` al final | Error sintáctico en consola | Alta |
| TC21 | Compilar código con error semántico | `avanzar_mts(0);` | Error semántico en consola | Alta |
| TC22 | Ver tabla de tokens | Compilar → Menú Compilar → Ver Tokens | Tabla con línea, columna, tipo, valor | Media |
| TC23 | Ver AST | Compilar → Ver AST | Árbol con nodos Program y Statement | Media |
| TC24 | Menú Archivo — Nuevo | Menú Archivo → Nuevo | Editor limpio con plantilla base | Media |
| TC25 | Menú Archivo — Guardar | Ctrl+S | Descarga archivo .umgpp | Media |

## Módulo 4: Simulador (req #26–#32)

| ID | Descripción | Pasos | Resultado esperado | Prioridad |
|----|-------------|-------|--------------------|-----------|
| TC26 | Compilar y Simular (F6) | Código válido → F6 | Rover animado en canvas | Alta |
| TC27 | avanzar_mts animado | `avanzar_mts(2);` compilar y simular | Rover avanza 2 metros (80 px) en línea recta | Alta |
| TC28 | girar animado | `girar(90);` compilar y simular | Rover gira 90° a la derecha | Alta |
| TC29 | circulo animado | `circulo(1);` compilar y simular | Rover traza círculo radio 1 m | Alta |
| TC30 | cuadrado animado | `cuadrado(1);` compilar y simular | Rover traza cuadrado de 1 m × 1 m | Alta |
| TC31 | caminar y moonwalk | `caminar(3); moonwalk(2);` | Rover avanza y retrocede | Media |
| TC32 | Telemetría en tiempo real | Ejecutar simulación | POS X/Y y HDG actualizados en sidebar | Media |

## Módulo 5: Transpilador (req #33–#38)

| ID | Descripción | Pasos | Resultado esperado | Prioridad |
|----|-------------|-------|--------------------|-----------|
| TC33 | Transpilar a C# | Compilar → Transpilar → C# | Código C# con clase Rover válido | Alta |
| TC34 | Transpilar a Java | Compilar → Transpilar → Java | Código Java con clase Rover válido | Alta |
| TC35 | Transpilar a Python | Compilar → Transpilar → Python | Código Python con clase Rover válido | Alta |
| TC36 | Transpilar a C++ | Compilar → Transpilar → C++ | Código C++ con clase Rover válido | Alta |
| TC37 | Generar ejecutable | Compilar → Transpilar → Ejecutable | Script .bat con comandos echo | Media |
| TC38 | Transpilar sin compilar | Click Transpilar sin compilar primero | Mensaje: "Compila primero" en consola | Baja |

## Módulo 6: Coreografías (req #39–#43)

| ID | Descripción | Pasos | Resultado esperado | Prioridad |
|----|-------------|-------|--------------------|-----------|
| TC39 | Cargar coreografía .umgpp | Menú Coreografías → Cargar .umgpp | Código cargado en memoria | Alta |
| TC40 | Ejecutar coreografía | Menú Coreografías → Ejecutar | Compilación automática + simulación | Alta |
| TC41 | Coreografía con audio | Cargar MP3 → Cargar .umgpp → Ejecutar | Simulación + música sincronizados | Alta |
| TC42 | Detener coreografía | Menú Coreografías → Detener | Simulador y audio detenidos | Media |
| TC43 | Coreografía predefinida | Menú Coreografías → ⭐ Saludo Rover | Coreografía predefinida ejecutada | Media |

## Módulo 7: Dashboard Admin (req #44–#45)

| ID | Descripción | Pasos | Resultado esperado | Prioridad |
|----|-------------|-------|--------------------|-----------|
| TC44 | Ver historial de ingresos | Admin → Dashboard → Historial | Tabla paginada con fecha/usuario/método/estado | Alta |
| TC45 | Filtrar por método de login | Filtro "Facial" en historial | Solo ingresos faciales mostrados | Media |
| TC46 | Ver conductores | Admin → Dashboard → Conductores | Tabla con nombre/estado/ruta/ingresos | Alta |
| TC47 | Exportar CSV ingresos | Click "Exportar CSV" en historial | Archivo .csv descargado | Media |
| TC48 | Gráfica últimos 30 días | Admin → Dashboard | Línea de ingresos diarios visible | Media |
| TC49 | E2E registro → compilar → simular | Registrar usuario → abrir editor → compilar → simular | Flujo completo sin errores | Alta |
