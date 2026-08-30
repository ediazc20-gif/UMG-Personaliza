-- ============================================================
-- INIT COMPLETO — Base de Datos Unificada: umg_personaliza_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS `umg_personaliza_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `umg_personaliza_db`;

-- ---------- Tabla: Roles ----------
CREATE TABLE IF NOT EXISTS `Roles` (
  `IdRol`  SMALLINT NOT NULL AUTO_INCREMENT,
  `Rol`    VARCHAR(60) NOT NULL,
  PRIMARY KEY (`IdRol`)
) ENGINE=InnoDB;

-- Roles (IDs alineados con BD de produccion)
INSERT IGNORE INTO `Roles` (`IdRol`, `Rol`) VALUES
  (4, 'Administrador'),
  (5, 'Supervisor'),
  (6, 'Comprador');

-- ---------- Tabla: usuarios ----------
-- Estructura alineada con BD de produccion
CREATE TABLE IF NOT EXISTS `usuarios` (
  `Id_Usuario`                        INT NOT NULL AUTO_INCREMENT,
  `Nombres_Usuario`                   VARCHAR(150)  NOT NULL,
  `Apellidos_Usuario`                 VARCHAR(150)  NOT NULL,
  `Password_Usuario`                  MEDIUMTEXT    NOT NULL,
  `Estado_Usuario`                    BIT(1)        NOT NULL DEFAULT b'1',
  `Fecha_Nacimiento_Usuario`          DATE          NOT NULL,
  `Usuario`                           VARCHAR(50)   NOT NULL,
  `Email_Usuario`                     VARCHAR(60)   DEFAULT NULL,
  `Celular_Usuario`                   VARCHAR(15)   DEFAULT NULL,
  `Nickname_Usuario`                  VARCHAR(60)   DEFAULT NULL,
  `Avatar_String64_Usuario`           MEDIUMTEXT    DEFAULT NULL,
  `Firma_Digital_Hash_Usuario`        VARCHAR(512)  DEFAULT NULL,
  `Correo_Verificado_Usuario`         BIT(1)        NOT NULL DEFAULT b'0',
  `Telefono_Verificado_Usuario`       BIT(1)        NOT NULL DEFAULT b'0',
  `Notificaciones_Correo_Usuario`     BIT(1)        NOT NULL DEFAULT b'0',
  `Notificaciones_WhatsApp_Usuario`   BIT(1)        NOT NULL DEFAULT b'0',
  `Id_Rol_Usuario`                    SMALLINT      NOT NULL DEFAULT 6,
  `Foto_BLOB_Usuario`                 LONGBLOB      DEFAULT NULL,
  `Foto_String64_Usuario`             MEDIUMTEXT    DEFAULT NULL,
  `Foto_Modificada_BLOB_Usuario`      LONGBLOB      DEFAULT NULL,
  `Fecha_Creacion_Usuario`            DATE          NOT NULL DEFAULT (CURRENT_DATE),
  `Fecha_Ultima_Modificacion`         DATE          NOT NULL DEFAULT (CURRENT_DATE),
  `Foto_Modificada_String64_Usuario`  MEDIUMTEXT    DEFAULT NULL,
  PRIMARY KEY (`Id_Usuario`),
  INDEX idx_email (`Email_Usuario`),
  INDEX idx_usuario (`Usuario`),
  INDEX idx_estado (`Estado_Usuario`),
  CONSTRAINT `FK_Rol_usuarios` FOREIGN KEY (`Id_Rol_Usuario`) REFERENCES `Roles`(`IdRol`) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Tabla: auditoria ----------
CREATE TABLE IF NOT EXISTS `auditoria` (
  `id_auditoria`   INT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario`     INT          DEFAULT NULL,
  `accion`         VARCHAR(100) NOT NULL,
  `descripcion`    TEXT,
  `ip_origen`      VARCHAR(45)  DEFAULT NULL,
  `fecha_evento`   DATETIME     DEFAULT NOW(),
  `indice_accion`  VARCHAR(50)  DEFAULT NULL,
  INDEX idx_aud_usuario (`id_usuario`),
  INDEX idx_aud_fecha   (`fecha_evento`),
  FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`Id_Usuario`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- SP: Login ----------
