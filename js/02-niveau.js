"use strict";
const TERRAIN = new Set(["#", "x", "^", "-", "|", "H", "=", "~", "%", "g", "G", "f", "B", "k", "."]);
function validLevel(l) {
  if (!l || !Array.isArray(l.rows) || !Array.isArray(l.ents)) return false;
  const h = l.rows.length, w = h ? String(l.rows[0]).length : 0;
  if (h < 4 || h > 256 || w < 4 || w > 256) return false;
  return l.rows.every(r => typeof r === "string" && r.length === w);
}
function normalizeLevel(l) {
  const rows = l.rows.map(r => r.split("").map(c => TERRAIN.has(c) ? c : ".").join(""));
  const w = rows[0].length, h = rows.length;
  const ents = l.ents.filter(e => e && typeof e.t === "string" && Number.isInteger(e.x) && Number.isInteger(e.y) && e.x >= 0 && e.y >= 0 && e.x < w && e.y < h)
    .map(e => {
      const o = { t: e.t, x: e.x, y: e.y };
      if (typeof e.s === "string") o.s = e.s;
      if (e.t === "bucket") o.d = Math.max(1, Math.min(30, Math.round(e.d || 4)));
      if (Number.isInteger(e.w)) o.w = e.w;
      if (Number.isInteger(e.h)) o.h = e.h;
      return o;
    });
  const biomes = Array.isArray(l.biomes) ? l.biomes.filter(b => b && (typeof BIOMES === "undefined" || BIOMES[b.id]) && [b.x, b.y, b.w, b.h].every(Number.isInteger)) : [];
  return { v: 1, base: l.base || null, w, h, rows, ents, biomes };
}
let level = clone(DEFAULT_LEVEL);
let levelSource = "default";
try {
  // Un brouillon n'est repris que s'il part de la map d'origine actuelle : sinon on le garde de côté
  const draft = JSON.parse(localStorage.getItem("lepuits.level"));
  if (draft && validLevel(draft)) {
    if (draft.base === DEFAULT_LEVEL.base) { level = normalizeLevel(draft); levelSource = "local"; }
    else { localStorage.setItem("lepuits.level.ancien", JSON.stringify(draft)); localStorage.removeItem("lepuits.level"); levelSource = "updated"; }
  }
} catch (e) {}

let MW = level.w, MH = level.h;
let grid, spawn, exitRune, relics = [], pickups = [], buckets = [], enemySpawns = [], anchors = [], crystals = [];
let campfires = [], steles = [], bossDoor = null, arenaEntry = null, bossSpawn = null;

const RELIC_INFO = {
  doubleJump: { color: "#e8913a", light: "#ffe2b0", name: "Double saut", how: "Saute une seconde fois en l'air." },
  dash:       { color: "#f2d45a", light: "#fff6c8", name: "Dash", get how() { return `${keysFor("dash")}, ${padLabel(padBinds.dash)} à la manette.`; } },
  smash:      { color: "#d06a4a", light: "#ffd1bf", name: "Frappe chargée", how: "Maintiens Frapper, puis relâche." },
  bolt:       { color: "#7fc8d6", light: "#e6fbff", name: "Projectile magique", get how() { return `${keysFor("bolt")}, ${padLabel(padBinds.bolt)} à la manette.`; } },
  grapple:    { color: "#a9b7b0", light: "#f1f6f3", name: "Grappin", get how() { return `${keysFor("grapple")} (${padLabel(padBinds.grapple)}) : vise un anneau ou un ennemi devant toi.`; } },
  phase:      { color: "#9d6bc4", light: "#eedcff", name: "Phase", get how() { return `${keysFor("phase")} (${padLabel(padBinds.phase)}) : glisse à travers les grilles et les ennemis.`; } },
};

