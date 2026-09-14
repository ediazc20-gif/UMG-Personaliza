-- ---------------------------------------------------------------------------
-- Pago con tarjeta a traves de Recurrente (https://recurrente.com)
--
-- Hasta ahora la tabla `ordenes` no tenia donde guardar nada del pago: al elegir
-- "tarjeta" el backend inventaba una referencia `MOCK-RCC-<hora>`, se la
-- devolvia al navegador y la tiraba. No quedaba rastro, y la orden nacia como
-- si estuviera pagada sin que se hubiera cobrado nada.
--
-- Estas tres columnas son lo minimo para que el cobro sea real y auditable.
-- ---------------------------------------------------------------------------

-- Identificador que devuelve Recurrente al crear el checkout. Es la llave con
-- la que el webhook encuentra despues la orden que hay que marcar como pagada.
ALTER TABLE ordenes
  ADD COLUMN ref_pago VARCHAR(120) NULL DEFAULT NULL
  COMMENT 'ID del checkout/payment intent en la pasarela'
  AFTER metodo_pago;

-- Estado del cobro, independiente del estado logistico de la orden.
-- Una orden en efectivo nace 'no_aplica' y pasa a 'pagado' cuando el repartidor
-- cobra al entregar. Una orden con tarjeta nace 'pendiente' y solo pasa a
-- 'pagado' cuando llega el webhook de la pasarela; nunca por decirlo el cliente.
ALTER TABLE ordenes
  ADD COLUMN estado_pago ENUM('no_aplica','pendiente','pagado','fallido')
  NOT NULL DEFAULT 'no_aplica'
  AFTER ref_pago;

-- URL de la pagina de pago alojada por Recurrente, por si hay que reenviarla al
-- comprador (cerro la pestana, se le paso el tiempo, quiere reintentar).
ALTER TABLE ordenes
  ADD COLUMN url_pago VARCHAR(500) NULL DEFAULT NULL
  COMMENT 'checkout_url devuelta por la pasarela'
  AFTER estado_pago;

-- El webhook busca por ref_pago en cada evento que llega.
CREATE INDEX idx_ordenes_ref_pago ON ordenes (ref_pago);

-- Las ordenes que ya existian son todas en efectivo y algunas ya entregadas:
-- dejarlas en 'no_aplica' es correcto, salvo las que ya se cobraron al entregar.
UPDATE ordenes
   SET estado_pago = 'pagado'
 WHERE metodo_pago = 'efectivo'
   AND estado = 'entregada';
