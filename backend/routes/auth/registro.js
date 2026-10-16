const express = require('express');
const multer  = require('multer');
const bcrypt  = require('bcrypt');
const { centralDBp } = require('../../database');
const { transporter } = require('../../config/mailer');
const { generateVerificationCode, sendVerificationEmail, sendWhatsAppVerificationCode } = require('../../utils/verification');
const {
  findUserByEmail,
  isPendingRegistration,
  softenUniqueValidation,
} = require('../../utils/pendingRegistration');

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
      console.log('📥 Datos recibidos en /registro:', req.body);

      const {
        nombres, apellidos, contrasena, fecha_nacimiento,
        nombre_usuario, correo, telefono, nickname, notif_correo, notif_whatsapp,
      } = req.body;

      const rol = 6; // rol por defecto

      if (!nombres || !apellidos || !contrasena || !fecha_nacimiento || !nombre_usuario || !correo) {
        return res.status(400).send('⚠️ Faltan campos obligatorios');
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
          let respuesta = respRows?.[0]?.respuesta;
          respuesta = await softenUniqueValidation(conn, respuesta, {
            correo,
            telefono: telefono || null,
            usuario: nombre_usuario,
          });
          console.log('🧩 Resultado de validación:', respuesta);

          if (respuesta !== '1') {
            const validationError = new Error(respuesta || 'Validación inválida');
            validationError.status = 400;
            throw validationError;
          }

          const pendingExisting = await findUserByEmail(conn, correo);
          const reusePending = pendingExisting && isPendingRegistration(pendingExisting);

          const notifCorreoBit = notif_correo === 'on' || notif_correo === true || notif_correo === 1 ? 1 : 0;
          const notifWhatsappBit = notif_whatsapp === 'on' || notif_whatsapp === true || notif_whatsapp === 1 ? 1 : 0;

          if (reusePending) {
            userId = pendingExisting.Id_Usuario;
            await conn.query(
              `UPDATE usuarios SET
                 Nombres_Usuario = ?,
                 Apellidos_Usuario = ?,
                 Password_Usuario = ?,
                 Estado_Usuario = b'0',
                 Fecha_Nacimiento_Usuario = ?,
                 Usuario = ?,
                 Email_Usuario = ?,
                 Celular_Usuario = ?,
                 Notificaciones_Correo_Usuario = ?,
                 Notificaciones_WhatsApp_Usuario = ?,
                 Foto_BLOB_Usuario = ?,
                 Foto_String64_Usuario = ?,
                 Foto_Modificada_BLOB_Usuario = ?,
                 Foto_Modificada_String64_Usuario = ?,
                 Fecha_Ultima_Modificacion = CURRENT_DATE()
               WHERE Id_Usuario = ?`,
              [
                nombres,
                apellidos,
                hash,
                fecha_nacimiento,
                nombre_usuario,
                correo,
                telefono || null,
                notifCorreoBit,
                notifWhatsappBit,
                fotoOriginalBuffer,
                fotoOriginal64,
                fotoModificadaBuffer,
                fotoModificada64,
                userId,
              ]
            );
            await conn.query(
              `UPDATE verificaciones SET usado = 1 WHERE id_usuario = ? AND usado = 0`,
              [userId]
            );
            console.log('♻️ Registro pendiente actualizado (reintento OTP):', userId);
          } else {
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
              notifCorreoBit,
              notifWhatsappBit,
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
          }

          if (nickname && String(nickname).trim()) {
            await conn.query(
              `UPDATE usuarios SET Nickname_Usuario = ? WHERE Id_Usuario = ?`,
              [String(nickname).trim(), userId]
            );
          }

          if (notif_correo) {
            await conn.query(
              `INSERT INTO verificaciones (id_usuario, tipo, codigo, expira)
               VALUES (?, 'correo', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
              [userId, codigo]
            );
          }
          if (telefono && notif_whatsapp) {
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
        if (notif_correo === 'on') {
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
        if (telefono && notif_whatsapp === 'on') {
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
        console.error('❌ Error generando o enviando la verificación:', mailErr);
        const msg = mailErr?.message || 'Error al generar o enviar el código de verificación';
        return res.status(mailErr.status || 500).send(msg);
      }
    } catch (error) {
      console.error('❌ Error en /registro:', error);
      return res.status(error.status || 500).send(error.message || 'Error interno del servidor');
    }
  }
);

module.exports = router;
