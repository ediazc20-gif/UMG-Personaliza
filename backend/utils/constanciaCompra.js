const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');

async function buildConstanciaCompra({ orden, items, comprador, areaNombre }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const brand = rgb(0.31, 0.27, 0.9);
  const muted = rgb(0.45, 0.45, 0.5);
  let y = height - 48;

  page.drawText('UMG Personaliza', { x: 48, y, size: 11, font: bold, color: brand });
  y -= 28;
  page.drawText('Constancia de compra', { x: 48, y, size: 20, font: bold, color: rgb(0.12, 0.16, 0.22) });
  y -= 22;
  page.drawText(`Orden: ${orden.codigo}`, { x: 48, y, size: 12, font: bold });
  y -= 16;
  page.drawText(`Fecha: ${new Date(orden.creado || Date.now()).toLocaleString('es-GT')}`, { x: 48, y, size: 10, font, color: muted });
  y -= 14;
  page.drawText(`Comprador: ${comprador || 'Cliente UMG'}`, { x: 48, y, size: 10, font });
  y -= 14;
  page.drawText(`Entrega: ${areaNombre || 'Campus UMG'}`, { x: 48, y, size: 10, font });
  y -= 14;
  page.drawText(`Pago: ${orden.metodo_pago === 'tarjeta' ? 'Tarjeta' : 'Efectivo al recibir'}`, { x: 48, y, size: 10, font });
  y -= 28;

  page.drawText('Productos', { x: 48, y, size: 12, font: bold, color: brand });
  y -= 18;

  for (const item of items) {
    if (y < 120) break;
    const line = `${item.nombre_producto}  x${item.cantidad}  —  Q${Number(item.precio_unitario * item.cantidad).toFixed(2)}`;
    page.drawText(line.substring(0, 72), { x: 48, y, size: 10, font });
    y -= 14;
    if (item.personalizacion_json) {
      let p = item.personalizacion_json;
      if (typeof p === 'string') {
        try { p = JSON.parse(p); } catch { p = null; }
      }
      if (p?.lado_a?.texto) {
        page.drawText(`  Lado A: "${String(p.lado_a.texto).substring(0, 40)}"`, { x: 48, y, size: 9, font, color: muted });
        y -= 12;
      }
      if (p?.lado_b?.texto) {
        page.drawText(`  Lado B: "${String(p.lado_b.texto).substring(0, 40)}"`, { x: 48, y, size: 9, font, color: muted });
        y -= 12;
      }
    }
  }

  y -= 8;
  page.drawText(`Total: Q${Number(orden.total).toFixed(2)}`, { x: 48, y, size: 14, font: bold });

  const qrPng = await QRCode.toBuffer(orden.codigo, { width: 120, margin: 1 });
  const qrImg = await pdfDoc.embedPng(qrPng);
  page.drawImage(qrImg, { x: width - 168, y: 48, width: 96, height: 96 });
  page.drawText('Tracking', { x: width - 156, y: 36, size: 8, font, color: muted });

  page.drawText('Universidad Mariano Galvez — Desarrollo Web 2027', {
    x: 48,
    y: 32,
    size: 8,
    font,
    color: muted,
  });

  return pdfDoc.save();
}

async function saveConstanciaPdf(ordenCodigo, pdfBytes) {
  const dir = path.join(__dirname, '..', 'uploads', 'constancias');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `constancia_${ordenCodigo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const fullPath = path.join(dir, fileName);
  fs.writeFileSync(fullPath, pdfBytes);
  return `/uploads/constancias/${fileName}`;
}

module.exports = { buildConstanciaCompra, saveConstanciaPdf };
