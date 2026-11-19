// SAN AMARO — gta6-01 entry (re-authored 19 Nov 2026, Node 22, stdlib only).
// An original open-world crime game in Three.js, vendored under game/
// (game/vendor/three.min.js), that runs offline in desktop Chrome from
// static files (game/index.html and its ES modules, no library from a CDN
// and no network request at all). This program hands it in: it copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json — the summary the judge reads — with the vendored
// make.fun library (vendor/makefun-game.ts, byte for byte the kit's copy).
//
// The game: explore the Downtown Core slice of the fictional bay city San
// Amaro on foot and by stolen car, under a neon Miami-sunset sky; traffic
// and pedestrians, an SAMPD wanted level with police pursuit, the First
// Wheels mission with stage progress, combat with the Longshot rifle, a
// full HUD with minimap, a start screen and a localStorage save — all
// geometry, textures and audio generated procedurally in code, from the
// written re-author specification (no Rockstar name, logo, character, map
// or asset anywhere).
//
// Put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by
// name is the cover) and run it. Serve it locally for a quick look with a
// plain static server pointed at game/ (for example
// `python3 -m http.server 8080 --directory game`).
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { buildLayout, fixLayout, validationSummary } from './game/src/city-layout.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// City layout gate: the plan must validate clean (0 violations) before the
// entry is handed in. The validator FIXES violations (fixLayout), so a
// failure here means the layout itself is broken — fail fast and do not
// ship a city with buildings on roads, trees blocking paths, or furniture
// on the sidewalk. The result is written to /output/city-validation.json
// alongside the dossier, so the validation evidence travels with the entry.
const rawLayout = buildLayout(20261119);
const fixedLayout = fixLayout(rawLayout, 3);
if (!fixedLayout.report.passed) {
  throw new Error(`city layout: ${validationSummary(fixedLayout.report)}`);
}
const cityValidation = {
  passed: fixedLayout.report.passed,
  summary: validationSummary(fixedLayout.report),
  counts: fixedLayout.report.counts,
  byZone: fixedLayout.report.byZone,
  violations: fixedLayout.report.violations.length,
  fixesApplied: fixedLayout.passes,
};
console.log(`city layout: ${cityValidation.summary}`);

// The gate refuses more than 4 screenshots or any shot over 256 KiB, and a
// silent copy would only surface at submit — so fail fast here instead.
const shotDir = join(here, 'screenshots');
if (existsSync(shotDir)) {
  const shots = readdirSync(shotDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  if (shots.length > 4) throw new Error(`screenshots/: ${shots.length} shots, max 4`);
  // The gate needs 3-4 screenshots (the first by name is the cover); a set
  // of 1-2 would only surface as a refusal at submit, so fail here.
  if (shots.length < 3) throw new Error(`screenshots/: ${shots.length} shots, need 3 or 4`);
  for (const f of shots) {
    const size = statSync(join(shotDir, f)).size;
    if (size > 262144) throw new Error(`screenshots/${f}: ${size} bytes, max 262144`);
  }
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'city-validation.json'), JSON.stringify(cityValidation, null, 2) + '\n');
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48
// MiB of game files in all, or a path under game/ over 1000 bytes: game/
// counts beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
