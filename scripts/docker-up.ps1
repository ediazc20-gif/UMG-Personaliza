# Reconstruye y levanta Docker con los archivos actuales del proyecto.
# Uso: .\scripts\docker-up.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ">> Deteniendo contenedores..." -ForegroundColor Cyan
docker compose down

Write-Host ">> Reconstruyendo imagenes (sin cache frontend)..." -ForegroundColor Cyan
docker compose build --no-cache frontend
docker compose build backend

Write-Host ">> Levantando servicios..." -ForegroundColor Cyan
docker compose up -d

Write-Host ""
Write-Host "Listo:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:8081"
Write-Host "  Backend:  http://localhost:3000"
Write-Host ""
Write-Host "Si el navegador muestra vista vieja: Ctrl+Shift+R en el editor." -ForegroundColor Yellow
