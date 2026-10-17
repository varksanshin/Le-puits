"use strict";
// ---------- 27b. Gardiens des reliques (mini-boss) ----------
/* Chaque relique de skill est gardée. En entrant dans sa salle, les issues se ferment et son gardien surgit.
   La relique n'apparaît qu'une fois le gardien vaincu, et la salle ne se rouvre qu'une fois la relique prise.
   Chaque gardien a ses attaques, toujours annoncées (il s'illumine en rouge, des marques rouges au sol ou au plafond),
   et une seconde phase sous la moitié de ses PV : il enrage, attaque plus souvent et ajoute un coup.
     double saut → la Reine des larves : pond des larves, crache de l'acide, s'enfouit et ressurgit sous tes pieds
     dash        → le Contremaître : charge, frappe le sol et fait tomber des rochers ; enragé, chaque mur percuté fait trembler la salle
     grappin     → le Geôlier : lance des os en éventail, fait pleuvoir des os, bondit en arrière si tu l'approches
     frappe      → la Feu-Mère : des orbes de feu tournent autour d'elle, elle fonce sur toi en laissant du feu, se divise
     projectile  → le Roi-Champignon : bondit, fait trembler le sol en retombant, lâche des nuages de spores
     phase       → l'Ombre affamée : disparaît et réapparaît derrière toi, crée des leurres d'ombre */
const MINI_BOSSES = {
  doubleJump: { base: "crawler",   name: "La Reine des larves", hp: 22, scale: 2,   speed: 1.3, every: 3.4, attacks: ["brood", "acid", "burrow"] },
  dash:       { base: "golem",     name: "Le Contremaître",     hp: 30, scale: 1.3, speed: 1.2, every: 3.8, attacks: ["rocks", "stomp"] },
  grapple:    { base: "squelette", name: "Le Geôlier",          hp: 26, scale: 1.7, speed: 1.1, every: 3.2, attacks: ["bonerain", "fan"], volley: true },
  smash:      { base: "wisp",      name: "La Feu-Mère",         hp: 22, scale: 2.2, speed: 0.9, every: 3.6, attacks: ["firedash", "firedash", "orbs"], split: true, orbs: 3 },
  bolt:       { base: "champi",    name: "Le Roi-Champignon",   hp: 30, scale: 2,   speed: 1.2, every: 3.6, attacks: ["spores"], quake: true },
  phase:      { base: "rodeur",    name: "L'Ombre affamée",     hp: 32, scale: 1.8, speed: 1.4, every: 3.0, attacks: ["vanish", "vanish", "decoys"] },
};
const miniHpMult = owned => Math.min(1, 0.65 + 0.07 * owned) * (gameMode === "chaos" ? 0.9 : 1);
let minis = [], miniBeaten = new Set(), miniActive = null;
let miniWarns = [], miniZones = [];                                   // marques d'alerte, zones dangereuses (feu, spores)

// Au chargement de la map : chaque relique est cachée jusqu'à la mort de son gardien
function setupMinis() {
  minis = []; miniActive = null; miniWarns = []; miniZones = [];
  for (const r of relics) {
    const def = MINI_BOSSES[r.skill];
    if (!def) continue;
    const c = Math.floor((r.x / T - 1) / CELL_W), row = Math.floor((r.y / T - 1) / CELL_H);
    const room = { x: (1 + c * CELL_W) * T, y: (1 + row * CELL_H) * T, w: ROOM_W * T, h: ROOM_H * T, c0: 1 + c * CELL_W, r0: 1 + row * CELL_H };
    const key = `${r.skill}@${c},${row}`;
    const m = { key, relic: r, def, room, state: miniBeaten.has(key) ? "done" : "wait", seal: null };
    r.guarded = m.state !== "done";
    minis.push(m);
  }
}

