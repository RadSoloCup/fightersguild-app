// Star Citizen killfeed — tails Game.log, extracts kill / death / vehicle
// events, and posts them to a Fluxer channel webhook. Opt-in, per-user.
//
// Log-line patterns are the ones the community kill-tracker tools use
// (AutoTrackR2 / citizenmon), current as of SC 4.x.

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { app } = require('electron')

const DEFAULT = {
  enabled: false,
  logPath: null,
  webhookUrl: null,
  username: null,        // your SC handle — auto-filled from the log's login line
  postKills: true,       // kills you get
  postDeaths: true,      // your deaths
  postNpc: false,        // include NPC / PvE
  postWitnessed: false,  // kills you weren't part of
  postSession: false,    // "started playing"
  postServer: true,      // which server / shard you joined
}

const RE = {
  login: /<Legacy login response> \[CIG-net\] User Login Success - Handle\[([A-Za-z0-9_-]+)\]/,
  loginAlt: /<AccountLoginCharacterStatus_Character> Character:.* - name ([A-Za-z0-9_-]+) - state STATE_CURRENT/,
  kill: /<Actor Death> CActor::Kill: '([^']+)' \[\d+\] in zone '([^']*)' killed by '([^']+)' \[[^\]]*\] using '([^']+)' \[Class ([^\]]+)\] with damage type '([^']+)'/,
  vehicle: /<Vehicle Destruction> CVehicle::OnAdvanceDestroyLevel: Vehicle '([^']+)' \[\d+\] in zone '([^']*)'[^]*?(?:caused by '([^']+)'|advanced from destroy level \d+ to (\d+))/,
  ship: /<Jump Drive State Changed>[^]*?adam: (.+?) in /,
  channel: /[\\/](LIVE|PTU|EPTU|HOTFIX|TECH-PREVIEW)[\\/]Game\.log$/i,
  // <Join PU> address[..] port[..] shard[pub_use1b_12030094_140] locationId[..]
  joinPu: /<Join PU> address\[([0-9.]+)\] port\[\d+\] shard\[(([a-z]+)_([a-z]+\d+[a-z])_\d+_(\d+))\]/i,
  // <Update Shard Id> New Shard Id: pub_use1b_12030094_140. Old Shard Id [..]  (mesh handoff / relog)
  shardUpdate: /New Shard Id:\s*(([a-z]+)_([a-z]+\d+[a-z])_\d+_(\d+))/i,
  shard: /Shard Id:\s*([a-z0-9_]+)/i, // fallback (older format, no instance)
  branch: /Branch:\s*\S*?(\d+\.\d+\.\d+[\w.-]*)/,
  // --system-trace-env-id='pub-sc-alpha-4100-12030094'
  //   4100 → 4.10.0 (major / 2-digit minor / patch), 12030094 → changelist
  versionEnv: /sc-alpha-(\d)(\d\d)(\d)-(\d+)/i,
  disconnect: /<Channel Disconnected>\s*cause=(\d+)\s*reason="([^"]*)"/,
  frontend: /Loading screen for Frontend_Main/,
}

// how long a "left" is held before posting — cancelled by any re-join in the
// window (SC's PU load bounces the connection, which isn't a real leave)
const LEAVE_DEBOUNCE_MS = 30_000
// re-announcing the same server within this window is treated as a reconnect
const REJOIN_QUIET_MS = 5 * 60_000

// region code prefix → friendly name.  use1b → US-East, euw1a → EU-West, …
const REGION = {
  euw: 'EU-West', euc: 'EU-Central', use: 'US-East', usw: 'US-West',
  aus: 'Australia', apse: 'Asia-SE', apne: 'Asia-NE', sae: 'S. America',
}
function regionOf(shard) {
  if (!shard || shard === 'local_shard') return null
  const m = shard.match(/^(?:pub|ptu|eptu)_([a-z]+)/)
  if (!m) return shard
  for (const k of Object.keys(REGION)) if (m[1].startsWith(k)) return REGION[k]
  return shard
}
// pub_use1b_12030094_140  →  "use1b-140"  (region code + server instance)
function serverNameOf(shard) {
  if (!shard) return null
  const m = shard.match(/^[a-z]+_([a-z]+\d+[a-z])_\d+_(\d+)$/i)
  return m ? `${m[1]}-${m[2]}` : (shard === 'local_shard' ? null : shard)
}

// entity names that are never real players
const NPC = /^(PU_|NPC_|AIModule|Kopion|Marok|Quasi|ArchBishop|PU_Human|PU_Pilots|Hunter_|SM_|GameMode|Kareah|unknown$|Kopion|creature_|Frigate|Root|ai_)/i

