#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node bin/jev-kit.mjs setup --codex "$@"
node bin/jev-kit.mjs doctor