// ----- Les issues de la salle se ferment pendant le combat -----
function sealRoom(m) {
  const { c0, r0 } = m.room, cells = [];
  for (let c = c0 - 1; c <= c0 + ROOM_W; c++) for (const r of [r0 - 1, r0 + ROOM_H]) cells.push([c, r]);
  for (let r = r0; r < r0 + ROOM_H; r++) for (const c of [c0 - 1, c0 + ROOM_W]) cells.push([c, r]);
  m.seal = [];
  for (const [c, r] of cells) {
    const t = tile(c, r);
    if (r < 0 || c < 0 || r >= MH || c >= MW || (solid(t) && t !== "b")) continue;
    m.seal.push([c, r, t === "b" ? "." : t]);
    grid[r][c] = "b";
  }
  // Après une chute dans des pics, on doit réapparaître DANS la salle fermée, pas dehors
  const p = player, pc = Math.floor((p.x + p.w / 2) / T), pr = Math.floor((p.y + p.h - 1) / T);
  let best = null, bd = 1e9;
  for (let r = r0; r < r0 + ROOM_H; r++) for (let c = c0 + 1; c < c0 + ROOM_W - 1; c++) {
    if (tile(c, r) !== "." || solid(tile(c, r - 1)) || !solid(tile(c, r + 1)) || tile(c, r + 1) === "=") continue;
    if ([-1, 0, 1].some(d => tile(c + d, r) === "^")) continue;
    const d = Math.abs(c - pc) + Math.abs(r - pr);
    if (d < bd) { bd = d; best = [c, r]; }
  }
  if (best) { p.safeX = best[0] * T + 3; p.safeY = (best[1] + 1) * T - p.h; }
}
function unsealRoom(m) {
  if (!m.seal) return;
  for (const [c, r, t] of m.seal) if (grid[r][c] === "b") {
    grid[r][c] = t;
    for (let i = 0; i < 3; i++) particles.push({ x: c * T + Math.random() * T, y: r * T + Math.random() * T, vx: 0, vy: -30 - Math.random() * 30, life: 0.5, max: 0.5, color: "#c4413b", g: 0 });
  }
  m.seal = null;
  toast("Les issues se rouvrent.", 1800);
}

