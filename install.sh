#!/usr/bin/env bash
# ============================================================================
# TuffNode TVM Panel — installer / repair tool
#
# Works on normal VPS (systemd) AND containers (LXC / Docker, no systemd).
# Safe to re-run: it repairs an existing install instead of duplicating it.
#
# Usage:
#   sudo bash install.sh
#   sudo ADMIN_PASSWORD='YourStr0ngPass!' bash install.sh
#
# Overrides: ADMIN_USERNAME ADMIN_PASSWORD DB_NAME DB_USER DB_PASS PORT
# ============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-tvm_panel}"
DB_USER="${DB_USER:-tvm_panel}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
PORT="${PORT:-3000}"

say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root:  sudo bash install.sh"
cd "$APP_DIR"
[[ -f package.json ]] || die "package.json not found in $APP_DIR — run this from the project root"

echo
echo "  ╔════════════════════════════════════════╗"
echo "  ║   TuffNode TVM Panel — installer       ║"
echo "  ╚════════════════════════════════════════╝"
echo "    dir  : $APP_DIR"
echo "    db   : $DB_NAME (user $DB_USER)"
echo "    port : $PORT"

# ---------------------------------------------------------------- init system
HAS_SYSTEMD=0
if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
  HAS_SYSTEMD=1
fi
[[ $HAS_SYSTEMD -eq 1 ]] && ok "systemd detected" || warn "no systemd (container) — using service/cron fallbacks"

# ------------------------------------------------------------- system packages
say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
# containers ship a policy file that blocks service startup
rm -f /usr/sbin/policy-rc.d
apt-get update -qq
apt-get install -y -qq curl git ca-certificates dos2unix postgresql postgresql-client >/dev/null
ok "base packages ready"

# Node.js 20+
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  [[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]] && NODE_OK=1
fi
if [[ $NODE_OK -ne 1 ]]; then
  say "Installing Node.js 20.x"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
ok "node $(node -v) / npm $(npm -v)"

command -v pm2 >/dev/null 2>&1 || { say "Installing PM2"; npm install -g pm2 >/dev/null 2>&1; }
ok "pm2 $(pm2 -v 2>/dev/null || echo installed)"

# sshx — live web terminal used by the panel's "Live terminal" tab
if ! command -v sshx >/dev/null 2>&1; then
  say "Installing sshx (live web terminal)"
  curl -sSf https://sshx.io/get | sh >/dev/null 2>&1 || warn "sshx install failed (optional feature)"
fi
if command -v sshx >/dev/null 2>&1; then
  ok "sshx installed at $(command -v sshx)"
  cat > /usr/local/bin/tvm-terminal <<'SSHXEOF'
#!/usr/bin/env bash
# Start a live sshx terminal and print the link to paste into the TVM panel.
echo "Starting sshx session — copy the https://sshx.io/s/... link below"
echo "into the panel (VM -> Console -> Live terminal, or Node -> live terminal)."
echo "Press Ctrl+C here to end the session."
echo
exec sshx
SSHXEOF
  chmod +x /usr/local/bin/tvm-terminal
  ok "helper command: tvm-terminal"
fi

# ------------------------------------------------------------------ PostgreSQL
say "Starting PostgreSQL"
PG_VER="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1 || true)"
start_pg() {
  if [[ $HAS_SYSTEMD -eq 1 ]]; then
    systemctl enable postgresql >/dev/null 2>&1 || true
    systemctl start postgresql >/dev/null 2>&1 && return 0
  fi
  service postgresql start >/dev/null 2>&1 && return 0
  [[ -n "$PG_VER" ]] && pg_ctlcluster "$PG_VER" main start >/dev/null 2>&1 && return 0
  return 1
}
start_pg || true

for i in $(seq 1 20); do
  pg_isready -q 2>/dev/null && break
  sleep 1
  [[ $i -eq 10 ]] && start_pg || true
  [[ $i -eq 20 ]] && die "PostgreSQL would not start. Try manually: pg_ctlcluster ${PG_VER:-14} main start"
done
ok "postgres accepting connections"

# ------------------------------------------------------- database user + schema
say "Configuring database"
# Reuse the password from an existing .env so re-runs don't break the login.
DB_PASS="${DB_PASS:-}"
if [[ -z "$DB_PASS" && -f .env ]]; then
  DB_PASS="$(sed -n 's|^DATABASE_URL=postgresql://[^:]*:\([^@]*\)@.*|\1|p' .env | head -1)"
fi
[[ -z "$DB_PASS" ]] && DB_PASS="$(openssl rand -hex 16)"

