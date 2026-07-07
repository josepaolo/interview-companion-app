#!/bin/bash
# Double-click this file to start Interview Companion.
# It installs anything missing, starts the app, and opens it in your browser.

cd "$(dirname "$0")" || exit 1
echo "── Interview Companion ───────────────────────────────"

if ! command -v npm >/dev/null 2>&1; then
  echo
  echo "Node.js isn't installed. Please install it from https://nodejs.org (LTS),"
  echo "then double-click this file again."
  echo
  read -r -p "Press Return to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing dependencies (about a minute)…"
  npm install || { echo "Install failed."; read -r -p "Press Return to close."; exit 1; }
fi

if ! grep -q '^ANTHROPIC_API_KEY="..*"' .env 2>/dev/null; then
  echo
  echo "⚠  No Anthropic API key found in .env — the interviewer won't work until you add one."
  echo "   Open the .env file and paste your key into ANTHROPIC_API_KEY. See README.md."
  echo
fi

# Open the browser once the server is up.
( for _ in $(seq 1 30); do
    if curl -s -o /dev/null http://localhost:8080/; then open http://localhost:8080/; break; fi
    sleep 1
  done ) &

echo "Starting… the app will open at http://localhost:8080/"
echo "Leave this window open while you use the app. Close it (or press Ctrl+C) to stop."
echo
npm run dev