function updateMinis(dt) {
  const p = player;
  if (p.dead) return;
  for (const m of minis) {
    if (!m.relic.taken && !m.seal) {
      const inside = overlap(p, { x: m.room.x + 2 * T, y: m.room.y, w: m.room.w - 4 * T, h: m.room.h });
      // On ne ressort jamais d'une salle de relique sans la relique : sans elle, on risquerait d'être bloqué plus loin
      if (inside && m.state === "wait") spawnMini(m);
      else if (inside && m.state === "done") { sealRoom(m); toast("Prends la relique pour rouvrir la salle.", 2200); }
    }
    if (m.seal && m.relic.taken) unsealRoom(m);
  }
  if (miniActive) {
    const e = miniActive.enemy, r = miniActive.room;
    bossFillEl.style.width = `${Math.max(0, e.hp / e.maxHp) * 100}%`;
    const near = overlap(p, { x: r.x - T, y: r.y - T, w: r.w + 2 * T, h: r.h + 2 * T });
    if (!bossFight) { bossBarEl.hidden = !near; if (near) bossNameEl.textContent = miniActive.def.name + (e.enraged ? " · enragé" : ""); }
    bossBarEl.dataset.tier = e.enraged ? "abyss" : "normal";
    if (e.dead) beatMini(miniActive);
  }
  // Marques d'alerte : quand le temps est écoulé, l'attaque tombe
  for (const w of miniWarns) { w.t -= dt; if (w.t <= 0 && !w.done) { w.done = true; w.act(); } }
  miniWarns = miniWarns.filter(w => !w.done);
  // Zones dangereuses
  for (const z of miniZones) {
    z.life -= dt; z.tick = Math.max(0, (z.tick || 0) - dt);
    if (z.life > 0 && z.tick <= 0 && overlap(p, z)) { z.tick = 0.6; hurtPlayer(z, 1); }
    if (Math.random() < dt * (z.kind === "fire" ? 16 : 8)) particles.push({ x: z.x + Math.random() * z.w, y: z.y + z.h * (z.kind === "fire" ? 0.6 : Math.random()), vx: (Math.random() - 0.5) * 10, vy: -15 - Math.random() * 20, life: 0.5, max: 0.5, color: z.kind === "fire" ? (Math.random() < 0.5 ? "#f2b54a" : "#e8913a") : "#9cbf6a", g: -10, s: 1 });
  }
  miniZones = miniZones.filter(z => z.life > 0);
}
// Trouve une place au sol, assez grande, la plus loin possible du héros
function miniSpot(m, w, h, fly) {
  const p = player, c0 = Math.floor(m.room.x / T), r0 = Math.floor(m.room.y / T);
  let best = null, bd = -1;
  for (let r = r0 + 1; r < r0 + ROOM_H; r++) for (let c = c0 + 1; c < c0 + ROOM_W - 1; c++) {
    if (!fly && !solid(tile(c, r + 1)) && tile(c, r + 1) !== "-") continue;
    const x = c * T + T / 2 - w / 2, y = (r + 1) * T - h - (fly ? 8 : 0);
    if (rectSolid(x, y, w, h)) continue;
    if (tile(c, r) === "^" || tile(c, r) === "~") continue;
    const d = Math.abs(x - p.x) + Math.abs(y - p.y) * 0.5;
    if (d > bd) { bd = d; best = { x, y }; }
  }
  return best;
}
function spawnMini(m) {
  const d = m.def, base = ENEMY_TYPES[d.base];
  let sc = d.scale, spot = null;
  while (sc >= 1 && !(spot = miniSpot(m, base.w * sc, base.h * sc, base.fly))) sc -= 0.2;
  if (!spot) { m.state = "done"; m.relic.guarded = false; sealRoom(m); return; }   // pas la place : la relique est libre, mais il faut la prendre
  const e = makeEnemy({ type: d.base, cx: 0, cy: 0 });
  Object.assign(e, { x: spot.x, y: spot.y, prevX: spot.x, prevY: spot.y, homeX: spot.x, homeY: spot.y, w: base.w * sc, h: base.h * sc });
  // Les PV suivent ta progression, pas la profondeur : 65 % de sa vie si c'est ta première relique,
  // +7 % par relique déjà obtenue, jamais plus de 100 %. En chaos (ordre des reliques au hasard), encore 10 % de moins.
  const owned = SKILLS.filter(s => skills[s.id]).length;
  e.hp = e.maxHp = Math.max(8, Math.round(d.hp * miniHpMult(owned))) * (has("couronne") ? 1.5 : 1);
  e.baseSpeed = (base.speed || 30) * d.speed; e.speed = e.baseSpeed;
  e.weight = 0.15; e.damage = d.base === "golem" ? 2 : 1;
  e.mini = d; e.miniScale = sc; e.dir = Math.sign(player.x - e.x) || 1;
  e.splitAt = d.split ? [0.75, 0.5, 0.25] : null; e.decoyAt = d.attacks.includes("decoys") ? [0.66, 0.33] : null;
  e.atkT = 2; e.attackIdx = 0; e.windFx = 0; e.orbA = 0;
  enemies.push(e);
  m.state = "fight"; m.enemy = e; miniActive = m;
  sealRoom(m);
  bossNameEl.textContent = d.name; bossBarEl.dataset.tier = "normal"; bossBarEl.hidden = false;
  bossFillEl.style.width = "100%";
  shake(4, 0.4); freeze = Math.max(freeze, 0.25);
  burst(e.x + e.w / 2, e.y + e.h / 2, 40, "#c4413b", 140);
  toast(`<b>${d.name}</b> garde la relique ! Les issues se ferment.`, 2600, true);
}
function beatMini(m) {
  m.state = "done"; miniBeaten.add(m.key); miniActive = null;
  if (!bossFight) bossBarEl.hidden = true;
  // ses créatures et ses attaques disparaissent avec lui
  for (const o of enemies) if (o.summonedBy === m.enemy) { o.dead = true; burst(o.x + o.w / 2, o.y + o.h / 2, 8, "#8a7f74", 60); }
  miniWarns = []; miniZones = [];
  const r = m.relic; r.guarded = false;
  burst(r.x + 4, r.y + 4, 50, RELIC_INFO[r.skill].color, 160);
  shake(3, 0.3); freeze = Math.max(freeze, 0.2);
  toast(`${m.def.name} est vaincu. Prends la relique pour rouvrir la salle !`, 2800);
  recordSplit(m.def.name);
}

