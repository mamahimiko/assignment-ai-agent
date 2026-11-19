#!/usr/bin/env bash
set -euo pipefail
set +x
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null || [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 24 ]; then
  echo 'Node.js 24 or later is required. / Node.js 24以降を使ってください。' >&2
  exit 1
fi
if [ ! -f node_modules/vite/bin/vite.js ]; then
  echo 'Run npm ci first. / 先に npm ci を実行してください。' >&2
  exit 1
fi
if [ -z "${GEMINI_API_KEY:-}" ]; then
  if [ ! -t 0 ]; then
    echo 'Open a terminal to enter your Gemini key privately.' >&2
    exit 1
  fi
  echo 'Gemini API key / APIキーを貼り付けてEnter（画面には表示されません）:'
  IFS= read -r -s GEMINI_API_KEY
  printf '\n'
fi
if [ -z "$GEMINI_API_KEY" ]; then
  echo 'No key entered. / キーが入力されていません。' >&2
  exit 1
fi
export GEMINI_API_KEY
# The key exists only in this process and its children, never in a file/history.
echo 'Starting Sumitt. Use a free-tier project with billing disabled.'
exec npm run dev
