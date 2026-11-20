// SAN AMARO — mission chain data (7 story jobs).
// Pure data: the engine lives in main.js and reads this. Each job reuses
// the existing stage framework (objective / marker / dialogue / reward) —
// there is no second mission system. Job 1 is the original "First Wheels"
// exactly as shipped; jobs 2-7 extend it.
//
// Stage types:
//   steal    — steal a specific car (car: 'comet' | 'sedan' | 'prize')
//   drive    — reach a marker (marker: {x, z, r})
//   evade    — lose the police (the evade timer in main.js)
//   interact — on foot, press E near a marker (marker: {x, z, r})
//   shootout — kill every spawned enemy (enemies: [{x, z}])
//   pickup   — reach a crew member; they join the car (person: 'mara')
//
// Crew speakers (portrait styles match hud.js faceSVG):
//   nadia — Palm & Piston, the garage. theo — race driver. mara — fixer.
export const MISSIONS = [
  {
    id: 'first-wheels', chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
    reward: { money: 500, xp: 200 }, par: 161, unlockWeapon: null,
    speaker: { name: 'NADIA · PALM & PISTON', style: 'nadia', skin: '#8a5a3a', hair: '#1c1410' },
    brief: '“Nadia’s garage is $50,000 in debt. Start with a car.”',
    stages: [
      { type: 'steal', car: 'comet', objective: 'Steal the Comet GT', desc: 'Nadia’s garage is $50,000 in debt. Start with a car.' },
      { type: 'drive', marker: { x: 120, z: 0, r: 16 }, objective: 'Drive to the marker', desc: 'Don’t scratch the paint — the SAMPD is watching.', line: '“That’s my car now — get it to the marker.”' },
      { type: 'evade', objective: 'Lose the police', desc: 'Two cruisers on you — lose them, then get to the marker.', line: '“Marker reached. Now lose them — full throttle.”' },
    ],
  },
  {
    id: 'debt-collector', chapter: 'CHAPTER 1 · MISSION 2', title: 'THE DEBT COLLECTOR',
    reward: { money: 400, xp: 120 }, par: 240, unlockWeapon: 2,
    speaker: { name: 'NADIA · PALM & PISTON', style: 'nadia', skin: '#8a5a3a', hair: '#1c1410' },
    brief: '“A client in Palm Courts owes us. Pick up the envelope from me, deliver it, bring back the cash.”',
    stages: [
      { type: 'interact', marker: { x: -14, z: 26, r: 7 }, objective: 'Pick up the envelope', desc: 'Nadia is waiting at the garage. Walk up and press E.' },
      { type: 'drive', marker: { x: -180, z: 120, r: 16 }, objective: 'Deliver to Palm Courts', desc: 'The client lives on Harbor Blvd. Don’t keep them waiting.', line: '“Envelope’s in. Now get it to Palm Courts.”' },
      { type: 'drive', marker: { x: -14, z: 26, r: 16 }, objective: 'Return to the garage', desc: 'Bring the cash back to Nadia.', line: '“Delivered. Now bring the money home.”' },
    ],
  },
  {
    id: 'sunset-run', chapter: 'CHAPTER 2 · MISSION 3', title: 'SUNSET RUN',
    reward: { money: 600, xp: 150 }, par: 150, unlockWeapon: 3,
    speaker: { name: 'THEO · STREET KING', style: 'theo', skin: '#e8b88a', hair: '#8a8a8a' },
    brief: '“Four gates, one winner, Jay. Beat the clock and the street is yours.”',
    stages: [
      { type: 'drive', marker: { x: 0, z: 120, r: 14 }, objective: 'Race — Gate 1 / 4', desc: 'Through the first gate. The clock is running.' },
      { type: 'drive', marker: { x: 120, z: 120, r: 14 }, objective: 'Race — Gate 2 / 4', desc: 'Keep it clean. Second gate ahead.', line: '“Gate one down. Don’t lift.”' },
      { type: 'drive', marker: { x: 120, z: -120, r: 14 }, objective: 'Race — Gate 3 / 4', desc: 'Halfway. Third gate on Coral Ave.', line: '“Halfway there. Push it.”' },
      { type: 'drive', marker: { x: 0, z: -120, r: 14 }, objective: 'Race — Gate 4 / 4', desc: 'Final gate. Beat the par time.', line: '“Last gate. Everything you’ve got.”' },
    ],
  },
  {
    id: 'dockside-heat', chapter: 'CHAPTER 2 · MISSION 4', title: 'DOCKSIDE HEAT',
    reward: { money: 700, xp: 180 }, par: 300, unlockWeapon: 4,
    speaker: { name: 'MARA · THE FIXER', style: 'mara', skin: '#f2c9a0', hair: '#e8c85a' },
    brief: '“Rico’s boys are muscling in at the yards. Go remind them whose city this is.”',
    stages: [
      { type: 'drive', marker: { x: 180, z: 180, r: 16 }, objective: 'Get to the docks', desc: 'The Yards, south-east. Rico’s crew is waiting.' },
      { type: 'shootout', enemies: [{ x: 176, z: 176 }, { x: 184, z: 178 }, { x: 180, z: 186 }], objective: 'Clear the docks', desc: 'Three of Rico’s crew. Take them down — on foot, weapons free.', line: '“There they are. Weapons free, Jay.”' },
      { type: 'evade', objective: 'Lose the police', desc: 'The shooting brought the SAMPD. Lose them.', line: '“They’re down. Now the cops are coming — run.”' },
    ],
  },
  {
    id: 'the-pickup', chapter: 'CHAPTER 3 · MISSION 5', title: 'THE PICKUP',
    reward: { money: 500, xp: 150 }, par: 240, unlockWeapon: null,
    speaker: { name: 'THEO · STREET KING', style: 'theo', skin: '#e8b88a', hair: '#8a8a8a' },
    brief: '“Mara’s stranded at the Spire. Go get her — and don’t keep her waiting.”',
    stages: [
      { type: 'pickup', person: 'mara', marker: { x: 90, z: -90, r: 10 }, objective: 'Pick up Mara', desc: 'Mara is waiting at the Glass Spire. Drive up to her.' },
      { type: 'drive', marker: { x: -14, z: 26, r: 16 }, objective: 'Drive Mara to the garage', desc: 'Get her back to Palm & Piston in one piece.', line: '“Got her. Now get us home, Jay.”' },
    ],
  },
  {
    id: 'paper-trail', chapter: 'CHAPTER 3 · MISSION 6', title: 'PAPER TRAIL',
    reward: { money: 550, xp: 150 }, par: 300, unlockWeapon: null,
    speaker: { name: 'MARA · THE FIXER', style: 'mara', skin: '#f2c9a0', hair: '#e8c85a' },
    brief: '“Two clues, Jay. One at the plaza, one at the bridge. Walk it — don’t drive, you’ll spook them.”',
    stages: [
      { type: 'interact', marker: { x: -90, z: 30, r: 8 }, objective: 'Search the plaza', desc: 'On foot. Walk to the fountain and press E.', line: '“First clue is at the fountain. On foot, Jay.”' },
      { type: 'interact', marker: { x: 0, z: -270, r: 8 }, objective: 'Search the bridge', desc: 'On foot. Walk to the bridge and press E.', line: '“One more — the bridge, north end. Walk it.”' },
      { type: 'drive', marker: { x: -14, z: 26, r: 16 }, objective: 'Report back to the garage', desc: 'Drive back to Nadia with what you found.', line: '“That’s the whole trail. Bring it home.”' },
    ],
  },
  {
    id: 'the-big-score', chapter: 'CHAPTER 4 · MISSION 7', title: 'THE BIG SCORE',
    reward: { money: 1000, xp: 200 }, par: 300, unlockWeapon: null,
    speaker: { name: 'NADIA · PALM & PISTON', style: 'nadia', skin: '#8a5a3a', hair: '#1c1410' },
    brief: '“The prize Comet. Take it, and don’t let the whole SAMPD stop you.”',
    stages: [
      { type: 'steal', car: 'prize', objective: 'Steal the prize Comet', desc: 'The showroom Comet in Downtown. Take it — the whole city will notice.' },
      { type: 'evade', objective: 'Escape the pursuit', desc: 'Three stars and climbing. Lose them all.', line: '“That’s the one. Now run — the whole SAMPD is coming.”' },
      { type: 'drive', marker: { x: -14, z: 26, r: 16 }, objective: 'Deliver the prize car', desc: 'Bring the Comet to the garage. The debt is done.', line: '“You lost them. Bring it home, Jay.”' },
    ],
  },
];

// Rank ladder (XP thresholds). NOBODY → SMALL TIME → STREET SMART →
// HUSTLER → KINGPIN. The old cap (200) was exhausted by job 1 alone;
// the chain pays 1150 XP total against a 1000 cap, so the rank moves
// across the whole story.
export const RANKS = [
  [0, 'NOBODY'],
  [150, 'SMALL TIME'],
  [400, 'STREET SMART'],
  [700, 'HUSTLER'],
  [1000, 'KINGPIN'],
];
export const XP_MAX = 1000;

// Weapon unlocks: slot index unlocked by completing a job (null = none).
// Start: FISTS + P9 PISTOL. Job 2 → VIPER SMG, job 3 → SCATTERGUN,
// job 4 → LONGSHOT.
export function rankFor(xp) {
  let r = 'NOBODY';
  for (const [t, n] of RANKS) if (xp >= t) r = n;
  return r;
}
