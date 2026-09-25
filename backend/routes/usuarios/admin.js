// routes/admin.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { queryCentralP } = require('../../database');
const { makeAuth } = require('../../middlewares/auth');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const ExcelJS = require('exceljs');
const bcrypt  = require('bcrypt');
const multer  = require('multer');
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

/** Fecha/hora legible en zona Guatemala (reportes). */
function formatGeneradoGt() {
  return new Date().toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

/**
 * Fecha/hora de fila de reporte como en reportes anteriores: YYYY-MM-DD HH:MM:SS (America/Guatemala).
 * Evita String(Date) tipo "Wed May 13 2026 ..." cuando mysql2 devuelve objeto Date.
 */
function formatFechaReporteGt(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
      .toLocaleString('sv-SE', { timeZone: 'America/Guatemala' })
      .replace('T', ' ')
      .slice(0, 19);
  }
  if (Buffer.isBuffer(value)) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d
        .toLocaleString('sv-SE', { timeZone: 'America/Guatemala' })
        .replace('T', ' ')
        .slice(0, 19);
    }
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d
      .toLocaleString('sv-SE', { timeZone: 'America/Guatemala' })
      .replace('T', ' ')
      .slice(0, 19);
  }
  return s;
}

/** Logo institucional para PDF/Excel (rutas válidas en repo y en imagen Docker /app). */
function loadReportLogoFile() {
  const candidates = [
    ['jpeg', path.join(__dirname, '../../assets/umg_logo.jpg')],
    ['png', path.join(__dirname, '../../assets/umg.png')],
    ['png', path.join(__dirname, '../../../frontend/src/assets/Logo UMG.png')],
    ['jpeg', path.join(__dirname, '../../assets/umg.jpg')],
  ];
  for (const [ext, p] of candidates) {
    try {
      if (fs.existsSync(p)) return { buffer: fs.readFileSync(p), ext };
    } catch {
      /* siguiente */
    }
  }
  return null;
}

/** Fila de ingresos con las 5 columnas del reporte institucional. */
function mapAccessLogRowForReport(row) {
  const nombre = (row.nombre_completo && String(row.nombre_completo).trim()) || '';
  const ex = row.exitoso;
  let estado = '';
  if (ex === 1 || ex === true || ex === '1') estado = 'OK';
  else if (ex === 0 || ex === false || ex === '0') estado = 'Fallo';
  else if (Buffer.isBuffer(ex)) {
    if (ex.length && ex[0] === 1) estado = 'OK';
    else if (ex.length && ex[0] === 0) estado = 'Fallo';
  } else if (ex != null && ex !== '') {
    const n = Number(ex);
    if (!Number.isNaN(n)) {
      if (n === 1) estado = 'OK';
      else if (n === 0) estado = 'Fallo';
    }
  }
  const fecha = formatFechaReporteGt(row.fecha);
  return {
    FECHA: fecha,
    NOMBRE: nombre,
    METODO_LOGIN: String(row.metodo_login ?? ''),
    IP: String(row.ip ?? ''),
    ESTADO: estado,
  };
}

