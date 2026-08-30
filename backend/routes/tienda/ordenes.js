const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { queryLocal, queryCentralP } = require('../../database');
const { makeAuth } = require('../../middlewares/auth');
const { generarCodigoOrden } = require('../../utils/ordenCodigo');
const { buildConstanciaCompra, saveConstanciaPdf } = require('../../utils/constanciaCompra');
const { verifyRecaptcha } = require('../../utils/recaptcha');
const { broadcastOrdenEstado } = require('../../utils/tiendaWs');
const { sendOrderEmail } = require('../../config/mailer');
const whatsappService = require('../../utils/whatsappService');
const { createRateLimiter } = require('../../utils/rateLimit');
const { registrarAuditoria } = require('../../utils/auditLogger');
const { validarTransicionAutomata, getSiguientesEstadosPermitidos, LABELS_ESTADOS } = require('../../utils/ordenAutomata');

const checkoutLimiter = createRateLimiter({ windowMs: 2 * 60 * 1000, max: 15 });

const entregaDir = path.join(__dirname, '..', '..', 'uploads', 'entregas');
fs.mkdirSync(entregaDir, { recursive: true });
const uploadEntrega = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, entregaDir),
    filename: (req, file, cb) => {
      cb(null, `entrega_${req.params.id}_${Date.now()}${path.extname(file.originalname) || '.jpg'}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const router = express.Router();
const authComprador = makeAuth({
  requireAuth: true,
  allowedRoles: ['Comprador', 'Usuario', 'Administrador'],
});
const authStaff = makeAuth({
  requireAuth: true,
  allowedRoles: ['Administrador', 'Supervisor', 'Repartidor'],
});

function userId(req) {
  return req.auth?.uid || req.auth?.payload?.sub;
}

async function getCarritoCompleto(uid) {
  const carts = await queryLocal(`SELECT id FROM carritos WHERE id_usuario = ?`, [uid]);
  if (!carts.length) return { items: [], subtotal: 0 };
  const items = await queryLocal(
    `SELECT ci.*, p.nombre AS nombre_producto
     FROM carrito_items ci
     INNER JOIN productos p ON p.id = ci.id_producto
     WHERE ci.id_carrito = ?`,
    [carts[0].id]
  );
  const subtotal = items.reduce((s, i) => s + Number(i.precio_unitario) * i.cantidad, 0);
  return { carritoId: carts[0].id, items, subtotal };
}

// GET /api/tienda/areas — public / active
router.get('/areas', async (_req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT id, nombre, descripcion FROM areas_entrega WHERE activo = 1 ORDER BY nombre`
    );
    res.json({ ok: true, areas: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar areas de entrega.' });
  }
});

