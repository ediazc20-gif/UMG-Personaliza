#!/usr/bin/env bash
# ==============================================================================
# Cloud Agent install script — UMG Personaliza
# Idempotent setup: system packages, Node deps, native MySQL data dir + schema,
# and a local dev .env. Runs after the repository is checked out.
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DB_PASS="${UMG_DB_PASSWORD:-umgdev123}"
MYSQL_CNF="/etc/mysql/mysql.conf.d/umg.cnf"

echo "==> [1/5] System packages (MySQL server + native build deps for canvas/bcrypt)"
if ! command -v mysqld >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends \
    mysql-server \
    build-essential python3 pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    curl ca-certificates
else
  echo "    mysqld already installed — skipping apt."
fi

echo "==> [2/5] MySQL config (lower_case_table_names=1 to match production/compose)"
sudo tee "$MYSQL_CNF" >/dev/null <<'EOF'
[mysqld]
lower_case_table_names=1
default_authentication_plugin=mysql_native_password
bind-address=127.0.0.1
port=3306
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
EOF

echo "==> [3/5] Initialize MySQL data directory (only if empty)"
sudo mkdir -p /var/run/mysqld
sudo chown -R mysql:mysql /var/run/mysqld
if [ ! -d /var/lib/mysql/mysql ]; then
  echo "    Fresh data dir — initializing with lower_case_table_names=1"
  sudo rm -rf /var/lib/mysql
  sudo mkdir -p /var/lib/mysql
  sudo chown -R mysql:mysql /var/lib/mysql
  sudo mysqld --initialize-insecure --user=mysql
  NEEDS_SEED=1
else
  echo "    Existing data dir — keeping data."
  NEEDS_SEED=0
fi

echo "==> [4/5] Start MySQL, set credentials, and load schema/seed (idempotent SQL)"
if ! sudo mysqladmin ping >/dev/null 2>&1; then
  sudo mysqld --user=mysql --daemonize
fi
# Wait for readiness
for i in $(seq 1 30); do
  if sudo mysqladmin ping >/dev/null 2>&1; then break; fi
  sleep 1
done

# Ensure root has a known password + remote host user (safe to re-run)
if mysql -uroot -h127.0.0.1 -P3306 -e "SELECT 1" >/dev/null 2>&1; then
  # passwordless root still active (fresh init) -> set password
  mysql -uroot -h127.0.0.1 -P3306 <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL
fi

# Load schema/seed only on a fresh data directory. The data dir persists across
# reboots and in the environment snapshot, so reloading on every run is
# unnecessary — and it would accumulate duplicate rows because init.sql inserts
# some seed users with INSERT IGNORE while `usuarios.Usuario` has no unique
# constraint. --force tolerates 03's MariaDB-style ADD COLUMN IF NOT EXISTS (the
# column already exists from 02) on MySQL 8.
if [ "${NEEDS_SEED}" = "1" ]; then
  for f in database/init.sql database/02-ecommerce.sql database/03-constancia-url.sql database/05-seed-users-stock.sql; do
    echo "    loading $f"
    mysql -uroot -p"${DB_PASS}" -h127.0.0.1 -P3306 --force < "$f" 2>&1 | grep -v "Using a password" || true
  done
else
  echo "    Existing data dir — skipping schema/seed load (already present)."
fi

echo "==> [5/5] Node dependencies + local dev .env"
( cd backend && npm install )

mkdir -p backend/uploads backend/data
if [ ! -f .env ]; then
  echo "    Generating .env for local dev"
  cat > .env <<EOF
NODE_ENV=development
PORT=3000

MYSQL_ROOT_PASSWORD=${DB_PASS}

JWT_SECRET=dev_local_jwt_secret_change_me_0123456789abcdef
JWT_ISSUER=umg_personaliza
JWT_AUDIENCE=umg_personaliza_frontend
JWT_EXPIRES=15m
REFRESH_EXPIRES=7d

DB_NAME=umg_personaliza_db

LOCAL_DB_HOST=127.0.0.1
LOCAL_DB_PORT=3306
LOCAL_DB_USER=root
LOCAL_DB_PASSWORD=${DB_PASS}
LOCAL_DB_NAME=umg_personaliza_db
LOCAL_DB_CONN_LIMIT=10
LOCAL_DB_QUEUE_LIMIT=0
LOCAL_DB_SSL=false
LOCAL_DB_MULTIPLE=true

CENTRALP_DB_HOST=127.0.0.1
CENTRALP_DB_PORT=3306
CENTRALP_DB_USER=root
CENTRALP_DB_PASSWORD=${DB_PASS}
CENTRALP_DB_NAME=umg_personaliza_db
CENTRALP_DB_CONN_LIMIT=10
CENTRALP_DB_QUEUE_LIMIT=0
CENTRALP_DB_SSL=false
CENTRALP_DB_MULTIPLE=true

DB_TZ=-06:00

PUBLIC_URL=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
COOKIE_SECURE=false

GMAIL_USER=
GMAIL_PASS=
CREDENTIAL_QR_SECRET=

SIGNING_SERVICE_URL=
SIGNING_SERVICE_API_KEY=
SIGNING_REQUIRED=false
SIGNING_REASON=Firma credencial UMG Personaliza
SIGNING_LOCATION=Guatemala
SIGNING_TIMEOUT_MS=30000

RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RECAPTCHA_SKIP=true

MODELS_PATH=${REPO_ROOT}/frontend/src/models
EOF
else
  echo "    .env already present — leaving it untouched."
fi

echo "==> install.sh complete."
