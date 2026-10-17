"use strict";
// ---------- 28h. Les fins : les deux dimensions, les fins alternatives, les scènes de fin ----------
/* 1. Les dimensions. La jauge de lumière décide de la forme du Gardien, et sa défaite ouvre une autre dimension :
        Gardien enragé (lumière pure)   → la DIMENSION CÉLESTE : un royaume blanc et or, des anges de pierre,
                                          le Jugement qui tombe du ciel. Son maître : le Séraphin. Puis « L'Ascension ».
        Gardien dévoré (ténèbres)       → la DIMENSION INFERNALE : un royaume de braise, des démons,
                                          des geysers de feu. Son maître : l'Archidémon. Puis « Le Trône des Abysses ».
        Gardien ordinaire               → pas de dimension : la menace est scellée (ou une fin alternative).
      Chaque dimension est un vrai niveau, plus grand et plus dur : monstres renforcés, danger propre au royaume,
      un seul feu de camp, pas de sauvegarde, et un boss final avec ses propres attaques.
   2. Les fins alternatives remplacent la fin ordinaire quand leur condition est remplie :
        Fin de l'Ascète      : vaincre le Gardien sans porter un seul objet
        Fin de l'Éclair      : le vaincre vite (20 min en histoire, 10 min en chaos)
        Fin du Cartographe   : avoir visité presque tout le puits (95 % des salles) et trouvé tous les secrets
   3. Chaque fin a sa scène animée, avant l'écran de fin. N'importe quelle touche la passe. */

// ----- Textes des fins -----
Object.assign(ENDINGS.pure, {
  name: "L'Ascension", color: "#fff6c8",
  text: "Le Séraphin s'efface dans une pluie de plumes de lumière. Le royaume céleste t'ouvre ses portes, et pour la première fois depuis mille ans, une flamme du puits monte jusqu'au ciel. Tu n'es plus tout à fait humain.",
  note: "",
});
Object.assign(ENDINGS.abyss, {
  name: "Le Trône des Abysses", color: "#e04a1a",
  text: "L'Archidémon s'effondre et son trône de braise reste vide… pas longtemps. Tu t'y assieds. Les flammes se couchent à tes pieds, et quelque part très haut, le puits frissonne : il a un nouveau maître.",
  note: "",
});
Object.assign(ENDINGS, {
  ascete: { name: "Fin de l'Ascète", color: "#e6d6b8",
    text: "Tu remontes du puits comme tu y étais descendu : les mains vides. Le pays ne saura jamais ce que tu as vaincu en bas. Ça te va très bien." },
  eclair: { name: "Fin de l'Éclair", color: "#7fd6ff",
    text: "Le Gardien n'a pas eu le temps de comprendre. Quand le soleil se lève sur Puits-Clair, tu es déjà loin, et l'on raconte qu'un éclair est remonté du puits cette nuit-là." },
  cartographe: { name: "Fin du Cartographe", color: "#c9a07a",
    text: "Chaque salle, chaque passage, chaque mur qui sonnait creux : tout est sur ta carte. Le puits n'a plus de secrets, et ceux qui descendront après toi te devront la vie." },
});
const ENDING_LIST = ["normal", "pure", "abyss", "ascete", "eclair", "cartographe", "true"];

// ----- Les deux dimensions -----
BIOMES.ciel = { name: "Le Royaume céleste", sub: "Au-delà de toute lumière",
  stone: [196, 186, 160], top: "#f2d45a", wall: [92, 104, 140], ambient: 0.04, light: "rgba(255,250,220,0.16)" };
BIOMES.enfer = { name: "Le Royaume infernal", sub: "Là où règne l'Archidémon",
  stone: [92, 34, 26], top: "#e0401a", wall: [34, 8, 6], ambient: 0.62, light: "rgba(255,90,40,0.14)" };
for (const id of ["ciel", "enfer"]) if (!BIOME_IDS.includes(id)) BIOME_IDS.push(id);
SALLE_MONSTRES.ciel = { e: ["squelette", "golem", "champi", "squelette"], a: ["wisp", "bat", "wisp"] };
SALLE_MONSTRES.enfer = { e: ["rodeur", "golem", "spitter", "squelette"], a: ["wisp", "bat"] };
BOSS_VARIANTS.seraphin = {
  name: "Le Séraphin", hp: 90, idle: 0.8, volley: 7, waveSpeed: 190, charge: 250, contact: 2,
  color: "#f6efe0", dark: "#c8a83a", eye: "#7fd6ff", summons: [0.66, 0.33], doubleSlam: true,
};
BOSS_VARIANTS.demon = {
  name: "L'Archidémon", hp: 95, idle: 0.85, volley: 6, waveSpeed: 175, charge: 240, contact: 2,
  color: "#6e1f24", dark: "#1a0606", eye: "#ffb020", summons: [0.75, 0.5, 0.25], summonMore: true, doubleSlam: true,
};
const DIMENSIONS = {
  ciel:  { biome: "ciel",  boss: "seraphin", ending: "pure",  split: "Le Royaume céleste", lore: "ciel1",
    arrive: "<b>Le Royaume céleste.</b> Ici, la lumière juge ceux qui entrent.", hazard: "jugement", every: 4.2,
    enemy: { hp: 1.6, speed: 1.15, shoot: 0.6, dmg: 0 }, light: 0 },
  enfer: { biome: "enfer", boss: "demon",    ending: "abyss", split: "Le Royaume infernal", lore: "enfer1",
    arrive: "<b>Le Royaume infernal.</b> Le sol lui-même a faim.", hazard: "geysers", every: 3.6,
    enemy: { hp: 1.6, speed: 1.25, shoot: 0.8, dmg: 1 }, light: 99 },
};
LORE.ciel1 = "Une plume de pierre, posée sur un socle : « Ceux qui montent sans ombre sont pesés. Ceux qui sont trop légers s'envolent. Les autres tombent. »";
LORE.enfer1 = "Gravé au fer rouge : « Tu as nourri les ténèbres tout le long du chemin. Elles t'ont amené jusqu'ici. Maintenant, elles ont faim de toi. »";
globalThis.DIM = null;                                             // la dimension en cours, ou null
let dimPrev = null, dimEntering = false, dimHazardT = 3;