-- Busca usuario por usuario/correo y devuelve datos completos
-- Backend hace la comparacion de password con bcrypt en Node.js
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `Login`(
  IN p_usuario  VARCHAR(50),
  IN p_correo   VARCHAR(150),
  IN p_password MEDIUMTEXT,
  IN p_foto64   LONGTEXT
)
BEGIN
  SELECT
    u.Id_Usuario,
    CONCAT(u.Nombres_Usuario, ' ', u.Apellidos_Usuario) AS NombreUsuario,
    u.Celular_Usuario,
    u.Fecha_Nacimiento_Usuario,
    u.Email_Usuario,
    u.Usuario,
    r.Rol,
    u.Notificaciones_Correo_Usuario,
    u.Notificaciones_WhatsApp_Usuario,
    u.Foto_Modificada_String64_Usuario,
    u.Foto_String64_Usuario
  FROM usuarios u
  INNER JOIN Roles r ON u.Id_Rol_Usuario = r.IdRol
  WHERE u.Estado_Usuario = 1
    AND (
      (p_usuario IS NOT NULL AND u.Usuario = p_usuario)
      OR (p_correo IS NOT NULL AND u.Email_Usuario = p_correo)
    )
  LIMIT 1;
END //
DELIMITER ;

-- ---------- SP: Validacion_Unico ----------
-- Valida que correo, telefono y usuario sean unicos antes de registrar
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `Validacion_Unico`(
  IN p_correo    VARCHAR(150),
  IN p_telefono  VARCHAR(20),
  IN p_usuario   VARCHAR(50),
  OUT p_respuesta VARCHAR(255)
)
proc_label: BEGIN
  DECLARE v_count INT DEFAULT 0;

  IF p_correo IS NOT NULL AND p_correo != '' THEN
    SELECT COUNT(*) INTO v_count FROM usuarios WHERE Email_Usuario = p_correo;
    IF v_count > 0 THEN
      SET p_respuesta = 'El correo ya esta registrado';
      LEAVE proc_label;
    END IF;
  END IF;

  IF p_telefono IS NOT NULL AND p_telefono != '' THEN
    SET v_count = 0;
    SELECT COUNT(*) INTO v_count FROM usuarios WHERE Celular_Usuario = p_telefono;
    IF v_count > 0 THEN
      SET p_respuesta = 'El telefono ya esta registrado';
      LEAVE proc_label;
    END IF;
  END IF;

  IF p_usuario IS NOT NULL AND p_usuario != '' THEN
    SET v_count = 0;
    SELECT COUNT(*) INTO v_count FROM usuarios WHERE Usuario = p_usuario;
    IF v_count > 0 THEN
      SET p_respuesta = 'El nombre de usuario ya esta registrado';
      LEAVE proc_label;
    END IF;
  END IF;

  SET p_respuesta = '1';
END //
DELIMITER ;

-- ---------- SP: AgregarUsuario ----------
-- 14 parametros — compatible con backend/routes/auth/registro.js
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `AgregarUsuario`(
  IN p_nombres           VARCHAR(150),
  IN p_apellidos         VARCHAR(150),
  IN p_password_hash     MEDIUMTEXT,
  IN p_estado            BIT,
  IN p_fecha_nacimiento  DATE,
  IN p_usuario           VARCHAR(50),
  IN p_correo            VARCHAR(60),
  IN p_telefono          VARCHAR(15),
  IN p_notif_correo      BIT,
  IN p_notif_whatsapp    BIT,
  IN p_foto_buffer       LONGBLOB,
  IN p_foto_64           MEDIUMTEXT,
  IN p_fotomod_buffer    LONGBLOB,
  IN p_fotomod_64        MEDIUMTEXT
)
BEGIN
  INSERT INTO usuarios (
    Nombres_Usuario, Apellidos_Usuario, Password_Usuario, Estado_Usuario,
    Fecha_Nacimiento_Usuario, Usuario, Email_Usuario, Celular_Usuario,
    Notificaciones_Correo_Usuario, Notificaciones_WhatsApp_Usuario,
    Id_Rol_Usuario,
    Foto_BLOB_Usuario, Foto_String64_Usuario,
    Foto_Modificada_BLOB_Usuario, Foto_Modificada_String64_Usuario,
    Fecha_Creacion_Usuario, Fecha_Ultima_Modificacion
  ) VALUES (
    p_nombres, p_apellidos, p_password_hash, p_estado,
    p_fecha_nacimiento, p_usuario, p_correo, p_telefono,
    p_notif_correo, p_notif_whatsapp,
    6,  -- Rol: Comprador por defecto
    p_foto_buffer, p_foto_64,
    p_fotomod_buffer, p_fotomod_64,
    CURRENT_DATE(), CURRENT_DATE()
  );
  SELECT LAST_INSERT_ID() AS Id_Usuario;
