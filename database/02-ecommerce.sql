-- ============================================================
-- MODULO E-COMMERCE — Tienda UMG Personaliza
-- ============================================================
USE `umg_personaliza_db`;

-- ---------- Roles (actualizacion) ----------
UPDATE `Roles` SET `Rol` = 'Comprador' WHERE `IdRol` = 6 AND `Rol` = 'Usuario';
INSERT IGNORE INTO `Roles` (`IdRol`, `Rol`) VALUES (7, 'Repartidor');

-- ---------- Categorias ----------
CREATE TABLE IF NOT EXISTS `categorias` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`      VARCHAR(80)  NOT NULL,
  `slug`        VARCHAR(80)  NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `activo`      BIT(1)       NOT NULL DEFAULT b'1',
  `orden`       INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ---------- Productos ----------
CREATE TABLE IF NOT EXISTS `productos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `id_categoria`    INT          NOT NULL,
  `nombre`          VARCHAR(120) NOT NULL,
  `slug`            VARCHAR(120) NOT NULL UNIQUE,
  `descripcion`     TEXT,
  `precio`          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock`           INT          NOT NULL DEFAULT 50,
  `imagen_url`      VARCHAR(255) DEFAULT NULL,
  `tiene_lado_b`    BIT(1)       NOT NULL DEFAULT b'1',
  `activo`          BIT(1)       NOT NULL DEFAULT b'1',
  `creado`          DATETIME     NOT NULL DEFAULT NOW(),
  INDEX idx_prod_cat (`id_categoria`),
  FOREIGN KEY (`id_categoria`) REFERENCES `categorias`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Areas de entrega (campus) ----------
CREATE TABLE IF NOT EXISTS `areas_entrega` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`      VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `activo`      BIT(1)       NOT NULL DEFAULT b'1'
) ENGINE=InnoDB;

-- ---------- Carritos ----------
CREATE TABLE IF NOT EXISTS `carritos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario`  INT NOT NULL UNIQUE,
  `actualizado` DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `carrito_items` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `id_carrito`          INT NOT NULL,
  `id_producto`         INT NOT NULL,
  `cantidad`            INT NOT NULL DEFAULT 1,
  `personalizacion_json` JSON DEFAULT NULL COMMENT 'lado_a, lado_b, texto, filtros',
  `precio_unitario`     DECIMAL(10,2) NOT NULL,
  `creado`              DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_ci_carrito (`id_carrito`),
  FOREIGN KEY (`id_carrito`) REFERENCES `carritos`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`id_producto`) REFERENCES `productos`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Ordenes ----------
CREATE TABLE IF NOT EXISTS `ordenes` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(20)  NOT NULL UNIQUE,
  `id_usuario`      INT NOT NULL,
  `id_area_entrega` INT DEFAULT NULL,
  `notas_entrega`   VARCHAR(255) DEFAULT NULL,
  `metodo_pago`     ENUM('efectivo','tarjeta') NOT NULL DEFAULT 'efectivo',
  `estado`          ENUM(
    'recibida','en_elaboracion','en_ruta','lista_entrega','entregada','cancelada','no_encontrado'
  ) NOT NULL DEFAULT 'recibida',
  `subtotal`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total`           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `qr_entrega`      TEXT DEFAULT NULL,
  `pdf_constancia_url` VARCHAR(255) DEFAULT NULL,
  `creado`          DATETIME NOT NULL DEFAULT NOW(),
  `actualizado`     DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_ord_usuario (`id_usuario`),
  INDEX idx_ord_estado (`estado`),
  FOREIGN KEY (`id_area_entrega`) REFERENCES `areas_entrega`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `orden_items` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `id_orden`            INT NOT NULL,
  `id_producto`         INT NOT NULL,
  `nombre_producto`     VARCHAR(120) NOT NULL,
  `cantidad`            INT NOT NULL DEFAULT 1,
  `precio_unitario`     DECIMAL(10,2) NOT NULL,
  `personalizacion_json` JSON DEFAULT NULL,
  FOREIGN KEY (`id_orden`) REFERENCES `ordenes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `orden_estado_log` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `id_orden`  INT NOT NULL,
  `estado`    VARCHAR(40) NOT NULL,
  `nota`      VARCHAR(255) DEFAULT NULL,
  `fecha`     DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_oel_orden (`id_orden`),
  FOREIGN KEY (`id_orden`) REFERENCES `ordenes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `entregas` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `id_orden`        INT NOT NULL UNIQUE,
  `id_repartidor`   INT DEFAULT NULL,
  `foto_url`        VARCHAR(255) DEFAULT NULL,
  `pago_registrado` BIT(1) NOT NULL DEFAULT b'0',
  `resultado`       ENUM('entregada','no_encontrado') NOT NULL DEFAULT 'entregada',
  `notas`           VARCHAR(255) DEFAULT NULL,
  `fecha`           DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`id_orden`) REFERENCES `ordenes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Seed categorias ----------
INSERT IGNORE INTO `categorias` (`id`, `nombre`, `slug`, `descripcion`, `orden`) VALUES
  (1, 'Llaveros', 'llaveros', 'Llaveros personalizados con tu foto', 1),
  (2, 'Playeras', 'playeras', 'Playeras con diseño Lado A y Lado B', 2),
  (3, 'Tazas', 'tazas', 'Tazas con mensaje o imagen', 3),
  (4, 'Tarjetas', 'tarjetas', 'Tarjetas de presentacion personalizadas', 4);

-- ---------- Seed productos ----------
INSERT IGNORE INTO `productos` (`id`, `id_categoria`, `nombre`, `slug`, `descripcion`, `precio`, `stock`, `imagen_url`, `tiene_lado_b`) VALUES
  (1, 1, 'Llavero NFC UMG', 'llavero-nfc', 'Llavero inteligente con chip NFC integrado y personalizacion Lado A/B. Comparte redes, perfil o datos al acercarlo a un celular.', 35.00, 50, '/assets/productos/llavero-nfc.jpg', 1),
  (2, 1, 'Llavero NFC Premium Dorado', 'llavero-nfc-premium', 'Llavero inteligente NFC con borde dorado y resina protectora con escudo oficial UMG.', 45.00, 8, '/assets/productos/llavero-premium.jpg', 1),
  (3, 2, 'Playera Basica (Catalogo Muestra)', 'playera-basica', 'Algodon 100% azul marino con escudo universitario bordado en pecho.', 89.00, 0, '/assets/productos/playera-basica.jpg', 1),
  (4, 2, 'Playera UMG Fan (Catalogo Muestra)', 'playera-umg', 'Edicion especial universitaria con tipografia deportiva UMG Est. 1966.', 99.00, 0, '/assets/productos/playera-umg.jpg', 1),
  (5, 3, 'Taza Magica (Catalogo Muestra)', 'taza-magica', 'Taza de ceramica oscura con acabado mate y emblema dorado UMG.', 55.00, 0, '/assets/productos/taza-magica.jpg', 0),
  (6, 4, 'Tarjeta Presentacion NFC', 'tarjeta-presentacion', 'Credencial universitaria con chip inteligente y codigo QR.', 25.00, 10, '/assets/productos/tarjeta-presentacion.jpg', 1);

-- ---------- Seed areas entrega (Sede La Florida) ----------
INSERT IGNORE INTO `areas_entrega` (`id`, `nombre`, `descripcion`) VALUES
  (1, 'Entrada Principal', 'Acceso y garita principal de la sede La Florida'),
  (2, 'Cancha', 'Cancha deportiva de la sede La Florida'),
  (3, 'Aula 312', 'Aula 312, tercer nivel - Sede La Florida');
