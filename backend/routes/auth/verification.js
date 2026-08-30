const express = require('express');
const fs = require('fs');
const path = require('path');
const { centralDBp, queryCentralP } = require('../../database');
const { transporter } = require('../../config/mailer');
const { generarCredencialArtefactos } = require('../../utils/credencial');
const { signPdfBuffer } = require('../../utils/pdf_signing');
const {
  generateVerificationCode,
  sendVerificationEmail,
  sendWhatsAppVerificationCode,
  sendWhatsAppCredential,
  buildCredentialPdfUrl,
  getPublicBaseUrl,
} = require('../../utils/verification');

function isNotifEnabled(value) {
  return value === true || value === 'true' || value === 'on' || value === '1' || value === 1;
}

function isDbNotifEnabled(value) {
  return value === 1 || value?.[0] === 1;
}

const router = express.Router();

async function insertVerification(conn, idUsuario, tipo, codigo) {
  await conn.query(
    `INSERT INTO verificaciones (id_usuario, tipo, codigo, expira)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
    [idUsuario, tipo, codigo]
  );
}

router.post('/verify-registration-code', async (req, res) => {
  try {
    const codigo = String(req.body?.codigo || '').trim();
    const correo = String(req.body?.correo || '').trim();
    const telefono = String(req.body?.telefono || '').trim();

    if (!codigo || (!correo && !telefono)) {
      return res.status(400).json({ ok: false, error: 'Faltan datos de verificación' });
    }

    const conditions = [];
    const params = [codigo];
    if (correo) {
      conditions.push('u.Email_Usuario = ?');
      params.push(correo);
    }
    if (telefono) {
      conditions.push('u.Celular_Usuario = ?');
      params.push(telefono);
    }

    const rows = await queryCentralP(
      `SELECT v.*, u.Id_Usuario, u.Nombres_Usuario, u.Apellidos_Usuario, u.Usuario, u.Email_Usuario,
              u.Celular_Usuario, u.Notificaciones_Correo_Usuario, u.Notificaciones_WhatsApp_Usuario,
              u.Foto_Modificada_String64_Usuario, r.Rol
         FROM verificaciones v
         INNER JOIN usuarios u ON u.Id_Usuario = v.id_usuario
         INNER JOIN Roles r ON r.IdRol = u.Id_Rol_Usuario
        WHERE v.codigo = ?
          AND v.usado = 0
          AND v.expira > NOW()
          AND (${conditions.join(' OR ') || '1=1'})
        ORDER BY v.creado DESC
        LIMIT 1`,
      params
    );

    if (!rows?.length) {
      return res.status(400).json({ ok: false, error: 'Código inválido o expirado' });
    }

    const row = rows[0];
    let credential = null;
    let finalCredentialBuffer = null;
    let fileName = null;
    let notificationWarnings = [];

    const conn = await centralDBp.getConnection();
    try {
      await conn.beginTransaction();
      
      console.log('✅ Actualizando verificaciones...');
      await conn.query('UPDATE verificaciones SET usado = 1 WHERE id_usuario = ? AND codigo = ?', [row.Id_Usuario, codigo]);
      
      console.log('✅ Actualizando usuario...');
      await conn.query(
        `UPDATE usuarios
            SET Estado_Usuario = 1,
                Correo_Verificado_Usuario = IF(? IS NULL OR ? = '', Correo_Verificado_Usuario, b'1'),
                Telefono_Verificado_Usuario = IF(? IS NULL OR ? = '', Telefono_Verificado_Usuario, b'1')
          WHERE Id_Usuario = ?`,
        [correo, correo, telefono, telefono, row.Id_Usuario]
      );

      console.log('✅ Generando credencial para usuario:', row.Id_Usuario);
      try {
        credential = await generarCredencialArtefactos({
          idUsuario: row.Id_Usuario,
          nombre: row.Nombres_Usuario,
          apellidos: row.Apellidos_Usuario,
          usuario: row.Usuario,
          correo: row.Email_Usuario,
          telefono: row.Celular_Usuario,
          rol: row.Rol,
          fotoModificada64: row.Foto_Modificada_String64_Usuario,
          nickname: row.Usuario,
        });
        console.log('✅ Credencial generada exitosamente');
      } catch (credErr) {
        console.error('❌ Error al generar credencial:', credErr);
        throw new Error(`Error al generar credencial: ${credErr.message}`);
      }

      console.log('✅ Preparando PDF de credencial...');
      finalCredentialBuffer = credential.buffer;
      try {
        const signingResult = await signPdfBuffer(credential.buffer);
        if (signingResult?.buffer) {
          finalCredentialBuffer = signingResult.buffer;
        }
      } catch (signErr) {
        console.warn('⚠️ [registro] Firma remota omitida, se guarda credencial directa:', signErr.message);
      }

      console.log('✅ Guardando PDF de credencial...');
      fileName = `credencial_${row.Id_Usuario}_${Date.now()}.pdf`;
      const pdfDir = path.join(__dirname, '..', '..', 'uploads', 'credenciales');
      fs.mkdirSync(pdfDir, { recursive: true });
      fs.writeFileSync(path.join(pdfDir, fileName), finalCredentialBuffer);
      console.log('✅ PDF guardado:', fileName);

      console.log('✅ Insertando registro de credencial en BD...');
      await conn.query(
        `INSERT INTO credenciales (id_usuario, pdf_url, qr_data_cifrado, firma_digital, enviada_correo, enviada_whatsapp)
         VALUES (?, ?, ?, ?, b'0', b'0')`,
        [row.Id_Usuario, `/uploads/credenciales/${fileName}`, credential.encryptedToken, credential.signature]
      );

      console.log('✅ Commit de transacción...');
      await conn.commit();
      console.log('✅ Verificación completada exitosamente');
    } catch (err) {
      console.error('❌ Error en transacción de verificación:', err);
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Ahora enviar notificaciones FUERA de la transacción
    const correoEnabled = isDbNotifEnabled(row.Notificaciones_Correo_Usuario);
    const whatsappEnabled = isDbNotifEnabled(row.Notificaciones_WhatsApp_Usuario);
    let enviadaCorreo = 0;
    let enviadaWhatsapp = 0;

    // 1. Enviar credencial por correo (solo si el usuario lo eligió)
    if (correoEnabled && row.Email_Usuario) {
      try {
        const systemUrl = getPublicBaseUrl() || 'http://localhost:8081';
        await transporter.sendMail({
          from: 'Universidad Mariano Gálvez <sistemadeseguridad.credencial@gmail.com>',
          to: row.Email_Usuario,
          subject: 'Credencial Digital de Acceso — UMG Personaliza',
          html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credencial Digital UMG Personaliza</title>
</head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FDFBF7;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #E5DED4;">

          <!-- HEADER -->
          <tr>
            <td style="background:#1A1A1A;padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:28px 36px 24px 36px;border-bottom:3px solid #B85C3A;">
                    <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#B85C3A;font-weight:700;">Universidad Mariano Gálvez de Guatemala</p>
                    <h1 style="margin:8px 0 0 0;font-size:24px;font-weight:700;color:#FDFBF7;letter-spacing:0.5px;">UMG Personaliza</h1>
                    <p style="margin:6px 0 0 0;font-size:12px;color:#C4BCB1;letter-spacing:1.5px;text-transform:uppercase;">Sistema de Credenciales & Tienda Campus</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SALUDO -->
          <tr>
            <td style="padding:36px 36px 0 36px;">
              <p style="margin:0;font-size:13px;color:#7A7265;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Estimado/a</p>
              <h2 style="margin:8px 0 0 0;font-size:24px;font-weight:700;color:#1A1A1A;">${row.Nombres_Usuario} ${row.Apellidos_Usuario}</h2>
              <div style="width:48px;height:3px;background:#B85C3A;margin:16px 0 0 0;border-radius:2px;"></div>
            </td>
          </tr>

          <!-- MENSAJE -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <p style="margin:0;font-size:15px;color:#3A3630;line-height:1.8;">
                Tu cuenta ha sido <span style="color:#B85C3A;font-weight:700;">verificada y activada exitosamente</span> en UMG Personaliza. Adjunto a este mensaje encontrarás tu <strong>Credencial Digital de Acceso</strong> en formato PDF, la cual te servirá como identificación oficial y llave de acceso dentro del campus.
              </p>
            </td>
          </tr>

          <!-- CAJA CREDENCIAL -->
          <tr>
            <td style="padding:28px 36px 0 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;border:1px solid #E5DED4;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="background:#B85C3A;width:4px;padding:0;">&nbsp;</td>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7A7265;font-weight:700;">Documento adjunto</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#1A1A1A;">Credencial_${row.Nombres_Usuario}_${row.Apellidos_Usuario}.pdf</p>
                    <p style="margin:8px 0 0 0;font-size:13px;color:#6A6356;line-height:1.5;">Descarga y guarda este documento. Contiene tu código QR cifrado y código de barras para inicio de sesión y compras.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ACCESO AL SISTEMA -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;border:1px solid #E5DED4;border-radius:8px;">
                <tr>
                  <td style="background:#4A5D3A;width:4px;padding:0;">&nbsp;</td>
                  <td style="padding:18px 24px;">
                    <p style="margin:0 0 6px 0;font-size:13px;color:#3A3630;font-weight:600;">
                      Ingresa al sistema en:
                    </p>
                    <a href="${systemUrl}" style="font-size:15px;font-weight:700;color:#B85C3A;text-decoration:none;word-break:break-all;">
                      ${systemUrl}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- AVISO -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5DED4;border-radius:6px;background:#F9F6F0;">
                <tr>
                  <td style="background:#B85C3A;width:4px;padding:0;">&nbsp;</td>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:12px;color:#7A7265;line-height:1.6;">
                      <strong>Confidencialidad:</strong> Esta credencial es de uso personal e intransferible. Queda estrictamente prohibida su cesión o divulgación a terceros.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:32px 36px 0 36px;">
              <div style="height:1px;background:#E5DED4;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px 32px 36px;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#7A7265;">Este es un mensaje generado automáticamente. Por favor no responda a este correo.</p>
              <p style="margin:16px 0 0 0;font-size:12px;font-weight:700;color:#B85C3A;letter-spacing:1px;text-transform:uppercase;">UMG Personaliza &mdash; Universidad Mariano Gálvez de Guatemala</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          attachments: [
            {
              filename: `Credencial_${row.Nombres_Usuario}_${row.Apellidos_Usuario}.pdf`.replace(/\s+/g, '_'),
              content: finalCredentialBuffer,
              contentType: 'application/pdf',
            },
          ],
        });
        enviadaCorreo = 1;
        console.log('✅ Credencial enviada por correo a', row.Email_Usuario);
      } catch (notifyErr) {
        notificationWarnings.push('correo');
        console.error('❌ No se pudo enviar la credencial por correo:', notifyErr);
      }
    }

    // 2. Enviar credencial por WhatsApp (solo si el usuario lo eligió)
    if (whatsappEnabled && row.Celular_Usuario) {
      console.log('📱 Intentando enviar credencial por WhatsApp a:', row.Celular_Usuario);
      console.log('📱 PUBLIC_URL efectiva:', getPublicBaseUrl() || '(no configurada)');
      console.log('📱 URL PDF para Twilio:', buildCredentialPdfUrl(fileName) || '(no se pudo construir)');
      try {
        const result = await sendWhatsAppCredential({
          phone: row.Celular_Usuario,
          nombre: row.Nombres_Usuario,
          fileName,
          credencialEnviadaPorCorreo: enviadaCorreo === 1,
        });

        console.log('📱 Resultado WhatsApp credencial:', result);

        if (result?.ok) {
          enviadaWhatsapp = 1;
          if (!result.attached && enviadaCorreo !== 1) {
            notificationWarnings.push('whatsapp_pdf');
          }
          console.log('✅ Credencial enviada por WhatsApp a', row.Celular_Usuario);
        } else {
          notificationWarnings.push('whatsapp');
        }
      } catch (waErr) {
        notificationWarnings.push('whatsapp');
        console.error('❌ No se pudo enviar credencial por WhatsApp:', waErr.message);
      }
    } else {
      console.log('⚠️ Credencial WhatsApp NO enviada. Celular:', row.Celular_Usuario, 'notif_whatsapp:', row.Notificaciones_WhatsApp_Usuario);
    }

    try {
      await queryCentralP(
        `UPDATE credenciales SET enviada_correo = ?, enviada_whatsapp = ? WHERE id_usuario = ?`,
        [enviadaCorreo, enviadaWhatsapp, row.Id_Usuario]
      );
    } catch (updErr) {
      console.error('❌ No se pudo actualizar flags de credencial:', updErr.message);
    }

    return res.json({ ok: true, mensaje: 'Usuario verificado correctamente', notificationWarnings });
  } catch (error) {
    console.error('❌ Error en verify-registration-code:', error);
    console.error('❌ Stack:', error.stack);
    return res.status(500).json({ ok: false, error: error.message || 'Error al verificar el código' });
  }
});

router.post('/resend-verification-code', async (req, res) => {
  try {
    const correo = String(req.body?.correo || '').trim();
    const telefonoBody = String(req.body?.telefono || '').trim();
    const notifCorreo = isNotifEnabled(req.body?.notif_correo);
    const notifWhatsapp = isNotifEnabled(req.body?.notif_whatsapp);

    if (!correo) {
      return res.status(400).json({ ok: false, error: 'Debe enviar correo' });
    }

    if (!notifCorreo && !notifWhatsapp) {
      return res.status(400).json({ ok: false, error: 'Selecciona al menos un canal de notificación' });
    }

    if (notifWhatsapp && !telefonoBody) {
      return res.status(400).json({ ok: false, error: 'Debe ingresar teléfono para enviar por WhatsApp' });
    }

    const rows = await queryCentralP(
      `SELECT Id_Usuario, Nombres_Usuario, Email_Usuario, Celular_Usuario,
              Notificaciones_Correo_Usuario, Notificaciones_WhatsApp_Usuario
         FROM usuarios
        WHERE Email_Usuario = ?
        LIMIT 1`,
      [correo]
    );

    if (!rows?.length) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const phone = telefonoBody || user.Celular_Usuario;
    const code = generateVerificationCode();
    const notificationWarnings = [];

    const conn = await centralDBp.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE usuarios
            SET Notificaciones_Correo_Usuario = ?,
                Notificaciones_WhatsApp_Usuario = ?,
                Celular_Usuario = COALESCE(NULLIF(?, ''), Celular_Usuario)
          WHERE Id_Usuario = ?`,
        [notifCorreo ? 1 : 0, notifWhatsapp ? 1 : 0, telefonoBody, user.Id_Usuario]
      );
      await conn.query('UPDATE verificaciones SET usado = 1 WHERE id_usuario = ? AND usado = 0', [user.Id_Usuario]);
      if (notifCorreo) {
        await insertVerification(conn, user.Id_Usuario, 'correo', code);
      }
      if (notifWhatsapp && phone) {
        await insertVerification(conn, user.Id_Usuario, 'sms', code);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    if (notifCorreo && user.Email_Usuario) {
      try {
        await sendVerificationEmail({ to: user.Email_Usuario, nombre: user.Nombres_Usuario, codigo: code });
      } catch (mailErr) {
        notificationWarnings.push('correo');
        console.error('❌ Error reenviando código por correo:', mailErr.message);
      }
    }

    if (notifWhatsapp && phone) {
      try {
        await sendWhatsAppVerificationCode({
          phone,
          nombre: user.Nombres_Usuario,
          codigo: code,
        });
      } catch (waErr) {
        notificationWarnings.push('whatsapp');
        console.error('❌ Error reenviando código por WhatsApp:', waErr.message);
      }
    }

    if (notificationWarnings.length === 2) {
      return res.status(502).json({ ok: false, error: 'No se pudo enviar el código por ningún canal' });
    }

    return res.json({ ok: true, mensaje: 'Código reenviado', notificationWarnings });

  } catch (error) {
    console.error('Error en resend-verification-code:', error);
    return res.status(500).json({ ok: false, error: 'Error al reenviar el código' });
  }
});

module.exports = router;