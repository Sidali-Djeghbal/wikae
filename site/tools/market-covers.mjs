// Writes the geometric covers for the market snapshot: an eight-point star lattice, one palette per entry, no text or emoji.
// node site/tools/market-covers.mjs
import { writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src/assets/market/covers");
const palettes = {
  "deck-quran-mutashabihat": ["#06231d", "#0b3b2f", "#5fcf9f", "#d9b45a"],
  "deck-juz-amma": ["#07211f", "#0d3a37", "#6ad0c4", "#e0c47a"],
  "deck-jazariyyah": ["#0b1d2c", "#143451", "#7bb4e6", "#d9b45a"],
  "deck-arbaeen": ["#1a1428", "#2c2147", "#a99be0", "#d9b45a"],
  "deck-hisn-almuslim": ["#231a0c", "#3d2c12", "#e0b25f", "#9fd6b4"],
  "type-quran-mutashabihat": ["#06231d", "#0b3b2f", "#5fcf9f", "#d9b45a"],
  "type-ayah-order": ["#0b1d2c", "#143451", "#7bb4e6", "#9fd6b4"],
  "type-quran-match": ["#1a1428", "#2c2147", "#a99be0", "#9fd6b4"],
  "type-quran-cloze": ["#231a0c", "#3d2c12", "#e0b25f", "#9fd6b4"],
};
const star = (cx, cy, r, w, color, op) => {
  const sq = (a) => {
    const pts = [0, 1, 2, 3].map((i) => { const t = a + (i * Math.PI) / 2; return `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`; });
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linejoin="round"/>`;
  };
  return sq(Math.PI / 4) + sq(Math.PI / 2 - Math.PI / 2 + 0);
};
for (const f of readdirSync(dir)) if (f.endsWith(".svg")) unlinkSync(join(dir, f));
for (const [name, [bg1, bg2, a, b]] of Object.entries(palettes)) {
  let lattice = "";
  for (let y = 0; y <= 4; y++) for (let x = 0; x <= 7; x++) lattice += star(x * 100 + (y % 2 ? 50 : 0), y * 100, 46, 1.2, a, 0.16);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg1}"/></linearGradient>
<radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${a}" stop-opacity=".28"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient></defs>
<rect width="640" height="400" fill="url(#g)"/>
${lattice}
<circle cx="320" cy="200" r="190" fill="url(#h)"/>
${star(320, 200, 120, 2.5, b, 0.9)}
${star(320, 200, 84, 1.5, a, 0.75)}
<circle cx="320" cy="200" r="30" fill="none" stroke="${b}" stroke-width="2" stroke-opacity=".9"/>
<circle cx="320" cy="200" r="7" fill="${b}"/>
<rect x="16" y="16" width="608" height="368" rx="14" fill="none" stroke="${b}" stroke-opacity=".35" stroke-width="1.5"/>
</svg>
`;
  writeFileSync(join(dir, `${name}.svg`), svg);
}
