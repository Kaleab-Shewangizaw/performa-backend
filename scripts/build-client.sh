#!/usr/bin/env bash
# Builds the React frontend and copies it into ./public so the backend can
# serve it as a single app. Run this locally before uploading to the server.
#
#   ./scripts/build-client.sh [path-to-frontend]
#
# Defaults to the sibling ../performa-frontend.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="${1:-$BACKEND_DIR/../performa-frontend}"

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "Frontend not found at: $FRONTEND_DIR" >&2
  echo "Pass its path: ./scripts/build-client.sh /path/to/performa-frontend" >&2
  exit 1
fi

echo "==> Building frontend at $FRONTEND_DIR"
( cd "$FRONTEND_DIR" && npm install && npm run build )

echo "==> Copying build into $BACKEND_DIR/public"
rm -rf "$BACKEND_DIR/public"
mkdir -p "$BACKEND_DIR/public"
cp -r "$FRONTEND_DIR/dist/." "$BACKEND_DIR/public/"

echo "==> Done. The backend will now serve the SPA from ./public"
