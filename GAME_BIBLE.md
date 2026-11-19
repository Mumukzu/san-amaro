# GAME_BIBLE.md — San Amaro

Source of truth for the game. Everything here is ORIGINAL: no names,
characters, logos, brands or text from Rockstar, other commercial games or
other competition entries. All systems and UI follow this file.
Honest ceiling: stylized low-poly Three.js, static files ≤48 MB, zero
network — a strongly art-directed city, never a photoreal claim.
Content is data-driven in spirit: districts, factions, missions, weapons,
vehicles, radio and dialogue live in data files, not in engine code.

## 1. Identity
- Game title: **SAN AMARO**
- Tagline (one line): **Steal the sunset. Own the city.**
- Visual style (one paragraph: lighting, palette, mood, camera): Neon
  Miami-sunset: a gradient sky (orange to pink to deep blue) with a low sun
  disc, warm haze and wet asphalt that sheens under street lights. Glass
  towers glow with random lit windows at dusk; neon signs in pink, cyan and
  gold light the boulevards. Third-person camera, low and close behind the
  player on foot, pulling back into a chase cam while driving.
- Time period and tone: Present day, sun-baked and slightly lawless. Funny,
  confident street tone — never grim, never cynical.

## 2. World
- City name: **San Amaro** (fictional, LA-flavoured, on a bay).
- Short history / vibe (3 sentences): San Amaro was a fishing port that
  grew rich on shipping, then on sun, neon and bad decisions. The docks
  still smell of salt and diesel; downtown is glass and ambition; the beach
  never sleeps. Everybody here is either chasing the sunset or running from
  it.
- Districts (7). Submission scope: **submission 1 = Downtown Core slice**
  (~600x600 m); **submission 2 = minimum 3 districts — Downtown Core +
  Sunset Beach ("The Strip") + Harbor Docks**; the other four are the
  full-city design target, added as scope allows. The bible is the source
  of truth, not a promise all seven ship in the first submission. City
  generation is data-driven: districts are added via data files, not
  engine rewrites.
  1. **Downtown Core ("The Glass")** — glass towers, tight streets, plaza
     and fountain. Map color steel blue. Look: curtain-wall towers with
     randomized silhouettes, stucco mid-rise, strip malls, palms, murals.
     Palette: charcoal glass, warm stucco, neon pink. Vibe: ambition and
     rush hour. Ruled by: contested (Chrome Kings vs SAMPD). Standing perk:
     **Street Smart** — wanted decays 25% faster.
  2. **Sunset Beach ("The Strip")** — boardwalk, sand, pier, beach bars.
     Map color coral pink. Look: low motels, surf shops, palm rows, wooden
     pier, volleyball nets. Palette: faded turquoise, sand, coral. Vibe:
     permanent holiday. Ruled by: Neon Vipers. Standing perk: **Race
     Ready** — race payouts +20%.
  3. **Harbor Docks** — container yards, cranes, warehouses, boats. Map
     color rust orange. Look: corrugated steel, stacked containers, gantry
     cranes, puddles of diesel rainbow. Palette: rust, grey, safety
     yellow. Vibe: work, sweat, smuggling. Ruled by: Harbor Union.
     Standing perk: **Union Rates** — repairs free, car spawns nearby.
  4. **Palm Grove Suburbs** — bungalows, lawns, quiet streets. Map color
     leaf green. Look: single-storey houses, picket fences, jacaranda
     trees, driveways. Palette: pastel walls, green lawns. Vibe: sleepy
     until it isn't. Ruled by: neutral. Standing perk: **Safehouse** —
     save anywhere, slow health regen at home.
  5. **Old Canal District** — canals, lift bridges, brick warehouses. Map
     color teal. Look: brick, iron bridges, canal water, moored boats.
     Palette: brick red, teal water, iron black. Vibe: old money, old
     secrets. Ruled by: neutral (Kings lean on it). Standing perk:
     **Canal Runner** — escape timer 30% shorter near water.
  6. **Neon Mile** — nightlife boulevard, clubs, diners, theatres. Map
     color magenta. Look: vertical neon signs, marquees, valet stands,
     crowded sidewalks. Palette: magenta, cyan, gold. Vibe: 2 AM, always.
     Ruled by: contested (Vipers vs Kings). Standing perk: **Night Owl**
     — mission payouts +15% after sunset.
  7. **Hillcrest** — hills, mansions, the big sign. Map color gold. Look:
     winding roads, pools, gated drives, long views over the bay.
     Palette: white stucco, gold light, dark green. Vibe: money that
     hides. Ruled by: neutral (rich). Standing perk: **Valet Key** —
     high-value cars spawn in the hills.
