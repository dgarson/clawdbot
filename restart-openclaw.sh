#!/bin/bash
set -e

echo "→ Changing to ~/clawd directory..."
cd ~/clawd/clawdbot

echo "→ Installing dependencies..."
pnpm install

echo "→ Building project..."
pnpm build

echo "→ Building UI..."
pnpm ui:build

echo "→ Stopping openclaw gateway processes..."
if pkill -9 -f "openclaw"; then
    echo "  ✓ Killed existing openclaw processes"
    sleep 1
else
    echo "  ℹ No openclaw processes were running"
fi

echo "→ Starting openclaw gateway (detached)..."
nohup pnpm openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &
GATEWAY_PID=$!

echo "  ✓ Gateway started with PID: $GATEWAY_PID"
echo "  ✓ Logs: /tmp/openclaw-gateway.log"
echo ""
echo "To check status:"
echo "  ps aux | grep '[o]penclaw'"
echo "  tail -f /tmp/openclaw-gateway.log"
