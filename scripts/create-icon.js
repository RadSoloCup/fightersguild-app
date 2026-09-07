const sharp = require('sharp')
const pngToIco = require('png-to-ico')
const fs = require('fs')
const path = require('path')

const assetsDir = path.join(__dirname, '..', 'assets')

// ── Fighters Guild mark ──────────────────────────────────────────────────────
// Round medallion with bold crossed swords. One shape, recoloured per state:
//   gold  → app / not in voice        green → in voice, mic live
//   red   → in voice, muted
// Tray art fills more of the circle (less padding) so it reads at 16–24 px.

function swords(color, glow) {
  const g = glow
    ? `<circle cx="128" cy="128" r="86" fill="${color}" opacity="0.14"/>`
    : ''
  // vertical sword centred on 128,128; drawn twice, rotated ±45°
  const blade = rot => `<g transform="rotate(${rot} 128 128)">
      <path d="M128 30 L116 52 L116 150 L140 150 L140 52 Z" fill="${color}"/>
      <rect x="86" y="150" width="84" height="17" rx="8" fill="${color}"/>
      <rect x="119" y="165" width="18" height="46" rx="9" fill="${color}"/>
      <circle cx="128" cy="216" r="13" fill="${color}"/>
    </g>`
  return g + blade(45) + blade(-45)
}

function medallion({ ring, fill, mark, glow = false, pad = 0 }) {
  const r = 120 - pad
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <defs>
      <radialGradient id="bg" cx="38%" cy="32%" r="80%">
        <stop offset="0%" stop-color="#2c2722"/>
        <stop offset="100%" stop-color="#121010"/>
      </radialGradient>
    </defs>
    <circle cx="128" cy="128" r="${r}" fill="url(#bg)" stroke="${ring}" stroke-width="10"/>
    ${glow ? swords(fill, true) : ''}
    ${swords(mark, false)}
  </svg>`
}

// state palettes
const GOLD  = '#c9a227'
const GREEN = '#3fbf5f'
const RED   = '#e0483d'

const variants = {
  icon:        medallion({ ring: '#8a6f1e', fill: GOLD,  mark: GOLD,  pad: 4 }),   // app icon
  'tray-idle': medallion({ ring: '#7a6520', fill: GOLD,  mark: GOLD,  pad: 0 }),
  'tray-live': medallion({ ring: '#2e7d43', fill: GREEN, mark: GREEN, glow: true, pad: 0 }),
  'tray-muted':medallion({ ring: '#9e2f27', fill: RED,   mark: RED,   glow: true, pad: 0 }),
}

async function build() {
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

  // App icon: big PNG (mac needs >=512) + multi-size ICO for Windows
  const iconSvg = Buffer.from(variants.icon)
  fs.writeFileSync(path.join(assetsDir, 'icon.png'),
    await sharp(iconSvg).resize(1024, 1024).png().toBuffer())
  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const icoBufs = await Promise.all(
    icoSizes.map(s => sharp(iconSvg).resize(s, s).png().toBuffer()))
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), await pngToIco(icoBufs))
  console.log('  icon.png / icon.ico')

  // Tray icons: 32 and 64 px PNGs (64 = @2x for HiDPI trays)
  for (const [name, svg] of Object.entries(variants)) {
    if (name === 'icon') continue
    const buf = Buffer.from(svg)
    fs.writeFileSync(path.join(assetsDir, `${name}.png`),
      await sharp(buf).resize(32, 32).png().toBuffer())
    fs.writeFileSync(path.join(assetsDir, `${name}@2x.png`),
      await sharp(buf).resize(64, 64).png().toBuffer())
    console.log(`  ${name}.png / ${name}@2x.png`)
  }

  // Small mark for the in-window title bar (injected as a CSS data URI).
  fs.writeFileSync(path.join(assetsDir, 'titlebar.png'),
    await sharp(iconSvg).resize(48, 48).png().toBuffer())
  console.log('  titlebar.png')
}

build()
  .then(() => console.log('Icons ready.'))
  .catch(err => { console.error('Icon creation failed:', err.message); process.exit(1) })
