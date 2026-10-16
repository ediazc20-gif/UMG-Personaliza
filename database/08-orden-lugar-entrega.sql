-- Lugar de entrega en texto libre (checkout comprador)
USE `umg_personaliza_db`;

ALTER TABLE `ordenes`
  ADD COLUMN `lugar_entrega` VARCHAR(255) DEFAULT NULL AFTER `id_area_entrega`;