// ----- Outils pour les attaques -----
const roomOfMini = e => minis.find(m => m.enemy === e);
function floorBelow(x, y) {                          // le sol sous un point (en pixels)
  let r = Math.floor(y / T); while (r < MH && !solid(tile(Math.floor(x / T), r))) r++;
  return r * T;
}
function ceilingAbove(x, y) {
  let r = Math.floor(y / T); while (r > 0 && !solid(tile(Math.floor(x / T), r))) r--;
  return (r + 1) * T;
}
function warn(x, y, w, kind, delay, act) { miniWarns.push({ x, y, w, kind, t: delay, max: delay, act }); }
function summon(e, type, x, y, extra = {}) {
  const k = makeEnemy({ type, cx: 0, cy: 0 });
  Object.assign(k, { x, y, prevX: x, prevY: y, homeX: x, homeY: y, summonedBy: e }, extra);
  enemies.push(k);
  return k;
}
const toPlayer = e => Math.sign((player.x + player.w / 2) - (e.x + e.w / 2)) || 1;

// Les attaques spéciales : annonce (le gardien rougeoie) puis exécution
const MINI_ATTACKS = {
  brood(e) {                                         // la Reine pond trois larves
    const kids = enemies.filter(o => o.summonedBy === e && !o.dead).length;
    for (let i = 0; i < Math.min(3, 4 - kids); i++) {
      const k = summon(e, "crawler", e.x + e.w / 2 - 7, e.y + e.h - 8, { dir: i % 2 ? 1 : -1 });
      k.vy = -160 - i * 30; k.vx = (i - 1) * 70;
    }
    burst(e.x + e.w / 2, e.y + e.h - 4, 14, "#9cbf6a", 80);
  },
  acid(e) {                                          // trois crachats d'acide en cloche
    const ex = e.x + e.w / 2, ey = e.y + 2, px = player.x + player.w / 2, py = player.y + player.h / 2, g = 420;
    for (const k of e.enraged ? [-40, -20, 0, 20, 40] : [-28, 0, 28]) {
      const dx = px + k - ex, tt = Math.max(0.5, Math.min(1.1, Math.abs(dx) / 130));
      shots.push({ x: ex - 3, y: ey - 3, w: 6, h: 6, vx: dx / tt, vy: (py - ey - 0.5 * g * tt * tt) / tt, grav: g, life: 3 });
    }
  },
  burrow(e) {                                        // elle s'enfouit… et ressurgit sous tes pieds
    e.hidden = true; e.vx = 0;
    burst(e.x + e.w / 2, e.y + e.h, 20, "#6e4426", 90); shake(2, 0.2);
    const tx = player.x + player.w / 2, fy = floorBelow(tx, player.y + player.h - 2);
    warn(tx - 16, fy - 2, 32, "ground", 0.9, () => {
      e.hidden = false; e.x = tx - e.w / 2; e.y = fy - e.h; e.prevX = e.x; e.prevY = e.y; e.vy = -260;
      burst(tx, fy, 30, "#6e4426", 140); shake(4, 0.3);
      for (const s of [-1, 1]) shots.push({ kind: "wave", x: tx - 5, y: fy - 10, w: 10, h: 10, vx: s * 140, vy: 0, grav: 0, life: 0.9 });
      if (overlap(player, { x: tx - 16, y: fy - 24, w: 32, h: 24 })) hurtPlayer({ x: tx, y: fy, w: 1, h: 1 }, 1);
    });
  },
  rocks(e) {                                         // il frappe le sol : des rochers tombent du plafond
    shake(4, 0.35); burst(e.x + e.w / 2, e.y + e.h, 24, "#7a7180", 120);
    const px = player.x + player.w / 2, n = e.enraged ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const x = px + (i - (n - 1) / 2) * 30 + (Math.random() - 0.5) * 12, cy = ceilingAbove(x, player.y);
      warn(x - 6, cy, 12, "ceiling", 0.8 + i * 0.12, () => shots.push({ kind: "rock", x: x - 5, y: cy, w: 10, h: 10, vx: 0, vy: 40, grav: 600, life: 3 }));
    }
  },
  stomp(e) {                                         // deux ondes de choc au sol
    shake(3, 0.25);
    for (const s of [-1, 1]) shots.push({ kind: "wave", x: e.x + e.w / 2 - 5 + s * e.w / 2, y: e.y + e.h - 10, w: 10, h: 10, vx: s * 170, vy: 0, grav: 0, life: 1.2 });
    if (e.enraged) warn(0, 0, 0, "none", 0.45, () => { if (!e.dead) for (const s of [-1, 1]) shots.push({ kind: "wave", x: e.x + e.w / 2 - 5, y: e.y + e.h - 10, w: 10, h: 10, vx: s * 120, vy: 0, grav: 0, life: 1.4 }); });
  },
  fan(e) {                                           // un éventail d'os
    const ex = e.x + e.w / 2, ey = e.y + 4, dir = toPlayer(e), n = e.enraged ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + dir * (0.35 + i * 0.16);
      shots.push({ kind: "bone", x: ex - 3, y: ey, w: 6, h: 6, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, grav: 380, life: 3 });
    }
  },
  bonerain(e) {                                      // une pluie d'os tout autour de toi
    const px = player.x + player.w / 2, n = e.enraged ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const x = px + (i - (n - 1) / 2) * 26, cy = ceilingAbove(x, player.y);
      warn(x - 6, cy, 12, "ceiling", 0.7 + (i % 2) * 0.25, () => shots.push({ kind: "bone", x: x - 3, y: cy, w: 6, h: 6, vx: 0, vy: 60, grav: 520, life: 3 }));
    }
  },
  firedash(e) {                                      // elle fonce sur toi et laisse une traînée de feu
    const dx = (player.x + player.w / 2) - (e.x + e.w / 2), dy = (player.y + player.h / 2) - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1;
    e.dashT = 0.55; e.dashVx = dx / d * 230; e.dashVy = dy / d * 230;
  },
  orbs(e) { e.orbBoost = 2.5; },                     // les orbes s'écartent et accélèrent un moment
  spores(e) {                                        // des nuages de spores qui piquent
    const n = e.enraged ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const x = e.x + e.w / 2 + (i - (n - 1) / 2) * 34 + (Math.random() - 0.5) * 10, fy = floorBelow(x, e.y + e.h - 4);
      warn(x - 14, fy - 2, 28, "ground", 0.5, () => miniZones.push({ kind: "spore", x: x - 14, y: fy - 26, w: 28, h: 26, life: 4 }));
    }
    burst(e.x + e.w / 2, e.y, 20, "#9cbf6a", 80);
  },
  vanish(e) {                                        // elle disparaît… et réapparaît derrière toi
    e.hidden = true; burst(e.x + e.w / 2, e.y + e.h / 2, 24, "#3a2a48", 100);
    const behind = -player.face, x = player.x + player.w / 2 + behind * 34, fy = floorBelow(x, player.y + player.h - 2);
    warn(x - 12, fy - 2, 24, "ground", e.enraged ? 0.55 : 0.8, () => {
      const nx = Math.max(roomOfMini(e).room.x + 4, Math.min(roomOfMini(e).room.x + roomOfMini(e).room.w - e.w - 4, x - e.w / 2));
      e.hidden = false; e.x = nx; e.y = fy - e.h; e.prevX = e.x; e.prevY = e.y;
      e.dir = toPlayer(e); e.state = "wind"; e.stateT = 0.25; e.cooldown = 0;
      burst(e.x + e.w / 2, e.y + e.h / 2, 24, "#3a2a48", 100);
    });
  },
  decoys(e) {                                        // deux leurres d'ombre (un coup suffit à les dissiper)
    for (const s of [-1, 1]) {
      const k = summon(e, "rodeur", e.x + s * 40, e.y + e.h - 7, { decoy: true, hp: 1, dir: s });
      if (rectSolid(k.x, k.y, k.w, k.h)) k.x = e.x;
    }
    burst(e.x + e.w / 2, e.y + e.h / 2, 30, "#3a2a48", 120);
  },
};

