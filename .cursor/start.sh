#!/usr/bin/env bash
# ==============================================================================
# Cloud Agent start script — UMG Personaliza
# Per-boot reconciliation: ensure the MySQL daemon is running and ready.
# The backend server itself runs as a named terminal (see environment.json).
# ==============================================================================
set -euo pipefail

echo "==> Ensuring MySQL runtime dir"
sudo mkdir -p /var/run/mysqld
sudo chown -R mysql:mysql /var/run/mysqld

if sudo mysqladmin ping >/dev/null 2>&1; then
  echo "==> MySQL already running."
else
  echo "==> Starting MySQL daemon"
  sudo mysqld --user=mysql --daemonize
fi

echo "==> Waiting for MySQL readiness"
for i in $(seq 1 60); do
  if sudo mysqladmin ping >/dev/null 2>&1; then
    echo "==> MySQL is ready."
    exit 0
  fi
  sleep 1
done

echo "!! MySQL did not become ready in time" >&2
exit 1
