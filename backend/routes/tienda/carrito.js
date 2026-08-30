const express = require('express');
const { queryLocal } = require('../../database');
const { makeAuth } = require('../../middlewares/auth');
const { asBool } = require('../../utils/bit');

const router = express.Router();
const authComprador = makeAuth({
  requireAuth: true,
  allowedRoles: ['Comprador', 'Usuario', 'Administrador'],
});

async function getOrCreateCarrito(userId) {
  let rows = await queryLocal(`SELECT id FROM carritos WHERE id_usuario = ?`, [userId]);
  if (rows.length) return rows[0].id;
  const ins = await queryLocal(`INSERT INTO carritos (id_usuario) VALUES (?)`, [userId]);
  return ins.insertId;
}

async function fetchCarritoItems(carritoId) {
  const rows = await queryLocal(
    `SELECT ci.id, ci.id_producto, ci.cantidad, ci.precio_unitario, ci.personalizacion_json,
            p.nombre, p.slug, p.imagen_url, p.tiene_lado_b
     FROM carrito_items ci
     INNER JOIN productos p ON p.id = ci.id_producto
     WHERE ci.id_carrito = ?
     ORDER BY ci.creado`,
    [carritoId]
  );
  return rows.map((r) => ({ ...r, tiene_lado_b: asBool(r.tiene_lado_b) }));
}

router.get('/carrito', authComprador, async (req, res) => {
  try {
    const userId = req.auth?.uid || req.auth?.payload?.sub;
    const carritoId = await getOrCreateCarrito(userId);
    const items = await fetchCarritoItems(carritoId);
    const subtotal = items.reduce((s, i) => s + Number(i.precio_unitario) * i.cantidad, 0);
    res.json({ ok: true, carrito_id: carritoId, items, subtotal, total: subtotal });
  } catch (err) {
    console.error('[carrito GET]', err);
    res.status(500).json({ error: 'No se pudo cargar el carrito.' });
  }
});

router.post('/carrito/items', authComprador, async (req, res) => {
  try {
    const userId = req.auth?.uid || req.auth?.payload?.sub;
    const { id_producto, cantidad = 1, personalizacion } = req.body;
    if (!id_producto) return res.status(400).json({ error: 'Producto requerido.' });

    const prod = await queryLocal(
      `SELECT id, precio, activo FROM productos WHERE id = ? LIMIT 1`,
      [id_producto]
    );
    if (!prod.length || !asBool(prod[0].activo)) {
      return res.status(404).json({ error: 'Producto no disponible.' });
    }

    const carritoId = await getOrCreateCarrito(userId);
    const qty = Math.max(1, parseInt(cantidad, 10) || 1);
    const persoJson = personalizacion ? JSON.stringify(personalizacion) : null;

    await queryLocal(
      `INSERT INTO carrito_items (id_carrito, id_producto, cantidad, personalizacion_json, precio_unitario)
       VALUES (?, ?, ?, ?, ?)`,
      [carritoId, id_producto, qty, persoJson, prod[0].precio]
    );

    const items = await fetchCarritoItems(carritoId);
    res.status(201).json({ ok: true, items });
  } catch (err) {
    console.error('[carrito POST item]', err);
    res.status(500).json({ error: 'No se pudo agregar al carrito.' });
  }
});

router.put('/carrito/items/:id', authComprador, async (req, res) => {
  try {
    const userId = req.auth?.uid || req.auth?.payload?.sub;
    const { cantidad } = req.body;
    const qty = parseInt(cantidad, 10);
    if (!qty || qty < 1) return res.status(400).json({ error: 'Cantidad invalida.' });

    const carritoId = await getOrCreateCarrito(userId);
    await queryLocal(
      `UPDATE carrito_items ci
       INNER JOIN carritos c ON c.id = ci.id_carrito
       SET ci.cantidad = ?
       WHERE ci.id = ? AND c.id_usuario = ?`,
      [qty, req.params.id, userId]
    );
    const items = await fetchCarritoItems(carritoId);
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el item.' });
  }
});

router.delete('/carrito/items/:id', authComprador, async (req, res) => {
  try {
    const userId = req.auth?.uid || req.auth?.payload?.sub;
    const carritoId = await getOrCreateCarrito(userId);
    await queryLocal(
      `DELETE ci FROM carrito_items ci
       INNER JOIN carritos c ON c.id = ci.id_carrito
       WHERE ci.id = ? AND c.id_usuario = ?`,
      [req.params.id, userId]
    );
    const items = await fetchCarritoItems(carritoId);
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el item.' });
  }
});

module.exports = router;
