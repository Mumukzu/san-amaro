// SAN AMARO — HUD. All panels are plain DOM (index.html); this module
// updates them, draws the minimap canvas, and builds the SVG cartoon
// portraits (same face rule as the 3D characters: clear eyes, brows, nose,
// mouth, hair). Written from scratch from the re-author spec.
const $ = (id) => document.getElementById(id);

// ---- SVG cartoon faces (for dialogue + crew portraits) ----
export function faceSVG(style = 'generic', skin = '#e8b88a', hair = '#1c1410') {
  const eye = (cx) => `<circle cx="${cx}" cy="28" r="5.5" fill="#fff"/>
    <circle cx="${cx}" cy="28.5" r="2.6" fill="#14141a"/>`;
  const brow = (x1) => `<rect x="${x1}" y="19" width="11" height="2.6" rx="1.3" fill="#1c1410"/>`;
  const mouth = `<path d="M26 44 Q32 49 38 44" stroke="#5a2a2a" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const nose = `<path d="M32 32 L30 38 L34 38" stroke="#b98a5e" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  let top = '';
  if (style === 'jay') {
    // black cap worn backwards (brim at the back = hidden in a front portrait)
    top = `<path d="M10 26 Q12 8 32 8 Q52 8 54 26 Q44 18 32 18 Q20 18 10 26" fill="#14141a"/>
      <rect x="10" y="22" width="44" height="4" rx="2" fill="#14141a"/>`;
  } else if (style === 'nadia') {
    top = `<path d="M10 28 Q12 8 32 8 Q52 8 54 28 Q44 19 32 19 Q20 19 10 28" fill="#d92a3a"/>
      <circle cx="50" cy="14" r="6" fill="#1c1410"/>`;
  } else if (style === 'theo') {
    top = `<path d="M10 26 Q12 9 32 9 Q52 9 54 26 Q44 19 32 19 Q20 19 10 26" fill="#8a8a8a"/>
      <rect x="18" y="24" width="12" height="7" rx="3" fill="#14141a"/>
      <rect x="34" y="24" width="12" height="7" rx="3" fill="#14141a"/>
      <rect x="30" y="26" width="4" height="2" fill="#14141a"/>
      <path d="M20 46 Q32 60 44 46 L44 56 Q32 62 20 56 Z" fill="#c8c0b8" opacity=".9"/>`;
  } else if (style === 'mara') {
    top = `<path d="M10 28 Q12 8 32 8 Q52 8 54 28 L54 20 Q40 10 32 12 Q18 14 10 28" fill="#e8c85a"/>
      <rect x="18" y="24" width="12" height="7" rx="3" fill="#22e6ff" opacity=".85"/>
      <rect x="34" y="24" width="12" height="7" rx="3" fill="#22e6ff" opacity=".85"/>
      <rect x="30" y="26" width="4" height="2" fill="#14141a"/>`;
  } else {
    top = `<path d="M10 28 Q12 8 32 8 Q52 8 54 28 Q44 19 32 19 Q20 19 10 28" fill="${hair}"/>`;
  }
  const shades = (style === 'theo' || style === 'mara');
  const eyes = shades ? '' : eye(24) + eye(40) + brow(18) + brow(35);
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="33" r="24" fill="${skin}"/>${top}${eyes}${nose}${mouth}</svg>`;
}

// ---- wanted stars ----
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4L18 20.5 12 17l-6 3.5 1.25-6.8L2.5 9.3l6.6-1.04z"/></svg>';
export function buildStars() { $('stars').innerHTML = STAR.repeat(5); }
export function setStars(n) {
  [...$('stars').children].forEach((s, i) => s.classList.toggle('lit', i < n));
}

// ---- weapon wheel ----
const WEAPONS = [
  { name: 'FISTS', ammo: '—', svg: '<circle cx="11" cy="11" r="4"/><circle cx="20" cy="11" r="4"/>' },
  { name: 'P9 PISTOL', ammo: '12/48', svg: '<path d="M4 8h18v4h-6l-2 8h-4l1-8H4z"/>' },
  { name: 'VIPER SMG', ammo: '32/128', svg: '<path d="M3 8h20v4h-8l-2 8h-4l1-8H3z"/><path d="M14 12l3 6"/>' },
  { name: 'SCATTERGUN', ammo: '6/18', svg: '<path d="M3 9h22M3 13h22"/><path d="M18 9v8"/>' },
  { name: 'LONGSHOT', ammo: '24/96', svg: '<path d="M2 11h26"/><rect x="12" y="6" width="7" height="4"/><path d="M20 11l4 3"/>' },
];
export function buildWeapons() {
  $('weapons').innerHTML = WEAPONS.map((w, i) =>
    `<div class="slot" id="slot${i}"><div class="ic"><svg viewBox="0 0 30 22">${w.svg}</svg></div>
     <div class="nm">${w.name}</div><div class="am">${w.ammo}</div></div>`).join('');
}
export function setWeapon(i, ammo) {
  [...$('weapons').children].forEach((s, k) => s.classList.toggle('active', k === i));
  if (ammo !== undefined) $(`slot${i}`).querySelector('.am').textContent = ammo;
}
export function lockWeapons(lockedFrom) {
  [...$('weapons').children].forEach((s, k) => s.classList.toggle('locked', k >= lockedFrom));
}

// ---- mission panel ----
export function setMission(m) {
  if (m.chapter) $('mp-chapter').textContent = m.chapter;
  if (m.title) $('mp-title').textContent = m.title;
  if (m.objective) $('mp-objective').textContent = m.objective;
  if (m.desc) $('mp-desc').textContent = m.desc;
  if (m.fill !== undefined) $('mp-fill').style.width = `${Math.round(m.fill * 100)}%`;
  if (m.stage) $('mp-stage').textContent = m.stage;
  if (m.par) $('mp-par').textContent = m.par;
  if (m.time) $('mp-time').textContent = m.time;
}

// ---- wanted / money / XP ----
export function setWanted(stars, status, cls, money, rank, xp, xpMax) {
  setStars(stars);
  const b = $('status-badge');
  b.textContent = status;
  b.className = cls || '';
  if (money !== undefined) $('money').textContent = money;
  if (rank !== undefined) $('xp-rank').textContent = rank;
  if (xp !== undefined && xpMax !== undefined) {
    $('xp-fill').style.width = `${Math.round((xp / xpMax) * 100)}%`;
    $('xp-num').textContent = `${xp} / ${xpMax} XP`;
  }
}

// ---- police response panel ----
export function setPolice(rows) {
  rows.forEach((r, i) => {
    const d = $(`cop${i}-dist`), b = $(`cop${i}-badge`);
    if (!d || !b) return;
    d.textContent = r.dist;
    b.textContent = r.status;
    b.className = 'badge ' + (r.status === 'PURSUIT' ? 'pursuit' : r.status === 'EN ROUTE' ? 'enroute' : 'standby');
  });
}

// ---- vehicle readout ----
export function setVehicle(v) {
  $('vehicle').style.display = '';
  if (v.name) $('veh-name').textContent = v.name;
  if (v.speed !== undefined) $('veh-speed').innerHTML = `${v.speed} <small>km/h</small>`;
  if (v.condition !== undefined) {
    $('veh-cond').style.width = `${v.condition}%`;
    $('veh-cond-num').textContent = `${v.condition}%`;
  }
  if (v.nitro !== undefined) {
    $('veh-nitro').style.width = `${v.nitro}%`;
    $('veh-nitro-num').textContent = `${v.nitro}%`;
  }
  if (v.station) $('radio-station').textContent = v.station;
  if (v.track) $('radio-track').textContent = v.track;
  if (v.genre) $('radio-genre').textContent = v.genre;
}
export function hideVehicle() { $('vehicle').style.display = 'none'; }
export function showVehicle() { $('vehicle').style.display = ''; }

// ---- district / street (from the player's actual zone + nearest street) ----
// District names for the layout zones; the street line is the nearest
// named street. Only updates the DOM when the label actually changes, so
// this can be called every frame cheaply.
const DISTRICT_NAMES = {
  downtown: 'DOWNTOWN CORE',
  commercial: 'COMMERCIAL ROW',
  residential: 'PALM COURTS',
  industrial: 'THE YARDS',
  spire: 'SPIRE DISTRICT',
  plaza: 'SUNSET PLAZA',
};
let lastDistrict = '', lastStreet = '';
export function setDistrict(zone, street) {
  const d = DISTRICT_NAMES[zone] || 'SAN AMARO';
  if (d !== lastDistrict) { $('district').textContent = d; lastDistrict = d; }
  if (street && street !== lastStreet) { $('street').textContent = street; lastStreet = street; }
}

// City validation badge (under the minimap): the layout validator's
// verdict, e.g. "CITY VALID · 80 BUILDINGS · 673 TREES". Green when the
// city passes, red when it has violations.
export function setCityBadge(summary, passed) {
  const el = $('city-badge');
  if (!el) return;
  el.textContent = summary || 'CITY VALID';
  el.style.color = passed === false ? '#ff2a1a' : '#2aff5a';
}

// ---- dialogue ----
export function setDialogue(name, line, style, skin, hair) {
  $('dlg-name').textContent = name;
  $('dlg-line').textContent = line;
  $('dlg-portrait').innerHTML = faceSVG(style || 'nadia', skin || '#8a5a3a', hair || '#1c1410');
}

// ---- health / armour / crew ----
export function setHealth(hp, armor) {
  $('hp-fill').style.width = `${hp}%`; $('hp-num').textContent = hp;
  $('ar-fill').style.width = `${armor}%`; $('ar-num').textContent = armor;
}
export function setCrew(members) {
  $('crew').innerHTML = members.map((m) =>
    `<div class="crew-mate"><div class="face">${faceSVG(m.style, m.skin, m.hair)}</div>${m.name}</div>`).join('');
}

// ---- toast ----
export function showToast(big, sub, ms = 2600) {
  $('toast-big').textContent = big;
  $('toast-sub').textContent = sub;
  $('toast').style.display = 'block';
  if (ms) setTimeout(() => { $('toast').style.display = 'none'; }, ms);
}

// ---- minimap ----
const MAP = { x0: -330, x1: 330, z0: -330, z1: 330 };
const STREETS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export function drawMinimap(state) {
  const c = $('minimap');
  if (!c) return;
  const g = c.getContext('2d');
  const S = c.width; // 340
  const px = (x) => ((x - MAP.x0) / (MAP.x1 - MAP.x0)) * S;
  const py = (z) => ((z - MAP.z0) / (MAP.z1 - MAP.z0)) * S;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#0a0d18'; g.fillRect(0, 0, S, S);
  // blocks (subtle)
  g.fillStyle = 'rgba(255,255,255,.045)';
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    g.fillRect(px(-270 + i * 60), py(-270 + j * 60), px(48) - px(0), py(48) - py(0));
  }
  // canal (north band)
  g.fillStyle = '#1b6a7d';
  g.fillRect(0, py(-302), S, py(-262) - py(-302));
  g.fillStyle = '#2fa8a0';
  g.fillRect(px(-8), py(-302), px(8) - px(-8), py(-262) - py(-302)); // bridge
  // streets
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3;
  for (const z of STREETS) { g.beginPath(); g.moveTo(0, py(z)); g.lineTo(S, py(z)); g.stroke(); }
  for (const x of STREETS) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), S); g.stroke(); }
  // mission marker (gold diamond)
  if (state.marker) {
    const mx = px(state.marker.x), my = py(state.marker.z);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.moveTo(mx, my - 9); g.lineTo(mx + 9, my); g.lineTo(mx, my + 9); g.lineTo(mx - 9, my); g.closePath(); g.fill();
    g.strokeStyle = '#0d0f1a'; g.lineWidth = 2; g.stroke();
  }
  // police (red/blue dots)
  for (const p of state.police || []) {
    g.fillStyle = p.color || '#ff2a1a';
    g.beginPath(); g.arc(px(p.x), py(p.z), 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
  }
  // player arrow (white, rotated by heading)
  if (state.player) {
    const x = px(state.player.x), y = py(state.player.z);
    g.save(); g.translate(x, y); g.rotate(state.player.heading || 0);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(-8, 9); g.closePath(); g.fill();
    g.strokeStyle = '#0d0f1a'; g.lineWidth = 2; g.stroke();
    g.restore();
  }
  // compass letters
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '900 17px system-ui';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', S / 2, 14); g.fillText('S', S / 2, S - 14);
  g.fillText('W', 14, S / 2); g.fillText('E', S - 14, S / 2);
}

export function showHUD() { $('hud').classList.remove('hidden'); }
export function hideHUD() { $('hud').classList.add('hidden'); }
