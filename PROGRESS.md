# PROGRESS — SAN AMARO (make.fun gta6-01)

Source of truth for the world: `GAME_BIBLE.md` (rev 2, commit 78737d4).
Tick an item only after it is verified in the running game via Playwright.

## Step 0 — World bible
- [x] GAME_BIBLE.md filled completely (340 lines, commit ce959ad)
- [x] Bible rev 2 per Mu 19 Nov ~13:36: renames (Nadia Okafor / Palm & Piston /
      Auntie Mabel / Neon Tide 102.5 / SAMPD / Bay-12 / Lantern Blvd /
      Marina Sedan / Dragonfly / Flamingo), differentiators #2 dynamic
      rain-storm + #4 garage customization + #5 photo mode (stretch),
      S2 scope = 3 districts min (commit 78737d4, zero old names remain)

## HUD mockup (AGENTS.md §10 step 2)
- [x] mockups/hud.html built (bible UI language: tokens, glass panels,
      badges, keycaps, SVG icons + portraits)
- [x] Mockup rendered + Playwright-checked (no overlap, readable at small size)
      — round 2 clean: title + in-game views, 0 console errors.
      Shots: mockups/shots/mockup-title.png, mockups/shots/mockup-game.png.
      Fixes in round 2: menu spacing, roster name size, weapon slots widened
      to 88px, emoji icons replaced with inline SVG, switcher hidden via
      ?clean=1 for clean screenshots.

## Baseline — features 1-2 + HUD shell
- [x] game/index.html rewritten (import map, HUD DOM, bible CSS)
- [x] game/src/main.js rewritten as 3D boot (menus, loop, enter/exit, shots)
- [x] game/src/input.js rewritten (keys + mouse orbit + actions)
- [x] main.ts adapted (San Amaro description, ≥1 line by this session)
- [x] README.md created (3 live make.fun badges); GitHub About set
      (website https://make.fun/bounty/gta6-01, topic makefun)
- [x] shots.json updated to ?shot=1..4
- [x] Explorable Downtown Core on foot + by vehicle, day/night, fog, shadows
      — verified live: walk (W), day/night/sunset presets, fog, shadows.
- [x] Steal/drive cars, arcade handling, damage feedback
      — verified live: E steals parked sedan -> inCar, wanted 1, cruiser
      spawns + pursues; W drives (speed 3.3 m/s in headless test).
- [x] Playwright visual loop: 4 shots, 2 times of day, critique + fix
      — round 1: HUD clock wrong preset, night too dark, palm trunk blocked
      shots 3/4, street text low contrast. Round 2: all fixed, cruiser
      visible in shot 3 (BAY-12 14 m PURSUIT). Shots: mockups/shots/shot-1..4.png
      + gameplay-title.png + gameplay-drive.png.
- [x] Zero console errors (verified: 0 errors on all 4 shots + playtest;
      only headless ReadPixels warnings). Zero network requests at runtime
      (ES modules + vendored three.min.js only; kit check references gate).
- [ ] 30+ FPS on real hardware — NOT verifiable headless (SwiftShader ~1 FPS;
      fixed-step loop clamps to 0.25 s/frame, so the game slows down instead
      of breaking). Draw calls 127-171 (budget ≤250), tris 22-26K (budget ≤1.5M).
- [ ] 4 real screenshots in screenshots/ (each a different feature)
      — capture running (JPEG q80: 1-day, 2-night, 3-chase, 4-mission).
- [ ] Kit check passes (`check --kit . --repo <repo>`)
- [ ] Commit + push baseline; verify live quota; SUBMIT (Mu authorized 13:39:
      submit the baseline directly once it runs + passes kit check)

## Notes
- Dead 2D starter code (game/src/render.js, random.js) KEPT in place, NOT
  deleted — Mu 19 Nov ~13:39: never delete any file that is part of the
  recording. Harmless (well under game/ size + file caps).
- Submit authorization (Mu 19 Nov ~13:39): baseline may be submitted directly
  after it runs + passes the kit check, without waiting for his approval.
  Covers ONLY this early baseline entry.

## Later slices (not this session)
- [ ] Features 3-9: traffic/peds, wanted/police, missions/story, combat,
      HUD+minimap, menu+save, polish
- [ ] Submission 2: 3 districts (Downtown Core + The Strip + Harbor Docks)
- [ ] Differentiators: dynamic rain/storm, garage customization, photo mode