- Landmarks (5+): name, location, purpose (mission site, race start, etc.):
  - **The Glass Spire** — tallest tower, Downtown — finale heist site.
  - **Sunset Plaza + Fountain** — Downtown centre — race start, meeting
    spot, shot 1 backdrop.
  - **The SAN AMARO Sign** — Hillcrest ridge — viewpoint, collectible
    spot, shot backdrop.
  - **Pier 9 Boardwalk** — The Strip — race start, side-job hub.
  - **Canal Lift Bridge** — Old Canal — signature stunt jump / escape.
  - **Palm & Piston Garage** — Downtown edge — player safehouse and garage.
  - **Mabel's Pie House** — Neon Mile — neutral meeting spot, side-job giver.
- Street naming rules (e.g. boulevards, avenues, causeway names):
  Boulevards are named after light and time (Lantern Boulevard, Golden Hour
  Avenue, Dusk Drive). Avenues are named after palms and flowers (Palm Row,
  Hibiscus Avenue, Jacaranda Lane). Dock streets are named after the sea
  (Harbor Way, Anchor Street, Tide Lane). Hill streets are named after
  views (Vista Drive, Sunset Ridge). No real street names, no Rockstar names.

## 3. Characters (6+)
1. Player character: **Jace "Jay" Moreno**, 27, ex-valet driver, back in
   town to save his brother's garage. Look: teal jacket, dark jeans, white
   sneakers, gold chain, black cap worn backwards, short dark hair, light
   stubble. Personality: quick, loyal, allergic to authority, jokes when
   scared. Voice lines: short, confident, street-smart ("Watch the paint.",
   "That's my car now."). Portrait: three-quarter view, cap backwards,
   sunset gradient behind, teal jacket pop.
2. **Nadia "Nails" Okafor**, 31, ally / mechanic, runs Palm & Piston. Look:
   oil-stained denim overalls over a red tee, red bandana, curly dark hair
   in a bun, grease on one cheek. Personality: blunt, warm, the only adult
   in the room. Voice: dry one-liners ("You break it, you bought it.").
   Portrait: arms crossed, wrench over shoulder, garage glow.
3. **Theo "T" Calloway**, 45, ally / fence and info broker, runs Theo's
   Trade pawn shop. Look: loud Hawaiian shirt, gold rings, grey-flecked
   beard, sunglasses indoors. Personality: knows everybody, sells
   anything, never lies twice. Voice: conspiratorial whisper that carries
   across the room. Portrait: leaning on a counter, gold rings catching
   light.
4. **Mara Quinn**, 29, rival driver / on-off ally, Neon Vipers' champion.
   Look: pink racing jacket, black leggings, blonde undercut, mirrored
   shades. Personality: faster than you, knows it, secretly sentimental.
   Voice: teasing, competitive ("Try to keep up, Jay."). Portrait: helmet
   under one arm, beach sunset behind.
5. **Vince "Vex" Kroll**, 34, rival / antagonist, leads the Chrome Kings.
   Look: chrome bomber jacket, black turtleneck, slicked hair, scar over
   left eyebrow. Personality: patient, theatrical, collects debts and
   grudges. Voice: slow, polite, menacing ("Let's not make this ugly.").
   Portrait: low angle, chrome jacket gleaming, downtown behind.