let cfg = { ...DEFAULT }
let statusCb = () => {}
let poll = null
let offset = 0
let tail = ''
let curArea = null
let curShard = null
let curServerIp = null
let curBranch = null      // "4.10.0-live" if the Branch: line appears
let curVersion = null     // "4.10.0" from the trace-env line
let curChangelist = null  // "12030094"
let announcedShard = null
let announcedAt = 0
let leaveTimer = null
let seen = []           // recent line signatures for de-dup
let queue = []
let sending = false

function file() { return path.join(app.getPath('userData'), 'killtracker.json') }
function persist() { try { fs.writeFileSync(file(), JSON.stringify(cfg)) } catch {} }

function load() {
  try { cfg = { ...DEFAULT, ...JSON.parse(fs.readFileSync(file(), 'utf8')) } } catch { cfg = { ...DEFAULT } }
  return cfg
}

function status() {
  let running = !!poll
  let logOk = false
  try { logOk = !!cfg.logPath && fs.existsSync(cfg.logPath) } catch {}
  return {
    enabled: cfg.enabled, running, logPath: cfg.logPath, logOk,
    webhookSet: !!cfg.webhookUrl, username: cfg.username,
    channel: cfg.logPath && (cfg.logPath.match(RE.channel) || [])[1] || null,
    shard: curShard, region: regionOf(curShard), server: serverNameOf(curShard),
    build: buildLabel(),
  }
}

