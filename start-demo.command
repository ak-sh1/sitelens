#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22 LTS or newer from https://nodejs.org, then run this again."
  exit 1
fi
node scripts/demo-server.mjs
