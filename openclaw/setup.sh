#!/bin/bash
# HustleBot OpenClaw Integration Setup
# Run this script to install HustleBot as an OpenClaw skill

set -e

OPENCLAW_SKILLS_DIR="$HOME/.openclaw/workspace/skills"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== HustleBot OpenClaw Setup ==="
echo ""

# Check if OpenClaw is installed
if ! command -v openclaw &>/dev/null && ! npx openclaw --version &>/dev/null 2>&1; then
  echo "OpenClaw not found. Installing..."
  npm install -g openclaw
fi

# Initialize workspace if needed
if [ ! -d "$HOME/.openclaw/workspace" ]; then
  echo "Initializing OpenClaw workspace..."
  npx openclaw setup --non-interactive 2>/dev/null || true
fi

# Create skills directory
mkdir -p "$OPENCLAW_SKILLS_DIR/hustlebot"

# Copy skill file
cp "$SCRIPT_DIR/SKILL.md" "$OPENCLAW_SKILLS_DIR/hustlebot/SKILL.md"

echo "HustleBot skill installed!"
echo ""

# Enable Telegram plugin
echo "Enabling Telegram plugin..."
npx openclaw plugins enable telegram 2>/dev/null || true

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Add your Telegram bot token:"
echo "     npx openclaw channels add --channel telegram --token YOUR_BOT_TOKEN"
echo ""
echo "  2. Start the gateway:"
echo "     npx openclaw gateway"
echo ""
echo "  3. Message your bot on Telegram:"
echo "     'scan for gigs' - Find freelance opportunities"
echo "     'check earnings' - View revenue analytics"
echo "     'start autopilot' - Begin full automation"
echo ""
echo "  4. Verify skill is loaded:"
echo "     npx openclaw skills list"
echo ""
