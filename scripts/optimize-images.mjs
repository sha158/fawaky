/**
 * optimize-images.mjs
 * Generates width-capped WebP next to every source PNG/JPEG in /assets.
 * Run: npm run images
 *
 * Originals are kept (used as <picture> fallback). WebP files are committed.
 * Reused images are capped at their LARGEST on-page usage.
 */
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');
const QUALITY = 78;
const DEFAULT_MAX_W = 1400;

// Per-file width caps keyed by basename. Sized to the largest place each image
// is rendered. Reused images keep the larger cap. Unlisted → DEFAULT_MAX_W.
const MAX_WIDTH = {
  '0877bdbc-dd73-4b40-8724-a7de28cd0f7d.png': 1600, // hero can (LCP)
  '03ba4d14-eb39-468c-ab8a-725a46e096a8.png': 1600, // product-hero bg + social
  '6e99ca7a-fbb6-477a-82b4-0068844efb2a.png': 1600, // seasonal bg + social + reels poster
  '4c89619e-9937-463a-afef-5cbf7f083339.png': 1400, // bestseller spotlight
  '5ab237ed-f3c6-4fef-9659-9df92f358054.png': 1400, // featured showcase centerpiece + reels
  '47ba710b-a1e7-499c-b20c-2ecb95286aa8.png': 1400, // seasonal visual + reels poster
  '67b3ae11-2d90-4e86-8527-d7f2f6373837.png': 1200, // frost/ice texture (showcase, wholesale)
  'df010659-d1be-4823-9680-d7c3e138cf5f.png': 1400, // ingredients + showcase nungu float
  '8475ba77-c5c8-4bea-b38f-e121544ca16d.png': 1400, // ingredients + showcase nata float
  'ice-apple-hero.jpeg': 1400, // benefits hero band (ice apple)
  'bestseller-can.jpeg': 1400, // bestseller spotlight
  'about-can.jpeg': 1400, // about / our story
  'showcase-can.jpeg': 1400, // showcase / freshly chilled
  'social-violet.jpeg': 900, // social grid tile (extra)
  'cashew-splash.jpeg': 1000, // benefits support card (cashew)
  'tender-coconut-malai.jpeg': 1000, // benefits support card (tender coconut malai)
  'milk-splash.jpeg': 1000, // benefits support card (milk)
  'give_me_different_flavours_like_202606051453.jpeg': 900,
  'give_me_different_flavours_like_202606051453 (1).jpeg': 900,
  'give_me_different_flavours_like_202606051453 (2).jpeg': 900,
  'give_me_different_flavours_like_202606051453 (3).jpeg': 900,
};

const SRC_RE = /\.(png|jpe?g)$/i;
const kb = (b) => (b / 1024).toFixed(0) + ' KB';

const files = (await readdir(ASSETS)).filter((f) => SRC_RE.test(f));
if (!files.length) {
  console.log('No source images found in /assets.');
  process.exit(0);
}

let totalIn = 0;
let totalOut = 0;

for (const file of files) {
  const src = path.join(ASSETS, file);
  const out = path.join(ASSETS, file.replace(SRC_RE, '.webp'));
  const maxW = MAX_WIDTH[file] ?? DEFAULT_MAX_W;

  const inSize = (await stat(src)).size;
  await sharp(src)
    .rotate()
    .resize({ width: maxW, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);
  const outSize = (await stat(out)).size;

  totalIn += inSize;
  totalOut += outSize;
  const pct = (100 - (outSize / inSize) * 100).toFixed(0);
  console.log(
    `${file.padEnd(54)} ${kb(inSize).padStart(9)} → ${kb(outSize).padStart(8)}  (-${pct}%, ${maxW}px)`
  );
}

console.log('─'.repeat(86));
console.log(
  `TOTAL ${kb(totalIn)} → ${kb(totalOut)}  ` +
    `(saved ${kb(totalIn - totalOut)}, -${(100 - (totalOut / totalIn) * 100).toFixed(0)}%)`
);
