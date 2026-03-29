# Sonos Arc Controller

A local web app for controlling a Sonos Arc (or any Sonos speaker) with saved audio profiles, scheduling, and automatic session detection. Built with React + Vite, talks to your Sonos over [node-sonos-http-api](https://github.com/jishi/node-sonos-http-api).

---

## Features

- **Audio profiles** — save named presets with volume, bass, treble, loudness, night mode, and subwoofer settings
- **One-click apply** — apply any profile instantly, or capture your current Sonos settings as a new profile
- **Scheduler** — automatically apply a profile on specific days and times
- **Session watcher** — detects when playback starts and sets a startup volume automatically
- **Live controls** — adjust volume and subwoofer gain in real time without overwriting saved profiles
- **Activity log** — track every profile change, schedule trigger, and setting adjustment
- All data stored locally in the browser (localStorage — nothing leaves your network)

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
git clone https://github.com/YOUR_USERNAME/sonos-controller.git
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

## Running in the background with PM2

To keep both node-sonos-http-api and this app running persistently (survives terminal close, auto-restarts on crash):

```bash
npm install -g pm2

# Start node-sonos-http-api
cd node-sonos-http-api
pm2 start server.js --name sonos-api

# Start this app
cd sonos-arc-controller
pm2 start ecosystem.config.cjs

# Save the process list so it restores after reboot
pm2 save
```

The included `ecosystem.config.cjs` is pre-configured for this project.

---

## How CORS is handled

The Sonos API does not send CORS headers, so browsers block direct requests to it. This app includes a lightweight proxy built into the Vite dev server (`vite.config.js`) that forwards all API calls from the browser through Node.js on the server side — no browser CORS issues, no extra configuration needed.

---

## Project structure

```
src/
  components/
    ConnectionConfig.jsx   # Host/port/room settings UI
    ProfileCard.jsx        # Single profile display + apply button
    ProfileEditor.jsx      # Create / edit profile form
    QuickControls.jsx      # Live volume + sub gain sliders
    Scheduler.jsx          # Schedule list + add form
    ActivityLog.jsx        # Event history log
  hooks/
    useProfiles.js         # Profile storage and management
    useSonosApi.js         # All Sonos API calls
    useScheduler.js        # Schedule evaluation and triggering
    useSessionWatcher.js   # Playback state polling
    useActivityLog.js      # Log state management
  App.jsx
  main.jsx
ecosystem.config.cjs       # PM2 config
pm2-start.bat / .vbs       # Windows startup helpers
```

---

## License

MIT