// Chaque image : comportements en plus de ceux du monstre de base
function updateMiniExtra(e, dt, p) {
  const d = e.mini;
  // Seconde phase sous la moitié des PV
  if (!e.enraged && e.hp <= e.maxHp / 2) {
    e.enraged = true; e.baseSpeed *= 1.25;
    shake(4, 0.4); freeze = Math.max(freeze, 0.2);
    burst(e.x + e.w / 2, e.y + e.h / 2, 40, "#ff5a3a", 160);
    toast(`<b>${d.name}</b> enrage !`, 2000, true);
  }
  e.windFx = Math.max(0, e.windFx - dt);
  // Attaques spéciales, à tour de rôle, toujours annoncées
  if (!e.hidden && !e.dashT) {
    e.atkT -= dt;
    if (e.atkT <= 0 && !e.pending) {
      e.pending = d.attacks[e.attackIdx++ % d.attacks.length];
      e.windFx = e.enraged ? 0.45 : 0.65;            // il rougeoie : l'attaque arrive
    }
    if (e.pending && e.windFx <= 0) {
      MINI_ATTACKS[e.pending](e); e.pending = null;
      e.atkT = d.every * (e.enraged ? 0.65 : 1) * (gameMode === "chaos" ? 1.15 : 1) * (0.85 + Math.random() * 0.3);
    }
  }
  // La Feu-Mère fonce : on remplace son mouvement normal
  if (e.dashT > 0) {
    e.dashT -= dt; e.x += e.dashVx * dt; e.y += e.dashVy * dt;
    const r = roomOfMini(e).room;
    e.x = Math.max(r.x, Math.min(r.x + r.w - e.w, e.x)); e.y = Math.max(r.y, Math.min(r.y + r.h - e.h, e.y));
    e.trailT = (e.trailT || 0) - dt;
    if (e.trailT <= 0) { e.trailT = 0.07; const fy = floorBelow(e.x + e.w / 2, e.y + e.h); if (fy - (e.y + e.h) < 40) miniZones.push({ kind: "fire", x: e.x + e.w / 2 - 8, y: fy - 10, w: 16, h: 10, life: e.enraged ? 2.6 : 1.8 }); }
    if (e.dashT <= 0) e.dashT = 0;
  }
  // Orbes de feu qui tournent autour de la Feu-Mère
  if (d.orbs) {
    e.orbBoost = Math.max(0, (e.orbBoost || 0) - dt);
    e.orbA += dt * (2.2 + (e.orbBoost > 0 ? 2.5 : 0) + (e.enraged ? 0.8 : 0));
    const n = d.orbs + (e.enraged ? 2 : 0), rad = 20 + (e.orbBoost > 0 ? 14 : 0) + e.w * 0.3;
    e.orbList = [];
    for (let i = 0; i < n; i++) {
      const a = e.orbA + i * Math.PI * 2 / n, o = { x: e.x + e.w / 2 + Math.cos(a) * rad - 3, y: e.y + e.h / 2 + Math.sin(a) * rad - 3, w: 6, h: 6 };
      e.orbList.push(o);
      if (!p.phasing && overlap(p, o)) hurtPlayer(o, 1);
    }
  }
  if (d.volley) {                                    // le Geôlier lance trois os d'un coup, et bondit en arrière si tu l'approches
    if (e.lastState === "throw" && e.state !== "throw") {
      const s = shots[shots.length - 1];
      if (s && s.kind === "bone") for (const k of [0.7, 1.35]) shots.push({ ...s, vx: s.vx * k, vy: s.vy * (k > 1 ? 1.1 : 0.8) });
    }
    e.lastState = e.state;
    e.hopCd = Math.max(0, (e.hopCd || 0) - dt);
    if (e.onGround && e.hopCd <= 0 && Math.abs((p.x + p.w / 2) - (e.x + e.w / 2)) < 42 && Math.abs(p.y - e.y) < 40) {
      e.hopCd = e.enraged ? 1.4 : 2.2; e.vy = -280; e.vx = -toPlayer(e) * 170; e.stun = 0.4;
      burst(e.x + e.w / 2, e.y + e.h, 10, "#8a7f74", 60);
    }
  }
  if (d.split && e.splitAt && e.splitAt.length && e.hp / e.maxHp <= e.splitAt[0]) {   // la Feu-Mère se divise
    e.splitAt.shift();
    for (const s of [-1, 1]) { const w = summon(e, "wisp", e.x + e.w / 2 + s * 12, e.y); w.vx = s * 90; w.vy = -60; }
    burst(e.x + e.w / 2, e.y + e.h / 2, 24, "#8ff0d0", 120);
  }
  if (e.decoyAt && e.decoyAt.length && e.hp / e.maxHp <= e.decoyAt[0]) { e.decoyAt.shift(); MINI_ATTACKS.decoys(e); }
  if (d.quake) {                                     // le Roi-Champignon fait trembler le sol en retombant (plus souvent quand il enrage)
    if (e.lastState === "air" && e.state === "idle") {
      for (const s of [-1, 1]) shots.push({ kind: "wave", x: e.x + e.w / 2 - 5 + s * e.w / 2, y: e.y + e.h - 10, w: 10, h: 10, vx: s * 150, vy: 0, grav: 0, life: 1.1 });
      shake(3, 0.2);
      if (e.enraged) e.cooldown = 0.15;
    }
    e.lastState = e.state;
  }
  // Le Contremaître enragé : chaque mur percuté fait tomber des rochers
  if (d.base === "golem" && e.enraged && e.daze > 1.2 && !e.wallRocks) { e.wallRocks = true; MINI_ATTACKS.rocks(e); }
  if (e.daze <= 0) e.wallRocks = false;
}

