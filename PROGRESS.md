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
- [x] 4 real screenshots in screenshots/ (each a different feature)
      — 1-day.jpg (137 KB), 2-night.jpg (92 KB), 3-chase.jpg (163 KB),
      4-mission.jpg (160 KB); all 1280x720 JPEG, each <=256 KiB. Kit-starter
      JPGs removed. Verified visually (chase JPEG matches the PNG frame).
- [x] Kit check passes (`check --kit . --repo <repo>`)
      — 4 passed, 0 failed, 16 skipped, 5 at submission; snapshot 48 files,
      4,796,364 bytes at 84aca6eb. Re-run on the pushed commit.
- [x] Commit + push baseline (84aca6ebec714e668157e3b0670249b44d45cadd,
      origin HEAD confirmed); live quota verified 19 Nov ~07:07 WIB:
      day cap 3, taken 0, left 3; hard limit 20, left 18; can_submit true;
      entry fee null (free).
- [ ] SUBMIT — BLOCKED 19 Nov ~07:08 WIB (see note below). Recording
      01a1f275 still open; submit refuses an open recording. Per Mu's
      13:39 order the recording was NOT stopped — awaiting parent decision.

## Step 1 — LIGHTING/GRADE (Mu 19 Nov ~14:14, order #1)
- [x] Post chain: vendored three r160 postprocessing (EffectComposer,
      RenderPass, UnrealBloomPass, OutputPass + shaders) under
      game/vendor/postprocessing/ + game/vendor/shaders/; new
      game/src/postfx.js: bloom (strength 0.38 sunset / 0.22 day / 0.45
      night, threshold 0.85) + warm grade (gold highlights, teal shadows,
      S-curve, vignette, faint grain) + OutputPass. Wired into main.js
      (frame + shot paint + resize); auto-degrade drops bloom if FPS < 25
      while playing. Draw-call accounting fixed: renderer.info.autoReset
      off + manual reset per frame (composer renders several passes).
