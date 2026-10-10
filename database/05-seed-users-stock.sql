USE umg_personaliza_db;

-- ============================================================================
-- 1. USUARIOS DEL SISTEMA Y USUARIOS DE PRUEBA ADICIONALES (SEDE LA FLORIDA)
-- ============================================================================

-- Rol 4: Administrador (admin / admin123)
INSERT INTO usuarios (
  Id_Usuario, Nombres_Usuario, Apellidos_Usuario, Usuario, Email_Usuario,
  Password_Usuario, Id_Rol_Usuario, Estado_Usuario, Fecha_Nacimiento_Usuario,
  Correo_Verificado_Usuario, Telefono_Verificado_Usuario
) VALUES (
  1, 'Admin', 'Sistema', 'admin', 'admin@sistema.local',
  '$2b$10$NUAL8ElbJQh5p1OEruXUSuFKsfj99TKGkDhDDrZFu15yjfLhyM4P6', 4, 1, '1990-01-01',
  1, 1
) ON DUPLICATE KEY UPDATE 
  Usuario = 'admin',
  Password_Usuario = '$2b$10$NUAL8ElbJQh5p1OEruXUSuFKsfj99TKGkDhDDrZFu15yjfLhyM4P6',
  Id_Rol_Usuario = 4,
  Estado_Usuario = 1;

-- Rol 5: Supervisor (supervisor / supervisor123)
INSERT INTO usuarios (
  Id_Usuario, Nombres_Usuario, Apellidos_Usuario, Usuario, Email_Usuario,
  Password_Usuario, Id_Rol_Usuario, Estado_Usuario, Fecha_Nacimiento_Usuario,
  Correo_Verificado_Usuario, Telefono_Verificado_Usuario
) VALUES (
  20, 'Supervisor', 'Ventas', 'supervisor', 'supervisor@sistema.local',
  '$2b$10$4f4MYLG5NBEbOKgejQkn1uqsjZQf4JNBkuYQGVonTc/Vj/RvQa9.q', 5, 1, '1992-05-10',
  1, 1
) ON DUPLICATE KEY UPDATE 
  Usuario = 'supervisor',
  Password_Usuario = '$2b$10$4f4MYLG5NBEbOKgejQkn1uqsjZQf4JNBkuYQGVonTc/Vj/RvQa9.q',
  Id_Rol_Usuario = 5,
  Estado_Usuario = 1;

-- Rol 7: Repartidores de prueba Sede La Florida (repartidor123)
-- Hash bcrypt para 'repartidor123': $2b$10$yQ2c/q.V9zuTyEGt0D.UyOdqUkaix4dWboPncO1NygxQMd9BT6aLq
INSERT INTO usuarios (
  Id_Usuario, Nombres_Usuario, Apellidos_Usuario, Usuario, Email_Usuario, Celular_Usuario,
  Password_Usuario, Id_Rol_Usuario, Estado_Usuario, Fecha_Nacimiento_Usuario,
  Correo_Verificado_Usuario, Telefono_Verificado_Usuario
) VALUES 
  (30, 'Repartidor', 'Sede La Florida', 'repartidor', 'repartidor@sistema.local', '50255550000',
   '$2b$10$yQ2c/q.V9zuTyEGt0D.UyOdqUkaix4dWboPncO1NygxQMd9BT6aLq', 7, 1, '1994-08-20', 1, 1),
  (31, 'Carlos', 'Mendez Repartidor', 'repartidor2', 'carlos.repartidor@umg.edu.gt', '50255550001',
   '$2b$10$yQ2c/q.V9zuTyEGt0D.UyOdqUkaix4dWboPncO1NygxQMd9BT6aLq', 7, 1, '1995-03-12', 1, 1),
  (32, 'Pedro', 'Gomez Repartidor', 'repartidor3', 'pedro.repartidor@umg.edu.gt', '50255550002',
   '$2b$10$yQ2c/q.V9zuTyEGt0D.UyOdqUkaix4dWboPncO1NygxQMd9BT6aLq', 7, 1, '1996-09-25', 1, 1)
ON DUPLICATE KEY UPDATE 
  Password_Usuario = VALUES(Password_Usuario),
  Id_Rol_Usuario = 7,
  Estado_Usuario = 1;

