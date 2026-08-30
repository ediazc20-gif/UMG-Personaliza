#!/usr/bin/env bash
# ==============================================================================
# Script de Inicio Rápido - UMG Personaliza (Linux / macOS)
# ==============================================================================

set -e

echo -e "\n\033[1;36m========================================================\033[0m"
echo -e "\033[1;33m   🚀 INICIANDO ENTORNO UMG PERSONALIZA   \033[0m"
echo -e "\033[1;36m========================================================\n\033[0m"

# 1. Verificar Docker
if ! docker info >/dev/null 2>&1; then
    echo -e "\033[0;31m❌ Error: Docker no está corriendo o no se encuentra instalado.\033[0m"
    exit 1
fi

# 2. Verificar .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "\033[1;33mℹ️ Creando .env desde .env.example...\033[0m"
        cp .env.example .env
    fi
fi

# 3. Levantar contenedores
echo -e "\033[1;36m📦 Levantando contenedores Docker...\033[0m"
docker compose up -d --build

sleep 5

echo -e "\n\033[1;32m========================================================\033[0m"
echo -e "\033[1;32m   ✅ SISTEMA LISTO EN: http://localhost:8081           \033[0m"
echo -e "\033[1;32m========================================================\033[0m"
echo -e "🛡️ Admin:       admin       | Pass: Admin123*"
echo -e "📊 Supervisor:  supervisor  | Pass: Supervisor123*"
echo -e "🚚 Repartidor:  repartidor  | Pass: Repartidor123*"
echo -e "🛍️ Comprador:   comprador   | Pass: Comprador123*\n"
