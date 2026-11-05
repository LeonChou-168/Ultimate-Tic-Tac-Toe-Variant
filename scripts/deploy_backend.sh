#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy_backend.sh --host <host> [options]

Required:
  --host <host>                 Remote SSH host, e.g. root@your-server-ip

Optional:
  --repo <url>                  Git repository URL
  --branch <branch>             Git branch to deploy
  --target-dir <dir>            Remote deploy directory
  --client-origin <origin>      Allowed frontend origin(s), comma-separated
  --room-ttl-ms <ms>            Room TTL in milliseconds
  --disconnect-grace-ms <ms>    Disconnect grace period in milliseconds
  --dry-run                     Print the remote script instead of executing it
  -h, --help                    Show this help

Defaults:
  --repo https://github.com/LeonChou-168/Ultimate-Tic-Tac-Toe-Variant.git
  --branch main
  --target-dir /root/uttv
  --room-ttl-ms 1800000
  --disconnect-grace-ms 300000

Example:
  scripts/deploy_backend.sh \
    --host root@your-server-ip \
    --client-origin https://your-frontend.vercel.app
EOF
}

HOST=""
REPO_URL="https://github.com/LeonChou-168/Ultimate-Tic-Tac-Toe-Variant.git"
BRANCH="main"
TARGET_DIR="/root/uttv"
CLIENT_ORIGIN=""
ROOM_TTL_MS="1800000"
DISCONNECT_GRACE_MS="300000"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --target-dir)
      TARGET_DIR="${2:-}"
      shift 2
      ;;
    --client-origin)
      CLIENT_ORIGIN="${2:-}"
      shift 2
      ;;
    --room-ttl-ms)
      ROOM_TTL_MS="${2:-}"
      shift 2
      ;;
    --disconnect-grace-ms)
      DISCONNECT_GRACE_MS="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  echo "--host is required" >&2
  usage
  exit 1
fi

if [[ -z "$CLIENT_ORIGIN" ]]; then
  echo "--client-origin is required" >&2
  usage
  exit 1
fi

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

if ! command -v git >/dev/null 2>&1; then
  apt update
  apt install -y git curl
fi

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

if [[ ! -d "$TARGET_DIR/.git" ]]; then
  git clone "$REPO_URL" "$TARGET_DIR"
fi

cd "$TARGET_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
npm install

cat > .env.backend <<'EOCFG'
CLIENT_ORIGIN=$CLIENT_ORIGIN
ROOM_TTL_MS=$ROOM_TTL_MS
DISCONNECT_GRACE_MS=$DISCONNECT_GRACE_MS
EOCFG

cat > run-server.sh <<'EOSH'
#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.backend" ]]; then
  # shellcheck disable=SC2046
  export \$(grep -v '^#' .env.backend | xargs)
fi

exec npm run server:start
EOSH

chmod +x run-server.sh
pm2 delete uttv-server >/dev/null 2>&1 || true
pm2 start "$TARGET_DIR/run-server.sh" --name uttv-server
pm2 save
curl -fsS http://127.0.0.1:3001/health
pm2 status uttv-server
EOF
)

if [[ "$DRY_RUN" == "true" ]]; then
  printf '%s\n' "$REMOTE_SCRIPT"
  exit 0
fi

ssh -o StrictHostKeyChecking=accept-new "$HOST" "$REMOTE_SCRIPT"
