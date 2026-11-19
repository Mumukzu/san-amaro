# SAN AMARO

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Mumukzu/san-amaro/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Mumukzu/san-amaro/reward.svg)](https://make.fun/bounty/gta6-01)

**Steal the sunset. Own the city.**

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): the most complete rendition of a GTA-style game an agent can build in a week, playing offline in a desktop browser from static files. No Rockstar name, logo, character, map or asset — everything (city, characters, vehicles, story, art, sound) is original and procedural.

## The game

Jace "Jay" Moreno comes home after three years to find his late brother's garage, Palm & Piston, $50,000 in debt to the Chrome Kings with one week to pay. He steals, races and runs through San Amaro to raise the money — and takes the Kings' own cash from the Glass Spire to settle it.

- **A living sunset city** — Downtown Core slice (~600×600 m) rebuilt layout-first: roads first, buildings only inside plots, zones (tall downtown, commercial avenues, low residential, industrial yards), the Glass Spire on its own plot, a Sunset Plaza, sidewalk trees + lamps + benches + bins in a dedicated planting strip, traffic signals, street-name signs, crosswalks, stop lines, puddles — and a 10-check validator that proves the plan clean (0 violations) before the game even builds it.
- **On foot and by car** — walk, steal cars, drive (arcade handling, nitro boost on Shift — the HUD nitro bar is now a real, drain-and-refill resource), traffic and pedestrians with cartoon faces. Two new vehicles: the Sunset Cab taxi and the Ranchero pickup (open bed, cargo).
- **Wanted system** — SAMPD pursuit (Bay-12 cruisers, Victor-7 interceptors, AIR-1 helicopter) that rams, blocks and spotlights you.
- **Missions and story** — 8 chapters; the First Wheels mission is playable with stage progress. Side jobs, races, stunt jumps and postcards.
- **Combat** — five weapon slots; the Longshot rifle for the dock shoot-out.
- **Full HUD** — minimap, mission panel with stage bar, police response, vehicle readout, radio, health/armour, dialogue with portraits, weapon wheel — plus a live district/street readout (the zone you are actually in) and a CITY VALID badge under the minimap.
- **Start screen and save** — localStorage saves your money, XP and mission progress.
- **Procedural sound** — WebAudio engine hum, sirens, gunshots and three radio stations, plus a nitro whoosh and a city ambience hum.

## Play

Serve `game/` with any static server and open `index.html`:

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

Controls: **WASD** move / drive · **E** steal or leave a car · **1–5** weapons · **Click** shoot · **R** radio · **Shift** run / nitro boost while driving · **Space** handbrake · **M** save · **Enter** start.

## The city rebuild (layout-first)

`game/src/city-layout.js` is the plan the whole city is built from — pure data, no THREE.js, so it runs in Node as well as in the browser:

- **Roads first.** A 60 m grid (streets −240…240); main avenues Lantern Blvd (z=0) and Sunset Ave (x=0) are 14 m wide, secondary streets 12 m, residential 10 m. Every street has a 3.2 m sidewalk and a 1.2 m planting strip on its outer edge.
- **Plots.** Each block is inset from its four bounding streets by the plot line (road half-width + sidewalk + planting); a building only ever sits inside its plot, never on a road or a sidewalk, and faces the nearest street.
- **Zones.** Downtown (tall, 26–58 m), commercial (14–34 m, shopfronts), residential (two low houses per block, 8–14 m, yard trees), industrial (low warehouses, south-east), plus the Glass Spire on its own plot and the Sunset Plaza.
- **Trees as infrastructure.** 673 trees: palms on the main avenues, shade trees on side streets and in yards, a ring around the plaza fountain — all in the planting strip, never in a vehicle lane or on a pedestrian path. 368 lamps (arm toward the road), 140 benches + 140 bins on commercial sidewalks, 20 traffic signals at the five main intersections, street-name signs, 476 parking bays in the road's outer lane.
- **Validation.** A 10-check validator (buildings off roads, inside plots, no overlaps, trees off lanes and in planting areas, paths passable, heights ordered by zone, intersections clear, nothing within 1 m of a road) runs on the plan, and `fixLayout` repairs any violation and re-validates. Current plan: **CITY VALID · 80 buildings · 673 trees · 0 violations**. The result is exposed in-game (`window.__cityValidation`, the CITY VALID badge under the minimap) and gated in `main.ts` (the build fails fast on a violation and writes `city-validation.json` into `/output`).
- **Performance.** Trees and lamps are `THREE.InstancedMesh` (9 draw calls for 673 trees + 368 lamps, instead of ~8,000 as individual groups).

## Build

`main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes `dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Three.js is vendored under `game/vendor/three.min.js`. Everything else is written in code; there are no external assets and no network requests.

## License

MIT — see [LICENSE](LICENSE).