6. **Captain Rosa Delgado**, 48, cop / SAMPD captain. Look: navy uniform,
   captain's bars, grey-streaked bun, reading glasses on a chain.
   Personality: by-the-book in public, tired in private, hates the Kings
   more than she hates Jay. Voice: clipped, official, with a dry edge.
   Portrait: arms folded, badge catching light, precinct blinds behind.
7. **Officer Ben "Bump" Kowalski**, 33, cop / patrol, Delgado's driver.
   Look: navy uniform two sizes too enthusiastic, moustache, donut dust on
   the vest. Personality: earnest, slow to anger, surprisingly good driver.
   Voice: friendly radio chatter ("Bay-12, in pursuit, over."). Portrait:
   leaning on a cruiser, grinning.
8. **Auntie Mabel**, 60, neutral / diner owner, side-job giver. Look:
   floral apron, silver curls, cat-eye glasses, pie always in hand.
   Personality: feeds everyone, judges no one, remembers everything.
   Voice: warm, maternal, with a steel edge ("Eat first. Then we talk.").
   Portrait: behind the diner counter, pie in hand, neon sign glow.

## 4. Factions and law
- Gangs/crews (3+): name, color, territory, behaviour, weapon style:
  - **Chrome Kings** — chrome/silver. Downtown + Docks. Muscle: they
    lean on shops, collect debts, drive heavy muscle cars. Weapons: bats,
    pistols, one sawn-off per crew. Behaviour: block roads, ram, never
    back down.
  - **Neon Vipers** — hot pink/green. The Strip + Neon Mile. Racers and
    smugglers: fast cars, night runs, protect their turf with speed.
    Weapons: pistols, SMGs. Behaviour: chase, cut off, flee when losing.
  - **Harbor Union** — rust orange/brown. The Docks. Not a gang: dock
    workers who control the port and don't take orders from anyone.
    Weapons: wrenches, shotguns (for "pest control"). Behaviour: stand
    their ground, help the player if standing is high.
- Police department: **San Amaro Metropolitan Police Department (SAMPD)**, navy/white.
  Unit types: Patrol cruiser (Bay-##), Interceptor (Victor-##, faster,
  3+ stars), Air-1 helicopter (4+ stars, spotlight, visual only in the
  slice), Roadblock units (4+ stars). Callsign scheme: "Bay-12",
  "Victor-7", "Air-1", "K-9" (dogs, never shown). Tactics per star level:
  1 star — one cruiser follows, easy to lose. 2 stars — two cruisers,
  they ram. 3 stars — interceptors join, they cut off and block. 4 stars
  — roadblocks on the boulevard + Air-1 spotlight. 5 stars — everything,
  plus foot officers (later slice).
- Neutral groups (shops, unions, valets, etc.): Mabel's Pie House staff
  (neutral ground, no fighting inside), Valet Guild (park cars, tip for
  info), Sunset Taxi Co-op (taxi side jobs), Beach Lifeguards (Strip,
  first aid = free heal).

## 5. Story (8 chapters)
One line per chapter: title, location, goal, twist, reward.
1. **First Wheels** — Downtown — steal a car, deliver it, lose the cops —
   twist: the car belongs to a King — $500.
2. **Nadia's List** — Downtown — three deliveries across the district —
   twist: one package is police evidence — $800.
3. **Beach Run** — The Strip — win a street race against the Vipers —
   twist: their champion is Mara, Jay's old flame — $1,200 + Viper rep.
4. **Dock Rats** — Harbor Docks — steal a shipment manifest — twist: it
   names the Kings' inside cop — $1,500.
5. **Canal Run** — Old Canal — escape a 3-star chase over the lift bridge
   — twist: the bridge is up; jump it — $1,800.
6. **Neon Mile** — Neon Mile — defend Palm & Piston from a Kings hit — twist:
   Vince offers Jay a job instead — $2,000.
