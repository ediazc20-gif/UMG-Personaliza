-- Tarjeta NFC: id 6 → 2 (catálogo solo productos 1 y 2)
USE umg_personaliza_db;

UPDATE carrito_items SET id_producto = 2 WHERE id_producto = 6;
UPDATE orden_items SET id_producto = 2 WHERE id_producto = 6;

UPDATE productos SET id = 2 WHERE id = 6 AND slug = 'tarjeta-nfc';