-- Rol 6: Compradores de prueba Estudiantes Aula 312 / Sede La Florida (test123)
-- Hash bcrypt para 'test123': $2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.
INSERT INTO usuarios (
  Id_Usuario, Nombres_Usuario, Apellidos_Usuario, Usuario, Email_Usuario, Celular_Usuario,
  Password_Usuario, Id_Rol_Usuario, Estado_Usuario, Fecha_Nacimiento_Usuario,
  Correo_Verificado_Usuario, Telefono_Verificado_Usuario
) VALUES 
  (2, 'Test', 'Comprador', 'test', 'test@sistema.local', '50255551000',
   '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.', 6, 1, '1998-11-15', 1, 1),
  (40, 'Comprador', 'Pruebas', 'comprador', 'comprador@sistema.local', '50255551001',
   '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.', 6, 1, '1999-04-10', 1, 1),
  (41, 'Maria', 'Lopez Estudiante 312', 'estudiante1', 'mlopez@miumg.edu.gt', '50255551002',
   '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.', 6, 1, '2001-02-18', 1, 1),
  (42, 'Diego', 'Castillo Estudiante 312', 'estudiante2', 'dcastillo@miumg.edu.gt', '50255551003',
   '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.', 6, 1, '2000-07-22', 1, 1),
  (43, 'Sofia', 'Morales Compradora', 'comprador2', 'smorales@miumg.edu.gt', '50255551004',
   '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.', 6, 1, '2002-10-05', 1, 1)
ON DUPLICATE KEY UPDATE 
  Password_Usuario = VALUES(Password_Usuario),
  Id_Rol_Usuario = 6,
  Estado_Usuario = 1;


-- ============================================================================
-- 2. AREAS DE ENTREGA CONFIRMADAS — SEDE LA FLORIDA (3 UBICACIONES)
-- ============================================================================
-- Desactivar cualquier otra ubicación anterior para dejar solo las 3 oficiales
UPDATE `areas_entrega` SET `activo` = 0 WHERE id > 3;

INSERT INTO `areas_entrega` (`id`, `nombre`, `descripcion`, `activo`) VALUES
  (1, 'Entrada Principal', 'Acceso y garita principal de la sede La Florida', 1),
  (2, 'Cancha', 'Cancha deportiva de la sede La Florida', 1),
  (3, 'Aula 312', 'Aula 312, tercer nivel - Punto de entrega en clase', 1)
ON DUPLICATE KEY UPDATE
  `nombre` = VALUES(`nombre`),
  `descripcion` = VALUES(`descripcion`),
  `activo` = VALUES(`activo`);


-- ============================================================================
-- 3. PRODUCTOS CONFIRMADOS: LLAVEROS NFC (SEDE LA FLORIDA)
-- ============================================================================
-- Actualizar nombres, stock y fotografías reales
UPDATE productos SET 
  nombre = 'Llavero NFC UMG',
  slug = 'llavero-nfc',
  descripcion = 'Llavero inteligente con chip NFC integrado y personalizacion Lado A/B. Comparte redes sociales, carnet o datos de contacto al acercarlo a un celular.',
  precio = 35.00,
  imagen_url = '/assets/productos/llavero-nfc.jpg',
  stock = 50,
  activo = 1
WHERE id = 1; -- Producto confirmado estrella (Disponible - 50)

UPDATE productos SET 
  nombre = 'Llavero NFC Premium Dorado',
  slug = 'llavero-nfc-premium',
  descripcion = 'Llavero inteligente NFC con marco dorado y resina protectora con escudo oficial UMG.',
  precio = 45.00,
  imagen_url = '/assets/productos/llavero-premium.jpg',
  stock = 4,
  activo = 1
WHERE id = 2; -- ¡Últimas 4 unidades!

UPDATE productos SET 
  nombre = 'Playera Basica (Muestra)',
  imagen_url = '/assets/productos/playera-basica.jpg',
  stock = 0,
  activo = 1
WHERE id = 3; -- Agotado / Muestra

UPDATE productos SET 
  nombre = 'Playera UMG Fan (Muestra)',
  imagen_url = '/assets/productos/playera-umg.jpg',
  stock = 0,
  activo = 1
WHERE id = 4; -- Agotado / Muestra

UPDATE productos SET 
  nombre = 'Taza Magica (Muestra)',
  imagen_url = '/assets/productos/taza-magica.jpg',
  stock = 0,
  activo = 1
