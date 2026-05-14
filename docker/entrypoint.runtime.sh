#!/usr/bin/env sh
set -eu

cd /workspace/app

if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile
fi

pnpm build
exec pnpm start --hostname 0.0.0.0 --port 3010
