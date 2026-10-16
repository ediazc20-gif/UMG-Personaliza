-- Catálogo UMG Personaliza: solo Llavero NFC (id 1) y Tarjeta NFC (id 6)
USE umg_personaliza_db;

UPDATE productos SET
  nombre = 'Llavero NFC',
  slug = 'llavero-nfc',
  activo = 1,
  tiene_lado_b = 1
WHERE id = 1;

UPDATE productos SET
  nombre = 'Tarjeta NFC',
  slug = 'tarjeta-nfc',
  activo = 1,
  tiene_lado_b = 1
WHERE slug = 'tarjeta-nfc';

UPDATE carrito_items SET id_producto = 2 WHERE id_producto = 6;
UPDATE orden_items SET id_producto = 2 WHERE id_producto = 6;
UPDATE productos SET id = 2 WHERE id = 6 AND slug = 'tarjeta-nfc';

DELETE FROM carrito_items WHERE id_producto NOT IN (1, 2);
DELETE FROM productos WHERE id NOT IN (1, 2);
