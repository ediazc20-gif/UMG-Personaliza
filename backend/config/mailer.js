require('./load-env');
const nodemailer = require('nodemailer');

const gmailUser = (process.env.GMAIL_USER || '').trim();
const gmailPass = (process.env.GMAIL_PASS || '').trim();

let transporter = null;

function getTransporter() {
  if (!gmailUser || !gmailPass) {
    throw new Error('GMAIL_USER y GMAIL_PASS deben estar definidos en .env (sin fallbacks).');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
  }
  return transporter;
}

function isMailConfigured() {
  return Boolean(gmailUser && gmailPass);
}

async function sendSecurityAlert(subject, message, base64Image) {
  try {
    if (!isMailConfigured()) {
      console.warn('[mailer] Alerta omitida: GMAIL_USER/GMAIL_PASS no configurados.');
      return;
    }
    const htmlContent = `
      <b>${String(message || '').replace(/\n/g, '<br>')}</b><br><br>
      ${base64Image ? `<img src="cid:fotoPersona" style="max-width:400px; border:1px solid #ccc;">` : ''}
    `;

    await getTransporter().sendMail({
      from: `Sistema de Seguridad <${gmailUser}>`,
      to: gmailUser,
      subject,
      text: message,
      html: htmlContent,
      attachments: base64Image ? [{
        filename: 'foto.jpg',
        content: Buffer.from(base64Image, 'base64'),
        cid: 'fotoPersona',
      }] : [],
    });
    console.log('Correo de alerta enviado con imagen');
  } catch (error) {
    console.error('Error enviando correo de alerta:', error);
  }
}

async function sendOrderEmail({ to, nombre, codigo, estado, total, items = [], nota = '' }) {
  try {
    if (!isMailConfigured()) {
      console.log('[mailer] Notificación de orden omitida: mailer no configurado.');
      return;
    }
    if (!to) return;

    const estadosTexto = {
      recibida: 'Tu orden ha sido recibida y confirmada',
      en_elaboracion: 'Tu pedido está en proceso de personalización/elaboración',
      en_ruta: 'Tu pedido va en camino con el repartidor',
      lista_entrega: 'Tu pedido está listo en el punto de entrega',
      entregada: 'Tu pedido ha sido entregado exitosamente',
      cancelada: 'Tu orden ha sido cancelada',
      no_encontrado: 'No pudimos localizarte para la entrega',
    };

    const estadoHuman = estadosTexto[estado] || `Estado actualizado: ${estado}`;

    const itemsHtml = items.map(i => `
      <li style="margin-bottom: 6px;">
        <strong>${i.cantidad || 1}x</strong> ${i.nombre_producto || 'Producto'} - Q${(Number(i.precio_unitario || 0) * Number(i.cantidad || 1)).toFixed(2)}
      </li>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f111a; color: #f0edff; padding: 24px; border-radius: 12px; border: 1px solid #2e354f;">
        <h2 style="color: #a78bfa; margin-top: 0; font-size: 22px;">UMG Personaliza</h2>
        <p style="font-size: 15px;">Hola <strong>${nombre || 'Estimado(a) Estudiante'}</strong>,</p>
        <p style="font-size: 15px; color: #d1d5db;">${estadoHuman}.</p>
        
        <div style="background: #171926; border: 1px solid #2e354f; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #9ca3af;">Código de Orden:</p>
          <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: bold; color: #f0a35e; letter-spacing: 1px;">${codigo}</p>
          
          ${items.length > 0 ? `
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">Detalle de Productos:</p>
            <ul style="padding-left: 20px; margin: 0 0 16px 0; color: #e5e7eb;">
              ${itemsHtml}
            </ul>
          ` : ''}
          
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #f0edff;">Total: Q${Number(total || 0).toFixed(2)}</p>
          ${nota ? `<p style="margin: 12px 0 0 0; font-size: 13px; color: #9ca3af; font-style: italic;">Nota: ${nota}</p>` : ''}
        </div>

        <p style="font-size: 13px; color: #9ca3af; margin-top: 24px; line-height: 1.5;">
          Puedes consultar el tracking en tiempo real desde tu cuenta en <strong>UMG Personaliza</strong>.
        </p>
      </div>
    `;

    await getTransporter().sendMail({
      from: `UMG Personaliza <${gmailUser}>`,
      to,
      subject: `[${codigo}] ${estadoHuman} — UMG Personaliza`,
      html,
    });
    console.log(`[mailer] Notificación enviada a ${to} para orden ${codigo} (${estado})`);
  } catch (err) {
    console.warn('[mailer] Error enviando notificación de orden:', err.message);
  }
}

// Compat: código legado usa `transporter.sendMail` directamente
const transporterProxy = {
  sendMail: async (...args) => getTransporter().sendMail(...args),
};

module.exports = { transporter: transporterProxy, sendSecurityAlert, sendOrderEmail, isMailConfigured, getTransporter };