7. **The Inside Cop** — Downtown — expose Lt. Marsh, the dirty cop —
   twist: Marsh worked for the Vipers, not the Kings — $2,500.
8. **Glass Spire** — Downtown — heist the Kings' cash from the Spire —
   twist: Mara already took it; split it or fight her — $5,000.
- Opening situation and final payoff (3 sentences): Jay comes home after
  three years away to find his late brother's garage, Palm & Piston, $50,000 in
  debt to the Chrome Kings with one week to pay. He steals, races and runs
  his way through every district of San Amaro to raise the money. In the
  finale he takes the Kings' own cash from the Glass Spire, pays the debt,
  keeps the garage, and the sunset over the bay is finally his.

## 6. Missions and side activities
- Story missions (8+): id, giver, objective types, stages, fail conditions,
  reward, par time:
  - M1 First Wheels — Nadia — steal car → drive to marker → lose police —
    fail: busted / car destroyed — $500 — par 4:00.
  - M2 Nadia's List — Nadia — deliver 3 packages → avoid police — fail:
    busted / package lost — $800 — par 6:00.
  - M3 Beach Run — Mara — win race (3 laps, Pier 9 circuit) — fail:
    finish 2nd+ — $1,200 — par 5:00.
  - M4 Dock Rats — Theo — steal manifest → photograph it → escape docks
    — fail: busted / seen by Union — $1,500 — par 7:00.
  - M5 Canal Run — Nadia — reach the bridge → jump it at 3 stars — fail:
    busted / car in the canal — $1,800 — par 5:00.
  - M6 Neon Mile — Nadia — defend garage (3 waves) → chase the getaway car
    — fail: garage burns / busted — $2,000 — par 8:00.
  - M7 The Inside Cop — Delgado — tail Marsh → photograph the handoff →
    deliver evidence — fail: spotted / busted — $2,500 — par 8:00.
  - M8 Glass Spire — Mara — enter the Spire → grab the cash → escape 4
    stars — fail: busted / Mara takes it all — $5,000 — par 10:00.
- Side jobs (5+): name, type, location, reward:
  - **Sunset Taxi** — fares — anywhere — $50-150 per fare.
  - **Slice Runner** — pizza delivery — Neon Mile — $100-300 per run.
  - **Tow It** — tow broken cars — Docks — $200 per tow.
  - **Valet Rush** — park cars — Neon Mile — $80-200 per shift.
  - **Postcard Hunt** — photo spots — everywhere — $200 per postcard (12).
- Activities (races, deliveries, stunts, collectibles): 3 street-race
  circuits (Pier 9, Neon Mile loop, Hillcrest climb); delivery runs;
  5 stunt jumps (Canal Bridge is the signature); 12 sunset postcards to
  photograph; taxi and valet as repeatable income.

## 7. Vehicles (8+)
Name, class (sports, sedan, muscle, van, truck, bike, police, boat), top
speed, handling note, look (body shape, color, spoiler, lights):
1. **Comet GT** — sports — 190 km/h — sharp, grippy, twitchy at the
   limit — low wedge, candy red, big wing, LED strips.
2. **Marina Sedan** — sedan — 150 km/h — balanced, the everyman car —
   four-door, muted blue, chrome trim, soft headlights.
3. **Bruiser** — muscle — 165 km/h — heavy, drifts wide, huge torque —
   long hood, matte black, hood scoop, round lamps.
4. **Hopper Van** — van — 130 km/h — slow, steady, roomy — boxy, two-tone
   cream/brown, roof rack.
5. **Longhaul** — truck — 120 km/h — very heavy, plows through — cab-over,
   rust orange, bull bar, fog lamps.
6. **Dragonfly** — bike — 175 km/h — nimble, fragile, wheelies — slim, neon
   yellow, single headlamp.
7. **Interceptor** — police — 180 km/h — pursuit-tuned, stiff — white
   with navy doors, light bar, push bar.