// GET /api/tienda/areas/admin — admin list
router.get('/areas/admin', authStaff, async (_req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT id, nombre, descripcion, activo FROM areas_entrega ORDER BY id ASC`
    );
    res.json({ ok: true, areas: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar listado de areas.' });
  }
});

// POST /api/tienda/areas — admin create area
router.post('/areas', makeAuth({ requireAuth: true, allowedRoles: ['Administrador'] }), async (req, res) => {
  try {
    const { nombre, descripcion = '', activo = 1 } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del área es requerido.' });
    }
    const [result] = await queryLocal(
      `INSERT INTO areas_entrega (nombre, descripcion, activo) VALUES (?, ?, ?)`,
      [nombre.trim(), descripcion ? descripcion.trim() : null, activo ? 1 : 0]
    );
    res.status(201).json({ ok: true, id: result.insertId, mensaje: 'Área de entrega creada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear área: ' + err.message });
  }
});

// PUT /api/tienda/areas/:id — admin update area
router.put('/areas/:id', makeAuth({ requireAuth: true, allowedRoles: ['Administrador'] }), async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    const areaId = req.params.id;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del área es requerido.' });
    }
    await queryLocal(
      `UPDATE areas_entrega SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?`,
      [nombre.trim(), descripcion ? descripcion.trim() : null, activo ? 1 : 0, areaId]
    );
    res.json({ ok: true, mensaje: 'Área de entrega actualizada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar área: ' + err.message });
  }
});

// DELETE /api/tienda/areas/:id — admin toggle / delete
router.delete('/areas/:id', makeAuth({ requireAuth: true, allowedRoles: ['Administrador'] }), async (req, res) => {
  try {
    const areaId = req.params.id;
    await queryLocal(`UPDATE areas_entrega SET activo = 0 WHERE id = ?`, [areaId]);
    res.json({ ok: true, mensaje: 'Área desactivada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar área: ' + err.message });
  }
});

// POST /api/tienda/checkout — crear orden desde carrito
router.post('/checkout', authComprador, async (req, res) => {
  const uid = userId(req);
  const limit = checkoutLimiter(uid || req.ip);
  if (!limit.ok) {
    return res.status(429).json({ error: `Demasiadas solicitudes de compra. Por favor espera ${limit.retryAfterSec} segundos.` });
  }

  const conn = await require('../../database').localDB.getConnection();
  try {
    const { id_area_entrega, notas_entrega, metodo_pago = 'efectivo', recaptcha_token } = req.body;
    if (!id_area_entrega) {
      return res.status(400).json({ error: 'Selecciona un area de entrega.' });
    }

    const captcha = await verifyRecaptcha(recaptcha_token, req.ip);
    if (!captcha.ok) {
      return res.status(400).json({ error: captcha.error });
    }

    const { carritoId, items, subtotal } = await getCarritoCompleto(uid);
    if (!items.length) {
      return res.status(400).json({ error: 'El carrito esta vacio.' });
    }

    const codigo = generarCodigoOrden();
    const metodo = metodo_pago === 'tarjeta' ? 'tarjeta' : 'efectivo';
    let refPago = null;
    if (metodo === 'tarjeta') {
      refPago = `MOCK-RCC-${Date.now()}`;
    }

    await conn.beginTransaction();

    const [ordResult] = await conn.execute(
      `INSERT INTO ordenes (codigo, id_usuario, id_area_entrega, notas_entrega, metodo_pago, subtotal, total, qr_entrega)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, uid, id_area_entrega, notas_entrega || null, metodo, subtotal, subtotal, codigo]
    );
    const ordenId = ordResult.insertId;

    for (const item of items) {
      await conn.execute(
        `INSERT INTO orden_items (id_orden, id_producto, nombre_producto, cantidad, precio_unitario, personalizacion_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ordenId,
          item.id_producto,
          item.nombre_producto,
          item.cantidad,
          item.precio_unitario,
          item.personalizacion_json == null
            ? null
            : typeof item.personalizacion_json === 'string'
              ? item.personalizacion_json
              : JSON.stringify(item.personalizacion_json),
        ]
      );
    }

    await conn.execute(
      `INSERT INTO orden_estado_log (id_orden, estado, nota) VALUES (?, 'recibida', 'Orden creada')`,
      [ordenId]
    );

    await conn.execute(`DELETE FROM carrito_items WHERE id_carrito = ?`, [carritoId]);
    await conn.commit();

    let pdfUrl = null;
    try {
      const [orderItems] = await conn.execute(
        `SELECT nombre_producto, cantidad, precio_unitario, personalizacion_json FROM orden_items WHERE id_orden = ?`,
        [ordenId]
      );
      const [areaRows] = await conn.execute(
        `SELECT nombre FROM areas_entrega WHERE id = ? LIMIT 1`,
        [id_area_entrega]
      );
      const pdfBytes = await buildConstanciaCompra({
        orden: { codigo, total: subtotal, metodo_pago: metodo, creado: new Date() },
        items: orderItems,
        comprador: `Usuario #${uid}`,
        areaNombre: areaRows[0]?.nombre,
      });
      pdfUrl = await saveConstanciaPdf(codigo, pdfBytes);
      await conn.execute(`UPDATE ordenes SET pdf_constancia_url = ? WHERE id = ?`, [pdfUrl, ordenId]);
    } catch (pdfErr) {
      console.warn('[checkout] PDF constancia omitido:', pdfErr.message);
    }

    broadcastOrdenEstado({ codigo, estado: 'recibida', nota: 'Orden creada' });

    // Notificación por correo y WhatsApp asíncrona
    (async () => {
      try {
        const uRows = await queryCentralP(
          `SELECT Email_Usuario, Nombres_Usuario, Celular_Usuario, Notificaciones_WhatsApp_Usuario FROM usuarios WHERE Id_Usuario = ? LIMIT 1`,
          [uid]
        );
        if (uRows.length) {
          const user = uRows[0];
          if (user.Email_Usuario) {
            await sendOrderEmail({
              to: user.Email_Usuario,
              nombre: user.Nombres_Usuario,
              codigo,
              estado: 'recibida',
              total: subtotal,
              items,
              nota: notas_entrega || ''
            });
          }
          if (user.Celular_Usuario && Number(user.Notificaciones_WhatsApp_Usuario) === 1) {
            await whatsappService.sendOrderWhatsApp({
              phone: user.Celular_Usuario,
              nombre: user.Nombres_Usuario,
              codigo,
              estado: 'recibida',
              total: subtotal,
              areaEntrega: req.body?.area_entrega || 'Campus UMG'
            });
          }
        }
      } catch (mErr) {
        console.warn('[checkout notification error]', mErr.message);
      }
    })();

    // Auditoría automática
    registrarAuditoria({
      id_usuario: userId(req),
      accion: 'NUEVA_ORDEN_COMPRA',
      descripcion: `Orden de compra creada: ${codigo} por total Q${subtotal.toFixed(2)} (${metodo})`,
      ip_origen: req.ip || '::1',
      indice: 'TIENDA-CHECKOUT',
    });

    res.status(201).json({
      ok: true,
      orden: {
        id: ordenId,
        codigo,
        total: subtotal,
        estado: 'recibida',
        metodo_pago: metodo,
        ref_pago: refPago,
        pdf_constancia_url: pdfUrl,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[checkout]', err);
    res.status(500).json({ error: 'No se pudo completar el checkout.' });
  } finally {
    conn.release();
  }
});

