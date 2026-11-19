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
- [ ] game/index.html rewritten (import map, HUD DOM, bible CSS)
- [ ] game/src/main.js rewritten as 3D boot (menus, loop, enter/exit, shots)
- [ ] game/src/input.js rewritten (keys + mouse orbit + actions)
- [ ] Dead 2D starter code removed (render.js, random.js)
- [ ] main.ts adapted (San Amaro description, ≥1 line by this session)
- [ ] README.md created (3 live make.fun badges); GitHub About set
      (website https://make.fun/bounty/gta6-01, topic makefun)
- [ ] shots.json updated to ?shot=1..4
- [ ] Explorable Downtown Core on foot + by vehicle, day/night, fog, shadows
- [ ] Steal/drive 4+ vehicle types, arcade handling, damage feedback
- [ ] Playwright visual loop: ≥3 angles, 2 times of day, critique + fix
- [ ] Zero console errors, zero network requests, 30+ FPS
- [ ] 4 real screenshots in screenshots/ (each a different feature)
- [ ] Kit check passes (`check --kit . --repo <repo>`)

## Later slices (not this session)
- [ ] Features 3-9: traffic/peds, wanted/police, missions/story, combat,
      HUD+minimap, menu+save, polish
- [ ] Submission 2: 3 districts (Downtown Core + The Strip + Harbor Docks)
- [ ] Differentiators: dynamic rain/storm, garage customization, photo mode
- [ ] Submit #1 (after Mu reviews the preview)
