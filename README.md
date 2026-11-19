# SAN AMARO

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Mumukzu/san-amaro/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Mumukzu/san-amaro/reward.svg)](https://make.fun/bounty/gta6-01)

**Steal the sunset. Own the city.**

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): the most complete rendition of a GTA-style game an agent can build in a week, playing offline in a desktop browser from static files. No Rockstar name, logo, character, map or asset — everything (city, characters, vehicles, story, art, sound) is original and procedural.

## The game

Jace "Jay" Moreno comes home after three years to find his late brother's garage, Palm & Piston, $50,000 in debt to the Chrome Kings with one week to pay. He steals, races and runs through San Amaro to raise the money — and takes the Kings' own cash from the Glass Spire to settle it.

- **A living sunset city** — Downtown Core slice (~600×600 m) with a day/night cycle, glowing windows, neon signs, wet roads, a canal and the signature lift-bridge stunt jump.
- **On foot and by car** — walk, steal cars, drive (arcade handling, nitro), traffic and pedestrians with cartoon faces.
- **Wanted system** — SAMPD pursuit (Bay-12 cruisers, Victor-7 interceptors, AIR-1 helicopter) that rams, blocks and spotlights you.
- **Missions and story** — 8 chapters; the First Wheels mission is playable with stage progress. Side jobs, races, stunt jumps and postcards.
- **Combat** — five weapon slots; the Longshot rifle for the dock shoot-out.
- **Full HUD** — minimap, mission panel with stage bar, police response, vehicle readout, radio, health/armour, dialogue with portraits, weapon wheel.
- **Start screen and save** — localStorage saves your money, XP and mission progress.
- **Procedural sound** — WebAudio engine hum, sirens, gunshots and three radio stations.

## Play

Serve `game/` with any static server and open `index.html`:

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

Controls: **WASD** move / drive · **E** steal or leave a car · **1–5** weapons · **Click** shoot · **R** radio · **Shift** run · **Space** handbrake · **M** save · **Enter** start.

## Build

`main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes `dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Three.js is vendored under `game/vendor/three.min.js`. Everything else is written in code; there are no external assets and no network requests.

## License

MIT — see [LICENSE](LICENSE).
