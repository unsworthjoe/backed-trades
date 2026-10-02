// Regenerate after changing the brand colour (keep these values in sync with src/constants/theme.ts):
//   npm install --no-save opentype.js sharp
//   node scripts/build-brand-assets.js .

// Builds Backed. logo SVGs (text converted to outlines) and app icon PNGs.
// Writes assets/brand/*.svg, the app icon, Android icon layers, splash image, favicon and iOS icon layer.
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const sharp = require('sharp');

const root = process.argv[2];
const fontFile = path.join(root, 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf');
const font = opentype.parse(fs.readFileSync(fontFile).buffer.slice(0));

const C = {
  brand: '#8A3FFC',
  brandDark: '#A877FF',
  lilac: '#D9C6FF',
  ink: '#16181C',
  white: '#FFFFFF',
};

const brandDir = path.join(root, 'assets/brand');
const imgDir = path.join(root, 'assets/images');
const iosDir = path.join(root, 'assets/expo.icon/Assets');
fs.mkdirSync(brandDir, { recursive: true });

// opentype's toPathData mis-formats some round numbers as NaN, so serialise commands ourselves.
const n = (v) => String(Math.round(v * 100) / 100);
const toD = (p) =>
  p.commands
    .map((c) => {
      if (c.type === 'M' || c.type === 'L') return `${c.type}${n(c.x)} ${n(c.y)}`;
      if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      return 'Z';
    })
    .join('');

// Lay out a string with tracking (in em), returning path data and metrics.
function textPath(str, size, trackingEm) {
  const glyphs = font.stringToGlyphs(str);
  const scale = size / font.unitsPerEm;
  let x = 0;
  let d = '';
  glyphs.forEach((g, i) => {
    d += toD(font.getPath(str[i], x, 0, size, { kerning: false }));
    let adv = g.advanceWidth * scale;
    if (i < glyphs.length - 1) adv += font.getKerningValue(g, glyphs[i + 1]) * scale;
    x += adv + trackingEm * size;
  });
  const bb = font.getPath(str, 0, 0, size).getBoundingBox();
  return { d, width: x - trackingEm * size, top: bb.y1, bottom: bb.y2 };
}

// Tick path drawn inside a 34-unit circle, as in the design canvas.
const tick = (cx, cy, r, color) => {
  const s = (2 * r) / 34;
  const p = (x, y) => `${(cx - r + x * s).toFixed(2)} ${(cy - r + y * s).toFixed(2)}`;
  return `<path d="M${p(10, 17.5)} L${p(14.5, 22)} L${p(24, 12.5)}" fill="none" stroke="${color}" stroke-width="${(3.5 * s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

// Wordmark: "Backed" + full stop that doubles as a tick.
function wordmark({ textColor, dotColor, tickColor, knockout = false }) {
  const size = 200;
  const t = textPath('Backed', size, -0.036);
  const dotD = 0.29 * size;
  const gap = 0.055 * size;
  const r = dotD / 2;
  const cx = t.width + gap + r;
  const cy = -r; // dot sits on the baseline
  const pad = 8;
  const minX = -pad;
  const minY = Math.floor(t.top) - pad;
  const w = Math.ceil(cx + r + pad - minX);
  const h = Math.ceil(t.bottom + pad - minY);
  let dot;
  if (knockout) {
    dot = `<mask id="m"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#fff"/>${tick(cx, cy, r, '#000')}</mask><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${dotColor}" mask="url(#m)"/>`;
  } else {
    dot = `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${dotColor}"/>${tick(cx, cy, r, tickColor)}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}"><title>Backed.</title><path d="${t.d}" fill="${textColor}"/>${dot}</svg>\n`;
}

// Monogram "B." centred in a square canvas. `scale` = B cap height as a share of the canvas.
function monogram({ canvas, scale, bColor, dotColor, bg, radius = 0 }) {
  const probe = textPath('B', 100, 0);
  const capH = probe.bottom - probe.top;
  const size = (canvas * scale * 100) / capH;
  const b = textPath('B', size, 0);
  const r = 0.096 * size; // dot diameter ≈ 0.192em
  const gap = 0.038 * size;
  const groupW = b.width + gap + 2 * r;
  const groupH = b.bottom - b.top;
  const ox = (canvas - groupW) / 2;
  const oy = (canvas - groupH) / 2 - b.top;
  const cx = b.width + gap + r;
  const cy = -r;
  const bgRect = bg ? `<rect width="${canvas}" height="${canvas}" rx="${radius}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}" width="${canvas}" height="${canvas}">${bgRect}<g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)})"><path d="${b.d}" fill="${bColor}"/><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${dotColor}"/></g></svg>\n`;
}

const write = (file, svg) => fs.writeFileSync(file, svg);
const png = (svg, file, size) => sharp(Buffer.from(svg)).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(file);

(async () => {
  // Master SVGs
  write(path.join(brandDir, 'backed-wordmark.svg'), wordmark({ textColor: C.ink, dotColor: C.brand, tickColor: C.white }));
  write(path.join(brandDir, 'backed-wordmark-reversed.svg'), wordmark({ textColor: C.white, dotColor: C.brandDark, tickColor: C.ink }));
  write(path.join(brandDir, 'backed-wordmark-mono.svg'), wordmark({ textColor: '#000000', dotColor: '#000000', knockout: true }));
  write(path.join(brandDir, 'backed-wordmark-white.svg'), wordmark({ textColor: C.white, dotColor: C.white, tickColor: C.brand }));
  write(path.join(brandDir, 'backed-mark.svg'), monogram({ canvas: 1024, scale: 0.5, bColor: C.white, dotColor: C.lilac, bg: C.brand, radius: 230 }));
  write(path.join(brandDir, 'backed-mark-mono.svg'), monogram({ canvas: 1024, scale: 0.5, bColor: '#000000', dotColor: '#000000' }));

  // App icon (square, no rounding: iOS and Android apply their own masks)
  await png(monogram({ canvas: 1024, scale: 0.5, bColor: C.white, dotColor: C.lilac, bg: C.brand }), path.join(imgDir, 'icon.png'), 1024);
  // Android adaptive icon layers: keep the mark inside the central safe zone
  await png(monogram({ canvas: 1024, scale: 0.34, bColor: C.white, dotColor: C.lilac }), path.join(imgDir, 'android-icon-foreground.png'), 1024);
  await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${C.brand}"/></svg>`, path.join(imgDir, 'android-icon-background.png'), 1024);
  await png(monogram({ canvas: 1024, scale: 0.34, bColor: C.white, dotColor: C.white }), path.join(imgDir, 'android-icon-monochrome.png'), 1024);
  // Splash: white wordmark on the purple splash background
  const splash = wordmark({ textColor: C.white, dotColor: C.white, tickColor: C.brand });
  await sharp(Buffer.from(splash)).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(imgDir, 'splash-icon.png'));
  // Web favicon
  await png(monogram({ canvas: 1024, scale: 0.5, bColor: C.white, dotColor: C.lilac, bg: C.brand, radius: 230 }), path.join(imgDir, 'favicon.png'), 196);
  // iOS Icon Composer layer: the mark alone on transparent; the fill colour lives in icon.json
  write(path.join(iosDir, 'backed-mark.svg'), monogram({ canvas: 1024, scale: 0.5, bColor: C.white, dotColor: C.lilac }));
  console.log('done');
})();