// GET /api/tienda/ordenes/admin/list — staff lista ordenes
router.get('/ordenes/admin/list', authStaff, async (req, res) => {
  try {
    const { estado, limite = 100 } = req.query;
    let sql = `
      SELECT o.id, o.codigo, o.estado, o.total, o.metodo_pago, o.creado, o.id_usuario, o.notas_entrega,
             a.nombre AS area_entrega,
             u.Nombres_Usuario, u.Apellidos_Usuario, u.Usuario, u.Email_Usuario, u.Celular_Usuario,
             (
               SELECT GROUP_CONCAT(CONCAT(oi.cantidad, 'x ', p.nombre) SEPARATOR ', ')
               FROM orden_items oi
               JOIN productos p ON p.id = oi.id_producto
               WHERE oi.id_orden = o.id
             ) AS productos_resumen,
             (
               SELECT COUNT(*)
               FROM orden_items oi
               WHERE oi.id_orden = o.id
             ) AS total_articulos
      FROM ordenes o
      LEFT JOIN areas_entrega a ON a.id = o.id_area_entrega
      LEFT JOIN usuarios u ON u.Id_Usuario = o.id_usuario
      WHERE 1=1`;
    const params = [];
    if (estado) {
      sql += ` AND o.estado = ?`;
      params.push(estado);
    }
    const lim = Math.min(Math.max(Number(limite) || 100, 1), 200);
    sql += ` ORDER BY o.creado DESC LIMIT ${lim}`;
    const rows = await queryLocal(sql, params);
    res.json({ ok: true, ordenes: rows });
  } catch (err) {
    console.error('[ordenes admin list]', err);
    res.status(500).json({ error: 'Error al cargar ordenes.' });
  }
});

