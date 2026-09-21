/**
 * make-map-pin.mjs
 * Builds the Fawaky Stations map marker: the product can inside a brand-purple
 * teardrop, matching the fawaky-stations-map-*.png mockups.
 * Run: npm run map-pin
 *
 * Output is @2x (retina). The map renders it at half size via scaledSize.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');

const CAN = path.join(ASSETS, '0877bdbc-dd73-4b40-8724-a7de28cd0f7d.png');
const OUT = path.join(ASSETS, 'map-pin.png');

// @2x geometry. Logical size is half this: 56x70.
const W = 112;
const H = 140;
const CX = 56;
const CY = 52;
const R = 48;
const CAN_BOX = 70; // the can is contained in this square, centred on the bubble

const PURPLE = '#5E1F78';
const GREEN = '#92B83D';

// Symmetric teardrop: a full circle at (CX,CY) that tapers to a point at (CX,TIP).
const TIP = H - 4;
const shoulder = CY + R * 0.74; // where the taper leaves the circle
const waist = R * 0.42; // horizontal pull of the taper control points

const teardrop = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="s" x="-40%" y="-20%" width="180%" height="150%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#17001F" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M ${CX} ${TIP}
             C ${CX - waist} ${shoulder + 14} ${CX - R} ${shoulder} ${CX - R} ${CY}
             A ${R} ${R} 0 1 1 ${CX + R} ${CY}
             C ${CX + R} ${shoulder} ${CX + waist} ${shoulder + 14} ${CX} ${TIP}
             Z"
          fill="${PURPLE}"/>
    <circle cx="${CX}" cy="${CY}" r="${R - 6}" fill="#FFFFFF"/>
    <circle cx="${CX}" cy="${CY}" r="${R - 6}" fill="none" stroke="${GREEN}" stroke-width="2.5"/>
  </g>
</svg>`;

const base = await sharp(Buffer.from(teardrop)).png().toBuffer();

const can = await sharp(CAN)
  .resize(CAN_BOX, CAN_BOX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp(base)
  .composite([{ input: can, left: Math.round(CX - CAN_BOX / 2), top: Math.round(CY - CAN_BOX / 2) }])
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const { size } = await sharp(OUT).metadata().then(async (m) => ({ size: (await sharp(OUT).toBuffer()).length, ...m }));
console.log(`map-pin.png  ${W}x${H} @2x  ${(size / 1024).toFixed(1)} KB  ->  ${path.relative(ROOT, OUT)}`);