// Un vrai niveau : un serpentin de cinq étages sur quatre colonnes, des branches, un feu de camp, puis l'arène
function buildDimensionLevel(id) {
  const D = DIMENSIONS[id], COLS = 4, ROWS = 5;
  for (let t = 0; t < 60; t++) {
    const rand = rng(Math.floor(Math.random() * 1e9));
    const path = []; const used = new Set();
    let c = Math.floor(rand() * COLS);
    for (let r = 0; r < ROWS; r++) {
      path.push([c, r]); used.add(`${c},${r}`);
      let dir = rand() < 0.5 ? -1 : 1; if (c + dir < 0 || c + dir >= COLS) dir = -dir;
      const steps = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < steps && c + dir >= 0 && c + dir < COLS; i++) { c += dir; path.push([c, r]); used.add(`${c},${r}`); }
    }
    const pool = id === "ciel" ? ["statues", "hall", "crypte", "pont_friable", "galerie", "racines"] : ["ossuaire", "crypte", "galerie", "fosse", "statues", "hall"];
    const plan = { cols: COLS, rows: ROWS, seed: Math.floor(rand() * 1e9), arena: true, base: "dimension-" + id, cells: {}, links: [] };
    const need = path.map(() => new Set());
    for (let i = 0; i < path.length - 1; i++) {
      const [ac, ar] = path[i], [bc, br] = path[i + 1];
      if (br > ar) { need[i].add("D"); need[i + 1].add("u"); } else if (bc > ac) { need[i].add("R"); need[i + 1].add("L"); } else { need[i].add("L"); need[i + 1].add("R"); }
      plan.links.push({ a: `${ac},${ar}`, b: `${bc},${br}` });
    }
    const mid = Math.floor(path.length / 2);
    let fail = false;
    path.forEach(([pc, pr], i) => {
      const want = [...need[i]];
      const list = i === 0 ? ["depart"] : i === path.length - 1 ? ["antichambre"] : i === mid ? ["repos"] : pool;
      const cell = pickRoom(list, want, rand, D.biome) || pickRoom(pool.concat(["hall", "hall_autel"]), want, rand, D.biome);
      if (!cell) { fail = true; return; }
      cell.biome = D.biome; if (i === 0) cell.lore = D.lore;
      plan.cells[`${pc},${pr}`] = cell;
    });
    if (fail) continue;
    // des branches : un autel, un trésor gardé par une épreuve, un secret
    for (const reward of ["hall_autel", "epreuve", "secret", "hall_autel"]) {
      for (let k = 0; k < 20; k++) {
        const i = 1 + Math.floor(rand() * (path.length - 2)), [pc, pr] = path[i], dir = rand() < 0.5 ? -1 : 1, nc = pc + dir;
        if (nc < 0 || nc >= COLS || used.has(`${nc},${pr}`)) continue;
        const host = plan.cells[`${pc},${pr}`], side = dir < 0 ? "L" : "R";
        if (!salleDoors(host).includes(side)) continue;
        const cell = pickRoom([reward], [dir < 0 ? "R" : "L"], rand, D.biome); if (!cell) continue;
        cell.biome = D.biome; plan.cells[`${nc},${pr}`] = cell; used.add(`${nc},${pr}`);
        plan.links.push({ a: `${pc},${pr}`, b: `${nc},${pr}`, lock: reward === "secret" ? "f" : undefined });
        break;
      }
    }
    const check = checkPlan(plan);
    if (!check.ok || !check.report.some(l => l.includes("Gardien atteignable : oui"))) continue;
    const lv = assemblePlan(plan);
    for (const b of lv.biomes) b.id = D.biome;
    lv.seed = plan.seed;
    return lv;
  }
  return null;
}

function enterDimension(id) {
  const D = DIMENSIONS[id];
  const lv = buildDimensionLevel(id);
  if (!lv) { finishRunAnyway(D.ending); return; }
  const keep = {
    skills: SKILLS.filter(s => skills[s.id]).map(s => s.id), items: [...items], coins, keyCount,
    runClock, runTainted, splits: splits.slice(), kills, maxDepth,
  };
  dimPrev = dimPrev || { level, gameMode };
  level = lv; DIM = id;
  dimEntering = true; loadingSave = true;
  try { resetRun(); } finally { loadingSave = false; dimEntering = false; }
  mapSeen = new Set();
  for (const sid of keep.skills) grantSkill(sid);
  for (const it of keep.items) items.add(it);
  computeStats(); renderItems();
  player.hp = stats.maxHp; renderHearts();                          // tu arrives avec tous tes PV
  coins = keep.coins; keyCount = keep.keyCount; renderPurse();
  dark = D.light; darkLocked = true; darkShown = -1; renderDark();   // la lumière ne bouge plus : céleste ou infernale
  runClock = keep.runClock; runTainted = keep.runTainted; splits = keep.splits; kills = keep.kills; maxDepth = keep.maxDepth; renderKills();
  recordSplit(D.split);
  for (const e of enemies) if (!e.boss) {                           // les créatures du royaume sont plus coriaces
    e.dim = id; e.hp *= D.enemy.hp; e.maxHp = (e.maxHp || e.hp) * D.enemy.hp;
    e.speed *= D.enemy.speed; if (e.baseSpeed) e.baseSpeed *= D.enemy.speed;
    if (e.shootCd) e.shootCd *= D.enemy.shoot;
    if (D.enemy.dmg && (e.type === "golem" || e.type === "rodeur")) e.damage = (e.damage || 1) + D.enemy.dmg;
  }
  dimHazardT = 4;
  closeMenu(); fadeIn = 1.4;
  toast(D.arrive, 4000, true);
}
function leaveDimension() {
  if (!dimPrev) return;
  level = dimPrev.level; gameMode = dimPrev.gameMode; dimPrev = null; DIM = null;
}
function finishRunAnyway(key) { endRun("win", key); }

