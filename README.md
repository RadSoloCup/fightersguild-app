# Fighters Guild Desktop

A native Windows and Linux desktop client for the **Fighters Guild** chat
server. It is an [Electron](https://www.electronjs.org) wrapper around the
[Fluxer](https://fluxer.app) web app, with a system tray, global keybinds,
Star Citizen tooling, and a built in **Ops Center** tab that fronts the guild
[Portal](https://github.com/RadSoloCup/fightersguild-portal).

> This is a rebranded build of the community
> [fluxer-client](https://github.com/shadowflee3/fluxer-client) wrapper. All
> credit for the Fluxer platform (server, web app, gateway and voice protocol)
> goes to the Fluxer team at <https://github.com/fluxerapp/fluxer>. Fluxer is
> licensed under the GNU AGPL v3.

Releases at [Releases](https://github.com/RadSoloCup/fightersguild-app/releases).
Each one gets a two word Star Citizen codename and ships installers for Windows,
Debian/Ubuntu, Fedora/openSUSE, Arch, and generic Linux (AppImage and Flatpak).

---

## Why not just use Discord

Fighters Guild runs its own chat stack (Fluxer plus LiveKit for voice) on
hardware the guild controls. That choice trades Discord's polish and reach for
ownership, no upsell, and the freedom to run whatever tooling the guild wants.
This client is the desktop face of that stack.

| | Fighters Guild (Fluxer) | Discord free | Discord Nitro |
|---|---|---|---|
| Cost per member | none, the server runs on a home box or small VPS | none | about 10 USD per month |
| Who holds the data | the guild, on its own disk | Discord | Discord |
| File upload cap | set by the server admin, can be large | 10 MB | 500 MB |
| Message length | set by the server admin | 2000 characters | 4000 characters |
| Screen share quality | set by the server, LiveKit SFU | 720p at 30 fps | up to 1080p at 60 fps or 4K |
| Voice bitrate | set by the server, no per server cap | lower on non boosted servers | higher, plus server boosts |
| Custom client theme | ships with the RSI Blue theme, server can serve its own CSS | not without client mods that break the ToS | limited profile themes only |
| Bots and integrations | run your own, no approval gates | third party, subject to Discord review | same |
| Ads and promotions | none | none today, but you do not control that | none |
| Content scanning | none | yes | yes |
| Mobile apps and discovery | none yet | yes | yes |

If your community wants Discord's mobile apps, server discovery, and the largest
possible network, Discord is still the pragmatic choice. If it wants to own its
data, skip the Nitro upsell, set its own limits, and run its own bots, this is
what that looks like.

Everything the guild would pay Nitro for (bigger uploads, higher quality voice
and screen share, longer messages, a themed client) is a server setting here, not
a subscription.

---

## The Ops Center

The window has two tabs at the top: **Chat** and **Ops Center**. Ops Center loads
the guild [Portal](https://github.com/RadSoloCup/fightersguild-portal) in the
same window, signed in with your chat account, with back, forward, reload, and
home controls in the tab bar.

The Portal is the guild's operations hub. It provides:

- **Mission board.** Post a Star Citizen op with a title, briefing, pay, a
  roll call time and a mission time, an in game meet up point, a set of crew
  roles with slot counts, and a list of ship types the op wants. Members claim
  a role with one click and tick which of the requested ships they can bring.
  The board shows who has signed up to what and which ships are covered. The
  creator or an admin can edit a posted op or mark it complete and file a short
  after action report, which opens a discussion thread in the forum.
- **Two way mission sync.** Posting `!mission` in the guild's mission channel on
  the chat server creates a board entry, and posting one on the web drops an
  embed in that channel. Edits re render the channel message.
- **Forum.** Markdown threads with image uploads, categories, read tracking, and
  admin moderation (pin, lock, move, delete).
- **Events calendar** with going / interested / can't RSVPs.
- **Game server list.** The guild's game servers (Minecraft, Hytale, and so on)
  with a live up or down check, player counts where the game answers a query,
  a copy address button, and a join link.
- **Service status board.** Live up or down for the chat service, the API, the
  realtime gateway, the voice server, and each guild bot.

See the [Portal repo](https://github.com/RadSoloCup/fightersguild-portal) for the
full feature set and how it plugs into the server.

---

## What the desktop client adds over a browser tab

- **Pinned to the guild server.** No setup screen, it opens straight to the
  guild. A different server can still be set from the tray, under
  *Change Server URL*.
- **RSI Blue theme by default.** A navy and cyan look that matches the Star
  Citizen launcher, applied across Chat and Ops Center. Toggle it from the tray.
- **System tray.** Minimise to tray. The icon turns green when your mic is live
  in a voice channel and red when you are muted.
- **Global push to talk.** The PTT keybind works when the window is unfocused or
  minimised.
- **Custom global keybinds** for other Fluxer actions.
- **Screen sharing.** Full desktop or single window capture, including sources on
  the LAN.
- **Star Citizen killfeed.** Opt in. It tails the game's `Game.log`, classifies
  each kill, death, and witnessed kill, tracks your current shard and build, and
  posts to a chat channel through a webhook. Configure it from the tray.
- **Native desktop notifications** with an optional custom sound.
- **Update check.** The tab bar and tray show when a newer release is on GitHub.
  Clicking opens the download page. Downloads are manual, there is no silent
  auto update.
- **Diagnostics.** The tray *Save diagnostics* item dumps the WebRTC and ICE plus
  screen share log for troubleshooting a failed voice join or screen share.
- **Voice reliability fix.** The client rewrites the LiveKit ICE policy so voice
  connects on Chromium the same way it does in Firefox, which the stock web
  client does not do behind this kind of tunnel.
- **Zoom controls** with `Ctrl` and `+`, `-`, or `0`.
- **Auto start on login**, optional, toggled from Fluxer's own settings.
- **DevTools** with `F12` or `Ctrl+Shift+I`.

---

## Install

Download the latest build from
[Releases](https://github.com/RadSoloCup/fightersguild-app/releases):

| Platform | File |
|---|---|
| Windows 10/11 (x64) | `fighters-guild-x.y.z-x64.exe` |
| Debian, Ubuntu, Mint, Pop!\_OS (x64) | `fighters-guild-x.y.z-amd64.deb` |
| Fedora, openSUSE, Nobara (x64) | `fighters-guild-x.y.z-x86_64.rpm` |
| Arch, CachyOS, EndeavourOS (x64) | `fighters-guild-x.y.z-x64.pacman` |
| Any Linux, including Steam Deck desktop (x64) | `fighters-guild-x.y.z-x86_64.AppImage` |
| Immutable distros (Silverblue, Bazzite) | `fighters-guild-x.y.z-x86_64.flatpak` |

---

## Build from source

Requires Node.js 20 or newer.

The server the build opens by default is read from `default-server.json`, which
is git ignored. Create it first, or the app falls back to a placeholder and you
set the server from the tray:

```bash
echo '{"serverUrl":"https://chat.example.com"}' > default-server.json
```

CI writes this file from the `FG_SERVER_URL` repository secret or variable
(Settings, then Secrets and variables, then Actions).

```bash
npm install

# run in dev
npm start

# Windows installer, run on Windows
npm run build:win

# Linux formats, run on Linux or in a builder container
docker run --rm -v "$PWD":/project -w /project electronuserland/builder:latest \
  bash -lc "npm install && npm run create-icon && npx electron-builder --linux --x64"
```

Output lands in `dist/`.

---

## Credits

| | | License |
|---|---|---|
| [**Fluxer**](https://github.com/fluxerapp/fluxer) | the chat platform (server, web app, gateway and voice protocol) this app is a client for. All credit for it goes to the Fluxer team. | AGPL-3.0 |
| [**fluxer-client**](https://github.com/shadowflee3/fluxer-client) by shadowflee | the community Electron wrapper this build is forked from and rebranded | see note below |
| [**Electron**](https://www.electronjs.org) | the desktop runtime | MIT |
| [`uiohook-napi`](https://github.com/SnosMe/uiohook-napi) | global push to talk and keybinds | MIT |
| [`sharp`](https://sharp.pixelplumbing.com), [`png-to-ico`](https://github.com/steambap/png-to-ico), [`electron-builder`](https://www.electron.build) | icon generation and packaging, build only | Apache-2.0 and MIT |
| AutoTrackR2, citizenmon, and other community kill trackers | the `Game.log` line formats the killfeed matches are the ones these tools established | their own |

`fluxer-client` ships without an explicit license file. This fork is used and
distributed in good faith as a community wrapper of AGPL software, with full
credit above. Check with the original author before redistributing.

**Star Citizen&reg;**, **Squadron 42&reg;**, **Roberts Space Industries&reg;**,
and **Cloud Imperium&reg;** are trademarks of Cloud Imperium Rights LLC. This is
an unofficial fan project and is not affiliated with or endorsed by Cloud
Imperium Games.

## License

Copyright &copy; 2026 Fighters Guild. Licensed under the
[GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html), see [`LICENSE`](LICENSE).
The Fluxer platform it connects to is likewise AGPL-3.0.