function loadMap() {
  MW = level.w; MH = level.h;
  grid = level.rows.map(r => r.split(""));
  spawn = { x: 2 * T + 3, y: 2 * T + 2 }; exitRune = null;
  relics = []; pickups = []; buckets = []; enemySpawns = []; anchors = []; crystals = [];
  campfires = []; steles = []; bossDoor = null; arenaEntry = null; bossSpawn = null;
  resetElements();
  for (const e of level.ents) {
    if (loadElements(e)) continue;
    if (e.t === "campfire") { campfires.push({ x: e.x * T, y: e.y * T, w: 16, h: 16, used: false, rest: 0, t: Math.random() * 6 }); continue; }
    if (e.t === "stele") { steles.push({ x: e.x * T + 3, y: e.y * T - 6, w: 10, h: 22, used: false, rest: 0, t: Math.random() * 6 }); continue; }
    if (e.t === "bossdoor") { bossDoor = { x: e.x * T - 4, y: e.y * T - 16, w: 24, h: 32, hold: 0 }; continue; }
    if (e.t === "arena") { arenaEntry = { x: e.x * T + 3, y: e.y * T + 2 }; continue; }
    if (e.t === "boss") { bossSpawn = { cx: e.x, cy: e.y }; continue; }
    if (e.t === "anchor") { anchors.push({ x: e.x * T + 8, y: e.y * T + 6 }); continue; }
    if (e.t === "crystal") { crystals.push({ x: e.x * T + 3, y: e.y * T + 2, w: 10, h: 12, cx: e.x, cy: e.y, on: false }); continue; }
    if (ENEMY_TYPES[e.t]) { enemySpawns.push({ type: e.t, cx: e.x, cy: e.y }); continue; }
    if (e.t === "spawn") spawn = { x: e.x * T + 3, y: e.y * T + 2 };
    else if (e.t === "exit") exitRune = { x: e.x * T, y: e.y * T - 8, w: 16, h: 24 };
    else if (e.t === "relic" && RELIC_INFO[e.s]) relics.push({ x: e.x * T + 4, y: e.y * T + 4, w: 8, h: 8, skill: e.s, taken: false });
    else if (e.t === "altar") pickups.push(makePickup(e.x * T + 3, e.y * T + 3));
    else if (e.t === "crawler" || e.t === "bat") enemySpawns.push({ type: e.t, cx: e.x, cy: e.y });
    else if (e.t === "bucket") {
      let r = e.y - 1; while (r >= 0 && !solid(tile(e.x, r))) r--;
      const y0 = e.y * T;
      buckets.push({ x: e.x * T - 2, w: 20, h: 4, y: y0, prevY: y0, y0, yMax: y0 + (e.d || 4) * T, vy: 0, anchorY: (r + 1) * T });
    }
  }
  // Sans départ (effacé par mégarde dans l'éditeur), on reprend celui de la map d'origine
  if (!level.ents.some(e => e.t === "spawn")) {
    const d = DEFAULT_LEVEL.ents.find(e => e.t === "spawn");
    if (d && d.x < MW && d.y < MH) spawn = { x: d.x * T + 3, y: d.y * T + 2 };
  }
  spawn = freeSpawn(spawn);
  if (typeof setupMinis === "function") setupMinis();
  // La lumière perdue en descendant ne dépend pas de la taille de la map : environ 45 % du haut jusqu'au fond
  if (typeof DARK !== "undefined") DARK.perZone = Math.min(3, 45 / Math.max(1, Math.ceil(MH / 14)));
  buildBiomeGrid();
  countSecrets();
}
// Si le départ est pris dans la roche, on cherche la place libre la plus proche (avec un sol sous les pieds)
function freeSpawn(sp) {
  const fits = (c, r) => !solid(tile(c, r)) && !solid(tile(c, r - 1)) && tile(c, r) !== "^" && (solid(tile(c, r + 1)) || tile(c, r + 1) === "-");
  const c0 = Math.floor(sp.x / T), r0 = Math.floor(sp.y / T);
  if (fits(c0, r0) || (!solid(tile(c0, r0)) && !solid(tile(c0, r0 + 1)) && !rectSolid(sp.x, sp.y, 10, 14))) return sp;
  for (let d = 1; d < 60; d++)
    for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
      const c = c0 + dc, r = r0 + dr;
      if (c > 0 && r > 0 && c < MW - 1 && r < MH - 1 && fits(c, r)) return { x: c * T + 3, y: r * T + 2 };
    }
  return sp;
}
const makePickup = (x, y) => ({ x, y, w: 10, h: 10, t: Math.random() * 6 });
const tile = (cx, cy) => (cx < 0 || cy < 0 || cx >= MW || cy >= MH) ? "#" : grid[cy][cx];
const solid = t => t === "#" || t === "x" || t === "H" || t === "k" || t === "b" || t === "=" || t === "g" || t === "G" || (t === "B" && barriersUp);
// Les grilles « | » bloquent tout le monde, sauf le héros pendant la phase
const solidFor = (b, t) => solid(t) || (t === "|" && !(b && b.phasing));
// Cristal touché par le projectile : toutes les herses « H » à moins de 16 tuiles se lèvent
function activateCrystal(k) {
  if (k.on) return;
  k.on = true;
  let opened = 0;
  for (let r = Math.max(0, k.cy - 16); r <= Math.min(MH - 1, k.cy + 16); r++)
    for (let c = Math.max(0, k.cx - 16); c <= Math.min(MW - 1, k.cx + 16); c++)
      if (grid[r][c] === "H") {
        grid[r][c] = "."; opened++;
        for (let i = 0; i < 6; i++) particles.push({ x: c * T + Math.random() * T, y: r * T + Math.random() * T, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, life: 0.6, max: 0.6, color: "#7fc8d6", g: 200 });
      }
  burst(k.x + 5, k.y + 6, 30, "#7fc8d6", 120);
  freeze = Math.max(freeze, 0.12); shake(2, 0.2);
  toast(opened ? "Le cristal s'illumine : une herse se lève." : "Le cristal s'illumine.", 2400);
}