// Le danger propre à chaque royaume, annoncé comme les attaques des gardiens
function dimensionHazard(dt) {
  const D = DIMENSIONS[DIM], p = player;
  if (!D || !p || p.dead || (bossFight && bossFight.boss.dead)) return;
  dimHazardT -= dt;
  if (dimHazardT > 0) return;
  dimHazardT = D.every * (bossFight ? 0.75 : 1) * (0.8 + Math.random() * 0.4);
  const n = bossFight ? 3 : 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const x = p.x + p.w / 2 + (i === 0 ? (Math.random() - 0.5) * 30 : (Math.random() - 0.5) * 160);
    if (D.hazard === "jugement") {
      // une colonne de lumière tombe du plafond
      const top = ceilingAbove(x, p.y), bottom = floorBelow(x, p.y);
      warn(x - 8, top, 16, "ceiling", 1.0, () => {
        miniZones.push({ kind: "holy", x: x - 8, y: top, w: 16, h: Math.max(16, bottom - top), life: 0.55, tick: 0 });
        burst(x, bottom - 2, 10, "#fff6c8", 90);
      });
    } else {
      // un geyser de feu jaillit du sol
      const fy = floorBelow(x, p.y + p.h - 2);
      warn(x - 10, fy - 2, 20, "ground", 0.9, () => {
        miniZones.push({ kind: "fire", x: x - 10, y: fy - 40, w: 20, h: 40, life: 0.9, tick: 0 });
        for (let k = 0; k < 6; k++) shots.push({ kind: "hell", x: x - 2.5, y: fy - 10, w: 5, h: 5, vx: (Math.random() - 0.5) * 120, vy: -200 - Math.random() * 120, grav: 420, life: 2 });
        burst(x, fy - 4, 14, "#e0401a", 110);
      });
    }
  }
}

// ----- Les conditions des fins alternatives -----
let realSeen = new Set();                                          // les salles vraiment visitées (la Carte du cartographe ne compte pas)
function roomsTotal() {
  const cols = Math.floor((MW - 1) / CELL_W), rows = Math.floor((MH - 1) / CELL_H);
  let n = 0;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x0 = 1 + c * CELL_W, y0 = 1 + r * CELL_H;
    let open = false;
    for (let y = y0; y < y0 + ROOM_H && !open; y += 2) for (let x = x0; x < x0 + ROOM_W; x += 2) if (!solid(tile(x, y))) { open = true; break; }
    if (open) n++;
  }
  return Math.max(1, n);
}
function specialEnding() {
  if (items.size === 0) return "ascete";
  if (runClock <= (gameMode === "chaos" ? 600 : 1200)) return "eclair";
  if (realSeen.size / roomsTotal() >= 0.95 && secretsFound >= secretsTotal) return "cartographe";
  return null;
}

// ----- Les scènes de fin -----
let outro = null;                                                  // { key, t, len, cb, data }
let outroMusic = "title";
const OUTRO_LEN = { ascension: 2.8, descente: 2.8, normal: 7.5, pure: 7.5, abyss: 8, ascete: 7.5, eclair: 6.5, cartographe: 8, true: 9.5 };
function playOutro(key, cb) {
  if (REDUCED) { cb(); return; }
  outro = { key, t: 0, len: OUTRO_LEN[key] || 7, cb, data: {}, sparks: [] };
  outroMusic = key === "abyss" || key === "descente" ? "antre" : key === "pure" || key === "ascension" ? "noyee" : "title";
  screen = "outro"; menuEl.hidden = true; keys.clear();
  $("hud").hidden = true; bossBarEl.hidden = true;
}
function finishOutro() {
  if (!outro) return;
  const cb = outro.cb; outro = null;
  screen = "play"; $("hud").hidden = false;
  cb();
}
function skipOutro() { if (outro && outro.t > 0.6) finishOutro(); }
addEventListener("keydown", e => { if (screen === "outro") { e.preventDefault(); skipOutro(); } });
addEventListener("pointerdown", () => { if (screen === "outro") skipOutro(); });