8. **Bay Runner** — boat — 90 km/h on water — docks and canals only —
   white hull, teal stripe, outboard motor.
9. **Flamingo** — lowrider — 140 km/h — hydraulics bounce at idle —
   candy pink, chrome rims, mural on the hood.

## 8. Weapons and gear
Slots 1-5 with names, damage, ammo, rep requirement, look:
1. **Fists / Knuckle Dusters** — damage 10 — ammo — — rep Nobody — brass
   knuckles, taped hands.
2. **P9 Pistol** — damage 25 — 12+48 — rep Street — black compact pistol,
   suppressor option.
3. **Viper SMG** — damage 16/shot — 32+128 — rep Known — pink-accented
   SMG, folding stock.
4. **Sawed Scattergun** — damage 60 close — 6+24 — rep Respected — short
   double barrel, wood grip.
5. **Longshot Rifle** — damage 90 — 5+20 — rep Feared — scoped, matte
   grey, long barrel.
Clothing shops and outfits: **Thread House** (street: tees, caps,
sneakers, $50-300); **Velvet Rope** (flashy: gold chains, silk shirts,
$400-1,200); **Torque Workwear** (mechanic: overalls, boots, gloves,
$80-250). Outfits change the player model colors; Velvet Rope outfits
give +5% mission pay (looking the part).

## 9. Economy and progression
- Money sources and sinks (price list): Sources — story missions
  ($500-5,000), races ($300-2,000), taxi ($50-150/fare), deliveries
  ($100-300), postcards ($200 each), valet ($80-200/shift). Sinks — car
  repair ($100-500), ammo ($20-100 per box), clothes ($50-1,200), bribe
  to clear 1 star ($300), safehouse upgrades ($1,000-5,000), car purchase
  ($2,000-25,000).
- Reputation levels (names, XP thresholds, what each unlocks): Nobody
  (0) — nothing. Street (200 XP) — P9 pistol, taxi jobs. Known (600 XP)
  — Viper SMG, race invites, 5% shop discount. Respected (1,200 XP) —
  Scattergun, crew: Nadia (free repairs), 10% discount. Feared (2,000 XP)
  — Longshot rifle, crew: Mara (race +25%), police look the other way
  10% faster. Legend (3,500 XP) — Velvet Rope outfits, crew: Theo (+15%
  mission pay), Glass Spire penthouse.
- Crew members and their perks: Nadia (mechanic — free repairs, garage
  upgrades), Theo (fence — +15% mission pay, sells rare cars), Mara
  (driver — race payouts +25%, unlocks Flamingo), Auntie Mabel (info —
  postcards and collectibles shown on the map).

## 10. Radio and sound
- Stations (3+): name, frequency, genre, mood, track list (original titles
  and artist names, all fictional):
  - **Neon Tide 102.5** — synthwave / chill — golden-hour driving.
    Tracks: "Neon Horizon" — Midnight Palms; "Golden Hour Drive" —
    Cassia Blue; "Palm Shadows" — The Vultures; "Glass Spire (Reprise)"
    — Mara Q.
  - **107.3 The Dock** — garage rock — rust and diesel. Tracks: "Rust
    and Chrome" — Harbor Rats; "Anchor Down" — Salty Dogs; "Night Shift"
    — The Breakers; "Diesel Heart" — Crane Wife.
  - **K-VIBE 91.1** — hip-hop / funk — night cruising. Tracks: "Chrome
    Dreams" — Lil Vex; "Neon Mile" — Mara Q; "Low and Slow" — DJ
    Tropic; "Kings Fall" — The Vultures.
  DJ chatter reacts to wanted level and missions ("SAMPD is all over
  Lantern Boulevard tonight, folks — drive safe.").
- Sound palette (engine, siren, gunshots, ambience, UI): Engine — sawtooth
  + lowpass, pitch tied to speed. Siren — square wave alternating 720/940
  Hz. Gunshots — noise burst + fast envelope. Ambience — waves and gulls
  at the beach, traffic hum downtown, crickets in the suburbs. UI — short
  sine/square blips, cash-register chime on payout.

## 11. UI language
- Color tokens (background, panel, accent 1/2/3, danger, success):
  background #0d0f1a; panel rgba(16,18,26,0.85) with 1px rgba(255,255,255,
  0.12) border; accent 1 neon pink #ff2e88; accent 2 cyan #22e6ff;
  accent 3 gold #ffd23e; danger #ff2a1a; success #2aff5a.
