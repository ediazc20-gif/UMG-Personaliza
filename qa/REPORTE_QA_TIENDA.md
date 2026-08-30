# Reporte QA — UMG Personaliza (pre-asignaciones)

**Fecha:** 2026-08-28  
**Entorno:** Docker local `http://localhost:8081`  
**Script:** `qa/qa-tienda-smoke.ps1` + pruebas Playwright UI

## Resultado

| Suite | Resultado |
|-------|-----------|
| API smoke | **35 / 35 PASS** |
| UI admin móvil (hamburguesa) | **PASS** |
| UI tienda móvil (overflow) | **PASS** |
| UI repartidor móvil | **PASS** |
| Reset password (correo real) | **PASS** (validado manualmente antes) |

## Cobertura API

- Auth: login admin + comprador  
- Catálogo, categorías, áreas, flags Lado A/B (boolean)  
- Carrito → checkout → PDF constancia → tracking  
- Admin: listado órdenes, cambio de estado, productos, dashboard ventas  
- Seguridad básica: comprador no accede a `ordenes/admin/list`  
- Perfil nickname, forgot-password, config pública  
- 10 páginas HTML críticas HTTP 200  

## UI responsive

- Admin ≤768px: botón menú, drawer off-canvas, cierre al navegar, oculto en desktop  
- Tienda/carrito/repartidor: sin overflow horizontal en 390×844  

## Limitaciones conocidas (no bloquean asignaciones)

1. Pago tarjeta = mock (`MOCK-RCC-*`), no Recurrente real  
2. Usuario `Repartidor` de demo: admin puede usar rutas staff; falta seed dedicado  
3. Face login depende de modelos en `frontend/src/models/`  
4. Email solo si `GMAIL_*` en `.env`  
5. Documentación académica (UML/Bizagi/video) pendiente — Persona C  

## Cómo repetir

```bash
docker compose up -d
powershell -ExecutionPolicy Bypass -File qa/qa-tienda-smoke.ps1
```

## Conclusión

El núcleo de tienda está **estable para repartir tareas al equipo**. Priorizar integraciones externas y docs, no rehacer el MVP.