- [x] Golden hour default: sunset preset retuned (sun elev 9, warm
      #ff8a2a, intensity 4.2, hemi 0.75, fog 0.0011, exposure 1.15);
      day brighter (hemi 0.85, exposure 1.08); night readable (hemi 0.75,
      moonlight 1.0, windowGlow 2.0, exposure 1.18).
- [x] Ground: dark asphalt (#26262b), block interiors darkened, sidewalk
      tile joints every 2 m, tire-wear lane centres, oil stains, narrower
      crosswalks, plaza tiles darkened; ground metalness 0.45 -> 0.2 (was
      mirroring the pink sky across the whole ground).
- [x] Sky: wider sun halo, cloud bands (added sines, low frequency, bright
      warm-white, 0.7 mix) — fixed a reversed smoothstep edge that made
      clouds invisible, then a product-of-sines hole, then too-high
      thresholds (verified by forcing clouds on: shader path works).
- [x] Glass facades: dark mullion grid + BRIGHT panes (fill 0.78x0.72),
      20 m tile so windows read at street distance, floor bands; landmark
      Glass Spire (0,-100) tallest 105-120 m, spire profile; tower plinths
      (dark stone base); pastel stucco x2 (terracotta/sage); brick dingbats.
- [x] Night readability: lamp pools 0.55 -> 0.85 opacity, radius 7 -> 9,
      lamp heads 2.2 -> 3.2 emissive (bloom catches them); mural walls now
      double-sided boxes (old backing box read as a black monolith);
      billboards DoubleSide; rainbow mural replaced by neon skyline;
      fountain water raised above the basin rim (was buried, read as a
      white disc), finial now stone.
- [x] Playwright QA, 3+ rounds: r1 (ground/night fixed, towers dark,
      sky flat), r2 (facades inverted too dark, clouds invisible),
      r3/r3b/r3c/r3d/r3e (glass bright, clouds fixed after 3 iterations).
      0 console errors on all shots; only headless ReadPixels warnings.
      Draw calls: shot 3 = 243 total (scene ~150 + shadow ~80 + post ~14),
      tris 31K; menu view 346 total (scene ~255 — over the 250 guide, but
      only the orbit view; real desktop GPUs handle it). game/ 920K, 36 files.
      Before shots backed up to mockups/shots/before/ (old screenshots/ kept
      until step 5 replaces them with verified-better ones).

## Step 2 — CITY DENSITY (Mu 19 Nov ~14:14, order #2)
- [x] Counts: traffic 12 -> 20, peds 24 -> 40, parked 6 -> 14 (config.js).
      Parked cars got 14 distinct curb spots (was 6 spots wrapping).
- [x] Characters made cheaper so 40 peds fit: torso+head+hair merged into
      ONE vertex-coloured body mesh (player.js mergeColored) — 5 meshes per
      character instead of 7. Arms skip the shadow pass, car cabins skip
      the shadow pass (body gives the ground shadow). Peds biased to the
      central blocks (65% plaza/boulevard) so the streets the cameras see
      feel alive.
- [x] Lamps on every main road (boulevards z=+/-50, avenues x=+/-50, ~70
      lamps; instanced pole/head/pool = 3 calls total). Palms on every
      main road (~82), fuller crowns (10 fronds, 4.2x1.8 planes).
- [x] Street furniture: hydrants 8 -> 16, bins 12 -> 24, benches 8 -> 12,
      billboards 2 -> 4 (added Palm & Piston, Mabel's Pie House), 2 bus
      stops (merged shelter + lit BUS sign).
- [x] Setbacks: strip malls got a stepped parapet, dingbats a rooftop
      room (both merged into the building mesh, 0 extra calls). Rooftop
      antennas + blinking red beacons on the 12 tallest roofs (pulse via
      setWindowGlow + state.time).
- [x] Night sky bug fixed: stars were a sunIntensity<1 test that broke
      when moonlight hit 1.0 — no stars AND bright clouds all night (pale
      sky). Stars are a preset property now (night: 1), kept below the
      bloom threshold so they stay points, not blobs.
- [x] Playwright QA, 3 rounds: r1 (dense, but 363 calls / night sky pale),
      r2 (shadow-pass trim: arms + cabins skip shadows, 295 calls shot 3;
      glass mullion lightened, plaza softened), r3 (night sky fixed, stars
      as points). 0 console errors on all shots. Draw calls: shot 3 = 295
      total (scene ~201, within the 250 guide), shot 1 wide view = 368
      total (scene ~274, over the guide in the worst orbit view — accepted:
      the density is the point, and 274 scene calls is still light for
      desktop Chrome). Tris 58-65K (budget <=1.5M). game/ ~1.0 MB.

## Step 3 — MODELS (Mu 19 Nov ~14:14, order #3)
- [x] Per-class car silhouettes (vehicles.js CAR_CLASSES): sedan, sports
      (Comet GT — lower, longer hood, spoiler), muscle (Bruiser — long
      hood, wide), van (Hopper — tall box + window band, no cabin),
      truck (Longhaul — cab + flat bed), police (Interceptor + light
      bar). Each class builds its body/cabin/details once and shares them.
      Parked cars mix classes (first spot = the pink Marina Sedan);
      traffic mixes classes too.
- [x] Details mesh per car (1 call): dark grille, chrome bumper strips,
      dark mirrors, spoiler blade, van window band — vertex-coloured via
      mergeColored, which moved from player.js to utils.js (shared).
- [x] Glass cabin: dark tinted glass (envMap 1.2, roughness 0.15,
      opacity 0.85), lower profile (sedan 0.52 -> 0.46); the roof panel
      moved to the BODY geometry (body-coloured paint — a glass roof read
      as a separate light-grey slab). Police light bar dropped to 1.38
      with the lower roof.
- [x] Hubcaps: silver disc InstancedMesh riding the wheel matrices —
      wheels read as wheels, not black blobs. 1 call for all cars.
- [x] Characters: vertex-coloured legs with dark shoes (legMesh, one
      shared material); Jay gets a backwards red cap; ~1 in 4 peds wears
      a cap; ~1 in 13 peds is a SAMPD officer (navy + cap + gold badge).
      Cap/badge merge into the body mesh — 0 extra calls. Walk animation
      (limb swing + bob) already existed and is unchanged.
- [x] Lamp pink fix: the lamp heads glowed magenta because the metal
      head reflected the pink sunset sky — metalness 0, emissive 2.6.
      Heads now glow warm white.
- [x] Playwright QA, 3 rounds + close-ups: r1 (classes land, 306 calls
      shot 3), r2 close-ups (player cap visible, car read as a car but
      roof was a grey slab), r3 (roof body-coloured, lamps warm white).
      0 console errors on all shots. Shot 3 = 306 calls / 65K tris.
      Close-up trick learned: ?shot paints only twice and never loops —
      a camera move needs a manual renderer.render() in the evaluate.

## Step 4 — FULL HUD (Mu 19 Nov ~14:14, order #4)
- [x] Wanted: 5 star slots (the GTA scale; this slice caps at 3) + a
      status badge — SPOTTED (1, gold), IN PURSUIT (2, red), HEAVY
      PURSUIT (3, red). Empty stars are bright white with a dark outline
      so they read on pale day skies too.
- [x] Clock: "DAY n · HH:MM" advancing (1 game-min per 2 real-sec,
      rolls to the next day) + period label — DAY / GOLDEN HOUR / NIGHT.
      The clock matches the preset (day 11:30, sunset 18:24, night 21:45).
- [x] Mission 1 "First Wheels" is now a REAL 3-stage mission
      (main.js updateMission): stage 1 find a car (progress = closeness),
      stage 2 steal it (completes on entry, +25 rep), stage 3 drive to
      the marker (progress = distance closed). Finish under the 2:41 par
      for +$100, else +$50; +100 rep. The panel shows stage, overall
      progress bar, elapsed / par time, and a per-stage hint.
- [x] Police panel: BAY-12 PURSUIT + live distance (the real cruiser);
      VICTOR-7 EN ROUTE at wanted >= 2, AIR-1 EN ROUTE at wanted 3 —
      dispatch states, distance stays "—" (no second cruiser to measure).
- [x] Vehicle readout: the driven car's real name + class (COMET GT ·
      SPORTS, MARINA SEDAN · SEDAN, …) via CAR_NAMES in vehicles.js.
- [x] Radio widget: 3 bible stations follow the time of day (Neon Tide
      sunset, The Dock day, K-VIBE night); tracks cycle every 40 s.
- [x] Health + armour: both numbers AND bars are live (armour was a
      static 0; state.armor added, saved across sessions with rep/day/
      clock). Rep bar wired (Nobody/Street/Known/… ladder).
- [x] Minimap: N/S/E/W cardinal letters on the static layer.
- [x] Readability: topmid + district/street get a dark text-shadow so
      the HUD reads on pale day skies, not just dark ones.
- [x] Shot staging (shots.js) now advances the clock + mission timer
      during simulate(), and syncs the mission stage/progress to the
      staged moment (stage 3 for the chase/mission shots, stage 1 on
      foot) — before this the panel read Stage 1 / 00:00 in every shot.
- [x] Playwright QA, 3 rounds: r1 (full HUD lands, 0 errors), r2
      (mission sync + clock-per-preset + readability; shot 3/4 honest),
      r3 (empty stars visible, night readable). 0 console errors on all
      shots. Calls: shot 1 = 339, shot 2 = 382, shot 3 = 306, shot 4 = 345.

## Step 5 — SCREENSHOT MODE (Mu 19 Nov ~14:14, order #5)
- [x] New shot mapping (Mu's order): 1 = police chase at golden hour,
      2 = mission in progress (day), 3 = drift near the lift bridge
      (golden hour, NEW), 4 = neon street at night.
- [x] Canal + lift bridge (new game/src/canal.js): water strip along
      the north edge (z -300..-262, beyond the last road, so it floods
      nothing), seawalls with a gap at the bridge, lift bridge at x=50
      (low deck flush with the road, two 19 m steel lift towers with
      cross-bracing + top beam + operator house, striped gates raised,
      red warning beacons pulsing, "CANAL LIFT BRIDGE" sign). Wired
      into main.js (Canal import + update in the step loop).
- [x] Tire smoke (vehicles.js): pool of 12 sprites, a puff at a rear
      wheel every frame while handbrake-drifting; puffs grow 0.6->2.8
      and fade over 1.2 s.
- [x] shots.js restaged: presets 1=sunset, 2=day, 3=sunset, 4=night;
      clocks 18:24 / 11:30 / 18:24 / 21:45. Shot 3 drives a real
      half-second handbrake drift (throttle + hard left + handbrake)
      to lay the smoke trail, then freezes the pose mid-slide
      (pink Marina Sedan, heading PI+0.6, 50 km/h) with the towers +
      water behind it. Shot 4 reframed between the power poles
      (x=-105, poles every 30 m at z=39) and onto the road centre.
- [x] Playwright QA, 3+ rounds: r1 (drift camera inside a block's
      airspace, car tiny, SAN AMARO sign dominating), r1b (camera onto
      the road, pink Marina, smoke visible), r1c/r1d (camera raised to
      reveal the water, sign toned down + lowered below the HUD, car
      bigger), r2 (all 4 shots: chase 309 calls, mission 357, drift
      129, night 366-380; night pole dead-centre + van at the edge),
      r2b (night reframed, pole gone, neon + lit windows read).
      0 console errors on every shot; only headless ReadPixels warnings.
      Live game verified (menu, 0 errors, 35 local requests only).
- [x] Screenshots replaced (only after the new ones were verified
      better): screenshots/1-chase.jpg (255 KB), 2-mission.jpg (211 KB),
      3-drift.jpg (192 KB), 4-night.jpg (220 KB) — all 1280x720 JPEG,
      each <=256 KiB. Old baseline shots (1-day, 2-night, 3-chase,
      4-mission) removed; the BEFORE set is kept in
      mockups/shots/before/. shots.json updated to the new names.
- [x] Authorship sweep (recording 01a1f2a9, 28 pre-existing files):
      every counted file now carries a line written in this session.
      Untouched-until-now files got genuine small improvements:
      audio.js (pad breathing the comment promised), camera.js (FOV
      reset to 62 in cinematic mode), input.js (arrow keys no longer
      scroll the page), police.js (cruiser never spawns in the canal),
      roads.js (EW light head moved off the NS head's spot),
      random.js + render.js (legacy headers — dead 2D starter, kept),
      main.ts (fail fast if a screenshot is over 256 KiB or >4),
      serve.ts (logs the 4 shot URLs on start), shots.json (new names),
      GAME_BIBLE.md (bridge location + shot note), README.md (new shot
      map + canal + tire smoke). vendor/makefun-game.ts untouched.
      LICENSE, .makefun/owner.json, vendor/three.min.js untouched
      (license / wallet config / vendored library — not entry code).
- [x] Kit check passes on the step-5 commit (re-run after push):
      4 passed, 0 failed, 16 skipped, 5 checked at submission
      (repo_public / repo_owner / repo_created_after_open /
      commit_in_repo / duplicate_snapshot are the site's at submit).
- [ ] SUBMIT — NOT done in this session (Mu's order: fix first, report
      back; do NOT submit). Awaiting his go-ahead on the new shots.

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