- Typography choices (system font stacks), logo treatment: system-ui,
  -apple-system, "Segoe UI", sans-serif only (offline). Titles: 800-900
  weight, uppercase, letter-spacing 0.08em, gradient text (pink → gold)
  with a soft drop shadow. Body: 400-600 weight, 14-16px, high contrast.
- Iconography style: inline SVG, outlined, 2px stroke, rounded joins,
  single accent color per icon. Stars, arrows, car and phone glyphs are
  simple geometric shapes, never emoji.
- Tone of UI text: short, confident, street-smart. Objectives are verbs
  ("Steal the car.", "Lose the police."). Failure is blunt but fair
  ("BUSTED — The SAMPD got you. $100 bail."). No begging, no purple prose.

## 12. Fictional brands (billboards, shops, food, cars)
List 10+ made-up brand names with slogans and colors. No real brands.
1. **NEON COLA** — "Taste the Sunset" — hot pink / white.
2. **PALM DRIVE MOTORS** — "Drive San Amaro" — navy / gold.
3. **TACO PALACE** — "Tacos · Burritos · Open Late" — red / cream.
4. **DONUT DRIVE** — "Fresh 24 Hours" — orange / white.
5. **SURF SHOP** — "Boards · Wax · Beach Gear" — teal / sand.
6. **NEON NAILS** — "Salon & Spa" — purple / pink.
7. **PALM & PISTON** — "We Fix Anything" — teal / white.
8. **MABEL'S PIE HOUSE** — "Pie at 2 AM" — cream / red.
9. **NEON TIDE 102.5** — "Ride the Glow" — orange-pink gradient.
10. **SLICE RUNNER** — "Pizza in 20 or Free" — red / yellow.
11. **HARBOR RATS COFFEE** — "Strong as the Tide" — brown / cream.
12. **VELVET ROPE** — "Dress Like You Own It" — gold / black.
13. **THREAD HOUSE** — "Streetwear, San Amaro Made" — black / white.
14. **K-VIBE 91.1** — "All Vibe, All Day" — magenta / cyan.
15. **GLASS SPIRE HOTEL** — "Sleep Above It All" — silver / blue.

## 13. Differentiators (pick 3-4 visible ones)
1. **A living sunset.** A full day/night cycle where the whole city
   re-lights: windows glow, neon fires up, wet roads sheen under the
   lamps. Visible in every screenshot, not a static backdrop.
2. **Dynamic rain and storms.** Weather rolls in off the bay — rain,
   lightning, thunder, and wet roads that mirror the neon. Storms change
   driving grip, visibility, and the whole look of the city.
3. **The Canal Lift Bridge stunt escape.** A signature set-piece: a
   3-star chase that ends in jumping a raised bridge. One moment, built
   to be screenshotted. The bridge itself stands at the north edge of
   the Downtown slice (x=50, over the canal): two steel lift towers,
   a low deck, striped gates and a lit sign — the drift approach to it
   is one of the four staged screenshots.
4. **Garage car customization.** At Palm & Piston, rebuild your ride —
   paint, wheels, body kits, spoilers, and performance tuning that
   changes how the car drives. Your car, your signature.
5. **Photo mode (stretch, optional).** Freeze the action, move the
   camera, tune the sunset, and frame the shot — built for the
   screenshots that decide the judging. Not part of the core 4.
Note: district reputation (standing perks in §2, levels in §9) remains a
required system — it is no longer listed as a differentiator. The
3-station procedural radio (§10) also remains a required feature.
