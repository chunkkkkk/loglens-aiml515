#!/bin/bash
# Double-click this file in Finder to set up and start LogLens on macOS.
cd "$(dirname "$0")" || exit 1
echo "=== LogLens setup ==="

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then double-click this file again."
  read -r -p "Press Enter to close."
  exit 1
fi
echo "Node $(node -v), npm $(npm -v)"

[ -f server/.env ] || cp .env.example server/.env

if ! grep -qE '^ANTHROPIC_API_KEY=.+' server/.env; then
  echo
  echo "Paste your Anthropic API key (starts with sk-ant-) and press Enter."
  echo "It is saved only in server/.env on this Mac. Press Enter with nothing to skip (rules mode)."
  read -r -s -p "API key: " KEY; echo
  if [ -n "$KEY" ]; then
    /usr/bin/sed -i '' "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${KEY}|" server/.env
    echo "Key saved to server/.env"
  fi
fi

if [ ! -d node_modules ] || [ ! -d server/node_modules ] || [ ! -d client/node_modules ]; then
  echo; echo "Installing dependencies (first run only, about 1-2 minutes)..."
  npm run setup || { echo "Install failed. See the error above."; read -r -p "Press Enter to close."; exit 1; }
fi

# Open the project and the AI analyzer file in VS Code for the code screenshot
open -a "Visual Studio Code" . server/src/services/aiAnalyzer.js 2>/dev/null || echo "(VS Code not found - open this folder in your IDE manually)"

# Open the browser once the app is up
( for i in $(seq 1 30); do sleep 1; curl -s http://localhost:5173 >/dev/null 2>&1 && { open http://localhost:5173; break; }; done ) &

echo; echo "Starting LogLens: API on http://localhost:3001, app on http://localhost:5173"
echo "Keep this window open. Press Ctrl+C to stop."
npm run dev
