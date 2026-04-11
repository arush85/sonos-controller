# Sonos Controller

A local web app for controlling Sonos speakers with saved audio profiles, scheduling, and automatic session detection. Built with React + Vite, talks to your Sonos over [node-sonos-http-api](https://github.com/jishi/node-sonos-http-api).

![Screenshot](docs/screenshot.jpg)

---

## Features

### Playback
- **Now Playing card** — shows current track title, artist, album, and album art with animated EQ bars while playing
- **Transport controls** — play/pause, previous, and next track directly from the controller
- **Queue view** — see the full current queue with per-track thumbnails and active track highlight
- **Per-track album art** — uses the Sonos device's `/getaa` endpoint so individual track art is shown correctly (including YouTube Music liked-songs playlists, which would otherwise show playlist art)

### Speaker Groups
- **Speaker grouping** — add or remove other speakers from the group with one tap; detected automatically, no room names hardcoded
- **Group header** — header shows all grouped room names when speakers are grouped
- **Group-aware volume** — Live Controls reads and writes group volume when speakers are grouped, matching what the Sonos app displays

### Audio Profiles
- **Saved profiles** — named presets with volume, bass, treble, night mode, speech enhancement, and subwoofer settings
- **One-click apply** — apply any profile instantly, or capture your current Sonos settings as a new profile
- **Re-apply** — quickly re-apply the active profile from the now-playing strip

### Automation
- **Scheduler** — automatically apply a profile on specific days and times
- **Session watcher** — detects when playback starts and sets a startup volume automatically

### Live Controls
- **Real-time sliders** — adjust volume, bass, treble, and subwoofer gain without overwriting saved profiles
- **Subwoofer toggle** — enable/disable the subwoofer with a live switch

### General
- **Activity log** — tracks every profile change, schedule trigger, and setting adjustment
- **Persistent storage** — data stored in both localStorage and a local `sonos-data.json` file so settings survive port changes and browser clears
- **Run on lock** — can be set up as a macOS launchd daemon so the controller stays running even when the Mac is locked

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- [node-sonos-http-api](https://github.com/jishi/node-sonos-http-api) running on your local network
- A Sonos speaker reachable on your local network

---

## Setup

### 1. Start node-sonos-http-api

This app talks to your Sonos through node-sonos-http-api. If you haven't set it up yet:

```bash
git clone https://github.com/jishi/node-sonos-http-api.git
cd node-sonos-http-api
npm install
npm start
```

By default it runs on port `5005`. Verify it's working by opening `http://localhost:5005/zones` in your browser — you should see your Sonos zones listed.

### 2. Install and run this app

```bash
git clone https://github.com/tonypest0/sonos-controller.git
cd sonos-controller
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Configure the connection

On first launch, go to **Settings** and enter:

- **Host** — IP address or hostname of the machine running node-sonos-http-api (use `localhost` if it's the same machine)
- **Port** — `5005` (default)
- **Room name** — the exact name of your Sonos room as shown in the Sonos app (e.g. `Living Room`)

Hit **Test Connection** to confirm everything is working.

> **Finding your room name:** Open the Sonos app on your phone, tap the room/speaker name — that exact string (case-sensitive) is what to enter here.

---

## Running as a background service (macOS launchd)

For a Mac that should keep the controller running at all times — including when locked — use launchd daemons instead of PM2. This runs both services as system-level daemons that start at boot without requiring a login.

Create a plist for node-sonos-http-api at `/Library/LaunchDaemons/com.sonos.api.plist` and one for this app at `/Library/LaunchDaemons/com.sonos.controller.plist`, then load them with:

```bash
sudo launchctl load /Library/LaunchDaemons/com.sonos.api.plist
sudo launchctl load /Library/LaunchDaemons/com.sonos.controller.plist
```

---

## Running in the background with PM2

To keep both services running persistently using PM2 (survives terminal close, auto-restarts on crash):

```bash
npm install -g pm2

# Start node-sonos-http-api
cd node-sonos-http-api
pm2 start server.js --name sonos-api

# Start this app
cd sonos-controller
pm2 start ecosystem.config.cjs

# Save the process list so it restores after reboot
pm2 save
```

The included `ecosystem.config.cjs` is pre-configured for this project.

---

## How CORS is handled

The Sonos API does not send CORS headers, so browsers block direct requests to it. This app includes a lightweight proxy built into the Vite dev server (`vite.config.js`) that forwards all API calls from the browser through Node.js — no browser CORS issues, no extra configuration needed.

---

## Project structure

```
src/
  components/
    ConnectionConfig.jsx   # Host/port/room settings UI
    NowPlaying.jsx         # Now Playing card with transport controls
    ProfileCard.jsx        # Single profile display + apply button
    ProfileEditor.jsx      # Create / edit profile form
    Queue.jsx              # Current queue panel with thumbnails
    QuickControls.jsx      # Live sliders + kitchen group toggle
    Scheduler.jsx          # Schedule list + add form
    ActivityLog.jsx        # Event history log
  hooks/
    useNowPlaying.js       # Polls /zones for playback state + group info
    useProfiles.js         # Profile storage and management
    useSonosApi.js         # All Sonos API calls
    useScheduler.js        # Schedule evaluation and triggering
    useSessionWatcher.js   # Playback state polling for session start
    useActivityLog.js      # Log state management
  lib/
    fileStore.js           # localStorage + server-side file persistence
    sonosArt.js            # Album art URL resolution helper
  App.jsx
  main.jsx
ecosystem.config.cjs       # PM2 config
```

---

## Bug fixes

| Issue | Fix |
|---|---|
| Volume slider showed wrong value when speakers were grouped | Switched to reading `groupState.volume` from `/zones` instead of individual room volume from `/state` |
| YouTube Music liked-songs showed playlist thumbnail instead of track art | Now fetches art via the Sonos device's `/getaa` endpoint (`albumArtUri`) rather than `absoluteAlbumArtUri` |
| Port conflict when running alongside Claude Code preview server | Daemon now uses `PORT` env var; default bumped to avoid collision |
| Live Controls panel overlapped content when scrolling | Panel is now collapsible and collapses automatically after a profile is applied |
| Volume write applied to individual room only when grouped | Write now uses `groupvolume` command when Kitchen is in the group |

---

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — free for personal and non-commercial use. Commercial use requires explicit written permission.
