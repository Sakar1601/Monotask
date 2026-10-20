// Renders the PWA icon set from the favicon glyph. Run: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';

const BG = '#121212';
const FG = '#fafafa';

// `scale` sizes the glyph inside the 64-unit canvas; maskable icons keep it
// inside the central 80% safe zone so OS masks (circle/squircle) never clip it.
const svg = (scale) => {
  const offset = (64 - 24 * scale) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${BG}"/>
  <g fill="none" stroke="${FG}" stroke-width="${5 / scale}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="m9 11 3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </g>
</svg>`);
};

const targets = [
  ['public/pwa-192.png', 192, 1.9],
  ['public/pwa-512.png', 512, 1.9],
  ['public/pwa-maskable-512.png', 512, 1.5],
  ['public/apple-touch-icon.png', 180, 1.9],
];

for (const [file, size, scale] of targets) {
  await sharp(svg(scale), { density: 384 }).resize(size, size).png().toFile(file);
  console.log('wrote', file);
}