// petits outils de dessin (coordonnées du monde : 320 × 180)
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const seg = (t, a, b) => ease((t - a) / (b - a));
function oSky(top, mid, bot, stars) {
  const g = ctx.createLinearGradient(0, 0, 0, TITLE.ground);
  g.addColorStop(0, rgb(top)); g.addColorStop(0.6, rgb(mid)); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, TITLE.ground + 2);
  if (stars > 0) for (let i = 0; i < 40; i++) {
    const x = hash(i, 3) * VW, y = hash(i, 7) * 80, tw = 0.4 + 0.6 * Math.abs(Math.sin(titleT * (0.6 + hash(i, 9)) + i));
    ctx.fillStyle = `rgba(240,230,255,${tw * stars * (1 - y / 90)})`; ctx.fillRect(snap(x), snap(y), 0.67, 0.67);
  }
}
function oForest(k) {                                              // k : 0 la nuit, 1 le plein jour
  drawLayer(0.08, rgb(mix([34, 26, 52], [92, 112, 140], k)), x => ridge(x, 1, 50, 128, 60));
  drawLayer(0.18, rgb(mix([28, 26, 42], [70, 96, 96], k)), x => ridge(x, 4, 30, 140, 40));
  drawPines(0.32, 17, rgb(mix([24, 32, 42], [52, 84, 70], k)), 146, 26, 18, 5);
  drawPines(0.6, 29, rgb(mix([18, 26, 24], [40, 66, 48], k)), 152, 40, 30, 9);
  drawGroundStrip();
}
function oSun(x, y, r, color, glow) {
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function oTitle(key, a) {
  if (a <= 0) return;
  const E = ENDINGS[key]; if (!E) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, a);
  const g = ctx.createLinearGradient(0, 4, 0, 40);                  // un bandeau en haut, pour ne jamais cacher le héros
  g.addColorStop(0, "rgba(6,4,10,0)"); g.addColorStop(0.5, "rgba(6,4,10,0.6)"); g.addColorStop(1, "rgba(6,4,10,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 4, VW, 36);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "15px 'IM Fell English SC', Georgia, serif"; ctx.fillStyle = E.color || "#f6efe0";
  ctx.fillText(E.name, VW / 2, 22);
  ctx.restore();
}
function oVignette(strength) {
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
  vg.addColorStop(0, "rgba(6,4,10,0)"); vg.addColorStop(1, `rgba(6,4,10,${strength})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
}
function oSparks(o, dt, n, color, area) {
  if (o.sparks.length < n && Math.random() < dt * n) o.sparks.push({ x: area.x + Math.random() * area.w, y: area.y + Math.random() * area.h, vy: -8 - Math.random() * 14, life: 2 + Math.random() * 2 });
  for (let i = o.sparks.length - 1; i >= 0; i--) {
    const s = o.sparks[i]; s.life -= dt; s.y += s.vy * dt; s.x += Math.sin(titleT * 2 + i) * dt * 4;
    if (s.life <= 0) { o.sparks.splice(i, 1); continue; }
    ctx.fillStyle = color.replace("A", Math.min(1, s.life).toFixed(2)); ctx.fillRect(snap(s.x), snap(s.y), 1, 1);
  }
}
const RUN = () => ["hero_run0", "hero_run1", "hero_run2", "hero_run1"][Math.abs(Math.floor(titleT * 12)) % 4];
const WELL_X = 150;
// le héros sort du puits d'un bond, entre a et b secondes ; renvoie sa position
function climbOut(t, a, b, toX) {
  const rim = TITLE.ground - 18;
  if (t < a) return null;
  const k = seg(t, a, b);
  return { x: WELL_X + (toX - WELL_X) * k, y: rim + 6 - Math.sin(k * Math.PI) * 30 - (TITLE.ground - rim - 6) * k, frame: k < 0.5 ? "hero_jump" : k < 1 ? "hero_fall" : "hero_idle0" };
}

const SCENES = {
  // Le Gardien enragé vaincu : la lumière t'emporte vers le ciel
  ascension(o, dt) {
    const t = o.t;
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "#fffbe8"); g.addColorStop(1, "#c8d8f0"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 40; i++) {                                  // des plumes de lumière qui tombent : on monte vite
      const x = hash(i, 11) * VW, sp = 140 + hash(i, 12) * 200, y = ((t * sp + hash(i, 13) * 400) % (VH + 40)) - 20;
      ctx.fillStyle = `rgba(242,212,90,${0.35 + hash(i, 16) * 0.4})`; ctx.fillRect(snap(x), snap(y), 1.33, 4 + hash(i, 17) * 6);
    }
    const c = ctx.createRadialGradient(VW / 2, 20, 4, VW / 2, 20, 160); c.addColorStop(0, `rgba(255,255,255,${0.5 + 0.4 * seg(t, 0, 2.4)})`); c.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = c; ctx.fillRect(0, 0, VW, VH);
    drawTitleHero(VW / 2 + Math.sin(t * 2) * 5, 120 - 40 * seg(t, 0, 2.6), "hero_jump");
    ctx.fillStyle = `rgba(255,255,255,${seg(t, 2.1, 2.8)})`; ctx.fillRect(0, 0, VW, VH);
  },
  // Le Gardien dévoré vaincu : le sol s'ouvre sur la braise
  descente(o, dt) {
    const t = o.t;
    ctx.fillStyle = "#0c0302"; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 40; i++) {                                  // des braises qui remontent : on tombe vite
      const x = hash(i, 11) * VW, sp = 160 + hash(i, 12) * 240, y = (VH - ((t * sp + hash(i, 13) * 400) % (VH + 60))) + 30;
      ctx.fillStyle = `rgba(255,${80 + hash(i, 15) * 100},30,${0.3 + hash(i, 16) * 0.4})`;
      ctx.fillRect(snap(x), snap(y), 0.67, 8 + hash(i, 17) * 16);
    }
    const g = ctx.createRadialGradient(VW / 2, VH * 0.95, 4, VW / 2, VH * 0.95, 150);
    g.addColorStop(0, `rgba(224,64,26,${0.35 + 0.35 * seg(t, 0, 2.5)})`); g.addColorStop(1, "rgba(224,64,26,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    drawTitleHero(VW / 2 + Math.sin(t * 3) * 6, 70 + Math.sin(t * 5) * 3, "hero_fall");
    ctx.fillStyle = `rgba(12,3,2,${seg(t, 2.1, 2.8)})`; ctx.fillRect(0, 0, VW, VH);
  },
  // La menace scellée : il sort du puits, une dalle le referme, l'aube se lève
  normal(o, dt) {
    const t = o.t, k = seg(t, 2.5, 7);
    oSky(mix([13, 11, 28], [70, 90, 140], k), mix([42, 30, 60], [200, 140, 110], k), mix([176, 96, 74], [250, 190, 120], k), 1 - k);
    oSun(250, 150 - 70 * k, 10, "#ffd890", "rgba(255,200,140,0.18)");
    oForest(k * 0.6);
    drawWell(WELL_X, false);
    const glow = 0.5 + 0.5 * Math.sin(t * 6);
    if (t < 3) { ctx.fillStyle = `rgba(232,145,58,${0.4 * glow * (1 - seg(t, 2.2, 3))})`; ctx.beginPath(); ctx.ellipse(WELL_X, TITLE.ground - 18, 17, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    const h = climbOut(t, 0.6, 1.6, 200);
    if (h) drawTitleHero(t < 3.5 ? h.x : 200 + (t - 3.5) * 22, h.y, t < 1.6 ? h.frame : t < 3.5 ? "hero_idle0" : RUN(), t > 1.6 && t < 3 ? -1 : 1);
    drawWell(WELL_X, true);
    // la dalle de pierre qui tombe sur le puits
    const sy = TITLE.ground - 90 + 66 * seg(t, 2.2, 2.8);              // la dalle tombe sur la margelle et bouche le puits
    if (t > 2.2) {
      ctx.fillStyle = "#140e18"; ctx.fillRect(snap(WELL_X - 24), snap(sy - 1), 48, 9);
      ctx.fillStyle = "#8a8290"; ctx.fillRect(snap(WELL_X - 23), snap(sy), 46, 7);
      ctx.fillStyle = "#b4aa96"; ctx.fillRect(snap(WELL_X - 23), snap(sy), 46, 1.33);
      ctx.fillStyle = "#5a5560"; for (let i = 0; i < 4; i++) ctx.fillRect(snap(WELL_X - 18 + i * 11), snap(sy + 3), 6, 1);
    }
    if (t > 2.8 && t < 3.3) { for (let i = 0; i < 6; i++) { ctx.fillStyle = "rgba(160,150,140,0.6)"; ctx.fillRect(snap(WELL_X - 24 + hash(i, 5) * 48), snap(TITLE.ground - 24 - (t - 2.8) * 30 * hash(i, 6)), 1, 1); } if (!o.data.shook) { o.data.shook = true; if (typeof SFX !== "undefined") SFX.play("wallBreak"); } }
    oVignette(0.5 - 0.3 * k);
    oTitle("normal", seg(t, 4.5, 5.5));
  },
  // L'Ascension : au-dessus des nuages, des ailes de lumière lui poussent dans le dos
  pure(o, dt) {
    const t = o.t;
    oSky([120, 170, 235], [220, 230, 250], [255, 246, 220], 0);
    oSun(VW / 2, 52, 16, "#fffbe8", "rgba(255,246,200,0.3)");
    for (let i = 0; i < 9; i++) {                                    // la mer de nuages
      const x = ((i * 47 - t * (6 + i % 3 * 3)) % (VW + 80)) - 40, y = 118 + (i % 3) * 14;
      ctx.fillStyle = i % 2 ? "#ffffff" : "#eef2fa";
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + k * 12, y + Math.sin(k + i) * 3, 12 + (k % 2) * 4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 150, VW, 30);
    const hx = VW / 2, hy = 136 - 6 * seg(t, 2.5, 4);
    const wing = seg(t, 2, 3.6);                                      // les ailes s'ouvrent
    if (wing > 0) {
      ctx.fillStyle = `rgba(255,246,200,${0.85 * wing})`;
      for (const d of [-1, 1]) for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(hx + d * 2, hy - 10 + k * 2); ctx.lineTo(hx + d * (8 + 24 * wing - k * 4), hy - 26 * wing + k * 6 + Math.sin(titleT * 3) * 2); ctx.lineTo(hx + d * (6 + 18 * wing - k * 4), hy - 4 + k * 3); ctx.fill(); }
    }
    drawTitleHero(hx, hy, Math.floor(titleT * 1.8) % 2 ? "hero_idle1" : "hero_idle0");
    if (t > 3) { ctx.strokeStyle = `rgba(242,212,90,${seg(t, 3, 4)})`; ctx.lineWidth = 0.67; ctx.beginPath(); ctx.ellipse(hx, hy - 19, 5, 1.5, 0, 0, Math.PI * 2); ctx.stroke(); }
    oSparks(o, dt, 30, "rgba(242,212,90,A)", { x: hx - 40, y: 60, w: 80, h: 80 });
    ctx.fillStyle = `rgba(255,255,255,${1 - seg(t, 0, 1.2)})`; ctx.fillRect(0, 0, VW, VH);
    oTitle("pure", seg(t, 4.6, 5.6));
  },
  // Le Trône des Abysses : un trône de braise vide… il s'y assied
  abyss(o, dt) {
    const t = o.t;
    ctx.fillStyle = "#0c0302"; ctx.fillRect(0, 0, VW, VH);
    const g = ctx.createRadialGradient(VW / 2, 120, 10, VW / 2, 120, 170); g.addColorStop(0, "rgba(224,64,26,0.45)"); g.addColorStop(1, "rgba(60,8,4,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 12; i++) {                                   // des colonnes de roche en fusion
      const x = i * 30 + hash(i, 2) * 10, h = 40 + hash(i, 3) * 60;
      ctx.fillStyle = "#1e0806"; ctx.fillRect(snap(x), 150 - h, 10, h);
      ctx.fillStyle = `rgba(255,${100 + hash(i, 4) * 80},30,${0.5 + 0.3 * Math.sin(titleT * 2 + i)})`; ctx.fillRect(snap(x + 4), 150 - h, 1, h);
    }
    ctx.fillStyle = "#2a0a06"; ctx.fillRect(0, 148, VW, 32);
    ctx.fillStyle = "#e0401a"; for (let i = 0; i < 40; i++) ctx.fillRect(snap(i * 8 + Math.sin(titleT * 4 + i) * 2), 148, 4, 1.33);
    // le trône
    const tx = VW / 2;
    ctx.fillStyle = "#1a0606"; ctx.fillRect(tx - 14, 112, 28, 36); ctx.fillRect(tx - 18, 96, 6, 52); ctx.fillRect(tx + 12, 96, 6, 52);
    ctx.beginPath(); ctx.moveTo(tx - 18, 96); ctx.lineTo(tx - 22, 80); ctx.lineTo(tx - 12, 96); ctx.fill(); ctx.beginPath(); ctx.moveTo(tx + 18, 96); ctx.lineTo(tx + 22, 80); ctx.lineTo(tx + 12, 96); ctx.fill();
    ctx.fillStyle = "#6e1f24"; ctx.fillRect(tx - 12, 128, 24, 4);
    // il marche jusqu'au trône, monte, se retourne et s'assied
    const walk = seg(t, 0.5, 3.2), hx = 40 + (tx - 40) * walk, hy = t < 3.2 ? 148 : 128;
    drawTitleHero(hx, hy, t < 3.2 ? RUN() : "hero_idle0", t < 3.2 ? 1 : -1);
    if (t > 3.6) { const a = seg(t, 3.6, 4.6); ctx.fillStyle = `rgba(255,176,32,${a})`; ctx.fillRect(snap(hx - 4), snap(hy - 11), 1.33, 1); ctx.fillRect(snap(hx - 1.7), snap(hy - 11), 1.33, 1); ctx.fillStyle = `rgba(26,6,6,${a})`; ctx.beginPath(); ctx.moveTo(hx - 5, hy - 15); ctx.lineTo(hx - 8, hy - 22); ctx.lineTo(hx - 3, hy - 15); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx + 1, hy - 15); ctx.lineTo(hx + 4, hy - 22); ctx.lineTo(hx - 1, hy - 15); ctx.fill(); }
    oSparks(o, dt, 40, "rgba(255,140,40,A)", { x: 0, y: 100, w: VW, h: 50 });
    // les flammes se couchent à ses pieds
    if (t > 4.2) { const k = seg(t, 4.2, 5.4); ctx.fillStyle = `rgba(224,64,26,${0.6 * k})`; for (const d of [-1, 1]) for (let i = 0; i < 5; i++) ctx.fillRect(snap(tx + d * (22 + i * 12)), 146 - 6 * k, 6, 6 * k); }
    oVignette(0.6);
    oTitle("abyss", seg(t, 5, 6));
  },
  // L'Ascète : seul, les mains vides, près d'un petit feu, au petit matin
  ascete(o, dt) {
    const t = o.t, k = seg(t, 0, 7);
    oSky(mix([30, 26, 54], [90, 110, 150], k), mix([90, 60, 80], [220, 170, 130], k), mix([200, 120, 90], [250, 200, 150], k), 0.6 - 0.6 * k);
    oForest(0.3 + 0.4 * k);
    drawWell(WELL_X, false); drawWell(WELL_X, true);
    const fx = 214, fy = TITLE.ground;
    ctx.fillStyle = "#4a321e"; ctx.fillRect(fx - 6, fy - 2, 12, 2);
    for (let i = 0; i < 3; i++) { const fl = Math.sin(titleT * 9 + i * 2) * 1.5; ctx.fillStyle = ["#c4413b", "#e8913a", "#f2d45a"][i]; ctx.beginPath(); ctx.moveTo(fx - 4 + i, fy - 2); ctx.lineTo(fx + fl * 0.5, fy - 9 + i * 2 - fl); ctx.lineTo(fx + 4 - i, fy - 2); ctx.fill(); }
    const g = ctx.createRadialGradient(fx, fy - 4, 2, fx, fy - 4, 40); g.addColorStop(0, "rgba(242,180,90,0.25)"); g.addColorStop(1, "rgba(242,180,90,0)"); ctx.fillStyle = g; ctx.fillRect(fx - 40, fy - 44, 80, 50);
    oSparks(o, dt, 8, "rgba(242,180,90,A)", { x: fx - 3, y: fy - 10, w: 6, h: 4 });
    const hx = Math.min(196, 120 + 30 * t);
    drawTitleHero(hx, TITLE.ground, hx < 196 ? RUN() : Math.floor(titleT * 1.8) % 2 ? "hero_idle1" : "hero_idle0");
    oVignette(0.45);
    oTitle("ascete", seg(t, 4.2, 5.2));
  },
  // L'Éclair : il traverse la forêt en un éclair pendant que le soleil se lève
  eclair(o, dt) {
    const t = o.t, k = seg(t, 0.5, 4.5);
    titleScroll += dt * (420 - 300 * seg(t, 4.5, 6));
    oSky(mix([13, 11, 28], [110, 170, 230], k), mix([42, 30, 60], [210, 190, 170], k), mix([176, 96, 74], [255, 210, 150], k), 1 - k);
    oSun(70, 150 - 100 * k, 9, "#fff0b0", "rgba(255,230,160,0.2)");
    oForest(k * 0.8);
    const hx = 110 + Math.sin(t * 1.3) * 10;
    for (let i = 4; i >= 1; i--) { ctx.globalAlpha = 0.12 * (5 - i); drawTitleHero(hx - i * 9, TITLE.ground, RUN()); }
    ctx.globalAlpha = 1; drawTitleHero(hx, TITLE.ground, RUN());
    ctx.fillStyle = "rgba(127,214,255,0.5)";
    for (let i = 0; i < 14; i++) ctx.fillRect(snap((VW - ((t * 600 + hash(i, 2) * 500) % (VW + 60)))), snap(70 + hash(i, 3) * 80), 14 + hash(i, 4) * 20, 0.67);
    oVignette(0.35);
    oTitle("eclair", seg(t, 3.6, 4.6));
  },
  // Le Cartographe : près du puits, il déroule la carte de tout ce qu'il a exploré
  cartographe(o, dt) {
    const t = o.t;
    oSky([13, 11, 28], [42, 30, 60], [176, 96, 74], 1);
    oForest(0);
    drawWell(WELL_X, false); drawWell(WELL_X, true);
    drawTitleHero(200, TITLE.ground, Math.floor(titleT * 1.8) % 2 ? "hero_idle1" : "hero_idle0", -1);
    const open = seg(t, 1, 2.4);
    if (open > 0) {
      const W = 150 * open, Hh = 92, x0 = VW / 2 - W / 2, y0 = 42;
      ctx.fillStyle = "#c9b48a"; ctx.fillRect(snap(x0), y0, W, Hh);
      ctx.fillStyle = "#a8905e"; ctx.fillRect(snap(x0), y0, W, 2); ctx.fillRect(snap(x0), y0 + Hh - 2, W, 2);
      ctx.fillStyle = "#8a6a3a"; ctx.fillRect(snap(x0 - 3), y0 - 2, 4, Hh + 4); ctx.fillRect(snap(x0 + W - 1), y0 - 2, 4, Hh + 4);
      if (open > 0.95) {
        const cols = Math.floor((MW - 1) / CELL_W), rows = Math.floor((MH - 1) / CELL_H);
        const s = Math.min(130 / cols, 76 / rows), mx = VW / 2 - cols * s / 2, my = y0 + 6;
        const show = seg(t, 2.4, 5);
        let n = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (!realSeen.has(`${c},${r}`)) continue;
          if (++n > show * realSeen.size) continue;
          ctx.fillStyle = "#5a3a1e"; ctx.fillRect(snap(mx + c * s + 0.5), snap(my + r * s + 0.5), s - 1, s - 1);
        }
        ctx.fillStyle = "#c4413b"; ctx.fillRect(snap(mx + cols * s / 2 - 1.5), snap(my + rows * s + 1), 3, 3);
      }
    }
    oVignette(0.5);
    oTitle("cartographe", seg(t, 5, 6));
  },
  // La Source : la main sur l'eau, la lumière remonte tout le puits… puis le puits au grand jour
  true(o, dt) {
    const t = o.t;
    if (t < 5) {
      ctx.fillStyle = "#0a0c18"; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = "#141a2a"; ctx.fillRect(0, 130, VW, 50);
      const pulse = 0.6 + 0.4 * Math.sin(titleT * 2);
      const g = ctx.createRadialGradient(VW / 2, 134, 4, VW / 2, 134, 90); g.addColorStop(0, `rgba(242,212,90,${0.35 * pulse})`); g.addColorStop(1, "rgba(242,212,90,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = "#3a6ab0"; ctx.beginPath(); ctx.ellipse(VW / 2, 136, 46, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,240,170,${0.5 + 0.3 * pulse})`; ctx.beginPath(); ctx.ellipse(VW / 2, 136, 30, 3, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i++) { const rr = ((t - 2.2 - i * 0.5) * 30); if (rr > 0 && rr < 50) { ctx.strokeStyle = `rgba(255,240,170,${1 - rr / 50})`; ctx.lineWidth = 0.67; ctx.beginPath(); ctx.ellipse(VW / 2, 136, rr, rr * 0.13, 0, 0, Math.PI * 2); ctx.stroke(); } }
      const hx = Math.min(VW / 2 - 52, 40 + 40 * t);
      drawTitleHero(hx, 131, hx < VW / 2 - 52 ? RUN() : "hero_idle0");
      const up = seg(t, 3, 4.6);
      if (up > 0) { const c = ctx.createLinearGradient(0, 136, 0, 0); c.addColorStop(0, `rgba(255,246,200,${up})`); c.addColorStop(1, "rgba(255,246,200,0)"); ctx.fillStyle = c; ctx.fillRect(VW / 2 - 18 * up, 0, 36 * up, 136); }
      oSparks(o, dt, 30, "rgba(255,240,170,A)", { x: VW / 2 - 50, y: 90, w: 100, h: 46 });
      ctx.fillStyle = `rgba(255,252,240,${seg(t, 4.3, 5)})`; ctx.fillRect(0, 0, VW, VH);
    } else {
      const k = seg(t, 5, 6.5);
      oSky([100, 160, 230], [200, 220, 240], [250, 240, 210], 0);
      oSun(240, 40, 11, "#fff6c8", "rgba(255,246,200,0.25)");
      oForest(1);
      drawWell(WELL_X, false);
      ctx.fillStyle = "#4a8ac4"; ctx.fillRect(snap(WELL_X - 18), TITLE.ground - 2, 36, 2);           // l'eau qui déborde
      ctx.fillStyle = "#7fc8ff"; for (let i = 0; i < 8; i++) ctx.fillRect(snap(WELL_X - 22 - i * 4 + Math.sin(titleT * 3 + i) * 1), TITLE.ground - 1, 3, 1);
      for (let i = 0; i < 14; i++) { const x = WELL_X - 70 + i * 10 + hash(i, 4) * 6; ctx.fillStyle = hash(i, 5) < 0.5 ? "#f2d45a" : "#e8a0c0"; ctx.fillRect(snap(x), TITLE.ground - 3 - hash(i, 6) * 3, 2, 2); }
      drawTitleHero(194, TITLE.ground, Math.floor(titleT * 1.8) % 2 ? "hero_idle1" : "hero_idle0", -1);
      drawWell(WELL_X, true);
      ctx.fillStyle = `rgba(255,252,240,${1 - k})`; ctx.fillRect(0, 0, VW, VH);
      oTitle("true", seg(t, 6.4, 7.4));
    }
  },
};
function drawOutro(dt) {
  const o = outro; if (!o) return;
  o.t += dt; titleT += dt;
  // la manette peut aussi passer la scène
  try { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.buttons.some(b => b && b.pressed)) skipOutro(); } catch (e) {}
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false;
  (SCENES[o.key] || SCENES.normal)(o, dt);
  if (o.t > 1) { ctx.font = "5px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(233,225,207,0.45)"; ctx.fillText("une touche pour passer", VW - 6, VH - 5); ctx.textAlign = "left"; }
  if (outro && o.t >= o.len) finishOutro();
}

