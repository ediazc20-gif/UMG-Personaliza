require("./config/load-env");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const http = require("http");

const { initAll, queryCentralP } = require("./database");
const { init: initFaceModels } = require("./routes/face/face_node");
const { attachTiendaWs } = require("./utils/tiendaWs");

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// ======================== WEBSOCKET TRACKING TIENDA ========================
const WebSocket = require("ws");
const tiendaWss = new WebSocket.Server({ server, path: "/ws/tienda" });
attachTiendaWs(tiendaWss);

// ======================== Middlewares base ========================
// Nginx es el unico salto delante de Express y reescribe X-Forwarded-For con
// `$proxy_add_x_forwarded_for`, asi que la ultima entrada de esa cabecera es la
// IP real del cliente. Sin este `trust proxy` habia dos problemas: req.ip valia
// siempre la IP interna del contenedor de Nginx (auditoria inutil) y el codigo
// que leia la cabecera a mano se quedaba con el primer valor, que lo pone el
// cliente y por tanto se puede falsificar para saltarse el rate limit.
app.set("trust proxy", 1);

app.use(cookieParser());
// Se guarda el cuerpo sin parsear porque la verificacion de firma de un webhook
// se calcula sobre los bytes que llegaron: si se parsea el JSON y se vuelve a
// serializar, cambian los bytes y la firma deja de cuadrar.
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ======================== Archivos estáticos ========================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Dev fallback — en producción Nginx sirve el frontend estático
if (process.env.NODE_ENV !== "production") {
  const frontendPath = path.join(__dirname, "..", "frontend", "src");

  app.use("/comprador", express.static(path.join(frontendPath, "comprador")));
  app.use("/repartidor", express.static(path.join(frontendPath, "repartidor")));
  app.use("/supervisor", express.static(path.join(frontendPath, "supervisor")));
  app.use("/admin", express.static(path.join(frontendPath, "admin")));
  app.use("/lib", express.static(path.join(frontendPath, "lib")));
  app.use("/css", express.static(path.join(frontendPath, "css")));
  app.use("/assets", express.static(path.join(frontendPath, "assets")));
  app.use("/js", express.static(path.join(frontendPath, "js")));
  app.use("/models", express.static(path.join(frontendPath, "models")));
  app.use("/fonts", express.static(path.join(frontendPath, "fonts")));

  app.use(express.static(frontendPath));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// ======================== API PÚBLICA DE CONFIGURACIÓN & ROLES ========================
app.get("/api/config/public", (_req, res) => {
  res.json({
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || "",
    recaptchaEnabled: Boolean(process.env.RECAPTCHA_SECRET_KEY),
    recaptchaSkip:
      process.env.RECAPTCHA_SKIP === "true" ||
      (process.env.NODE_ENV !== "production" && !process.env.RECAPTCHA_SECRET_KEY),
    appName: "UMG Personaliza",
  });
});

app.get("/api/roles", async (_req, res) => {
  try {
    const rows = await queryCentralP(
      `SELECT IdRol AS id, Rol AS nombre 
       FROM Roles 
       ORDER BY IdRol`
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error roles público:", err);
    res.status(500).json({ error: "Error al obtener roles." });
  }
});

// ======================== RUTAS DE AUTENTICACIÓN ========================
app.use("/", require("./routes/auth/login"));
app.use("/", require("./routes/auth/logout"));
app.use("/", require("./routes/auth/registro"));
app.use("/", require("./routes/auth/verification"));
app.use("/", require("./routes/auth/reset-password"));

// ======================== USUARIOS & ADMINISTRACIÓN ========================
app.use("/", require("./routes/usuarios/validar"));
app.use("/admin", require("./routes/usuarios/admin"));

// ======================== RECONOCIMIENTO FACIAL ========================
app.use("/", require("./routes/face/facer"));

// ======================== MENSAJERÍA WHATSAPP ========================
app.use("/", require("./routes/messaging/whatsapp"));
app.use("/api/whatsapp", require("./routes/messaging/whatsapp"));

// ======================== E-COMMERCE UMG PERSONALIZA ========================
app.use("/api/tienda", require("./routes/tienda/personalizacion"));
app.use("/api/tienda", require("./routes/tienda/productos"));
app.use("/api/tienda", require("./routes/tienda/carrito"));
app.use("/api/tienda", require("./routes/tienda/ordenes"));
app.use("/api/tienda", require("./routes/tienda/perfil"));

// ======================== Error handler global ========================
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // El detalle completo se queda en el log del servidor, que es donde sirve.
  console.error("[ERROR]", req.method, req.originalUrl, err);

  if (res.headersSent) return next(err);

  // Los 4xx los lanza nuestro propio codigo con un mensaje escrito para que lo
  // lea el usuario. Los 5xx no: ahi err.message puede venir de MySQL y traer
  // nombres de tabla y de columna, o rutas del servidor. Eso no sale de aqui.
  const mensaje = status < 500
    ? (err.message || "Solicitud invalida.")
    : "Error interno del servidor.";

  res.status(status).json({ error: mensaje });
});

// ======================== Inicio del Servidor ========================
(async () => {
  try {
    await initAll();

    console.log("Cargando modelos de reconocimiento facial...");
    await initFaceModels();
    console.log("Modelos faciales cargados correctamente.");

    server.listen(port, () => {
      console.log(`🚀 Servidor UMG Personaliza en puerto ${port}`);
      console.log(`🔌 WebSocket de tracking en /ws/tienda`);
    });
  } catch (e) {
    console.error("Error al iniciar:", e);
    process.exit(1);
  }
})();