function truncPdfCell(text, maxLen) {
  const s = String(text ?? '');
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

/** Calcula x para centrar texto en el área de contenido (x=40..555) de una página A4. */
function pdfCenterX(text, size, font) {
  try {
    const w = font.widthOfTextAtSize(text, size);
    return 40 + Math.max(0, (515 - w) / 2);
  } catch {
    return 40;
  }
}

/** Centra texto dentro de una columna del PDF tabular (margen 2 px; si overflow, alinea a la izquierda). */
function pdfTextXInCell(cellLeftPx, cellWidthPx, text, fontSize, font) {
  const t = String(text ?? '');
  const pad = 2;
  try {
    const tw = font.widthOfTextAtSize(t, fontSize);
    const inner = Math.max(0, cellWidthPx - pad * 2);
    if (tw <= inner) return cellLeftPx + pad + (inner - tw) / 2;
    return cellLeftPx + pad;
  } catch {
    return cellLeftPx + pad;
  }
}

/** Anchos de tabla PDF alineados con barras entre columnas x=40..555 (ancho útil 515). */
const PDF_ACCESS_COL_WIDTHS = [
  { left: 40, w: 78 }, // FECHA
  { left: 118, w: 150 }, // NOMBRE
  { left: 268, w: 110 }, // METODO_LOGIN
  { left: 378, w: 140 }, // IP
  { left: 518, w: 37 }, // ESTADO → 518+37=555
];

const PDF_DRIVER_COL_WIDTHS = [
  { left: 40, w: 120 }, // NOMBRE
  { left: 160, w: 95 }, // USUARIO
  { left: 255, w: 60 }, // ESTADO
  { left: 315, w: 105 }, // RUTA
  { left: 420, w: 48 }, // INGRESOS
  { left: 468, w: 87 }, // ULTIMO_ACCESO
];

/** PDF multipágina: logo UMG, encabezado y tabla (fechas YYYY-MM-DD HH:MM:SS). */
async function buildAccessLogsPdf(mappedRows) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.08, 0.35, 0.22);
  const muted = rgb(0.35, 0.38, 0.4);
  const white = rgb(1, 1, 1);
  const headerFill = rgb(15 / 255, 184 / 255, 142 / 255);
  const zebra = rgb(0.96, 0.97, 0.98);

  let logoImage = null;
  const logoFile = loadReportLogoFile();
  if (logoFile) {
    try {
      logoImage =
        logoFile.ext === 'jpeg' || logoFile.ext === 'jpg'
          ? await pdfDoc.embedJpg(logoFile.buffer)
          : await pdfDoc.embedPng(logoFile.buffer);
    } catch {
      logoImage = null;
    }
  }

  const generado = formatGeneradoGt();
  const total = mappedRows.length;

  const drawBranding = (page, continuation) => {
    let y = 800;
    if (logoImage) {
      const lw = 52;
      const lh = Math.round((logoImage.height / logoImage.width) * lw);
      page.drawImage(logoImage, { x: 595 - 40 - lw, y: 826 - lh, width: lw, height: lh });
    }
    const t1 = 'Universidad Mariano Gálvez';
    page.drawText(t1, { x: pdfCenterX(t1, 12, bold), y, size: 12, font: bold, color: brand });
    y -= 16;
    const t2 = 'Sistema UMG Rover 2.0';
    page.drawText(t2, { x: pdfCenterX(t2, 9, font), y, size: 9, font, color: muted });
    y -= 14;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 2, color: brand });
    y -= 22;
    const titulo = continuation ? 'REPORTE DE INGRESOS (continuación)' : 'REPORTE DE INGRESOS';
    page.drawText(titulo, { x: pdfCenterX(titulo, 18, bold), y, size: 18, font: bold, color: brand });
    y -= 18;
    const sub = `Generado: ${generado}  |  Total: ${total}`;
    page.drawText(sub, { x: pdfCenterX(sub, 9, font), y, size: 9, font, color: muted });
    return y - 24;
  };

  const drawTableHeader = (page, yTop) => {
    const barY = yTop;
    page.drawRectangle({ x: 40, y: barY - 18, width: 515, height: 18, color: headerFill });
    const labels = ['FECHA', 'NOMBRE', 'METODO_LOGIN', 'IP', 'ESTADO'];
    labels.forEach((label, i) => {
      const { left, w } = PDF_ACCESS_COL_WIDTHS[i];
      page.drawText(label, {
        x: pdfTextXInCell(left, w, label, 8, bold),
        y: barY - 14,
        size: 8,
        font: bold,
        color: white,
      });
    });
    return barY - 22;
  };

  let page = pdfDoc.addPage([595, 842]);
  let y = drawBranding(page, false);
  y = drawTableHeader(page, y);
  const rowH = 14;
  const bottom = 48;
  let idx = 0;
  let rowNum = 0;

  while (idx < mappedRows.length) {
    if (y < bottom + rowH) {
      page = pdfDoc.addPage([595, 842]);
      y = drawBranding(page, true);
      y = drawTableHeader(page, y);
    }
    const r = mappedRows[idx];
    const fill = rowNum % 2 === 1 ? zebra : rgb(1, 1, 1);
    page.drawRectangle({ x: 40, y: y - rowH, width: 515, height: rowH, color: fill });
    const cells = [
      truncPdfCell(r.FECHA, 22),
      truncPdfCell(r.NOMBRE, 28),
      truncPdfCell(r.METODO_LOGIN, 18),
      truncPdfCell(r.IP, 22),
      truncPdfCell(r.ESTADO, 8),
    ];
    cells.forEach((txt, i) => {
      const { left, w } = PDF_ACCESS_COL_WIDTHS[i];
      page.drawText(txt, {
        x: pdfTextXInCell(left, w, txt, 7, font),
        y: y - 11,
        size: 7,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
    y -= rowH;
    idx += 1;
    rowNum += 1;
  }

  return pdfDoc.save();
}

/** Fila de conductores con las 6 columnas del reporte institucional. */
function mapDriverRowForReport(row) {
  return {
    NOMBRE:         String(row.nombre_completo || '').trim() || String(row.Usuario || ''),
    USUARIO:        String(row.Usuario ?? ''),
    ESTADO:         String(row.estado ?? ''),
    RUTA:           String(row.ruta_asignada ?? '—'),
    INGRESOS:       String(row.total_ingresos ?? '0'),
    ULTIMO_ACCESO:  formatFechaReporteGt(row.ultimo_acceso),
  };
}

/** PDF multipágina conductores: logo UMG, encabezado y tabla. */
async function buildDriversPdf(mappedRows) {
  const pdfDoc = await PDFDocument.create();
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const brand      = rgb(0.08, 0.35, 0.22);
  const muted      = rgb(0.35, 0.38, 0.4);
  const white      = rgb(1, 1, 1);
  const headerFill = rgb(15 / 255, 184 / 255, 142 / 255);
  const zebra      = rgb(0.96, 0.97, 0.98);

  let logoImage = null;
  const logoFile = loadReportLogoFile();
  if (logoFile) {
    try {
      logoImage = logoFile.ext === 'jpeg' || logoFile.ext === 'jpg'
        ? await pdfDoc.embedJpg(logoFile.buffer)
        : await pdfDoc.embedPng(logoFile.buffer);
    } catch { logoImage = null; }
  }

  const generado = formatGeneradoGt();
  const total    = mappedRows.length;

  const drawBranding = (page, continuation) => {
    let y = 800;
    if (logoImage) {
      const lw = 52;
      const lh = Math.round((logoImage.height / logoImage.width) * lw);
      page.drawImage(logoImage, { x: 595 - 40 - lw, y: 826 - lh, width: lw, height: lh });
    }
    const t1 = 'Universidad Mariano Gálvez';
    page.drawText(t1, { x: pdfCenterX(t1, 12, bold), y, size: 12, font: bold, color: brand });
    y -= 16;
    const t2 = 'Sistema UMG Rover 2.0';
    page.drawText(t2, { x: pdfCenterX(t2, 9, font), y, size: 9, font, color: muted });
    y -= 14;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 2, color: brand });
    y -= 22;
    const titulo = continuation ? 'REPORTE DE CONDUCTORES (continuación)' : 'REPORTE DE CONDUCTORES';
    page.drawText(titulo, { x: pdfCenterX(titulo, 18, bold), y, size: 18, font: bold, color: brand });
    y -= 18;
    const sub = `Generado: ${generado}  |  Total: ${total}`;
    page.drawText(sub, { x: pdfCenterX(sub, 9, font), y, size: 9, font, color: muted });
    return y - 24;
  };

  const drawTableHeader = (page, yTop) => {
    page.drawRectangle({ x: 40, y: yTop - 18, width: 515, height: 18, color: headerFill });
    const labels = ['NOMBRE', 'USUARIO', 'ESTADO', 'RUTA', 'INGRESOS', 'ULTIMO ACCESO'];
    labels.forEach((label, i) => {
      const { left, w } = PDF_DRIVER_COL_WIDTHS[i];
      page.drawText(label, {
        x: pdfTextXInCell(left, w, label, 8, bold),
        y: yTop - 14,
        size: 8,
        font: bold,
        color: white,
      });
    });
    return yTop - 22;
  };

  let page = pdfDoc.addPage([595, 842]);
  let y    = drawBranding(page, false);
  y        = drawTableHeader(page, y);
  const rowH = 14, bottom = 48;
  let idx = 0, rowNum = 0;

  while (idx < mappedRows.length) {
    if (y < bottom + rowH) {
      page = pdfDoc.addPage([595, 842]);
      y    = drawBranding(page, true);
      y    = drawTableHeader(page, y);
    }
    const r    = mappedRows[idx];
    const fill = rowNum % 2 === 1 ? zebra : rgb(1, 1, 1);
    page.drawRectangle({ x: 40, y: y - rowH, width: 515, height: rowH, color: fill });
    const cells = [
      truncPdfCell(r.NOMBRE, 16),
      truncPdfCell(r.USUARIO, 14),
      truncPdfCell(r.ESTADO, 9),
      truncPdfCell(r.RUTA, 12),
      truncPdfCell(r.INGRESOS, 8),
      truncPdfCell(r.ULTIMO_ACCESO, 19),
    ];
    cells.forEach((txt, i) => {
      const { left, w } = PDF_DRIVER_COL_WIDTHS[i];
      page.drawText(txt, {
        x: pdfTextXInCell(left, w, txt, 7, font),
        y: y - 11,
        size: 7,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
    y -= rowH;
    idx += 1;
    rowNum += 1;
  }
  return pdfDoc.save();
}

/** Excel real (.xlsx) — conductores, logo UMG y fechas YYYY-MM-DD HH:MM:SS. */
async function buildDriversXlsx(mapped, generado) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Conductores', { properties: { defaultRowHeight: 20 } });

  ws.columns = [
    { width: 28 }, // A NOMBRE
    { width: 20 }, // B USUARIO
    { width: 14 }, // C ESTADO
    { width: 22 }, // D RUTA
    { width: 12 }, // E INGRESOS
    { width: 22 }, // F ULTIMO_ACCESO
    { width: 3  }, // G separador
    { width: 12 }, // H logo
  ];

  ws.addRow(['REPORTE DE CONDUCTORES', '', '', '', '', '', '', '']);
  ws.mergeCells(1, 1, 1, 6);
  ws.getRow(1).height = 72;
  const t1 = ws.getCell(1, 1);
  t1.font      = { bold: true, size: 14, color: { argb: 'FF065F46' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };

  const logoFile = loadReportLogoFile();
  if (logoFile) {
    try {
      const ext     = logoFile.ext === 'jpg' || logoFile.ext === 'jpeg' ? 'jpeg' : 'png';
      const imageId = wb.addImage({ buffer: logoFile.buffer, extension: ext });
      ws.addImage(imageId, { tl: { col: 7.1, row: 0.1 }, ext: { width: 68, height: 68 } });
    } catch { /* sin logo */ }
  }

  ws.addRow(['Sistema UMG Rover 2.0 - Universidad Mariano Gálvez']);
  ws.mergeCells(2, 1, 2, 6);
  const t2 = ws.getCell(2, 1);
  t2.font      = { size: 11, color: { argb: 'FF64748B' } };
  t2.alignment = { horizontal: 'center' };

  ws.addRow([`Generado: ${generado}`]);
  ws.mergeCells(3, 1, 3, 6);
  const t3 = ws.getCell(3, 1);
  t3.font      = { size: 10, color: { argb: 'FF64748B' } };
  t3.alignment = { horizontal: 'center' };

  ws.addRow([]);

  const headerRow = ws.addRow(['NOMBRE', 'USUARIO', 'ESTADO', 'RUTA', 'INGRESOS', 'ULTIMO_ACCESO']);
  headerRow.height = 20;
  for (let c = 1; c <= 6; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0FB88E' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  for (const r of mapped) {
    const row = ws.addRow([r.NOMBRE, r.USUARIO, r.ESTADO, r.RUTA, r.INGRESOS, r.ULTIMO_ACCESO]);
    for (let c = 1; c <= 6; c++) {
      row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  return wb.xlsx.writeBuffer();
}

/** Excel real (.xlsx) — logo UMG, encabezado y fechas YYYY-MM-DD HH:MM:SS. */
async function buildAccessLogsXlsx(mapped, generado) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ingresos', { properties: { defaultRowHeight: 20 } });

  // Columna G (índice 7) reservada para el logo, fuera de la tabla (A–E)
  ws.columns = [
    { width: 22 },  // A FECHA
    { width: 36 },  // B NOMBRE
    { width: 22 },  // C METODO_LOGIN
    { width: 18 },  // D IP
    { width: 10 },  // E ESTADO
    { width: 3  },  // F separador
    { width: 12 },  // G logo
  ];

  // Fila 1: título A–E, logo en G
  ws.addRow(['REPORTE DE INGRESOS AL SISTEMA', '', '', '', '', '', '']);
  ws.mergeCells(1, 1, 1, 5);
  ws.getRow(1).height = 72;
  const t1 = ws.getCell(1, 1);
  t1.font = { bold: true, size: 14, color: { argb: 'FF065F46' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };

  const logoFile = loadReportLogoFile();
  if (logoFile) {
    try {
      const ext = logoFile.ext === 'jpg' || logoFile.ext === 'jpeg' ? 'jpeg' : 'png';
      const imageId = wb.addImage({ buffer: logoFile.buffer, extension: ext });
      // col: 6 = columna G (0-indexed), row: 0 = fila 1; ext en píxeles
      ws.addImage(imageId, { tl: { col: 6.1, row: 0.1 }, ext: { width: 68, height: 68 } });
    } catch {
      /* sin logo */
    }
  }

  ws.addRow(['Sistema UMG Rover 2.0 - Universidad Mariano Gálvez']);
  ws.mergeCells(2, 1, 2, 5);
  const t2 = ws.getCell(2, 1);
  t2.font = { size: 11, color: { argb: 'FF64748B' } };
  t2.alignment = { horizontal: 'center' };

  ws.addRow([`Generado: ${generado}`]);
  ws.mergeCells(3, 1, 3, 5);
  const t3 = ws.getCell(3, 1);
  t3.font = { size: 10, color: { argb: 'FF64748B' } };
  t3.alignment = { horizontal: 'center' };

  ws.addRow([]);

  const headerRow = ws.addRow(['FECHA', 'NOMBRE', 'METODO_LOGIN', 'IP', 'ESTADO']);
  headerRow.height = 20;
  for (let col = 1; col <= 5; col += 1) {
    const cell = headerRow.getCell(col);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0FB88E' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  for (const r of mapped) {
    const row = ws.addRow([r.FECHA, r.NOMBRE, r.METODO_LOGIN, r.IP, r.ESTADO]);
    for (let c = 1; c <= 5; c++) {
      row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  return wb.xlsx.writeBuffer();
}


// Solo Admin
const requireAdmin = makeAuth({ requireAuth: true, allowedRoles: ['Administrador'] });
const requireAdminOrSupervisor = makeAuth({
  requireAuth: true,
  allowedRoles: ['Administrador', 'Supervisor']
});
// ---------- Diagnóstico rápido (temporal) ----------
router.get('/__ping', (req, res) => res.json({ ok: true, at: '/admin' }));

// =============== ROLES PÚBLICOS (para registro) ===============
router.get('/roles-public', async (req, res) => {
  try {
    const sql = `SELECT IdRol AS id, Rol AS nombre FROM Roles ORDER BY IdRol`;
    const rows = await queryCentralP(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error listando roles (público):', err);
    res.status(500).json({ error: 'Error al obtener roles.' });
  }
});

// =============== LISTAR ROLES ===============
router.get('/roles', requireAdmin, async (req, res) => {
  try {
    const sql = `
      SELECT r.IdRol, r.Rol, COUNT(u.Id_Usuario) AS TotalUsuarios
      FROM Roles r
      LEFT JOIN usuarios u ON u.Id_Rol_Usuario = r.IdRol
      GROUP BY r.IdRol, r.Rol
      ORDER BY r.IdRol
    `;
    const rows = await queryCentralP(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error listando roles:', err);
    res.status(500).json({ error: 'Error al obtener roles.' });
  }
});

// =============== LISTAR USUARIOS ===============
router.get('/usuarios', requireAdminOrSupervisor, async (req, res) => {  try {
    const sql = `
  SELECT 
    u.Id_Usuario,
    u.Nombres_Usuario,
    u.Apellidos_Usuario,
    u.Usuario,
    u.Email_Usuario,
    u.Id_Rol_Usuario,
    r.Rol,
    CAST(u.Estado_Usuario AS UNSIGNED) AS Estado_Usuario
      FROM usuarios u
      INNER JOIN Roles r
        ON u.Id_Rol_Usuario = r.IdRol
      ORDER BY u.Nombres_Usuario ASC
`;
    const rows = await queryCentralP(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error listando usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

// =============== LISTAR AUDITORÍA ===============
router.get('/auditoria', requireAdminOrSupervisor, async (req, res) => {  try {
    const sql = `
      SELECT 
        a.id_auditoria,
        a.id_usuario,
        u.Usuario,
        a.accion,
        a.descripcion,
        a.ip_origen,
        a.fecha_evento,
        a.indice_accion
      FROM auditoria a
      LEFT JOIN usuarios u
        ON a.id_usuario = u.Id_Usuario
      ORDER BY a.fecha_evento DESC
      LIMIT 100
    `;
    const rows = await queryCentralP(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error listando auditoría:', err);
    res.status(500).json({ error: 'Error al obtener auditoría.' });
  }
});

// =============== PERFIL (GET + PUT) ===============
router.get('/perfil/:id', requireAdmin, async (req, res) => {
  try {
    const uidToken = String(req.auth?.uid || '');
    const uidParam = String(req.params.id || '');
    if (uidToken !== uidParam) return res.status(403).json({ error: 'Acceso denegado' });

    const sql = `
      SELECT 
        u.Id_Usuario,
        u.Nombres_Usuario,
        u.Apellidos_Usuario,
        u.Email_Usuario,
        u.Celular_Usuario,
        u.Usuario,
        u.Foto_Modificada_String64_Usuario AS foto64,
        r.Rol
      FROM usuarios u
      INNER JOIN Roles r
        ON u.Id_Rol_Usuario = r.IdRol
      WHERE u.Id_Usuario = ?
      LIMIT 1
    `;
    const rows = await queryCentralP(sql, [uidParam]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error perfil GET:', err);
    res.status(500).json({ error: 'Error al obtener perfil.' });
  }
});

router.put('/perfil/:id', requireAdmin, async (req, res) => {
  try {
    const uidToken = String(req.auth?.uid || '');
    const uidParam = String(req.params.id || '');
    if (uidToken !== uidParam) return res.status(403).json({ error: 'Acceso denegado' });

    const { nombres, apellidos, correo, telefono, contrasena } = req.body || {};
    const updates = [];
    const vals = [];

    if (nombres)   { updates.push('Nombres_Usuario = ?'); vals.push(nombres); }
    if (apellidos) { updates.push('Apellidos_Usuario = ?'); vals.push(apellidos); }
    if (correo)    { updates.push('Email_Usuario = ?'); vals.push(correo); }
    if (telefono)  { updates.push('Celular_Usuario = ?'); vals.push(telefono); }

    if (contrasena && contrasena.trim()) {
      const hash = await bcrypt.hash(contrasena.trim(), 10);
      updates.push('Password_Usuario = ?');
      vals.push(hash);
    }

    if (!updates.length) return res.json({ ok: true, mensaje: 'Sin cambios' });

    const sql = `
      UPDATE usuarios
      SET ${updates.join(', ')}
      WHERE Id_Usuario = ?
    `;
    vals.push(uidParam);
    await queryCentralP(sql, vals);

    res.json({ ok: true, mensaje: 'Perfil actualizado' });
  } catch (err) {
    console.error('❌ Error perfil PUT:', err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});
// ========================
// ✅ ACTUALIZAR ROL DE USUARIO (Auditoría completa)
// ========================
router.put('/usuarios/:id/rol', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nuevoRol } = req.body;

  try {
    // El rol tiene que existir de verdad en la tabla Roles. Sin esta comprobacion
    // un IdRol inventado revienta contra la FK_Rol_usuarios y el usuario solo ve
    // un 500 sin explicacion.
    const rolId = Number(nuevoRol);
    if (!Number.isInteger(rolId)) {
      return res.status(400).json({ ok: false, error: 'El rol enviado no es valido.' });
    }

    const rolRows = await queryCentralP(
      `SELECT IdRol, Rol FROM Roles WHERE IdRol = ? LIMIT 1`,
      [rolId]
    );
    if (!rolRows.length) {
      return res.status(400).json({ ok: false, error: 'El rol seleccionado no existe.' });
    }
    const rolNombre = rolRows[0].Rol;

    const usuarioRows = await queryCentralP(
      `SELECT Id_Usuario FROM usuarios WHERE Id_Usuario = ? LIMIT 1`,
      [id]
    );
    if (!usuarioRows.length) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }

    const sql = `
      UPDATE usuarios
      SET Id_Rol_Usuario = ?
      WHERE Id_Usuario = ?;
    `;
    await queryCentralP(sql, [rolId, id]);

    // Obtener datos del usuario logueado
    const usuarioSesion = req.auth?.usuario || 'Desconocido';
    const ipOrigen = req.ip || '::1';
    const indice = 'ADM-ROL';

    // Insertar registro de auditoría
    await queryCentralP(`
      INSERT INTO auditoria 
      (id_usuario, accion, descripcion, ip_origen, fecha_evento, indice_accion)
      VALUES (?, 'CAMBIO_ROL_USUARIO', 
      CONCAT('El usuario ', ?, ' cambió el rol del usuario ID ', ?, ' a ', ?),
      ?, NOW(), ?)
    `, [req.auth.uid, usuarioSesion, id, rolNombre, ipOrigen, indice]);

    res.json({ ok: true, mensaje: `Rol actualizado a ${rolNombre}.`, rol: rolNombre, idRol: rolId });
  } catch (err) {
    console.error('❌ Error al actualizar rol:', err);
    res.status(500).json({ ok: false, error: 'Error al actualizar rol.' });
  }
});

//gestin usuarios
router.put('/usuarios/:id/estado', requireAdmin, async (req, res) => {
  const { id } = req.params;
  // Solo 0 o 1: cualquier otra cosa (o no enviarlo) llegaba a MySQL como
  // undefined y el cliente recibia un 500 en vez de saber que pidio algo mal.
  const nuevoEstado = Number(req.body?.nuevoEstado);
  if (nuevoEstado !== 0 && nuevoEstado !== 1) {
    return res.status(400).json({ ok: false, error: 'nuevoEstado debe ser 0 (inactivo) o 1 (activo).' });
  }

  try {
    const sql = `
      UPDATE usuarios
      SET Estado_Usuario = ?
      WHERE Id_Usuario = ?;
    `;
    const result = await queryCentralP(sql, [nuevoEstado, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }

    // Datos del usuario logueado
    const usuarioSesion = req.auth?.usuario || 'Desconocido';
    const ipOrigen = req.ip || '::1';
    const accion = nuevoEstado == 1 ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO';
    const indice = 'ADM-USUARIOS';

    // Registrar en auditoría
    await queryCentralP(`
      INSERT INTO auditoria 
      (id_usuario, accion, descripcion, ip_origen, fecha_evento, indice_accion)
      VALUES (?, ?, 
      CONCAT('El usuario ', ?, ' ', 
      IF(? = 1, 'activó la cuenta ID ', 'desactivó la cuenta ID '), ?, ''),
      ?, NOW(), ?)
    `, [req.auth.uid, accion, usuarioSesion, nuevoEstado, id, ipOrigen, indice]);

    res.json({ ok: true, mensaje: 'Estado del usuario actualizado correctamente.' });
  } catch (err) {
    console.error('❌ Error al cambiar estado de usuario:', err);
    res.status(500).json({ ok: false, error: 'Error al cambiar estado del usuario.' });
  }
});

function buildPaging(page, limit) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

router.get('/access-logs', requireAdminOrSupervisor, async (req, res) => {
  try {
    const { page, limit, offset } = buildPaging(req.query.page, req.query.limit);
    const filters = [];
    const params = [];

    if (req.query.usuario) {
      filters.push('(u.Usuario LIKE ? OR u.Email_Usuario LIKE ?)');
      params.push(`%${req.query.usuario}%`, `%${req.query.usuario}%`);
    }
    if (req.query.metodo) {
      filters.push('al.metodo_login = ?');
      params.push(req.query.metodo);
    }
    if (req.query.exitoso !== undefined && req.query.exitoso !== '') {
      filters.push('al.exitoso = ?');
      params.push(req.query.exitoso === '1' || req.query.exitoso === 'true' ? 1 : 0);
    }
    if (req.query.desde) {
      filters.push('al.fecha >= ?');
      params.push(req.query.desde);
    }
    if (req.query.hasta) {
      filters.push('al.fecha <= ?');
      params.push(req.query.hasta);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await queryCentralP(
      `SELECT COUNT(*) AS total
         FROM access_logs al
         LEFT JOIN usuarios u ON u.Id_Usuario = al.id_usuario
         ${where}`,
      params
    );
    const total = Number(countRows?.[0]?.total || 0);

    const rows = await queryCentralP(
      `SELECT al.id, al.id_usuario, al.metodo_login, al.ip, al.user_agent, 
              IFNULL(al.exitoso, 0) AS exitoso, al.fecha,
              u.Usuario, u.Email_Usuario, CONCAT(u.Nombres_Usuario, ' ', u.Apellidos_Usuario) AS nombre_completo
         FROM access_logs al
         LEFT JOIN usuarios u ON u.Id_Usuario = al.id_usuario
         ${where}
         ORDER BY al.fecha DESC
         LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ ok: true, data: rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error('❌ Error listando access logs:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener access logs' });
  }
});

router.get('/access-logs/stats', requireAdminOrSupervisor, async (req, res) => {
  try {
    const rows = await queryCentralP(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN DATE(al.fecha) = CURDATE() THEN 1 ELSE 0 END) AS hoy,
        SUM(CASE WHEN YEARWEEK(al.fecha, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END) AS esta_semana,
        SUM(CASE WHEN YEAR(al.fecha) = YEAR(CURDATE()) AND MONTH(al.fecha) = MONTH(CURDATE()) THEN 1 ELSE 0 END) AS este_mes,
        SUM(CASE WHEN al.metodo_login = 'password' THEN 1 ELSE 0 END) AS password_count,
        SUM(CASE WHEN al.metodo_login = 'facial' THEN 1 ELSE 0 END) AS facial_count,
        SUM(CASE WHEN al.metodo_login = 'qr' THEN 1 ELSE 0 END) AS qr_count
      FROM access_logs al
    `);
    const byUser = await queryCentralP(`
      SELECT u.Id_Usuario, u.Usuario, COUNT(*) AS total
      FROM access_logs al
      INNER JOIN usuarios u ON u.Id_Usuario = al.id_usuario
      GROUP BY u.Id_Usuario, u.Usuario
      ORDER BY total DESC
      LIMIT 5
    `);

    res.json({ ok: true, stats: rows?.[0] || {}, top_users: byUser });
  } catch (err) {
    console.error('❌ Error en stats access logs:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener estadisticas' });
  }
});

/**
 * Repartidores del sistema. Consultaba una tabla `conductores` que no existe en
 * ningun script de database/, asi que el endpoint respondia 500 siempre. Un
 * repartidor es un usuario con el rol Repartidor, y su actividad sale de la
 * bitacora access_logs; se conservan los nombres de campo de la respuesta.
 */
router.get('/conductores', requireAdminOrSupervisor, async (req, res) => {
  try {
    const { page, limit, offset } = buildPaging(req.query.page, req.query.limit);
    const filters = [`r.Rol = 'Repartidor'`];
    const params = [];

    if (req.query.estado === 'activo' || req.query.estado === '1') filters.push('u.Estado_Usuario = 1');
    if (req.query.estado === 'inactivo' || req.query.estado === '0') filters.push('u.Estado_Usuario = 0');
    if (req.query.buscar) {
      filters.push('(u.Usuario LIKE ? OR u.Email_Usuario LIKE ? OR CONCAT(u.Nombres_Usuario, " ", u.Apellidos_Usuario) LIKE ?)');
      params.push(`%${req.query.buscar}%`, `%${req.query.buscar}%`, `%${req.query.buscar}%`);
    }

    const where = `WHERE ${filters.join(' AND ')}`;
    const totalRows = await queryCentralP(
      `SELECT COUNT(*) AS total
         FROM usuarios u
         INNER JOIN Roles r ON r.IdRol = u.Id_Rol_Usuario
         ${where}`,
      params
    );
    const total = Number(totalRows?.[0]?.total || 0);

    const rows = await queryCentralP(
      `SELECT u.Id_Usuario AS id, u.Id_Usuario AS id_usuario,
              IF(u.Estado_Usuario = 1, 'activo', 'inactivo') AS estado,
              NULL AS ruta_asignada,
              MAX(CASE WHEN al.exitoso = 1 THEN al.fecha END) AS ultimo_acceso,
              SUM(CASE WHEN al.exitoso = 1 THEN 1 ELSE 0 END) AS total_ingresos,
              u.Usuario, u.Email_Usuario, CONCAT(u.Nombres_Usuario, ' ', u.Apellidos_Usuario) AS nombre_completo
         FROM usuarios u
         INNER JOIN Roles r ON r.IdRol = u.Id_Rol_Usuario
         LEFT JOIN access_logs al ON al.id_usuario = u.Id_Usuario
         ${where}
         GROUP BY u.Id_Usuario
         ORDER BY ultimo_acceso DESC, u.Id_Usuario ASC
         LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ ok: true, data: rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error('❌ Error listando conductores:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener conductores' });
  }
});

router.get('/conductores/:id/historial', requireAdminOrSupervisor, async (req, res) => {
  try {
    const historial = await queryCentralP(
      `SELECT al.id, al.metodo_login, al.ip, al.user_agent, al.exitoso, al.fecha
         FROM access_logs al
         WHERE al.id_usuario = ?
         ORDER BY al.fecha DESC
         LIMIT 100`,
      [req.params.id]
    );
    res.json({ ok: true, data: historial });
  } catch (err) {
    console.error('❌ Error historial conductor:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener historial' });
  }
});

// =============== FOTO DE PERFIL ===============
router.post('/perfil/foto', requireAdmin, uploadMem.single('foto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió imagen.' });
    const uid = String(req.auth?.uid || '');
    if (!uid) return res.status(403).json({ ok: false, error: 'Sin sesión.' });
    const b64 = req.file.buffer.toString('base64');
    await queryCentralP(
      `UPDATE usuarios
       SET Foto_Modificada_String64_Usuario = ?, Foto_String64_Usuario = ?
       WHERE Id_Usuario = ?`,
      [b64, b64, uid]
    );
    // Registrar en auditoría
    await queryCentralP(
      `INSERT INTO auditoria
       (id_usuario, accion, descripcion, ip_origen, fecha_evento, indice_accion)
       VALUES (?, 'ACTUALIZAR_FOTO', 'El usuario actualizó su foto de perfil', ?, NOW(), 'ADM-PERFIL')`,
      [uid, req.ip || '::1']
    );
    res.json({ ok: true, mensaje: 'Foto actualizada.' });
  } catch (err) {
    console.error('❌ Error foto perfil:', err);
    res.status(500).json({ ok: false, error: 'Error al actualizar foto.' });
  }
});

router.post('/reportes/export', requireAdminOrSupervisor, async (req, res) => {
  try {
    const tipo = String(req.body?.tipo || 'access_logs');
    const formato = String(req.body?.formato || 'xlsx').toLowerCase();
    const filters = req.body?.filtros || {};
    const isAccessLogs = tipo !== 'conductores';

    let rows = [];
    if (tipo === 'conductores') {
      rows = await queryCentralP(
        `SELECT c.*, u.Usuario, u.Email_Usuario, CONCAT(u.Nombres_Usuario, ' ', u.Apellidos_Usuario) AS nombre_completo
         FROM conductores c
         LEFT JOIN usuarios u ON u.Id_Usuario = c.id_usuario
         ORDER BY c.ultimo_acceso DESC LIMIT 500`,
      );
    } else {
      rows = await queryCentralP(
        `SELECT al.*, u.Usuario, u.Email_Usuario, CONCAT(u.Nombres_Usuario, ' ', u.Apellidos_Usuario) AS nombre_completo
         FROM access_logs al
         LEFT JOIN usuarios u ON u.Id_Usuario = al.id_usuario
         ORDER BY al.fecha DESC LIMIT 500`,
      );
    }

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const stamp = new Date().toISOString().slice(0, 10);

    const generado = formatGeneradoGt();

    // ── PDF ──────────────────────────────────────────────────────────────
    if (formato === 'pdf') {
      if (tipo === 'conductores') {
        const mapped   = rows.map(mapDriverRowForReport);
        const pdfBytes = await buildDriversPdf(mapped);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="conductores_${stamp}.pdf"`);
        return res.send(Buffer.from(pdfBytes));
      }
      // access_logs (y cualquier otro tipo)
      const mapped   = rows.map(mapAccessLogRowForReport);
      const pdfBytes = await buildAccessLogsPdf(mapped);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="logins_${stamp}.pdf"`);
      return res.send(Buffer.from(pdfBytes));
    }

    // ── XLSX ─────────────────────────────────────────────────────────────
    if (tipo === 'conductores') {
      const mapped = rows.map(mapDriverRowForReport);
      const buf    = await buildDriversXlsx(mapped, generado);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="conductores_${stamp}.xlsx"`);
      return res.send(Buffer.from(buf));
    }

    // access_logs xlsx
    const mapped = rows.map(mapAccessLogRowForReport);
    const buf    = await buildAccessLogsXlsx(mapped, generado);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="logins_${stamp}.xlsx"`);
    return res.send(Buffer.from(buf));
  } catch (err) {
    console.error('❌ Error exportando reportes:', err);
    res.status(500).json({ ok: false, error: 'Error al exportar reporte' });
  }
});


module.exports = router;
