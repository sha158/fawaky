import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/* Secrets live at ~/.config/fawaky/env — outside the repo, because this repo is public.
   On Vercel that file does not exist, so the build falls back to process.env. */
const SECRETS_PATH = join(homedir(), '.config', 'fawaky', 'env');

function localSecrets() {
  let raw;
  try {
    raw = readFileSync(SECRETS_PATH, 'utf8');
  } catch {
    return {}; // absent on CI/Vercel — process.env covers it
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 1) continue;
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export default defineConfig(() => {
  const local = localSecrets();
  const mapsKey = local.VITE_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!mapsKey) {
    console.warn('[fawaky] No VITE_GOOGLE_MAPS_API_KEY — the stations map will render its static fallback.');
  }

  return {
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsKey),
    },
  };
});
