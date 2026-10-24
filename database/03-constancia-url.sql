-- Constancia PDF URL en ordenes
USE `umg_personaliza_db`;

SET @has_pdf_constancia_url = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordenes'
    AND COLUMN_NAME = 'pdf_constancia_url'
);

SET @add_pdf_constancia_url = IF(
  @has_pdf_constancia_url = 0,
  'ALTER TABLE `ordenes` ADD COLUMN `pdf_constancia_url` VARCHAR(255) DEFAULT NULL AFTER `qr_entrega`',
  'SELECT 1'
);

PREPARE add_pdf_constancia_url_stmt FROM @add_pdf_constancia_url;
EXECUTE add_pdf_constancia_url_stmt;
DEALLOCATE PREPARE add_pdf_constancia_url_stmt;
