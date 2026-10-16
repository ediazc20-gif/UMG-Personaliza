USE `umg_personaliza_db`;

ALTER TABLE `ordenes`
  ADD COLUMN `ref_pago` VARCHAR(128) DEFAULT NULL AFTER `metodo_pago`;
