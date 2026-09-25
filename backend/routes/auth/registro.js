const express = require('express');
const multer  = require('multer');
const bcrypt  = require('bcrypt');
const { centralDBp } = require('../../database');
const { transporter } = require('../../config/mailer');
const { generateVerificationCode, sendVerificationEmail, sendWhatsAppVerificationCode } = require('../../utils/verification');
const { notificacionActiva } = require('../../utils/notificaciones');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/registro',
  upload.fields([
    { name: 'foto_original',   maxCount: 1 },
    { name: 'foto_modificada', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Nunca se registra el cuerpo completo: trae la contrasena en texto plano
      // y acabaria guardada en los logs del contenedor.
      console.log('📥 Registro recibido para el usuario:', req.body?.nombre_usuario);

      const {
        nombres, apellidos, contrasena, fecha_nacimiento,
        nombre_usuario, correo, telefono, nickname, notif_correo, notif_whatsapp,
      } = req.body;

      const rol = 6; // rol por defecto

      // Los checkbox llegan como 'on' desde el formulario y como '0'/'1' desde la
      // API. Con un simple `notif_whatsapp ? 1 : 0` la cadena '0' era verdadera y
      // el canal quedaba activado aunque el comprador no lo hubiera elegido.
      const quiereCorreo = notificacionActiva(notif_correo);
      const quiereWhatsapp = notificacionActiva(notif_whatsapp);

      if (!nombres || !apellidos || !contrasena || !fecha_nacimiento || !nombre_usuario || !correo) {
        return res.status(400).send('⚠️ Faltan campos obligatorios');
      }
      if (!quiereCorreo && !quiereWhatsapp) {
        return res.status(400).send('⚠️ Selecciona al menos un canal de notificación');
      }
      if (quiereWhatsapp && !telefono) {
        return res.status(400).send('⚠️ Ingresa un teléfono para recibir notificaciones por WhatsApp');
      }

      const hash = await bcrypt.hash(contrasena, 10);

      const fotoOriginalFile   = req.files?.['foto_original']?.[0]   || null;
      const fotoModificadaFile = req.files?.['foto_modificada']?.[0] || null;

      const fotoOriginalBuffer   = fotoOriginalFile   ? fotoOriginalFile.buffer   : null;
      const fotoModificadaBuffer = fotoModificadaFile ? fotoModificadaFile.buffer : null;

      const fotoOriginal64   = fotoOriginalBuffer   ? fotoOriginalBuffer.toString('base64')   : null;
      const fotoModificada64 = fotoModificadaBuffer ? fotoModificadaBuffer.toString('base64') : null;

      // === 1) Validar duplicados y crear verificación pendiente ===
      try {
        const codigo = generateVerificationCode();
        const conn = await centralDBp.getConnection();
        let userId = null;

        try {
          await conn.beginTransaction();

          const validarSql = `CALL Validacion_Unico(?, ?, ?, @respuesta)`;
          await conn.query(validarSql, [correo, telefono || null, nombre_usuario]);
          const [respRows] = await conn.query(`SELECT @respuesta AS respuesta`);
          const respuesta = respRows?.[0]?.respuesta;
          console.log('🧩 Resultado de validación:', respuesta);

          if (respuesta !== '1') {
            const validationError = new Error(respuesta || 'Validación inválida');
            validationError.status = 400;
            throw validationError;
          }

          const insertSql = `CALL AgregarUsuario(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          const paramsInsert = [
            nombres,
            apellidos,
            hash,
            0,
            fecha_nacimiento,
            nombre_usuario,
            correo,
            telefono || null,
            quiereCorreo ? 1 : 0,
            quiereWhatsapp ? 1 : 0,
            fotoOriginalBuffer,
            fotoOriginal64,
            fotoModificadaBuffer,
            fotoModificada64,
          ];

          const [resultSets] = await conn.query(insertSql, paramsInsert);
          const inserted = Array.isArray(resultSets) && Array.isArray(resultSets[0]) ? resultSets[0] : resultSets;
          userId = inserted?.[0]?.Id_Usuario || inserted?.insertId || null;

          if (!userId) {
            const fallback = await conn.query('SELECT LAST_INSERT_ID() AS Id_Usuario');
            userId = fallback?.[0]?.[0]?.Id_Usuario || fallback?.[0]?.Id_Usuario || null;
          }

          if (!userId) {
            throw new Error('No se pudo obtener el ID del usuario');
          }

          if (nickname && String(nickname).trim()) {
            await conn.query(
              `UPDATE usuarios SET Nickname_Usuario = ? WHERE Id_Usuario = ?`,
              [String(nickname).trim(), userId]
            );
          }

          if (quiereCorreo) {
            await conn.query(
              `INSERT INTO verificaciones (id_usuario, tipo, codigo, expira)
               VALUES (?, 'correo', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
              [userId, codigo]
            );
          }
          if (telefono && quiereWhatsapp) {
            await conn.query(
              `INSERT INTO verificaciones (id_usuario, tipo, codigo, expira)
               VALUES (?, 'sms', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
              [userId, codigo]
            );
          }

          await conn.commit();
        } catch (dbErr) {
          await conn.rollback();
          throw dbErr;
        } finally {
          conn.release();
        }

        let notificationWarnings = [];
        
        // Enviar código por correo
        if (quiereCorreo) {
          try {
            await sendVerificationEmail({ to: correo, nombre: nombres, codigo });
            console.log('✅ Código enviado por correo a:', correo);
          } catch (notifyErr) {
            notificationWarnings.push('correo');
            console.error('❌ No se pudo enviar el correo de verificación:', notifyErr);
          }
        } else {
          console.log('📧 Correo NO seleccionado por el usuario, no se envía código por email');
        }
        
        // Enviar código por WhatsApp si el usuario lo seleccionó
        if (telefono && quiereWhatsapp) {
          console.log('📱 Intentando enviar código por WhatsApp a:', telefono);
          try {
            const result = await sendWhatsAppVerificationCode({ 
              phone: telefono, 
              nombre: nombres,
              codigo 
            });
            console.log('📱 Resultado WhatsApp código:', result);
          } catch (waErr) {
            notificationWarnings.push('whatsapp');
            console.error('❌ No se pudo enviar código por WhatsApp:', waErr);
          }
        } else {
          console.log('⚠️ WhatsApp NO enviado. telefono:', telefono, 'notif_whatsapp:', notif_whatsapp);
        }
        
        return res.status(201).json({
          ok: true,
          mensaje: 'Usuario registrado. Debe verificar el código enviado.',
          pendiente_verificacion: true,
          userId,
          notificationWarnings,
        });
      } catch (mailErr) {
        // El rechazo de Validacion_Unico (usuario, correo o telefono repetidos)
        // se lanza dentro de este bloque con status 400. Antes acababa aqui
        // convertido en un 500 que culpaba al envio del codigo.
        if (mailErr.status === 400) {
          return res.status(400).send(mailErr.message);
        }
        console.error('❌ Error generando o enviando la verificación:', mailErr);
        return res.status(500).send('Error al generar o enviar el código de verificación');
      }
    } catch (error) {
      console.error('❌ Error en /registro:', error);
      // Solo se devuelve el mensaje de los errores de validacion (4xx); el de un
      // 500 puede traer detalles internos de la base.
      const status = error.status || 500;
      return res.status(status).send(status < 500 ? error.message : 'Error interno del servidor');
    }
  }
);

module.exports = router;
