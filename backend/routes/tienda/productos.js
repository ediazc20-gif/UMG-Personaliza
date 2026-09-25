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
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un producto con ese slug.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'La categoría indicada no existe.' });
    }
    console.error('[tienda/productos POST]', err);
    res.status(500).json({ error: 'No se pudo crear el producto.' });
  }
});

router.put('/productos/:id', authAdmin, async (req, res) => {
  try {
    // Edicion parcial: lo que no llega en el cuerpo conserva su valor actual.
    // Antes cualquier campo ausente viajaba como undefined y mysql2 lo rechazaba
    // con un 500; y si faltaba `activo`, el producto quedaba desactivado.
    const actuales = await queryLocal(`SELECT * FROM productos WHERE id = ? LIMIT 1`, [req.params.id]);
    if (!actuales.length) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    const actual = actuales[0];
    const body = req.body || {};
    const valor = (campo) => (body[campo] !== undefined ? body[campo] : actual[campo]);

    const precio = Number(valor('precio'));
    if (!Number.isFinite(precio) || precio < 0) {
      return res.status(400).json({ error: 'El precio debe ser un número mayor o igual a 0.' });
    }
    const stock = body.stock !== undefined ? Math.max(0, parseInt(body.stock, 10) || 0) : actual.stock;

    await queryLocal(
      `UPDATE productos SET id_categoria=?, nombre=?, slug=?, descripcion=?, precio=?, stock=?,
       imagen_url=?, tiene_lado_b=?, activo=? WHERE id=?`,
      [
        valor('id_categoria'),
        valor('nombre'),
        valor('slug'),
        valor('descripcion') || null,
        precio,
        stock,
        valor('imagen_url') || null,
        asBool(valor('tiene_lado_b')) ? 1 : 0,
        asBool(valor('activo')) ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un producto con ese slug.' });
    }
    console.error('[tienda/productos PUT]', err);
    res.status(500).json({ error: 'No se pudo actualizar el producto.' });
  }
});

router.delete('/productos/:id', authAdmin, async (req, res) => {
  try {
    const result = await queryLocal(`UPDATE productos SET activo = 0 WHERE id = ?`, [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo desactivar el producto.' });
  }
});

module.exports = router;