// ----- Dessin -----
// Le sprite du monstre de base, en plus grand, avec une aura ; il rougeoie avant une attaque
function drawMiniSprite(e, x, y, white) {
  if (e.hidden) return true;
  const f = enemyFrame(e); if (!f) return false;
  const sc = e.miniScale, w = spriteW(f), h = spriteH(f);
  const glow = e.windFx > 0 && Math.floor(time * 20) % 2 === 0;
  const c = spriteCanvas(f, white || glow);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const cx = Math.round((x + e.w / 2) * S) / S, by = Math.round((y + e.h) * S) / S;
  ctx.translate(cx, e.fly ? by - e.h / 2 + h * sc / 2 : by);
  const k = e.hitFx > 0 ? e.hitFx / 0.16 : 0;
  ctx.scale(((e.dir || 1) < 0 ? -sc : sc) * (1 + 0.2 * k), sc * (1 - 0.15 * k));
  if (glow) ctx.globalAlpha = 0.85;
  ctx.drawImage(c, -w / 2, -h);
  ctx.restore();
  // une aura au sol pour le reconnaître (rouge vif quand il enrage)
  ctx.fillStyle = e.enraged ? `rgba(255,90,58,${0.45 + 0.25 * Math.sin(time * 10)})` : `rgba(196,65,59,${0.25 + 0.15 * Math.sin(time * 6)})`;
  ctx.fillRect(x - 2, y + e.h - 1, e.w + 4, 1.5);
  return true;
}
// Marques d'alerte, zones de feu et de spores, orbes : dessinés par-dessus le monde
function drawMiniFx(ox, oy) {
  for (const w of miniWarns) {
    if (w.kind === "none") continue;
    const k = 1 - w.t / w.max, blink = Math.floor(time * (8 + k * 16)) % 2 === 0;
    ctx.fillStyle = `rgba(232,60,50,${blink ? 0.85 : 0.35})`;
    if (w.kind === "ceiling") {
      ctx.fillRect(snap(w.x - ox), snap(w.y - oy), w.w, 2);
      ctx.fillStyle = `rgba(232,60,50,${0.12 + 0.2 * k})`; ctx.fillRect(snap(w.x + w.w / 2 - 1 - ox), snap(w.y - oy), 2, 60 * k);
    } else {
      ctx.fillRect(snap(w.x - ox), snap(w.y - oy), w.w, 2);
      for (let i = 0; i < 3; i++) ctx.fillRect(snap(w.x + w.w * (0.2 + i * 0.3) - ox), snap(w.y - oy - 2 - k * 4), 1.5, 1.5);
    }
  }
  for (const z of miniZones) {
    const a = Math.min(1, z.life * 2);
    if (z.kind === "holy") {                              // colonne de lumière du Jugement céleste
      const g = ctx.createLinearGradient(z.x - ox, 0, z.x + z.w - ox, 0);
      g.addColorStop(0, "rgba(255,246,200,0)"); g.addColorStop(0.5, `rgba(255,250,225,${0.9 * a})`); g.addColorStop(1, "rgba(255,246,200,0)");
      ctx.fillStyle = g; ctx.fillRect(z.x - ox, z.y - oy, z.w, z.h);
    } else if (z.kind === "fire") {
      ctx.fillStyle = `rgba(232,105,42,${0.55 * a})`; ctx.fillRect(snap(z.x - ox), snap(z.y + 4 - oy), z.w, z.h - 4);
      ctx.fillStyle = `rgba(242,181,74,${0.8 * a})`;
      for (let i = 0; i < 3; i++) ctx.fillRect(snap(z.x + 2 + i * 5 - ox), snap(z.y + 2 - oy - Math.abs(Math.sin(time * 14 + i)) * 3), 2, 4);
    } else {
      const g = ctx.createRadialGradient(z.x + z.w / 2 - ox, z.y + z.h / 2 - oy, 2, z.x + z.w / 2 - ox, z.y + z.h / 2 - oy, z.w / 2 + 4);
      g.addColorStop(0, `rgba(156,191,106,${0.45 * a})`); g.addColorStop(1, "rgba(156,191,106,0)");
      ctx.fillStyle = g; ctx.fillRect(z.x - 4 - ox, z.y - 4 - oy, z.w + 8, z.h + 8);
    }
  }
  for (const e of enemies) if (e.mini && e.orbList && !e.dead) for (const o of e.orbList) {
    ctx.fillStyle = "rgba(242,181,74,0.35)"; ctx.fillRect(snap(o.x - 1 - ox), snap(o.y - 1 - oy), 8, 8);
    ctx.fillStyle = "#f2b54a"; ctx.fillRect(snap(o.x - ox), snap(o.y - oy), 6, 6);
    ctx.fillStyle = "#fff3d6"; ctx.fillRect(snap(o.x + 2 - ox), snap(o.y + 2 - oy), 2, 2);
  }
}
function drawRock(s, x, y) {
  ctx.fillStyle = "#2a2430"; ctx.fillRect(x - 0.67, y - 0.67, s.w + 1.33, s.h + 1.33);
  ctx.fillStyle = "#6a6270"; ctx.fillRect(x, y, s.w, s.h);
  ctx.fillStyle = "#8a8290"; ctx.fillRect(x + 1, y + 1, s.w * 0.5, 2);
}