// GET /api/tienda/ordenes/mis — historico comprador
router.get('/ordenes/mis', authComprador, async (req, res) => {
  try {
    const uid = userId(req);
    const rows = await queryLocal(
      `SELECT o.id, o.codigo, o.estado, o.total, o.metodo_pago, o.creado,
              a.nombre AS area_entrega
       FROM ordenes o
       LEFT JOIN areas_entrega a ON a.id = o.id_area_entrega
       WHERE o.id_usuario = ?
       ORDER BY o.creado DESC`,
      [uid]
    );
    res.json({ ok: true, ordenes: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar historial.' });
  }
});

// POST /api/tienda/ordenes/:id/reordenar — volver a pedir items de una orden pasada
router.post('/ordenes/:id/reordenar', authComprador, async (req, res) => {
  try {
    const uid = userId(req);
    const ordenId = req.params.id;

    // Verificar que la orden pertenezca al usuario
    const ordenRows = await queryLocal(
      `SELECT id FROM ordenes WHERE id = ? AND id_usuario = ? LIMIT 1`,
      [ordenId, uid]
    );
    if (!ordenRows.length) return res.status(404).json({ error: 'Orden no encontrada.' });

    // Obtener items de la orden
    const items = await queryLocal(
      `SELECT id_producto, cantidad, personalizacion_json, precio_unitario FROM orden_items WHERE id_orden = ?`,
      [ordenId]
    );
    if (!items.length) return res.status(400).json({ error: 'La orden no tiene artículos.' });

    // Obtener o crear carrito del usuario
    let cRows = await queryLocal(`SELECT id FROM carritos WHERE id_usuario = ?`, [uid]);
    let carritoId = cRows.length ? cRows[0].id : null;
    if (!carritoId) {
      const ins = await queryLocal(`INSERT INTO carritos (id_usuario) VALUES (?)`, [uid]);
      carritoId = ins.insertId;
    }

    for (const item of items) {
      await queryLocal(
        `INSERT INTO carrito_items (id_carrito, id_producto, cantidad, personalizacion_json, precio_unitario)
         VALUES (?, ?, ?, ?, ?)`,
        [carritoId, item.id_producto, item.cantidad, item.personalizacion_json, item.precio_unitario]
      );
    }

    registrarAuditoria({
      id_usuario: uid,
      accion: 'REORDENAR_COMPRA',
      descripcion: `Reordenados ${items.length} productos de orden previa ID ${ordenId}`,
      ip_origen: req.ip || '::1',
      indice: 'TIENDA-REORDENAR',
    });

    res.json({ ok: true, message: 'Productos agregados al carrito exitosamente.', agregados: items.length });
  } catch (err) {
    console.error('[reordenar]', err);
    res.status(500).json({ error: 'No se pudo procesar la solicitud de reordenar.' });
  }
});

// GET /api/tienda/ordenes/:codigo/constancia — descargar PDF
router.get('/ordenes/:codigo/constancia', authComprador, async (req, res) => {
  try {
    const uid = userId(req);
    const rows = await queryLocal(
      `SELECT codigo, pdf_constancia_url FROM ordenes WHERE codigo = ? AND id_usuario = ? LIMIT 1`,
      [req.params.codigo, uid]
    );
    if (!rows.length) return res.status(404).json({ error: 'Orden no encontrada.' });
    const rel = rows[0].pdf_constancia_url;
    if (!rel) return res.status(404).json({ error: 'Constancia no disponible.' });
    const filePath = path.join(__dirname, '..', '..', rel.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="constancia_${rows[0].codigo}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Error al descargar constancia.' });
  }
});

// GET /api/tienda/ordenes/rastreo/:codigo — tracking público estilo Cargo Expreso
router.get('/ordenes/rastreo/:codigo', async (req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT o.id, o.codigo, o.estado, o.total, o.metodo_pago, o.creado, o.pdf_constancia_url,
              a.nombre AS area_entrega
       FROM ordenes o
       LEFT JOIN areas_entrega a ON a.id = o.id_area_entrega
       WHERE o.codigo = ? LIMIT 1`,
      [req.params.codigo]
    );
    if (!rows.length) return res.status(404).json({ error: 'Guía de rastreo no encontrada.' });

    const log = await queryLocal(
      `SELECT estado, nota, fecha FROM orden_estado_log WHERE id_orden = ? ORDER BY fecha ASC`,
      [rows[0].id]
    );
    const items = await queryLocal(
      `SELECT nombre_producto, cantidad, precio_unitario FROM orden_items WHERE id_orden = ?`,
      [rows[0].id]
    );
    res.json({ ok: true, orden: rows[0], historial: log, items });
  } catch (err) {
    console.error('[rastreo publico]', err);
    res.status(500).json({ error: 'Error al consultar la guía de rastreo.' });
  }
});

// GET /api/tienda/ordenes/:codigo — tracking
router.get('/ordenes/:codigo', authComprador, async (req, res) => {
  try {
    const uid = userId(req);
    const rows = await queryLocal(
      `SELECT o.*, a.nombre AS area_entrega
       FROM ordenes o
       LEFT JOIN areas_entrega a ON a.id = o.id_area_entrega
       WHERE o.codigo = ? AND o.id_usuario = ? LIMIT 1`,
      [req.params.codigo, uid]
    );
    if (!rows.length) return res.status(404).json({ error: 'Orden no encontrada.' });

    const log = await queryLocal(
      `SELECT estado, nota, fecha FROM orden_estado_log WHERE id_orden = ? ORDER BY fecha`,
      [rows[0].id]
    );
    const items = await queryLocal(
      `SELECT nombre_producto, cantidad, precio_unitario FROM orden_items WHERE id_orden = ?`,
      [rows[0].id]
    );
    res.json({ ok: true, orden: rows[0], historial: log, items });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar orden.' });
  }
});

// GET /api/tienda/ordenes/buscar/:codigo — repartidor/admin
router.get('/ordenes/buscar/:codigo', authStaff, async (req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT o.*, a.nombre AS area_entrega
       FROM ordenes o
       LEFT JOIN areas_entrega a ON a.id = o.id_area_entrega
       WHERE o.codigo = ? LIMIT 1`,
      [req.params.codigo]
    );
    if (!rows.length) return res.status(404).json({ error: 'Orden no encontrada.' });
    const items = await queryLocal(
      `SELECT nombre_producto, cantidad, precio_unitario FROM orden_items WHERE id_orden = ?`,
      [rows[0].id]
    );
    res.json({ ok: true, orden: rows[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Error en busqueda.' });
  }
});

// POST /api/tienda/ordenes/:id/entrega — repartidor confirma entrega
router.post('/ordenes/:id/entrega', makeAuth({ requireAuth: true, allowedRoles: ['Repartidor', 'Administrador', 'Supervisor'] }), uploadEntrega.single('foto'), async (req, res) => {
  try {
    const { resultado = 'entregada', pago_registrado, notas } = req.body;
    const ordenId = req.params.id;
    const repartidorId = userId(req);

    const ordenes = await queryLocal(`SELECT id, metodo_pago FROM ordenes WHERE id = ?`, [ordenId]);
    if (!ordenes.length) return res.status(404).json({ error: 'Orden no encontrada.' });

    const fotoUrl = req.file ? `/uploads/entregas/${req.file.filename}` : null;
    const pago = pago_registrado === '1' || pago_registrado === true || pago_registrado === 'true';
    const resEntrega = resultado === 'no_encontrado' ? 'no_encontrado' : 'entregada';
    const estadoOrden = resEntrega === 'entregada' ? 'entregada' : 'no_encontrado';

    await queryLocal(
      `INSERT INTO entregas (id_orden, id_repartidor, foto_url, pago_registrado, resultado, notas)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         id_repartidor=VALUES(id_repartidor), foto_url=COALESCE(VALUES(foto_url), foto_url),
         pago_registrado=VALUES(pago_registrado), resultado=VALUES(resultado),
         notas=VALUES(notas), fecha=NOW()`,
      [ordenId, repartidorId, fotoUrl, pago ? 1 : 0, resEntrega, notas || null]
    );

    await queryLocal(`UPDATE ordenes SET estado = ? WHERE id = ?`, [estadoOrden, ordenId]);
    await queryLocal(
      `INSERT INTO orden_estado_log (id_orden, estado, nota) VALUES (?, ?, ?)`,
      [ordenId, estadoOrden, notas || (resEntrega === 'entregada' ? 'Entrega confirmada' : 'Comprador no localizado')]
    );

    const ordRows = await queryLocal(`SELECT id_usuario, codigo, total FROM ordenes WHERE id = ?`, [ordenId]);
    if (ordRows[0]?.codigo) {
      const notaFinal = notas || (resEntrega === 'entregada' ? 'Entrega confirmada' : 'Comprador no localizado');
      broadcastOrdenEstado({
        codigo: ordRows[0].codigo,
        estado: estadoOrden,
        nota: notaFinal,
      });

      // Notificación de correo y WhatsApp asíncrona
      (async () => {
        try {
          const uRows = await queryCentralP(
            `SELECT Email_Usuario, Nombres_Usuario, Celular_Usuario, Notificaciones_WhatsApp_Usuario FROM usuarios WHERE Id_Usuario = ? LIMIT 1`,
            [ordRows[0].id_usuario]
          );
          if (uRows.length) {
            const user = uRows[0];
            if (user.Email_Usuario) {
              await sendOrderEmail({
                to: user.Email_Usuario,
                nombre: user.Nombres_Usuario,
                codigo: ordRows[0].codigo,
                estado: estadoOrden,
                total: ordRows[0].total,
                nota: notaFinal,
              });
            }
            if (user.Celular_Usuario && Number(user.Notificaciones_WhatsApp_Usuario) === 1) {
              await whatsappService.sendOrderWhatsApp({
                phone: user.Celular_Usuario,
                nombre: user.Nombres_Usuario,
                codigo: ordRows[0].codigo,
                estado: estadoOrden,
                total: ordRows[0].total,
                areaEntrega: ordRows[0].area_entrega || 'Campus UMG'
              });
            }
          }
        } catch (mErr) {
          console.warn('[entrega notification error]', mErr.message);
        }
      })();
    }

    registrarAuditoria({
      id_usuario: repartidorId,
      accion: 'ENTREGA_ORDEN',
      descripcion: `Entrega registrada para orden ID ${ordenId} (${ordRows[0]?.codigo || ''}): ${estadoOrden}. ${pago ? 'Pago efectivo recibido.' : ''}`,
      ip_origen: req.ip || '::1',
      indice: 'LOGISTICA-ENTREGA',
    });

    res.json({ ok: true, estado: estadoOrden, foto_url: fotoUrl, pago_registrado: pago });
  } catch (err) {
    console.error('[entrega POST]', err);
    res.status(500).json({ error: 'No se pudo registrar la entrega.' });
  }
});

// PUT /api/tienda/ordenes/:id/estado — staff actualiza tracking mediante Autómata
router.put('/ordenes/:id/estado', authStaff, async (req, res) => {
  try {
    const { estado, nota } = req.body;
    const ordenId = req.params.id;

    // 1. Obtener la orden y su estado actual
    const ordRows = await queryLocal(`SELECT id, id_usuario, codigo, estado, total, area_entrega FROM ordenes WHERE id = ?`, [ordenId]);
    if (!ordRows.length) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }

    const estadoActual = ordRows[0].estado || 'recibida';
    const rolUsuario = req.user?.rol || 'Staff';

    // 2. Validar transición formal con el Autómata
    const validacion = validarTransicionAutomata(estadoActual, estado, rolUsuario);
    if (!validacion.valido) {
      return res.status(409).json({
        error: validacion.error,
        estadoActual,
        estadosPermitidos: getSiguientesEstadosPermitidos(estadoActual)
      });
    }

    if (validacion.sinCambio) {
      return res.json({ ok: true, mensaje: 'La orden ya se encuentra en este estado.', estado });
    }

    // 3. Ejecutar transición
    await queryLocal(`UPDATE ordenes SET estado = ? WHERE id = ?`, [estado, ordenId]);
    await queryLocal(
      `INSERT INTO orden_estado_log (id_orden, estado, nota) VALUES (?, ?, ?)`,
      [ordenId, estado, nota || `Transición automática (${estadoActual} ➔ ${estado})`]
    );

    const codigo = ordRows[0].codigo;
    if (codigo) {
      broadcastOrdenEstado({ codigo, estado, nota: nota || null });

      // Notificación de correo y WhatsApp asíncrona
      (async () => {
        try {
          const uRows = await queryCentralP(
            `SELECT Email_Usuario, Nombres_Usuario, Celular_Usuario, Notificaciones_WhatsApp_Usuario FROM usuarios WHERE Id_Usuario = ? LIMIT 1`,
            [ordRows[0].id_usuario]
          );
          if (uRows.length) {
            const user = uRows[0];
            if (user.Email_Usuario) {
              await sendOrderEmail({
                to: user.Email_Usuario,
                nombre: user.Nombres_Usuario,
                codigo,
                estado,
                total: ordRows[0].total,
                nota: nota || '',
              });
            }
            if (user.Celular_Usuario && Number(user.Notificaciones_WhatsApp_Usuario) === 1) {
              await whatsappService.sendOrderWhatsApp({
                phone: user.Celular_Usuario,
                nombre: user.Nombres_Usuario,
                codigo,
                estado,
                total: ordRows[0].total,
                areaEntrega: ordRows[0].area_entrega || 'Campus UMG'
              });
            }
          }
        } catch (mErr) {
          console.warn('[estado notification error]', mErr.message);
        }
      })();
    }

    registrarAuditoria({
      id_usuario: userId(req),
      accion: 'CAMBIO_ESTADO_ORDEN_AUTOMATA',
      descripcion: `Orden ${codigo}: Transición de '${estadoActual}' a '${estado}'. ${nota ? `Nota: ${nota}` : ''}`,
      ip_origen: req.ip || '::1',
      indice: 'ADM-ORDENES',
    });

    res.json({
      ok: true,
      estadoAnterior: estadoActual,
      estadoNuevo: estado,
      siguientesTransiciones: getSiguientesEstadosPermitidos(estado)
    });
  } catch (err) {
    console.error('[estado PUT]', err);
    res.status(500).json({ error: 'No se pudo actualizar estado.' });
  }
});

// GET /api/tienda/ordenes/export/csv — exportación CSV para staff
router.get('/ordenes/export/csv', authStaff, async (req, res) => {
  try {
    const rows = await queryLocal(
      `SELECT o.id, o.codigo, o.estado, o.metodo_pago, o.subtotal, o.total, o.creado,
              a.nombre AS area_entrega
       FROM ordenes o
       LEFT JOIN areas_entrega a ON a.id = o.id_area_entrega
       ORDER BY o.creado DESC`
    );

    let csv = 'ID,Codigo,Estado,MetodoPago,Total,AreaEntrega,Fecha\n';
    for (const r of rows) {
      const fecha = new Date(r.creado).toISOString();
      const area = (r.area_entrega || '').replace(/,/g, ' ');
      csv += `${r.id},"${r.codigo}","${r.estado}","${r.metodo_pago}",${Number(r.total).toFixed(2)},"${area}","${fecha}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_ordenes_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).send('Error exportando reporte CSV.');
  }
});

// GET /api/tienda/dashboard/ventas — supervisor/admin
router.get('/dashboard/ventas', makeAuth({ requireAuth: true, allowedRoles: ['Administrador', 'Supervisor'] }), async (req, res) => {
  try {
    const { rango = 'total' } = req.query;
    let filtro = '';
    if (rango === 'dia') filtro = `AND DATE(o.creado) = CURDATE()`;
    else if (rango === 'semana') filtro = `AND o.creado >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;

    const resumen = await queryLocal(
      `SELECT COUNT(*) AS total_ordenes,
              COALESCE(SUM(total), 0) AS ingresos,
              SUM(CASE WHEN estado = 'entregada' THEN 1 ELSE 0 END) AS entregadas
       FROM ordenes o WHERE 1=1 ${filtro}`
    );
    const porEstado = await queryLocal(
      `SELECT estado, COUNT(*) AS cantidad FROM ordenes o WHERE 1=1 ${filtro} GROUP BY estado`
    );
    const porProducto = await queryLocal(
      `SELECT oi.nombre_producto, SUM(oi.cantidad) AS unidades, SUM(oi.cantidad * oi.precio_unitario) AS ingresos
       FROM orden_items oi
       INNER JOIN ordenes o ON o.id = oi.id_orden
       WHERE 1=1 ${filtro}
       GROUP BY oi.nombre_producto
       ORDER BY unidades DESC
       LIMIT 10`
    );
    res.json({ ok: true, resumen: resumen[0], por_estado: porEstado, por_producto: porProducto });
  } catch (err) {
    console.error('[dashboard ventas]', err);
    res.status(500).json({ error: 'Error en dashboard.' });
  }
});

module.exports = router;
