USE umg_personaliza_db;

-- 1. Insertar / Actualizar usuarios para cada rol con credenciales conocidas
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

-- Rol 7: Repartidor (repartidor / repartidor123)
INSERT INTO usuarios (
  Id_Usuario, Nombres_Usuario, Apellidos_Usuario, Usuario, Email_Usuario,
  Password_Usuario, Id_Rol_Usuario, Estado_Usuario, Fecha_Nacimiento_Usuario,
  Correo_Verificado_Usuario, Telefono_Verificado_Usuario
) VALUES (
  30, 'Repartidor', 'Campus', 'repartidor', 'repartidor@sistema.local',
  '$2b$10$yQ2c/q.V9zuTyEGt0D.UyOdqUkaix4dWboPncO1NygxQMd9BT6aLq', 7, 1, '1994-08-20',
  1, 1
) ON DUPLICATE KEY UPDATE 
  Usuario = 'repartidor',
  Password_Usuario = '$2b$10$yQ2c/q.V9zuTyEGt0D.UyOdqUkaix4dWboPncO1NygxQMd9BT6aLq',
  Id_Rol_Usuario = 7,
  Estado_Usuario = 1;

-- Rol 6: Comprador (test / test123 y comprador / test123)
INSERT INTO usuarios (
  Id_Usuario, Nombres_Usuario, Apellidos_Usuario, Usuario, Email_Usuario,
  Password_Usuario, Id_Rol_Usuario, Estado_Usuario, Fecha_Nacimiento_Usuario,
  Correo_Verificado_Usuario, Telefono_Verificado_Usuario
) VALUES (
  2, 'Test', 'Comprador', 'test', 'test@sistema.local',
  '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.', 6, 1, '1998-11-15',
  1, 1
) ON DUPLICATE KEY UPDATE 
  Usuario = 'test',
  Password_Usuario = '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.',
  Id_Rol_Usuario = 6,
  Estado_Usuario = 1;

INSERT INTO usuarios (
  Id_Usuario, Nombres_Usuario, Apellidos_Usuario, Usuario, Email_Usuario,
  Password_Usuario, Id_Rol_Usuario, Estado_Usuario, Fecha_Nacimiento_Usuario,
  Correo_Verificado_Usuario, Telefono_Verificado_Usuario
) VALUES (
  40, 'Comprador', 'Pruebas', 'comprador', 'comprador@sistema.local',
  '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.', 6, 1, '1998-11-15',
  1, 1
) ON DUPLICATE KEY UPDATE 
  Usuario = 'comprador',
  Password_Usuario = '$2b$10$GMnzsdjX2GvnRySDEfJFau7sjI3RRxjfF/7IPRsIyzbqtj5LmG7w.',
  Id_Rol_Usuario = 6,
  Estado_Usuario = 1;

-- 2. Stock catálogo NFC (solo llavero + tarjeta)
UPDATE productos SET stock = 35, activo = 1, slug = 'llavero-nfc', nombre = 'Llavero NFC' WHERE id = 1;
UPDATE productos SET stock = 30, activo = 1, slug = 'tarjeta-nfc', nombre = 'Tarjeta NFC' WHERE slug = 'tarjeta-nfc';
UPDATE carrito_items SET id_producto = 2 WHERE id_producto = 6;
UPDATE orden_items SET id_producto = 2 WHERE id_producto = 6;
UPDATE productos SET id = 2 WHERE id = 6 AND slug = 'tarjeta-nfc';
DELETE FROM carrito_items WHERE id_producto NOT IN (1, 2);
DELETE FROM productos WHERE id NOT IN (1, 2);
