# Reporte QA completo — UMG Personaliza

**Fecha:** 2026-08-28  
**Entorno:** `http://localhost:8081` (Docker)  
**Ejecutado por:** agente (API smoke + Playwright UI)

## Resumen

| Suite | Total | PASS | FAIL |
|-------|------:|-----:|-----:|
| API smoke (`qa-tienda-smoke.ps1`) | 35 | 35 | 0 |
| UI / responsive / roles (Playwright) | 40 | 37* | 3* → **0 tras fix** |
| **Total efectivo** | **75** | **75** | **0** |

\* Fallos iniciales: (1–2) login no visible porque había sesión previa en el navegador de prueba; (3) botón **Cancelar** del modal no cerraba. Corregido en `personalizar.js` (todos los `[data-perso-cancel]`). Re-verificado: Cancelar cierra el modal.

## Lo que SÍ puede automatizar el agente

- Flujos API y permisos  
- Páginas HTML 200  
- Overflow móvil/tablet/desktop  
- Modales, menú hamburguesa admin  
- Checkout UI → tracking  
- Historial, perfil, repartidor buscar  
- Redirecciones sin sesión / comprador≠admin  

## Lo que NO puede hacer solo (equipo / manual)

| Prueba | Por qué |
|--------|---------|
| Login facial con cara real | Necesita cámara + modelos + persona |
| Escaneo QR físico de credencial | Hardware / cámara |
| Pago Recurrente real | Integración pendiente (mock hoy) |
| Correo en bandeja (cada build) | Ya validado una vez a mano |
| Diseño “bonito” subjetivo | Criterio humano del equipo |
| Dispositivo físico Android/iOS | Emulamos viewport, no OS real |

## Matriz UI (Playwright) — resultado final

| ID | Caso | Resultado |
|----|------|-----------|
| UI-AUTH-01/04/05 | Login/recuperar overflow + form | PASS |
| UI-AUTH-02/03 | Form + link recuperar (sesión limpia) | PASS |
| UI-SHOP-01..06 | Tienda móvil/desktop + modal | PASS |
| UI-CART / CHK / TRK / HIS / PER | Flujo compra UI | PASS |
| FN-CHK-01 | Checkout → tracking | PASS |
| UI-ADM-01..08 | Hamburguesa + productos + órdenes | PASS |
| UI-SUP / UI-REP / FN-REP | Supervisor + repartidor | PASS |
| SEC-01/02 | Sin sesión / comprador≠admin | PASS |
| UI-TAB-01 | Tablet 768 | PASS |

## Bug corregido en esta pasada

- **Cancelar** en modal de personalización no cerraba (solo la X).  
  Fix: listeners en todos los botones `[data-perso-cancel]`.

## Cómo repetir

```powershell
powershell -ExecutionPolicy Bypass -File qa/qa-tienda-smoke.ps1
```

UI: Playwright / Chrome DevTools responsive (390 / 768 / 1280).

## Veredicto

El sistema está **listo para asignar al equipo**. Queda trabajo de producto (Recurrente, docs, face) no de estabilidad del MVP.
