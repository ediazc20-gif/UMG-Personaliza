# Reporte Final de Calidad — UMG Basic Rover 2.0
**Módulo:** SZ17  
**Responsable:** ALEX  
**Fecha:** 2026-04-16  
**Versión del sistema:** 2.0.0  

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Total de casos de prueba | 49 |
| Casos aprobados | 49 |
| Casos fallidos | 0 |
| Cobertura de requerimientos | 49/49 (100%) |
| Estado general | ✅ **APROBADO** |

---

## 2. Resultados por módulo

### Módulo 1: Registro y Login (TC01–TC10)
| Resultado | Casos |
|-----------|-------|
| ✅ Aprobados | 10/10 |
| ❌ Fallidos | 0/10 |

Detalles en: [qa/resultados/registro-login.md](resultados/registro-login.md)

### Módulo 2: Credencial PDF (TC11–TC15)
| Resultado | Casos |
|-----------|-------|
| ✅ Aprobados | 5/5 (verificados elementos y envío) |
| ❌ Fallidos | 0/5 |

Detalles en: [qa/resultados/credencial.md](resultados/credencial.md)

### Módulo 3: Editor y Compilador (TC16–TC25)
| Resultado | Casos |
|-----------|-------|
| ✅ Aprobados | 10/10 |
| ❌ Fallidos | 0/10 |

Detalles en: [qa/resultados/compilador.md](resultados/compilador.md) y [qa/resultados/editor.md](resultados/editor.md)

### Módulo 4: Simulador (TC26–TC32)
| Resultado | Casos |
|-----------|-------|
| ✅ Aprobados | 7/7 |
| ❌ Fallidos | 0/7 |

Detalles en: [qa/resultados/simulador.md](resultados/simulador.md)

### Módulo 5: Transpilador (TC33–TC38)
| Resultado | Casos |
|-----------|-------|
| ✅ Aprobados | 6/6 |
| ❌ Fallidos | 0/6 |

Detalles en: [qa/resultados/transpilador.md](resultados/transpilador.md)

### Módulo 6: Coreografías (TC39–TC43)
| Resultado | Casos |
|-----------|-------|
| ✅ Aprobados | 5/5 |
| ❌ Fallidos | 0/5 |

Detalles en: [qa/resultados/simulador.md](resultados/simulador.md) (sección Coreografías)

### Módulo 7: Dashboard Admin (TC44–TC49)
| Resultado | Casos |
|-----------|-------|
| ✅ Aprobados | 6/6 (incluye E2E) |
| ❌ Fallidos | 0/6 |

Detalles en: [qa/resultados/dashboard.md](resultados/dashboard.md) y [qa/resultados/e2e.md](resultados/e2e.md)

---

## 3. Verificación de requerimientos

| Req # | Descripción | Responsable | Estado |
|-------|-------------|-------------|--------|
| 1–5 | Registro con OTP, datos únicos | EMANUEL | ✅ |
| 6–8 | Login password/facial/QR | EMANUEL | ✅ |
| 9–10 | Logout, manejo de sesión JWT | EMANUEL | ✅ |
| 11 | Credencial PDF con QR + firma | EMANUEL | ✅ |
| 12 | QR cifrado AES-256 + Code128 | EMANUEL | ✅ |
| 13 | Firma digital RSA-2048 | EMANUEL | ✅ |
| 14–15 | Envío por correo y WhatsApp | EMANUEL | ✅ |
| 16 | Editor Monaco con lenguaje UMG++ | DAVID | ✅ |
| 17 | Syntax highlighting | DAVID/ESTEBAN | ✅ |
| 18 | Compilación exitosa (F5) | ESTEBAN/DAVID | ✅ |
| 19 | Error léxico | ESTEBAN | ✅ |
| 20 | Error sintáctico | ESTEBAN | ✅ |
| 21 | Error semántico | ESTEBAN | ✅ |
| 22 | Ver tabla de tokens | DAVID/ESTEBAN | ✅ |
| 23 | Ver AST | DAVID/ESTEBAN | ✅ |
| 24–25 | Menú Archivo (Nuevo/Guardar) | DAVID | ✅ |
| 26 | Compilar y simular (F6) | DAVID/FELIPE | ✅ |
| 27–32 | Animación de los 9 comandos | FELIPE | ✅ |
| 33–37 | Transpilación C#/Java/Python/C++/bat | DAVID | ✅ |
| 38 | Guard: transpilar sin compilar | DAVID | ✅ |
| 39–40 | Cargar y ejecutar coreografía | FELIPE | ✅ |
| 41 | Coreografía con audio | FELIPE | ✅ |
| 42 | Detener coreografía | FELIPE | ✅ |
| 43 | Coreografías predefinidas (×3) | ALEX/FELIPE | ✅ |
| 44–45 | Historial de ingresos + filtros | EMANUEL | ✅ |
| 46 | Ver conductores | EMANUEL | ✅ |
| 47 | Exportar CSV | EMANUEL | ✅ |
| 48 | Gráfica 30 días | EMANUEL | ✅ |
| 49 | E2E completo | — | ✅ |

---

## 4. Hallazgos y observaciones

### 4.1 Sin defectos críticos
No se identificaron defectos que bloquearan la funcionalidad principal durante las pruebas.

### 4.2 Observaciones menores
| # | Observación | Impacto | Acción |
|---|-------------|---------|--------|
| O1 | El editor tarda ~1.5 s en cargar Monaco Editor desde CDN | Bajo | Sin acción (CDN estándar) |
| O2 | En pantallas < 900 px el layout del editor colapsa a una columna | Bajo | CSS responsivo ya incluido |
| O3 | El simulador no reinicia automáticamente si se compila un nuevo programa mientras hay animación | Bajo | Usuario debe hacer Reset antes de F6 |

### 4.3 Dependencias externas
| Dependencia | Estado |
|-------------|--------|
| Monaco Editor CDN (`cdn.jsdelivr.net`) | Requerido en primera carga |
| @vladmandic/face-api (modelos en `frontend/src/models/`) | Requerido para login facial |
| Nodemailer + SMTP | Requerido para envío de OTP y credencial |

---

## 5. Firmas de aprobación

| Rol | Responsable | Firma |
|-----|-------------|-------|
| Tester — Registro/Login/Credencial | EMANUEL | ✅ |
| Tester — Editor/Transpilador | DAVID | ✅ |
| Tester — Compilador | ESTEBAN | ✅ |
| Tester — Simulador/Coreografías | FELIPE | ✅ |
| Tester — Dashboard/QA Master | ALEX | ✅ |
| Hardware | SANCHEZ | ✅ (especificaciones aprobadas) |

---

## 6. Conclusión

El sistema **UMG Basic Rover 2.0** superó satisfactoriamente los **49 casos de prueba** definidos en el Plan Maestro de Testing (SZ8). El flujo E2E completo (registro → compilar → simular) funciona sin errores. El sistema está listo para la presentación del proyecto de compiladores UMG.
