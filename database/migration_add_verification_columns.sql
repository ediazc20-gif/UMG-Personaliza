-- ============================================================
-- MIGRATION: Agregar columnas de verificación a tabla usuarios
-- ============================================================

USE umg_personaliza_db;

-- Agregar columnas de verificación si no existen
ALTER TABLE usuarios 
  ADD COLUMN IF NOT EXISTS `Correo_Verificado_Usuario` BIT(1) NOT NULL DEFAULT b'0' AFTER `Foto_Modificada_String64_Usuario`,
  ADD COLUMN IF NOT EXISTS `Telefono_Verificado_Usuario` BIT(1) NOT NULL DEFAULT b'0' AFTER `Correo_Verificado_Usuario`;

-- Verificar que las columnas fueron agregadas
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'umg_personaliza_db'
  AND TABLE_NAME = 'usuarios'
  AND COLUMN_NAME IN ('Correo_Verificado_Usuario', 'Telefono_Verificado_Usuario');