END //
DELIMITER ;

-- ---------- Tabla: access_logs ----------
-- Historial de ingresos al sistema (dashboard req #44)
CREATE TABLE IF NOT EXISTS `access_logs` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario`    INT          DEFAULT NULL,
  `metodo_login`  VARCHAR(20)  NOT NULL DEFAULT 'password' COMMENT 'password, facial, qr',
  `ip`            VARCHAR(45)  DEFAULT NULL,
  `user_agent`    VARCHAR(255) DEFAULT NULL,
  `exitoso`       BIT(1)       NOT NULL DEFAULT b'1',
  `fecha`         DATETIME     NOT NULL DEFAULT NOW(),
  INDEX idx_al_usuario (`id_usuario`),
  INDEX idx_al_fecha   (`fecha`),
  FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`Id_Usuario`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Tabla: verificaciones ----------
-- Codigos de verificacion por correo o telefono (req #1, #2)
CREATE TABLE IF NOT EXISTS `verificaciones` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario`   INT         NOT NULL,
  `tipo`         ENUM('correo','sms') NOT NULL,
  `codigo`       VARCHAR(6)  NOT NULL,
  `expira`       DATETIME    NOT NULL,
  `usado`        BIT(1)      NOT NULL DEFAULT b'0',
  `creado`       DATETIME    NOT NULL DEFAULT NOW(),
  INDEX idx_ver_usuario (`id_usuario`),
  INDEX idx_ver_codigo  (`codigo`),
  FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`Id_Usuario`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Tabla: credenciales ----------
-- Credenciales PDF con QR cifrado y firma digital (req #7-#15)
CREATE TABLE IF NOT EXISTS `credenciales` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario`       INT          NOT NULL,
  `pdf_url`          VARCHAR(255) DEFAULT NULL,
  `qr_data_cifrado`  TEXT         DEFAULT NULL,
  `firma_digital`    TEXT         DEFAULT NULL,
  `enviada_correo`   BIT(1)       NOT NULL DEFAULT b'0',
  `enviada_whatsapp` BIT(1)       NOT NULL DEFAULT b'0',
  `creada`           DATETIME     NOT NULL DEFAULT NOW(),
  INDEX idx_cred_usuario (`id_usuario`),
  FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`Id_Usuario`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Usuario de prueba ----------
-- Usuario: admin / Password: admin123 (bcrypt hash)
INSERT IGNORE INTO `usuarios` (
  `Nombres_Usuario`, `Apellidos_Usuario`, `Usuario`, `Email_Usuario`,
  `Password_Usuario`, `Id_Rol_Usuario`, `Estado_Usuario`,
  `Fecha_Nacimiento_Usuario`, `Fecha_Creacion_Usuario`, `Fecha_Ultima_Modificacion`
) VALUES (
  'Admin', 'Sistema', 'admin', 'admin@sistema.local',
  '$2b$10$DYYXXN5VV1pGwECWtn9IQO/uixFs4LvQ0EFvXnzXt546A.eNPoe8S',
  4, 1, '1990-01-01', CURRENT_DATE(), CURRENT_DATE()
);
-- Password: admin123

-- ---------- Usuario de prueba: test ----------
-- Usuario: test / Password: test123 (bcrypt hash)
INSERT IGNORE INTO `usuarios` (
  `Nombres_Usuario`, `Apellidos_Usuario`, `Usuario`, `Email_Usuario`,
  `Password_Usuario`, `Id_Rol_Usuario`, `Estado_Usuario`,
  `Fecha_Nacimiento_Usuario`, `Fecha_Creacion_Usuario`, `Fecha_Ultima_Modificacion`
) VALUES (
  'Test', 'Usuario', 'test', 'test@sistema.local',
  '$2b$10$T3vW0mqW1bNAAi0K4am28.B7zHmnIjjCWiMWAKkGZnMUfMD.3yD8C',
  6, 1, '1995-06-15', CURRENT_DATE(), CURRENT_DATE()
);
-- Password: test123
