-- Constancia PDF URL en ordenes
USE `umg_personaliza_db`;

ALTER TABLE `ordenes`
  ADD COLUMN IF NOT EXISTS `pdf_constancia_url` VARCHAR(255) DEFAULT NULL AFTER `qr_entrega`;
