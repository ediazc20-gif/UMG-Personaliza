const express = require('express');
const { queryLocal } = require('../../database');
const { makeAuth } = require('../../middlewares/auth');
const { asBool, mapProductoFlags } = require('../../utils/bit');

const router = express.Router();
const authAdmin = makeAuth({ requireAuth: true, allowedRoles: ['Administrador'] });

router.get('/productos', async (req, res) => {
  try {
    const { categoria } = req.query;
    let sql = `
      SELECT p.id, p.nombre, p.slug, p.descripcion, p.precio, p.stock, p.imagen_url,
             p.tiene_lado_b, c.nombre AS categoria, c.slug AS categoria_slug
      FROM productos p
      INNER JOIN categorias c ON c.id = p.id_categoria
      WHERE p.activo = 1 AND c.activo = 1
    `;
    const params = [];
    if (categoria) {
      sql += ' AND c.slug = ?';
      params.push(categoria);
    }
    sql += ' ORDER BY c.orden, p.nombre';
    const rows = await queryLocal(sql, params);
    res.json({ ok: true, productos: rows.map(mapProductoFlags) });
  } catch (err) {
    console.error('[tienda/productos GET]', err);
    res.status(500).json({ error: 'No se pudo cargar el catalogo.' });
  }
});

// Admin: listar todos (incluye inactivos) — antes de /productos/:id
router.get('/productos/admin/list', authAdmin, async (_req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT p.id, p.nombre, p.slug, p.descripcion, p.precio, p.stock, p.imagen_url,
              p.tiene_lado_b, p.activo, p.id_categoria, c.nombre AS categoria
       FROM productos p
       INNER JOIN categorias c ON c.id = p.id_categoria
       ORDER BY c.orden, p.nombre`
    );
    res.json({ ok: true, productos: rows.map(mapProductoFlags) });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar productos.' });
  }
});

router.get('/productos/:id', async (req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT p.*, c.nombre AS categoria, c.slug AS categoria_slug
       FROM productos p
       INNER JOIN categorias c ON c.id = p.id_categoria
       WHERE p.id = ? AND p.activo = 1 LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ ok: true, producto: mapProductoFlags(rows[0]) });
  } catch (err) {
    console.error('[tienda/productos/:id]', err);
    res.status(500).json({ error: 'Error al obtener producto.' });
  }
});

router.get('/categorias', async (_req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT id, nombre, slug, descripcion FROM categorias WHERE activo = 1 ORDER BY orden`
    );
    res.json({ ok: true, categorias: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar categorias.' });
  }
});

router.post('/productos', authAdmin, async (req, res) => {
  try {
    const { id_categoria, nombre, slug, descripcion, precio, stock, imagen_url, tiene_lado_b } = req.body;
    if (!id_categoria || !nombre || !slug || precio == null) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    const stockVal = stock != null ? Math.max(0, parseInt(stock, 10) || 0) : 50;
    const result = await queryLocal(
      `INSERT INTO productos (id_categoria, nombre, slug, descripcion, precio, stock, imagen_url, tiene_lado_b)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_categoria, nombre, slug, descripcion || null, precio, stockVal, imagen_url || null, asBool(tiene_lado_b) ? 1 : 0]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('[tienda/productos POST]', err);
    res.status(500).json({ error: 'No se pudo crear el producto.' });
  }
});

router.put('/productos/:id', authAdmin, async (req, res) => {
  try {
    const { id_categoria, nombre, slug, descripcion, precio, stock, imagen_url, tiene_lado_b, activo } = req.body;
    const stockVal = stock != null ? Math.max(0, parseInt(stock, 10) || 0) : 50;
    await queryLocal(
      `UPDATE productos SET id_categoria=?, nombre=?, slug=?, descripcion=?, precio=?, stock=?,
       imagen_url=?, tiene_lado_b=?, activo=? WHERE id=?`,
      [
        id_categoria,
        nombre,
        slug,
        descripcion || null,
        precio,
        stockVal,
        imagen_url || null,
        asBool(tiene_lado_b) ? 1 : 0,
        asBool(activo) ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[tienda/productos PUT]', err);
    res.status(500).json({ error: 'No se pudo actualizar el producto.' });
  }
});

router.delete('/productos/:id', authAdmin, async (req, res) => {
  try {
    await queryLocal(`UPDATE productos SET activo = 0 WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo desactivar el producto.' });
  }
});

module.exports = router;
