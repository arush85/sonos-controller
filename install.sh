#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sonos Controller — Installer
# Installs dependencies, builds the app, and sets up launchd daemons so the
# controller and the Sonos API run automatically at boot (even when locked).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
die()  { echo -e "${RED}✗ $*${NC}"; exit 1; }
step() { echo -e "\n${BOLD}▸ $*${NC}"; }

echo ""
echo -e "${BOLD}  Sonos Controller — Installer${NC}"
echo    "  ────────────────────────────────"
echo ""

# ── Resolve install directory (the folder this script lives in) ───────────────
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ok "Install directory: $INSTALL_DIR"

# ── Check prerequisites ───────────────────────────────────────────────────────
step "Checking prerequisites"

if ! command -v brew &>/dev/null; then
  warn "Homebrew not found. Installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
ok "Homebrew"

if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via Homebrew..."
  brew install node
fi

NODE_MAJOR=$(node -e "console.log(parseInt(process.version.slice(1)))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "Node.js v18 or later is required (found v$(node -v)). Run: brew upgrade node"
fi
ok "Node.js $(node -v)"

if ! command -v git &>/dev/null; then
  warn "git not found. Installing via Homebrew..."
  brew install git
fi
ok "git"

NODE_PATH="$(which node)"

# ── Install controller dependencies & build ───────────────────────────────────
step "Installing dependencies and building the app"

cd "$INSTALL_DIR"
npm install
npm run build
ok "Build complete — output in dist/"

# ── Set up node-sonos-http-api ────────────────────────────────────────────────
step "Setting up node-sonos-http-api"

SONOS_API_DIR="$INSTALL_DIR/node-sonos-http-api"

if [ -d "$SONOS_API_DIR" ]; then
  ok "node-sonos-http-api already present, skipping clone"
else
  git clone https://github.com/jishi/node-sonos-http-api.git "$SONOS_API_DIR"
  cd "$SONOS_API_DIR"
  npm install --omit=dev
  cd "$INSTALL_DIR"
  ok "node-sonos-http-api installed"
fi

# ── Gather config from user ───────────────────────────────────────────────────
step "Configuring your Sonos connection"

echo ""
echo "  Your Sonos room name is shown in the Sonos app — tap the speaker name to find it."
echo "  It is case-sensitive (e.g. \"Living Room\" not \"living room\")."
echo ""

read -rp "  Room name: " ROOM_NAME
while [ -z "$ROOM_NAME" ]; do
  warn "Room name cannot be empty."
  read -rp "  Room name: " ROOM_NAME
done

read -rp "  Sonos API port [5005]: " API_PORT
API_PORT="${API_PORT:-5005}"

read -rp "  Controller port [3000]: " CTRL_PORT
CTRL_PORT="${CTRL_PORT:-3000}"

# Write initial config to sonos-data.json
cat > "$INSTALL_DIR/sonos-data.json" <<JSON
{
  "sonos-config": {
    "host": "localhost",
    "port": "$API_PORT",
    "room": "$ROOM_NAME"
  }
}
JSON
ok "Config saved to sonos-data.json"

# ── Create launchd plists ─────────────────────────────────────────────────────
step "Setting up background services (requires sudo)"

PLIST_API="/Library/LaunchDaemons/com.sonos.api.plist"
PLIST_CTRL="/Library/LaunchDaemons/com.sonos.controller.plist"

sudo tee "$PLIST_API" > /dev/null <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.sonos.api</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_PATH</string>
    <string>$SONOS_API_DIR/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$SONOS_API_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>$API_PORT</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/sonos-api.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/sonos-api-error.log</string>
</dict>
</plist>
XML

sudo tee "$PLIST_CTRL" > /dev/null <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.sonos.controller</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_PATH</string>
    <string>$INSTALL_DIR/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$INSTALL_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>$CTRL_PORT</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/sonos-controller.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/sonos-controller-error.log</string>
</dict>
</plist>
XML

ok "Launchd plists written"

# ── Load the daemons ──────────────────────────────────────────────────────────
step "Starting services"

# Unload first in case of a reinstall
sudo launchctl unload "$PLIST_API"  2>/dev/null || true
sudo launchctl unload "$PLIST_CTRL" 2>/dev/null || true

sudo launchctl load "$PLIST_API"
sudo launchctl load "$PLIST_CTRL"

ok "Services started"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  All done!${NC}"
echo ""
echo -e "  Sonos API:   ${BOLD}http://localhost:${API_PORT}${NC}"
echo -e "  Controller:  ${BOLD}http://localhost:${CTRL_PORT}${NC}"
echo ""
echo "  Both services start automatically at boot, even when the Mac is locked."
echo ""
echo "  Useful commands:"
echo "    View controller logs:  tail -f /tmp/sonos-controller.log"
echo "    View API logs:         tail -f /tmp/sonos-api.log"
echo "    Restart controller:    sudo launchctl kickstart -k system/com.sonos.controller"
echo "    Restart API:           sudo launchctl kickstart -k system/com.sonos.api"
echo ""
