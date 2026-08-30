const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const {
  buildCredentialPayload,
  encryptCredentialPayload,
  generateCode128Buffer,
  generateQrBuffer,
  signCredentialPayload,
} = require('./credential_security');

const SIGNER_NAME = 'UMG Personaliza';
const SIGN_REASON = 'Credencial oficial de acceso campus';

async function embedImageIfPossible(pdfDoc, filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const file = fs.readFileSync(filePath);
  try {
    return await pdfDoc.embedPng(file);
  } catch {
    try {
      return await pdfDoc.embedJpg(file);
    } catch {
      return null;
    }
  }
}

function getCredentialLugarUrl() {
  const custom = (process.env.PUBLIC_BASE_URL || process.env.PUBLIC_URL || process.env.CREDENTIAL_LUGAR_URL || '').trim();
  const base = custom || 'http://localhost:8081';
  return base.replace(/\/+$/, '');
}

/** Fecha/hora de emisión en zona horaria de Guatemala (UTC-6, sin DST). */
function formatCredentialIssuedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return String(iso || new Date().toISOString());
  }
  try {
    return new Intl.DateTimeFormat('es-GT', {
      timeZone: 'America/Guatemala',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleString('es-GT', {
      timeZone: 'America/Guatemala',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}

function wrapTextLines(text, maxChars) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawSignatureField(page, x, y, label, value, font, fontBold, medGray, dark, size) {
  const labelText = `${label}: `;
  const labelW = font.widthOfTextAtSize(labelText, size);
  page.drawText(labelText, { x, y, size, font, color: medGray });
  page.drawText(String(value), { x: x + labelW, y, size, font: fontBold, color: dark });
}

function drawElectronicSignatureBlock(page, { font, fontBold, logo, payload, medGray, dark }) {
  const pad = 14;
  const blockX = pad;
  const textX = logo ? 54 : blockX;
  const size = 6.5;
  const lineH = 10;
  const lineCount = 4;
  let y = pad + lineH * (lineCount - 1);

  if (logo) {
    const logoBox = 36;
    const logoScale = Math.min(logoBox / logo.width, logoBox / logo.height);
    const logoW = logo.width * logoScale;
    const logoH = logo.height * logoScale;
    const blockH = lineH * (lineCount - 1) + size;
    const logoY = pad + Math.max(0, (blockH - logoH) / 2);
    page.drawImage(logo, { x: blockX, y: logoY, width: logoW, height: logoH });
  }

  const fecha = formatCredentialIssuedAt(payload.issuedAt);
  const lugar = getCredentialLugarUrl();

  drawSignatureField(page, textX, y, 'Firmado electrónicamente por', SIGNER_NAME, font, fontBold, medGray, dark, size);
  y -= lineH;
  drawSignatureField(page, textX, y, 'Motivo', SIGN_REASON, font, fontBold, medGray, dark, size);
  y -= lineH;
  drawSignatureField(page, textX, y, 'Fecha', fecha, font, fontBold, medGray, dark, size);
  y -= lineH;

  const lugarLines = wrapTextLines(lugar, 52);
  const lugarLabel = 'Lugar: ';
  const lugarLabelW = font.widthOfTextAtSize(lugarLabel, size);
  page.drawText(lugarLabel, { x: textX, y, size, font, color: medGray });
  page.drawText(lugarLines[0], {
    x: textX + lugarLabelW,
    y,
    size,
    font: fontBold,
    color: dark,
  });
  if (lugarLines.length > 1) {
    y -= lineH;
    page.drawText(lugarLines[1], { x: textX + lugarLabelW, y, size, font: fontBold, color: dark });
  }
}

async function generarCredencialArtefactos({ idUsuario, nombre, apellidos, usuario, correo, telefono, rol, fotoModificada64, nickname }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([620, 360]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const white = rgb(1, 1, 1);
  const dark = rgb(0.10, 0.10, 0.10);
  const accent = rgb(0.72, 0.36, 0.23); // Terracota #B85C3A
  const accent2 = rgb(0.29, 0.36, 0.23); // Oliva #4A5D3A
  const creamBg = rgb(0.99, 0.98, 0.97); // Arena/Crema #FDFBF7
  const lightGray = rgb(0.96, 0.94, 0.90); // Sand card #F4EFE6
  const lineColor = rgb(0.90, 0.87, 0.83); // Border line #E5DED4
  const medGray = rgb(0.48, 0.45, 0.40); // Muted ink #7A7265

  const resolvedNickname = nickname || usuario;
  const payload = buildCredentialPayload({
    idUsuario: idUsuario || 0,
    usuario,
    correo,
    nickname: resolvedNickname,
    rol,
    telefono,
  });
  const encrypted = encryptCredentialPayload(payload);
  const signed = signCredentialPayload(payload);

  page.drawRectangle({ x: 0, y: 0, width: 620, height: 360, color: creamBg });
  page.drawRectangle({ x: 0, y: 0, width: 12, height: 360, color: accent });
  page.drawRectangle({ x: 12, y: 295, width: 608, height: 65, color: dark });
  page.drawRectangle({ x: 12, y: 292, width: 608, height: 3, color: accent });

  const logoCandidates = [
    path.join(__dirname, '..', 'assets', 'umg.jpg'),
    path.join(__dirname, '..', 'assets', 'umg.png'),
    path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'Logo UMG.png'),
  ];
  let logo = null;
  for (const candidate of logoCandidates) {
    logo = await embedImageIfPossible(pdfDoc, candidate);
    if (logo) break;
  }

  page.drawText('UMG PERSONALIZA', {
    x: 28,
    y: 332,
    size: 18,
    font: fontBold,
    color: accent,
  });
  page.drawText('CREDENCIAL DIGITAL & COMPRADOR CAMPUS', {
    x: 28,
    y: 314,
    size: 9,
    font,
    color: medGray,
  });

  const rolText = String(rol || 'Usuario').toUpperCase();
  const rolWidth = fontBold.widthOfTextAtSize(rolText, 8);
  const badgeX = 610 - rolWidth - 18;
  page.drawRectangle({ x: badgeX, y: 312, width: rolWidth + 18, height: 18, color: accent2 });
  page.drawText(rolText, {
    x: badgeX + 9,
    y: 317,
    size: 8,
    font: fontBold,
    color: white,
  });

  const fullName = `${nombre || ''} ${apellidos || ''}`.trim();
  const leftX = 28;
  const values = [
    ['NOMBRE COMPLETO', fullName || 'N/D'],
    ['USUARIO', usuario || 'N/D'],
    ['NICKNAME', resolvedNickname || 'N/D'],
    ['CORREO', correo || 'N/D'],
    ['TELEFONO', telefono || 'N/D'],
  ];

  let y = 255;
  for (const [label, value] of values) {
    page.drawText(label, { x: leftX, y, size: 8, font: fontBold, color: medGray });
    page.drawText(String(value), { x: leftX, y: y - 12, size: 11, font: fontBold, color: dark });
    y -= 38;
  }

  page.drawRectangle({ x: 350, y: 22, width: 1, height: 255, color: lightGray });

  // Layout base de la zona derecha: QR y código de barras
  const qrSize = 84;
  const qrX = 388;
  const codeCardX = 476;
  const codeCardWidth = 118;
  const qrCardStartX = qrX - 4;
  const codesAreaEndX = codeCardX + codeCardWidth;
  const imagesBottom = 44;
  const qrY = imagesBottom;
  const codeCardY = qrY - 4;
  const codeCardHeight = qrSize + 8;
  const codesTopY = codeCardY + codeCardHeight;
  const headerBodySeparatorY = 292;

  if (fotoModificada64) {
    try {
      const imageBytes = Buffer.from(fotoModificada64, 'base64');
      let image;
      try {
        image = await pdfDoc.embedJpg(imageBytes);
      } catch {
        image = await pdfDoc.embedPng(imageBytes);
      }
      const { width, height } = image.scale(1);
      const scale = Math.min(164 / width, 112 / height);
      const fw = width * scale;
      const fh = height * scale;
      // Centrar horizontalmente la foto en función del inicio de las cajitas QR y código
      const photoCardX = qrCardStartX;
      const photoCardWidth = codesAreaEndX - qrCardStartX;
      const photoCardHeight = 120;
      // Centrado vertical de la foto entre el encabezado y las cajitas QR/código
      const photoCardY = Math.round(codesTopY + (headerBodySeparatorY - codesTopY - photoCardHeight) / 2);
      const fx = photoCardX + (photoCardWidth - fw) / 2;
      const fy = Math.round(photoCardY + (photoCardHeight - fh) / 2);
      page.drawRectangle({ x: photoCardX - 4, y: photoCardY - 4, width: photoCardWidth + 8, height: photoCardHeight + 8, color: lightGray });
      page.drawImage(image, { x: fx, y: fy, width: fw, height: fh });
    } catch (err) {
      console.error('No se pudo embebir la foto de la credencial:', err.message);
    }
  }

  const qrImage = await pdfDoc.embedPng(await generateQrBuffer(encrypted.token));
  const barcodeToken = encrypted.token.slice(0, 16).toUpperCase();
  const codeImage = await pdfDoc.embedPng(await generateCode128Buffer(barcodeToken));

  // Alinear la base del QR y del código de barras para que queden emparejados visualmente
  // Dibujar tarjeta y QR
  page.drawRectangle({ x: qrX - 4, y: qrY - 4, width: qrSize + 8, height: qrSize + 8, color: lightGray });
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  // Centrar la etiqueta "QR" bajo el QR proporcional al tamaño del QR
  // y mantener la misma línea de título para ambos (qr y código)
  const labelsY = imagesBottom - 11;
  try {
    const qrLabel = 'QR';
    const qrLabelSize = 7;
    const qrLabelWidth = font.widthOfTextAtSize(qrLabel, qrLabelSize);
    const qrLabelX = qrX + (qrSize - qrLabelWidth) / 2;
    page.drawText(qrLabel, { x: qrLabelX, y: labelsY, size: qrLabelSize, font, color: medGray });
  } catch (e) {
    page.drawText('QR', { x: qrX + 35, y: labelsY, size: 7, font, color: medGray });
  }

  // Hacer que la tarjeta del código tenga la misma Y que la tarjeta del QR (misma caja)
  // usar la misma altura visual que la tarjeta QR
  page.drawRectangle({ x: codeCardX, y: codeCardY, width: codeCardWidth, height: codeCardHeight, color: lightGray });
  // Centrar verticalmente la imagen del código dentro de la tarjeta (alinear centros con el QR)
  const codeImageHeight = 56;
  const codeImageY = qrY + Math.round((qrSize - codeImageHeight) / 2);
  page.drawImage(codeImage, { x: codeCardX + 6, y: codeImageY, width: 106, height: codeImageHeight });
  // Centrar la etiqueta "Código de Barras" proporcionalmente debajo del código
  try {
    const codeLabel = 'Código de Barras';
    const codeLabelSize = 6.5;
    const codeAreaWidth = 106; // ancho del barcode embebido
    const codeLabelWidth = font.widthOfTextAtSize(codeLabel, codeLabelSize);
    const codeLabelX = codeCardX + 6 + Math.max(0, (codeAreaWidth - codeLabelWidth) / 2);
    page.drawText(codeLabel, { x: codeLabelX, y: labelsY, size: codeLabelSize, font, color: medGray });
  } catch (e) {
    page.drawText('Código de Barras', { x: codeCardX + 13, y: labelsY, size: 6.5, font, color: medGray });
  }

  drawElectronicSignatureBlock(page, { font, fontBold, logo, payload, medGray, dark });

  const pdfBytes = await pdfDoc.save();
  return {
    buffer: Buffer.from(pdfBytes),
    payload,
    encryptedToken: encrypted.token,
    signature: signed.signature,
    checksum: encrypted.checksum,
  };
}

async function generarCredencialBuffer(options) {
  const result = await generarCredencialArtefactos(options);
  return result.buffer;
}

module.exports = { generarCredencialArtefactos, generarCredencialBuffer };
