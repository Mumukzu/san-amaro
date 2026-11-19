# SAN AMARO — Steal the sunset. Own the city.

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Mumukzu/san-amaro/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Mumukzu/san-amaro/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the make.fun **gta6-01 "Make GTA 6"**
bounty. Jay Moreno is back in San Amaro after three years away — and his late
brother's garage, Palm &amp; Piston, owes the Chrome Kings $50,000 with one week
to pay. Steal, race and run through every district to raise the money…
or lose the garage for good.

**Everything is original**: the city, characters, vehicles, names, story, art
and sound — nothing from Rockstar or any other game. All geometry, textures
and audio are generated procedurally in code. Three.js r160 is vendored under
`game/vendor/`. The game runs offline in desktop Chrome from static files:
no network requests, no build step.

## Play it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open http://localhost:8080 — click **Continue** (or press Enter).

## Controls

| Key | Action |
| --- | ------ |
| W A S D / Arrows | Move / drive |
| Mouse | Orbit camera (click to lock) |
| Shift | Run / nitro (in car) |
| Space | Jump / handbrake |
| E | Enter / exit car |
| T | Cycle time of day (day / sunset / night) |
| P / Esc | Pause |
| M | Mute |
| H | Help |

## What is in the game (baseline)

- **Explorable city** — Downtown Core slice (~600×600 m) of San Amaro:
  glass towers, strip malls, dingbat apartments, plaza + fountain, palms,
  murals, billboards, traffic lights, day/night cycle, fog, shadows.
  North edge: the canal and the Canal Lift Bridge (twin steel towers,
  deck, gates, lit sign).
- **Steal and drive cars** — parked sedans ready to steal; arcade handling
  (steering, drift, brake, handbrake, nitro), tire smoke while drifting,
  damage feedback (condition), rotating/steering wheels, headlights and
  brake lights.
- **Traffic and pedestrians** — AI cars on loops, stopping at red lights and
  behind the car ahead; pedestrians walking the sidewalks, fleeing a pursuit.
- **Wanted level and police** — stealing a car or hitting a pedestrian raises
  heat (0–3 stars); an SAMPD cruiser chases, rams and busts; heat decays
  when you escape far away.
- **HUD** — mission panel, wanted stars, clock, money, reputation, health /
  armor, circular minimap (roads, player arrow, mission + police blips),
  weapon bar, vehicle readout (speed, condition, nitro), radio widget,
  dialogue box, SAMPD response panel.
- **Menus + save** — title / pause / busted screens, localStorage save.

## Structure (the judge reads this outline)

| Area | Where it lives |
| ---- | -------------- |
| Boot, loop, menus, enter/exit, shots | `game/src/main.js` |
| World layout + ground texture | `game/src/world.js` |
| Buildings (facades, roofs) | `game/src/buildings.js` |
| Street props (lamps, palms, signs) | `game/src/props.js` |
| Sky, sun, fog, environment | `game/src/sky.js` |
| Roads + traffic lights | `game/src/roads.js` |
| Vehicles + driving physics | `game/src/vehicles.js` |
| Traffic AI | `game/src/traffic.js` |
| Pedestrians | `game/src/pedestrians.js` |
| Police + wanted level | `game/src/police.js` |
| Player character | `game/src/player.js` |
| Camera | `game/src/camera.js` |
| HUD + minimap | `game/src/hud.js`, `game/src/minimap.js` |
| Procedural audio | `game/src/audio.js` |
| Save / load | `game/src/save.js` |
| Screenshot staging (`?shot=1..4`) | `game/src/shots.js` |
| World bible (source of truth) | `GAME_BIBLE.md` |
| HUD mockup (design reference) | `mockups/hud.html` |

## Screenshots

`?shot=1` police chase at golden hour · `?shot=2` mission in progress (day) ·
`?shot=3` drift near the lift bridge (golden hour) · `?shot=4` neon street at
night. Real renders live in `screenshots/` (`1-chase.jpg`, `2-mission.jpg`,
`3-drift.jpg`, `4-night.jpg`; the first by name is the cover).

## License

MIT — see `LICENSE`.
