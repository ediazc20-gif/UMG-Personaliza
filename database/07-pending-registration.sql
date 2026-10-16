-- Permite reintentar registro si el usuario quedó pendiente de OTP (Estado_Usuario = 0)
USE `umg_personaliza_db`;

DROP PROCEDURE IF EXISTS `Validacion_Unico`;

DELIMITER //
CREATE PROCEDURE `Validacion_Unico`(
  IN p_correo    VARCHAR(150),
  IN p_telefono  VARCHAR(20),
  IN p_usuario   VARCHAR(50),
  OUT p_respuesta VARCHAR(255)
)
proc_label: BEGIN
  DECLARE v_count INT DEFAULT 0;

  IF p_correo IS NOT NULL AND p_correo != '' THEN
    SELECT COUNT(*) INTO v_count FROM usuarios
     WHERE Email_Usuario = p_correo AND Estado_Usuario = b'1';
    IF v_count > 0 THEN
      SET p_respuesta = 'El correo ya esta registrado';
      LEAVE proc_label;
    END IF;
  END IF;

  IF p_telefono IS NOT NULL AND p_telefono != '' THEN
    SET v_count = 0;
    SELECT COUNT(*) INTO v_count FROM usuarios
     WHERE Celular_Usuario = p_telefono AND Estado_Usuario = b'1';
    IF v_count > 0 THEN
      SET p_respuesta = 'El telefono ya esta registrado';
      LEAVE proc_label;
    END IF;
  END IF;

  IF p_usuario IS NOT NULL AND p_usuario != '' THEN
    SET v_count = 0;
    SELECT COUNT(*) INTO v_count FROM usuarios
     WHERE Usuario = p_usuario AND Estado_Usuario = b'1';
    IF v_count > 0 THEN
      SET p_respuesta = 'El nombre de usuario ya esta registrado';
      LEAVE proc_label;
    END IF;
  END IF;

  SET p_respuesta = '1';
END //
DELIMITER ;
