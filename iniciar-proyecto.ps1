# ==============================================================================
# Script de Inicio Rápido - UMG Personaliza (Desarrollo Web 2027)
# ==============================================================================

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   🚀 INICIANDO ENTORNO UMG PERSONALIZA   " -ForegroundColor Yellow
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Verificar si Docker está corriendo
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Docker Desktop no está iniciado. Por favor abre Docker y vuelve a ejecutar este script." -ForegroundColor Red
        Exit 1
    }
} catch {
    Write-Host "❌ Error: Docker no está instalado o no se encuentra en el PATH." -ForegroundColor Red
    Exit 1
}

# 2. Verificar archivo .env
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "ℹ️ Creando archivo .env desde .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
    } else {
        Write-Host "⚠️ Advertencia: No se encontró .env ni .env.example." -ForegroundColor Yellow
    }
}

# 3. Levantar contenedores Docker
Write-Host "📦 Levantando y construyendo contenedores Docker (MySQL, Backend, Nginx)..." -ForegroundColor Cyan
docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ocurrió un error al iniciar los contenedores Docker." -ForegroundColor Red
    Exit 1
}

Write-Host "`n⏳ Esperando 5 segundos para que los servicios inicialicen..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 4. Estado de los contenedores
Write-Host "`n📋 Estado actual de los contenedores:" -ForegroundColor Cyan
docker compose ps

# 5. Abrir la tienda en el navegador
$url = "http://localhost:8081"
Write-Host "`n🌐 Abriendo la aplicación en: $url" -ForegroundColor Green
Start-Process $url

# 6. Resumen de credenciales para el equipo
Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "   ✅ SISTEMA LISTO PARA USAR (UMG PERSONALIZA)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "🛡️ Admin:       admin       | Pass:  Admin123*        | Vista: /admin/administrador.html" -ForegroundColor White
Write-Host "📊 Supervisor:  supervisor  | Pass:  Supervisor123*   | Vista: /supervisor/dashboard.html" -ForegroundColor White
Write-Host "🚚 Repartidor:  repartidor  | Pass:  Repartidor123*   | Vista: /repartidor/entrega.html" -ForegroundColor White
Write-Host "🛍️ Comprador:   comprador   | Pass:  Comprador123*    | Vista: /comprador/tienda.html" -ForegroundColor White
Write-Host "========================================================`n" -ForegroundColor Green
