# Pasarela de pagos — Recurrente

Guía para quien termine la integración. El camino ya está montado y probado;
**lo único que falta es una cuenta de Recurrente y pegar tres valores en el `.env`.**

---

## Qué pide el documento del curso

Dos sitios, y no dicen exactamente lo mismo:

- **Objetivo general:** *"…una tienda online que permita al comprador final comprar
  productos en línea, mediante el cobro de una tarjeta de débito o crédito de
  forma segura…"*
- **Requisito funcional:** *"El checkout permitirá seleccionar entre dos métodos
  de pago: Efectivo al recibir el producto y con tarjeta de crédito o débito
  (recurrente.com). Si la opción es con tarjeta, el sitio mostrará una vista para
  ingresar los datos de la tarjeta y realizar el pago **(la implementación de
  esta funcionalidad otorgará puntos extra)**."*

O sea: para la nota es **puntos extra**, pero el objetivo general del proyecto
entero gira alrededor del cobro con tarjeta. Vale la pena terminarlo.

---

## Qué había antes

Al elegir "tarjeta", el backend hacía esto:

```js
refPago = `MOCK-RCC-${Date.now()}`;
```

Inventaba una referencia con la hora, la devolvía al navegador y **la tiraba**:
la columna `ref_pago` ni siquiera existía en la tabla. La orden se creaba como si
estuviera pagada y recorría todo el ciclo hasta "entregada" sin que se hubiera
cobrado un quetzal. Y la pantalla del repartidor solo cobra en efectivo, así que
nadie cobraba nunca esas órdenes.

Eso ya no está.

---

## Cómo funciona ahora

Se usa el **checkout alojado**, no un formulario de tarjeta propio:

```
comprador           nuestro backend            Recurrente
    |                      |                        |
    |-- POST /checkout --->|                        |
    |                      |-- POST /checkouts ---->|
    |                      |<-- checkout_url -------|
    |<-- url_pago ---------|                        |
    |                                               |
    |------------ mete su tarjeta AQUÍ ------------>|
    |                                               |
    |                      |<-- webhook: pagado ----|
    |                      |  (orden -> 'pagado')   |
```

**El número de tarjeta nunca pasa por nuestro servidor.** Eso es lo que hace que
sea "de forma segura" como pide el documento, y nos deja fuera del alcance de
PCI-DSS. El requisito dice "mostrará una vista para ingresar los datos de la
tarjeta": esa vista es la página alojada de Recurrente, que es la forma correcta
de cumplirlo — montar nuestro propio formulario de tarjeta sería un problema
legal y de seguridad, no un punto extra.

La orden **solo pasa a pagada cuando lo dice el webhook**, nunca porque el
navegador vuelva a la `success_url`: esa vuelta la puede falsificar cualquiera
escribiendo la URL a mano.

---

## Lo que tienes que hacer tú

### 1. Crear la cuenta y sacar las claves

En la cuenta de Recurrente: **Ajustes → API Keys**.

Empieza por las claves de **Sandbox**. Es un entorno aislado con saldos
simulados donde puedes probar el ciclo completo — cobro, rechazo, reembolso —
**sin dinero real y sin usar tu tarjeta personal**. No hace falta que nadie
ponga una tarjeta propia para esto.

### 2. Rellenar el `.env`

```bash
RECURRENTE_PUBLIC_KEY=pk_...
RECURRENTE_SECRET_KEY=sk_...
RECURRENTE_WEBHOOK_SECRET=<ya hay uno generado, puedes dejarlo>
```

El `.env` está fuera de git a propósito: **no subas las claves al repositorio.**

### 3. Registrar el webhook en el panel de Recurrente

La URL es:

```
https://TU-DOMINIO/api/tienda/pagos/recurrente/webhook/<RECURRENTE_WEBHOOK_SECRET>
```

Ese segmento secreto es lo que impide que cualquiera marque órdenes como
pagadas. Si necesitas otro:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

> Para probar en local, la pasarela no puede alcanzar `localhost`. Usa un túnel
> (`ngrok http 8082` o similar) y registra la URL que te dé.

