#!/bin/bash
# Clawd Voice Server v4.0 — OpenClaw Gateway + OpenAI STT/TTS
# Usage: ./start.sh

set -e
cd "$(dirname "$0")"

PORT=${PORT:-8765}

echo "🎙️  Starting Clawd Voice Server v4.0..."
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

# Check if cloudflared is available
if ! command -v cloudflared &> /dev/null; then
  echo "📦 Installing cloudflared..."
  brew install cloudflare/cloudflare/cloudflared 2>/dev/null || {
    echo "   Trying npm..."
    npm install -g cloudflared
  }
  echo ""
fi

# The server reads its own token from ~/.openclaw/openclaw.json
# and connects directly to the local OpenClaw gateway.
echo "🚀 Starting voice server on port $PORT..."
node server.js
