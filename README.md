# Fighters Guild Desktop

A Rolling Release native Windows / Linux desktop client for the **Fighters Guild**
chat server, built as an Electron wrapper around the [Fluxer](https://fluxer.app)
web app.

> This is a rebranded build of the community
> [fluxer-client](https://github.com/shadowflee3/fluxer-client) wrapper.
> All credit for the Fluxer platform (server, web app, protocol) goes to the
> Fluxer team — <https://github.com/fluxerapp/fluxer>. Fluxer is licensed under
> the GNU AGPL v3.

---

## What this adds over the browser

- **Ships pointed at the guild server** — no setup screen, opens straight to it.
  (A different server can still be set from the tray menu → *Change Server URL…*.)
- **System tray** — minimise to tray; the icon turns **green** when your mic is
  live in a voice channel and **red** when you're muted
- **DevTools** — `F12` or `Ctrl+Shift+I`
- **Diagnostics** — tray → *Save diagnostics…* dumps the WebRTC/ICE + screen-share
  log for a failed voice join or screen share
- **Update check** — the title bar and tray show when a newer release is on
  GitHub; clicking opens the download page (tray → *Check for updates…* to force)
- **Star Citizen killfeed** — opt-in; tails `Game.log` and posts your kills /
  deaths to a Fluxer channel via webhook (tray → *Star Citizen killfeed…*)
- **Global push-to-talk** — PTT keybind works even when unfocused/minimised
- **Custom global keybinds** for Fluxer actions
- **Screen sharing** — full desktop/window capture, including LAN
- **Native desktop notifications** with optional custom sound
- **Zoom controls** — `Ctrl` `+` / `-` / `0`
- **Auto-start on login** — optional, toggled from Fluxer's settings

---

## Install

Grab the latest from the releases:

| Platform | File |
|----------|------|
| Windows 10/11 (x64) | `Fighters Guild Setup x.x.x.exe` |
| Linux (x64) portable | `Fighters Guild-x.x.x.AppImage` |
| Linux Debian/Ubuntu (x64) | `fighters-guild_x.x.x_amd64.deb` |

---

## Build from source

Requires Node.js 20+.

The server this build opens by default is read from `default-server.json`
(git-ignored). Create it first, or the app falls back to a placeholder and you
set the server from the tray → *Change Server URL…*:

```bash
echo '{"serverUrl":"https://your.server"}' > default-server.json
```

CI builds write it from the `FG_SERVER_URL` repository variable
(Settings → Secrets and variables → Actions → Variables).

```bash
npm install

# Run in dev
npm start

# Windows installer (run on Windows)
npm run build:win

# Linux AppImage + deb (run on Linux, or via Docker:)
docker run --rm -v "$PWD":/project -w /project electronuserland/builder:latest \
  bash -lc "npm install && npm run create-icon && npx electron-builder --linux --x64"
```

Output lands in `dist/`.

---

## Credits

| | | License |
|---|---|---|
| [**Fluxer**](https://github.com/fluxerapp/fluxer) | the chat platform (server, web app, gateway/voice protocol) this app is a client for — all credit for it goes to the Fluxer team | AGPL-3.0 |
| [**fluxer-client**](https://github.com/shadowflee3/fluxer-client) by shadowflee | the community Electron wrapper this build is forked from and rebranded | see note ¹ |
| [**Electron**](https://www.electronjs.org) | the desktop runtime | MIT |
| [`uiohook-napi`](https://github.com/SnosMe/uiohook-napi) | global push-to-talk / keybinds | MIT |
| [`sharp`](https://sharp.pixelplumbing.com), [`png-to-ico`](https://github.com/steambap/png-to-ico), [`electron-builder`](https://www.electron.build) | icon generation + packaging (build only) | Apache-2.0 / MIT |
| AutoTrackR2, citizenmon and other community kill-trackers | the `Game.log` line formats the killfeed matches are the ones these tools established | their own |

¹ `fluxer-client` ships without an explicit license file. This fork is used and
distributed in good faith as a community wrapper of AGPL software, with full
credit above; check with the original author before redistributing.

**Star Citizen®**, **Squadron 42®**, **Roberts Space Industries®** and **Cloud
Imperium®** are trademarks of Cloud Imperium Rights LLC. This is an unofficial fan
project, **not affiliated with or endorsed by Cloud Imperium Games**.

## License

Copyright © 2026 Fighters Guild. Licensed under the
[GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html) — see [`LICENSE`](LICENSE).
The Fluxer platform it connects to is likewise AGPL-3.0.
