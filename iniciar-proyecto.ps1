# ==============================================================================
# UMG Personaliza — levantar entorno de PRUEBA (Docker)
# Uso:  .\iniciar-proyecto.ps1
#       .\iniciar-proyecto.ps1 -ResetDb   (si MySQL no conecta / contraseña vieja)
# ==============================================================================

param(
    [switch]$ResetDb
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   UMG PERSONALIZA — entorno de prueba (Docker)   " -ForegroundColor Yellow
Write-Host "========================================================`n" -ForegroundColor Cyan

try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker Desktop no esta iniciado." }
} catch {
    Write-Host "Error: Abre Docker Desktop y vuelve a ejecutar este script." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Host "No hay .env en esta carpeta. Ejecuta:  git pull origin main" -ForegroundColor Red
    exit 1
}

if ($ResetDb) {
    Write-Host "Reiniciando volumen MySQL (borra datos locales)..." -ForegroundColor Yellow
    docker compose down -v
}

Write-Host "Construyendo y levantando contenedores..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Fallo docker compose. Prueba:  .\iniciar-proyecto.ps1 -ResetDb" -ForegroundColor Red
    exit 1
}

Write-Host "Esperando MySQL (hasta 90 s)..." -ForegroundColor Gray
$deadline = (Get-Date).AddSeconds(90)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    $status = docker compose ps mysql --format "{{.Health}}" 2>$null
    if ($status -match "healthy") { $healthy = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $healthy) {
    Write-Host "MySQL aun no responde. Revisa: docker compose logs mysql" -ForegroundColor Yellow
} else {
    Write-Host "MySQL listo." -ForegroundColor Green
}

docker compose ps

$url = "http://localhost:8081"
Write-Host "`nAbriendo $url ..." -ForegroundColor Green
Start-Process $url

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "   LISTO PARA PROBAR" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Admin:      admin       / admin123       -> /admin/administrador.html"
Write-Host "Supervisor: supervisor  / supervisor123  -> /supervisor/dashboard.html"
Write-Host "Repartidor: repartidor  / repartidor123  -> /repartidor/entrega.html"
Write-Host "Comprador:  test        / test123        -> /comprador/tienda.html"
Write-Host "            comprador   / test123"
Write-Host "========================================================`n" -ForegroundColor Green