// ----- Branchement -----
(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  let busy = false;
  around("endRun", (o, kind, tier, ...a) => {
    if (busy || kind !== "win" || runOver) return o(kind, tier, ...a);
    // le Gardien enragé ou dévoré vaincu : une autre dimension s'ouvre au lieu de finir
    if (!DIM && tier === "pure") { playOutro("ascension", () => enterDimension("ciel")); return; }
    if (!DIM && tier === "abyss") { playOutro("descente", () => enterDimension("enfer")); return; }
    let key = tier;
    if (DIM) key = DIMENSIONS[DIM].ending;
    else if (tier === "normal") key = specialEnding() || "normal";
    playOutro(key, () => { busy = true; try { o(kind, key, ...a); } finally { busy = false; } });
  });
  // une nouvelle run (ou une mort) dans une dimension : on retrouve la map d'avant
  around("resetRun", (o, ...a) => {
    if (DIM && !dimEntering) leaveDimension();
    const r = o(...a);
    if (!dimEntering) realSeen = new Set();
    return r;
  });
  around("startChaos", (o, ...a) => { if (DIM) { dimPrev = null; DIM = null; } return o(...a); });
  around("backToStory", (o, ...a) => { if (DIM) leaveDimension(); return o(...a); });
  // pas de sauvegarde dans une dimension (elle n'existe que le temps du voyage)
  around("saveGame", (o, quiet, ...a) => { if (DIM) { if (!quiet) toast("Impossible de sauvegarder hors du monde.", 2200); return false; } return o(quiet, ...a); });
  // l'arène de la dimension : c'est son maître qui attend
  around("enterArena", (o, ...a) => {
    const r = o(...a);
    if (DIM && bossFight) {
      const v = DIMENSIONS[DIM].boss;
      enemies = enemies.filter(e => !e.boss);
      const boss = makeBoss(v); enemies.push(boss);
      bossFight.tier = v; bossFight.boss = boss;
      bossNameEl.textContent = BOSS_VARIANTS[v].name; bossBarEl.dataset.tier = v; renderBossBar();
      toast(BOSS_VARIANTS[v].name.toUpperCase(), 2600);
      dimHazardT = 3;
    }
    return r;
  });
  // chaque image : salles visitées, danger du royaume, attaques propres aux maîtres des dimensions
  around("updateWorld", (o, dt, ...a) => {
    const r = o(dt, ...a), p = player;
    if (p && !p.dead) realSeen.add(`${Math.floor((p.x / T + p.w / T / 2 - 1) / CELL_W)},${Math.floor((p.y / T + p.h / T / 2 - 1) / CELL_H)}`);
    if (DIM) {
      dimensionHazard(dt);
      for (const e of enemies) if (e.dim && !e.dead && Math.random() < dt * 5)
        particles.push({ x: e.x + Math.random() * e.w, y: e.y + (DIM === "ciel" ? 0 : Math.random() * e.h), vx: 0, vy: DIM === "ciel" ? -10 : -18, life: 0.5, max: 0.5, color: DIM === "ciel" ? (Math.random() < 0.5 ? "#fff6c8" : "#f2d45a") : (Math.random() < 0.5 ? "#e0401a" : "#ffb020"), g: -10 });
      const b = bossFight && bossFight.boss;
      if (b && !b.dead && (b.variant === "seraphin" || b.variant === "demon")) {
        b.dimAtk = (b.dimAtk ?? 2.5) - dt;
        if (b.dimAtk <= 0) {
          b.dimAtk = b.hp < b.maxHp / 2 ? 2.6 : 3.6;
          const bx = b.x + b.w / 2, by = b.y + 8;
          if (b.variant === "seraphin") {
            // une couronne de lances de lumière qui partent dans toutes les directions
            const n = b.hp < b.maxHp / 2 ? 14 : 10;
            for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2 + Math.random() * 0.2; shots.push({ kind: "holy", x: bx - 2.5, y: by - 2.5, w: 5, h: 5, vx: Math.cos(an) * 120, vy: Math.sin(an) * 120, grav: 0, life: 2.4 }); }
            burst(bx, by, 24, "#fff6c8", 120, true);
          } else {
            // une pluie de braises, annoncée au plafond, autour du héros
            for (let i = 0; i < 5; i++) {
              const x = player.x + (i - 2) * 26 + (Math.random() - 0.5) * 10, top = ceilingAbove(x, player.y);
              warn(x - 4, top, 8, "ceiling", 0.8 + i * 0.1, () => shots.push({ kind: "hell", x: x - 2.5, y: top + 2, w: 5, h: 5, vx: 0, vy: 160, grav: 300, life: 3 }));
            }
          }
        }
      }
    }
    return r;
  });
  // l'autel de la vraie fin n'apparaît pas dans les dimensions
  for (const n of ["updateBossDoor", "drawBossDoor"]) around(n, (o, ...a) => {
    if (!DIM || typeof trueRun === "undefined") return o(...a);
    const keep = trueRun; const d = bossDoor; const al = d && d.altar; if (d) d.altar = null;
    const r = o(...a); if (d) d.altar = al; trueRun = keep; return r;
  });
  // les maîtres des dimensions : ailes et auréole pour le Séraphin, cornes et flammes pour l'Archidémon
  around("drawBoss", (o, e, x, y, white, ...a) => {
    if (e.variant === "seraphin" && !white) {
      const fl = Math.sin(time * 4) * 3;
      ctx.fillStyle = "rgba(255,250,230,0.85)";
      for (const d of [-1, 1]) for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 14 + d * 8, y + 8 + k * 3); ctx.lineTo(x + 14 + d * (34 - k * 4), y - 10 + k * 7 + fl); ctx.lineTo(x + 14 + d * (26 - k * 4), y + 12 + k * 5); ctx.fill(); }
    }
    if (e.variant === "demon" && !white) {
      ctx.fillStyle = `rgba(224,64,26,${0.25 + 0.15 * Math.sin(time * 10)})`; ctx.beginPath(); ctx.ellipse(x + 14, y + 14, 26, 22, 0, 0, Math.PI * 2); ctx.fill();
    }
    const r = o(e, x, y, white, ...a);
    if (e.variant === "seraphin" && !white) { ctx.strokeStyle = "#f2d45a"; ctx.lineWidth = 1.33; ctx.beginPath(); ctx.ellipse(x + 14, y - 8 + Math.sin(time * 3), 9, 2.5, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (e.variant === "demon" && !white) { ctx.fillStyle = "#1a0606"; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + 14 + d * 6, y - 2); ctx.lineTo(x + 14 + d * 18, y - 18); ctx.lineTo(x + 14 + d * 10, y - 1); ctx.fill(); } }
    return r;
  });
  // l'écran de fin : le compte de toutes les fins
  around("renderEndPanel", (o, ...a) => {
    const r = o(...a), el = document.getElementById("endUnlock"), e = (loadRecords().endings) || {};
    if (!el) return r;
    const got = ENDING_LIST.filter(t => e[t] || e["chaos-" + t]);
    let txt = `Fins obtenues : ${got.length} / ${ENDING_LIST.length}`;
    if (got.length) txt += " · " + got.map(t => ENDINGS[t].name).join(", ");
    if (e.true || e["chaos-true"]) txt += " · ✦ Vraie fin trouvée";
    if (!(e.true || e["chaos-true"]) && trueEndingUnlocked()) txt += " · Un autel attend devant la porte du Gardien : apporte-lui toutes les reliques.";
    el.textContent = txt;
    return r;
  });
})();