### 4. Lo único que queda por escribir: la firma del webhook

Recurrente firma sus webhooks. El secreto en la URL es la red de seguridad
mientras tanto, pero **lo correcto es verificar la firma**. En
`backend/routes/tienda/ordenes.js`, en el webhook, hay este hueco marcado:

```js
// --- AQUI va la verificacion de firma cuando se conozca la cabecera. ---
// const firma = req.headers['<cabecera-de-recurrente>'];
// if (!firmaValida(req.rawBody, firma)) return res.status(400).json({ error: 'Firma invalida.' });
```

Mira en el panel de Recurrente qué cabecera manda y con qué algoritmo. Ya te
dejé `req.rawBody` disponible (`backend/server.js`): la firma **se calcula sobre
los bytes que llegaron**, así que no sirve volver a serializar el JSON parseado.

---

## Qué toca cada fichero

| Fichero | Qué hace |
|---|---|
| `backend/utils/recurrente.js` | Cliente de la pasarela. `isConfigured()` y `crearCheckout()`. Timeout, validación del mínimo por moneda, errores al log y mensaje neutro al comprador. |
| `backend/routes/tienda/ordenes.js` → `POST /checkout` | Crea el cobro **antes** de tocar la base: si la pasarela falla, no queda ninguna orden a medias. |
| `backend/routes/tienda/ordenes.js` → webhook | Único sitio donde una orden pasa a `pagado`. Idempotente. |
| `backend/server.js` | Guarda `req.rawBody` para poder verificar firmas. |
| `database/06-pagos-recurrente.sql` | Columnas `ref_pago`, `estado_pago`, `url_pago` + índice. |
| `frontend/src/comprador/js/checkout.js` | Redirige a `url_pago` cuando viene informada. |

### `estado_pago` es independiente del estado logístico

| Valor | Cuándo |
|---|---|
| `no_aplica` | Orden en efectivo, aún no cobrada |
| `pendiente` | Orden con tarjeta, esperando al webhook |
| `pagado` | Webhook `payment_intent.succeeded`, o efectivo cobrado al entregar |
| `fallido` | Webhook `payment_intent.failed` |

Una orden puede estar `entregada` y `fallido` a la vez — significa que hay un
problema que alguien tiene que mirar. Son dos ejes distintos a propósito.

---

## Comprobado ya (sin claves reales)

| Caso | Resultado |
|---|---|
| Tarjeta sin claves configuradas | `503` con mensaje claro, **sin crear orden** |
| Efectivo | `201`, sigue funcionando igual que antes |
| Webhook sin `WEBHOOK_SECRET` | `503` — falla cerrado |
| Webhook con secreto incorrecto | `404` — no revela que la ruta existe |
| Webhook con `ref_pago` desconocida | `200` ignorado (evita bucles de reintento) |
| Evento no manejado | `200` ignorado |
| `payment_intent.succeeded` | Orden pasa a `pagado` + entrada en `auditoria` |
| El mismo evento repetido | Ignorado — es idempotente |

Lo que **no** está probado, porque hace falta una cuenta: la llamada real a
`POST /checkouts` y el formato exacto de la respuesta. El cliente acepta tanto
`checkout_url` como `url`, y tanto `id` como `checkout_id`, por si acaso.

---

## Dos cosas que conviene decidir

1. **El carrito se vacía al crear la orden**, también cuando el pago con tarjeta
   queda pendiente. Si el comprador abandona la pasarela, se queda sin carrito y
   con una orden pendiente. Se recupera con "volver a pedir", pero quizá
   convenga no vaciarlo hasta que el pago se confirme.
2. **Nada caduca las órdenes `pendiente`.** Si alguien abre la pasarela y no
   paga, la orden se queda ahí para siempre. Una tarea que las cancele pasado un
   rato estaría bien, y encaja con el requisito de los 60 segundos.

---

## Fuentes

- [Documentación API de Recurrente](https://docs.recurrente.com/)
- [API de Pagos RESTful para Guatemala](https://www.recurrente.com/integraciones/api)
- [Documentación API en Postman](https://documenter.getpostman.com/view/10340859/2sA2rFQf5R)