// ── install / Game.log detection ───────────────────────────────────────────
function detectLogPath() {
  const channels = ['LIVE', 'PTU', 'EPTU', 'HOTFIX', 'TECH-PREVIEW']
  const bases = new Set()
  try {
    const dir = path.join(app.getPath('appData'), 'rsilauncher', 'logs')
    for (const f of fs.readdirSync(dir)) {
      let t = ''
      try { t = fs.readFileSync(path.join(dir, f), 'utf8') } catch { continue }
      const re = /([A-Za-z]:\\{1,2}(?:[^"\\\r\n]+\\{1,2})*StarCitizen)\\{1,2}(?:LIVE|PTU|EPTU|HOTFIX|TECH-PREVIEW)/g
      let m
      while ((m = re.exec(t))) bases.add(m[1].replace(/\\\\/g, '\\'))
    }
  } catch {}
  bases.add('C:\\Program Files\\Roberts Space Industries\\StarCitizen')
  for (const d of ['C', 'D', 'E', 'F', 'G']) {
    bases.add(`${d}:\\RSI\\StarCitizen`)
    bases.add(`${d}:\\Games\\StarCitizen`)
    bases.add(`${d}:\\StarCitizen`)
  }
  const found = []
  for (const b of bases) for (const c of channels) {
    const p = path.join(b, c, 'Game.log')
    try { found.push({ p, m: fs.statSync(p).mtimeMs }) } catch {}
  }
  found.sort((a, b) => b.m - a.m)
  return found[0] ? found[0].p : null
}

// ── public API ─────────────────────────────────────────────────────────────
function init(cb) {
  statusCb = typeof cb === 'function' ? cb : () => {}
  load()
  if (!cfg.logPath) { const d = detectLogPath(); if (d) cfg.logPath = d, persist() }
  if (cfg.enabled) start()
  statusCb(status())
}

function setConfig(patch) {
  cfg = { ...cfg, ...patch }
  persist()
  stop()
  if (cfg.enabled) start()
  statusCb(status())
  return status()
}

function getConfig() { return { ...cfg } }

function start() {
  stop()
  if (!cfg.logPath) return
  offset = 0; tail = ''; seen = []
  curArea = curShard = curServerIp = curBranch = curVersion = curChangelist = announcedShard = null
  announcedAt = 0
  try { offset = fs.statSync(cfg.logPath).size } catch { offset = 0 } // start at the end — only new lines
  poll = setInterval(pump, 2000)
  statusCb(status())
}

function stop() {
  if (poll) clearInterval(poll)
  poll = null
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
}

// ── tail loop ──────────────────────────────────────────────────────────────
function pump() {
  let size
  try { size = fs.statSync(cfg.logPath).size } catch { return }
  if (size === offset) return
  if (size < offset) { // log recreated → new game session
    offset = 0; tail = ''
    curArea = curShard = curServerIp = announcedShard = null
    announcedAt = 0
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
    onSessionStart()
  }
  let buf
  try {
    const fd = fs.openSync(cfg.logPath, 'r')
    const len = size - offset
    buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, offset)
    fs.closeSync(fd)
  } catch { return }
  offset = size
  const text = tail + buf.toString('utf8')
  const lines = text.split('\n')
  tail = lines.pop() || ''
  for (const line of lines) handleLine(line)
}

function sig(line) { return line.replace(/^<[^>]+>\s*/, '').slice(0, 160) }

function handleLine(line) {
  let m
  if ((m = line.match(RE.login) || line.match(RE.loginAlt))) {
    if (m[1] && m[1] !== cfg.username) { cfg.username = m[1]; persist(); statusCb(status()) }
    return
  }
  if ((m = line.match(RE.branch))) { curBranch = m[1]; return }
  if ((m = line.match(RE.versionEnv))) {
    curVersion = `${m[1]}.${parseInt(m[2], 10)}.${m[3]}` // 4 / "10" / 0 → 4.10.0
    curChangelist = m[4]
    return
  }
  {
    const j = line.match(RE.joinPu)
    const u = j ? null : line.match(RE.shardUpdate)
    const s = (!j && !u) ? line.match(RE.shard) : null
    const shard = j?.[2] || u?.[1] || s?.[1]
    if (shard) {
      if (j?.[1]) curServerIp = j[1]
      const clFromShard = shard.match(/_(\d{7,})_\d+$/)
      if (clFromShard && !curChangelist) curChangelist = clFromShard[1]
      onShard(shard)
      return
    }
  }
  if (line.match(RE.frontend) || line.match(RE.disconnect)) { onMaybeLeave(); return }
  if ((m = line.match(RE.ship))) { return } // (loadout tracking — unused for now)

  if ((m = line.match(RE.kill))) {
    const s = sig(line)
    if (seen.includes(s)) return
    seen.push(s); if (seen.length > 200) seen.shift()

    const [, victimRaw, victimZone, killerRaw, weaponRaw, , dmgType] = m
    const victim = clean(victimRaw)
    const killer = clean(killerRaw)
    const weapon = clean(weaponRaw)
    if (victimZone) curArea = clean(victimZone)

    const me = (cfg.username || '').toLowerCase()
    const vLow = victimRaw.toLowerCase(), kLow = killerRaw.toLowerCase()
    const npc = NPC.test(victimRaw) || NPC.test(killerRaw) || /_\d{6,}$/.test(victimRaw) || /_\d{6,}$/.test(killerRaw)

    let kind, text
    if (me && vLow === me && kLow === me) { kind = 'self'; text = `**${victim}** died (${dmgType || 'self'})` }
    else if (me && kLow === me) { kind = 'kill'; text = `**${cfg.username}** killed **${victim}**` }
    else if (me && vLow === me) { kind = 'death'; text = `**${killer}** killed **${cfg.username}**` }
    else { kind = 'witness'; text = `**${killer}** killed **${victim}**` }

    if (kind === 'kill' && !cfg.postKills) return
    if ((kind === 'death' || kind === 'self') && !cfg.postDeaths) return
    if (kind === 'witness' && !cfg.postWitnessed) return
    if (npc && !cfg.postNpc && kind !== 'death' && kind !== 'self') return

    post(embedFor(kind, text, { weapon, dmgType, area: curArea, victimZone: clean(victimZone) }))
  }
}

function clean(name) {
  if (!name) return name
  return String(name)
    .replace(/_\d{4,}$/, '')
    .replace(/-\d{3,}$/, '')
    .replace(/^(AEGS|ANVL|ARGO|BANU|CNOU|CRUS|DRAK|ESPR|GRIN|KRIG|MISC|ORIG|RSI|VNCL|XIAN|XNAA)_/i, m => m.slice(0, -1) + ' ')
    .replace(/_(PU|AI|CIV|MIL|PIR)$/i, '')
    .replace(/_/g, ' ')
    .trim()
}

function embedFor(kind, text, x) {
  const color = kind === 'kill' ? 0x3fbf5f : (kind === 'death' || kind === 'self') ? 0xe0483d : 0x8a8f98
  const icon = kind === 'kill' ? '⚔' : (kind === 'death' || kind === 'self') ? '💀' : '☠'
  const fields = []
  if (x.weapon && x.weapon !== 'unknown') fields.push({ name: 'Weapon', value: x.weapon, inline: true })
  if (x.dmgType && x.dmgType !== 'unknown') fields.push({ name: 'Damage', value: x.dmgType, inline: true })
  if (x.area) fields.push({ name: 'Area', value: x.area, inline: true })
  const region = regionOf(curShard)
  const server = serverNameOf(curShard)
  if (region || server) {
    fields.push({ name: 'Server', value: [server && '`' + server + '`', region].filter(Boolean).join(' · '), inline: true })
  }
  return {
    username: 'Star Citizen',
    embeds: [{
      description: `${icon} ${text}`,
      color, fields,
      footer: { text: `Star Citizen killfeed${status().channel ? ' · ' + status().channel : ''}` },
      timestamp: new Date().toISOString(),
    }],
  }
}

function onSessionStart() {
  if (cfg.postSession && cfg.username && cfg.webhookUrl) {
    post({
      username: 'Star Citizen',
      embeds: [{ description: `🎮 **${cfg.username}** is now playing Star Citizen`, color: 0xc9a227 }],
    })
  }
}

function buildLabel() {
  if (curVersion && curChangelist) return `${curVersion} (${curChangelist})`
  if (curVersion) return curVersion
  if (curBranch) return curBranch
  if (curChangelist) return `build ${curChangelist}`
  return null
}

// Called for every shard line. Coalesces the connection bounce SC does while
// loading the PU (join → brief disconnect → join same shard) into one post.
function onShard(shard) {
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null } // a join cancels a pending "left"
  const changed = shard !== curShard
  curShard = shard
  if (changed) statusCb(status())
  if (!cfg.postServer || !cfg.username || !/^(pub|ptu|eptu)_/.test(shard)) return

  const sameAsAnnounced = shard === announcedShard && (Date.now() - announcedAt) < REJOIN_QUIET_MS
  if (sameAsAnnounced) return // reconnect / load bounce — already announced this server

  announcedShard = shard
  announcedAt = Date.now()

  const region = regionOf(shard)
  const server = serverNameOf(shard)
  const ptu = /^(ptu|eptu)_/.test(shard)
  const fields = []
  if (server) fields.push({ name: 'Server', value: '`' + server + '`', inline: true })
  fields.push({ name: 'Shard', value: '`' + shard + '`', inline: true })
  if (region) fields.push({ name: 'Region', value: region + (ptu ? ' · PTU' : ''), inline: true })
  const build = buildLabel()
  if (build) fields.push({ name: 'Build', value: build, inline: true })
  post({
    username: 'Star Citizen',
    embeds: [{
      description: `🛰️ **${cfg.username}** joined **${server || region || 'a server'}**`,
      color: 0x22a7e0, fields,
      footer: { text: `Star Citizen${status().channel ? ' · ' + status().channel : ''}` },
      timestamp: new Date().toISOString(),
    }],
  })
}

// A "Frontend_Main" load or a channel-disconnect line. SC bounces the
// connection during a normal PU load, so hold the "left" for 30s — any join in
// that window cancels it.
function onMaybeLeave() {
  if (!curShard || !/^(pub|ptu|eptu)_/.test(curShard)) { curShard = null; return }
  if (leaveTimer) return
  const was = serverNameOf(curShard) || regionOf(curShard)
  leaveTimer = setTimeout(() => {
    leaveTimer = null
    curShard = null; curServerIp = null; announcedShard = null
    statusCb(status())
    if (cfg.postServer && cfg.username) {
      post({
        username: 'Star Citizen',
        embeds: [{ description: `📴 **${cfg.username}** left the server${was ? ` (${was})` : ''}`, color: 0x8a8f98 }],
      })
    }
  }, LEAVE_DEBOUNCE_MS)
}

// ── webhook queue ──────────────────────────────────────────────────────────
function post(payload) {
  if (!cfg.webhookUrl) return
  queue.push(payload)
  if (queue.length > 25) queue.splice(0, queue.length - 25)
  drain()
}

function drain() {
  if (sending || !queue.length) return
  sending = true
  const payload = queue.shift()
  send(cfg.webhookUrl, payload).catch(() => {}).finally(() => {
    setTimeout(() => { sending = false; drain() }, 1500)
  })
}

function send(url, payload) {
  return new Promise((resolve, reject) => {
    let u
    try { u = new URL(url) } catch { return reject(new Error('bad url')) }
    const isLocal = u.hostname === '127.0.0.1' || u.hostname === 'localhost'
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLocal)) {
      return reject(new Error('https only'))
    }
    const lib = u.protocol === 'http:' ? http : https
    const body = Buffer.from(JSON.stringify(payload))
    const req = lib.request(u, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': body.length, 'user-agent': 'FightersGuild' },
    }, res => { res.resume(); res.statusCode < 300 ? resolve() : reject(new Error('HTTP ' + res.statusCode)) })
    req.setTimeout(15000, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end(body)
  })
}

async function test() {
  if (!cfg.webhookUrl) throw new Error('Set a webhook URL first')
  await send(cfg.webhookUrl, {
    username: 'Star Citizen',
    embeds: [{ description: '⚔ Killfeed test — **you** killed **a test dummy**', color: 0x3fbf5f,
      footer: { text: 'Star Citizen killfeed' } }],
  })
}

module.exports = { init, start, stop, setConfig, getConfig, status, detectLogPath, test }