psql_su() { su - postgres -c "psql -tAc \"$1\"" 2>/dev/null; }
if [[ "$(psql_su "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" == "1" ]]; then
  su - postgres -c "psql -qc \"ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}'\"" >/dev/null
  ok "db user ${DB_USER} (password synced)"
else
  su - postgres -c "psql -qc \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}'\"" >/dev/null
  ok "db user ${DB_USER} created"
fi
if [[ "$(psql_su "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" == "1" ]]; then
  ok "database ${DB_NAME} exists"
else
  su - postgres -c "psql -qc \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}\"" >/dev/null
  ok "database ${DB_NAME} created"
fi
su - postgres -c "psql -qd ${DB_NAME} -c \"GRANT ALL ON SCHEMA public TO ${DB_USER}\"" >/dev/null 2>&1 || true

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -tAc "select 1" >/dev/null \
  || die "cannot connect with the generated DATABASE_URL — check pg_hba.conf"
ok "connection verified"

# -------------------------------------------------------------------- .env file
say "Writing .env"
cat > .env <<EOF
DATABASE_URL=${DATABASE_URL}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
chmod 600 .env
ok ".env written"

# --------------------------------------------------- normalise Windows line ends
say "Normalising source files"
find . -path ./node_modules -prune -o -path ./.next -prune -o -type f \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.mjs" -o -name "*.css" -o -name "*.sh" \) \
  -print0 2>/dev/null | xargs -0 -r dos2unix -q 2>/dev/null || true
ok "CRLF stripped"

# ---------------------------------------------------- dependencies + build
# A node_modules/.next copied from another OS is the #1 cause of
# "Failed to load external module pg-...". Always rebuild them here.
say "Installing dependencies (fresh)"
rm -rf .next node_modules
npm install --no-audit --no-fund
ok "dependencies installed"

say "Applying database schema"
npx drizzle-kit push --force
ok "schema applied"

say "Building production bundle"
npm run build
ok "build complete"

# -------------------------------------------------------------------- start app
say "Starting panel on port ${PORT}"
pm2 delete tvm-panel >/dev/null 2>&1 || true
PORT="$PORT" pm2 start npm --name tvm-panel -- start >/dev/null
pm2 save >/dev/null 2>&1 || true

if [[ $HAS_SYSTEMD -eq 1 ]]; then
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || warn "pm2 startup failed — autostart not configured"
else
  # containers have no systemd: use cron instead
  PM2_BIN="$(command -v pm2)"
  CRON_PG="@reboot /usr/sbin/service postgresql start"
  CRON_PM="@reboot sleep 15 && ${PM2_BIN} resurrect"
  ( crontab -l 2>/dev/null | grep -v 'service postgresql start' | grep -v 'pm2 resurrect' || true
    echo "$CRON_PG"; echo "$CRON_PM" ) | crontab - 2>/dev/null \
    && ok "autostart via cron" || warn "could not write crontab — start manually after reboot"
fi

# ----------------------------------------------------------------- firewall
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q active; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
  ok "ufw: ports 22 + ${PORT} open"
fi

# ------------------------------------------------------------------- healthcheck
say "Verifying"
HEALTH=""
for _ in $(seq 1 15); do
  sleep 2
  HEALTH="$(curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || true)"
  [[ "$HEALTH" == *'"ok":true'* ]] && break
done

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
if [[ "$HEALTH" == *'"ok":true'* ]]; then
  echo "============================================================================"
  echo "  ✅  TuffNode TVM Panel is running"
  echo "============================================================================"
  echo "  URL            : http://${IP:-<server-ip>}:${PORT}"
  echo "  Admin user     : ${ADMIN_USERNAME}"
  echo "  Admin password : ${ADMIN_PASSWORD}"
  echo
  echo "  pm2 status | pm2 logs tvm-panel | pm2 restart tvm-panel"
  echo
  if command -v sshx >/dev/null 2>&1; then
    echo "  Live terminal: run 'tvm-terminal' on any machine, then paste the"
    echo "  sshx link into the panel (Console -> Live terminal)."
    echo
  fi
  echo "  ⚠  Change the admin password after first login (Account page)."
  echo "  ⚠  Put nginx + SSL in front of port ${PORT} for production."
  echo "============================================================================"
else
  echo "============================================================================"
  echo "  ⚠  Panel started but the healthcheck did not pass"
  echo "============================================================================"
  echo "  Response: ${HEALTH:-<no response>}"
  echo
  echo "  Debug with:"
  echo "    pm2 logs tvm-panel --lines 40"
  echo "    curl -s http://127.0.0.1:${PORT}/api/health"
  echo "    pg_isready"
  echo "============================================================================"
  exit 1
fi