WHERE id = 5; -- Agotado / Muestra

UPDATE productos SET 
  nombre = 'Tarjeta Presentacion NFC',
  slug = 'tarjeta-presentacion-nfc',
  descripcion = 'Credencial universitaria inteligente con chip NFC y QR de contacto.',
  precio = 25.00,
  imagen_url = '/assets/productos/tarjeta-presentacion.jpg',
  stock = 15,
  activo = 1
WHERE id = 6;


-- ============================================================================
-- 4. ORDENES DE PRUEBA DE LLAVEROS NFC (DASHBOARD VENTAS & CSV SUPERVISOR)
-- ============================================================================
INSERT INTO `ordenes` (
  `id`, `codigo`, `id_usuario`, `id_area_entrega`, `notas_entrega`,
  `metodo_pago`, `estado`, `subtotal`, `total`, `creado`, `actualizado`
) VALUES 
  (101, 'ORD-UMG-8001', 2, 3, 'Entregar en Aula 312 durante receso', 'efectivo', 'entregada', 90.00, 90.00, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 1 DAY),
  (102, 'ORD-UMG-8002', 41, 3, 'Aula 312 fila de en medio', 'tarjeta', 'en_ruta', 70.00, 70.00, NOW() - INTERVAL 1 DAY, NOW()),
  (103, 'ORD-UMG-8003', 42, 2, 'En la cancha al terminar clase', 'tarjeta', 'en_elaboracion', 45.00, 45.00, NOW() - INTERVAL 4 HOUR, NOW()),
  (104, 'ORD-UMG-8004', 43, 1, 'Entrada principal al salir', 'efectivo', 'recibida', 35.00, 35.00, NOW() - INTERVAL 1 HOUR, NOW())
ON DUPLICATE KEY UPDATE
  `id_area_entrega` = VALUES(`id_area_entrega`),
  `estado` = VALUES(`estado`),
  `total` = VALUES(`total`);

-- Items de las ordenes (Llaveros NFC)
INSERT INTO `orden_items` (`id`, `id_orden`, `id_producto`, `nombre_producto`, `cantidad`, `precio_unitario`) VALUES
  (201, 101, 2, 'Llavero NFC Premium Dorado', 2, 45.00),
  (202, 102, 1, 'Llavero NFC UMG', 2, 35.00),
  (203, 103, 2, 'Llavero NFC Premium Dorado', 1, 45.00),
  (204, 104, 1, 'Llavero NFC UMG', 1, 35.00)
ON DUPLICATE KEY UPDATE
  `nombre_producto` = VALUES(`nombre_producto`),
  `precio_unitario` = VALUES(`precio_unitario`);

-- Historial de log para las ordenes de prueba
INSERT IGNORE INTO `orden_estado_log` (`id_orden`, `estado`, `nota`, `fecha`) VALUES
  (101, 'recibida', 'Orden recibida en sistema', NOW() - INTERVAL 2 DAY),
  (101, 'en_elaboracion', 'Grabado y programacion NFC', NOW() - INTERVAL 36 HOUR),
  (101, 'en_ruta', 'Repartidor subiendo al Aula 312', NOW() - INTERVAL 25 HOUR),
  (101, 'entregada', 'Entregado a estudiante en Aula 312', NOW() - INTERVAL 24 HOUR),
  (102, 'recibida', 'Orden recibida en sistema', NOW() - INTERVAL 1 DAY),
  (102, 'en_elaboracion', 'Chip NFC vinculado y probado', NOW() - INTERVAL 12 HOUR),
  (102, 'en_ruta', 'Repartidor en camino a Aula 312', NOW()),
  (103, 'recibida', 'Orden recibida en sistema', NOW() - INTERVAL 4 HOUR),
  (103, 'en_elaboracion', 'Programando chip NFC', NOW()),
  (104, 'recibida', 'Orden recibida en sistema', NOW() - INTERVAL 1 HOUR);

-- Entrega registrada para la orden 101
INSERT INTO `entregas` (`id_orden`, `id_repartidor`, `pago_registrado`, `resultado`, `notas`, `fecha`) VALUES
  (101, 30, 1, 'entregada', 'Entregado en Aula 312, pago en efectivo recibido', NOW() - INTERVAL 24 HOUR)
ON DUPLICATE KEY UPDATE
  `notas` = VALUES(`notas`);
