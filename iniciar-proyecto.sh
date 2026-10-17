#!/usr/bin/env bash
# UMG Personaliza — entorno de prueba (Docker)
# Uso:  ./iniciar-proyecto.sh
#       ./iniciar-proyecto.sh --reset-db

set -e

RESET_DB=false
if [[ "${1:-}" == "--reset-db" ]]; then
  RESET_DB=true
fi

echo -e "\n\033[1;36m========================================================\033[0m"
echo -e "\033[1;33m   UMG PERSONALIZA — entorno de prueba (Docker)   \033[0m"
echo -e "\033[1;36m========================================================\n\033[0m"

if ! docker info >/dev/null 2>&1; then
  echo -e "\033[0;31mError: Docker no está corriendo.\033[0m"
  exit 1
fi

if [[ ! -f ".env" ]]; then
  echo -e "\033[0;31mNo hay .env. Ejecuta: git pull origin main\033[0m"
  exit 1
fi

if $RESET_DB; then
  echo -e "\033[1;33mReiniciando volumen MySQL...\033[0m"
  docker compose down -v
fi

echo -e "\033[1;36mLevantando contenedores...\033[0m"
docker compose up -d --build

echo "Esperando MySQL..."
for i in $(seq 1 30); do
  if docker compose ps mysql 2>/dev/null | grep -q healthy; then
    echo -e "\033[1;32mMySQL listo.\033[0m"
    break
  fi
  sleep 3
done

docker compose ps

echo -e "\n\033[1;32m========================================================\033[0m"
echo -e "\033[1;32m   LISTO: http://localhost:8081\033[0m"
echo -e "\033[1;32m========================================================\033[0m"
echo "Admin: admin / admin123"
echo "Supervisor: supervisor / supervisor123"
echo "Repartidor: repartidor / repartidor123"
echo "Comprador: test o comprador / test123"
echo ""
