"use strict";
// ---------- 22. Assembleur de salles ----------
/* Construit une map à partir d'un plan : une grille de salles modèles (niveaux/salles.js) reliées par des portes.
   Sert au mode histoire (plan fixe, niveaux/plan-histoire.js) et au mode chaos (plan tiré au hasard).
   plan = {
     cols, rows, seed,
     cells: { "c,r": { s: "nom de la salle", biome, relic, lore, flip } },
     links: [{ a: "c,r", b: "c,r", lock }]      lock : x (frappe) · | (phase) · H (cristal) · G (levier) · f (secret)
            pour H : crystalIn = salle où poser le cristal · pour G : leverIn = salle où poser le levier
   } */
const CELL_W = 19, CELL_H = 13, ROOM_W = 18, ROOM_H = 12;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
const cellKey = (c, r) => `${c},${r}`;
const parseKey = k => k.split(",").map(Number);
function salleRows(cell) {
  const rows = SALLES[cell.s].rows;
  return cell.flip ? rows.map(r => r.split("").reverse().join("")) : rows;
}
// Les portes d'une salle retournée échangent gauche et droite
function salleDoors(cell) {
  const d = SALLES[cell.s].doors;
  return cell.flip ? d.replace(/L/g, "_").replace(/R/g, "L").replace(/_/g, "R") : d;
}

function assemblePlan(plan) {
  const W = 1 + plan.cols * CELL_W, gridH = 1 + plan.rows * CELL_H;
  const arenaH = plan.arena ? 20 : 0, H = gridH + arenaH;
  const g = Array.from({ length: H }, () => Array(W).fill("#"));
  const ents = [], biomes = [];
  const rand = rng(plan.seed || 1), lootRand = rng((plan.seed || 1) * 31 + 777);
  const pickFrom = list => list[Math.floor(rand() * list.length)];
  const origin = k => { const [c, r] = parseKey(k); return [1 + c * CELL_W, 1 + r * CELL_H]; };

  for (const [k, cell] of Object.entries(plan.cells)) {
    const [x0, y0] = origin(k), rows = salleRows(cell), biome = cell.biome || "entree";
    biomes.push({ x: x0 - 1, y: y0 - 1, w: CELL_W + 1, h: CELL_H + 1, id: biome });
    const mons = SALLE_MONSTRES[biome] || SALLE_MONSTRES.entree;
    for (let r = 0; r < ROOM_H; r++) for (let c = 0; c < ROOM_W; c++) {
      const ch = rows[r][c], x = x0 + c, y = y0 + r;
      g[y][x] = TERRAIN.has(ch) ? ch : ".";
      if (TERRAIN.has(ch)) continue;
      switch (ch) {
        case "P": ents.push({ t: "spawn", x, y }); break;
        case "A": ents.push({ t: "altar", x, y }); break;
        case "C": ents.push({ t: "chest", x, y, s: cell.s === "secret" ? "secret" : undefined }); break;
        case "R": if (cell.relic) ents.push({ t: "relic", x, y, s: cell.relic }); break;
        case "O": ents.push({ t: "anchor", x, y }); break;
        case "K": ents.push({ t: "crystal", x, y }); break;
        case "L": if (cell.levers !== false) ents.push({ t: "lever", x, y }); break;
        case "F": ents.push({ t: "campfire", x, y }); break;
        case "S": ents.push({ t: "stele", x, y }); break;
        case "T": ents.push({ t: "trial", x, y, w: ROOM_W, h: ROOM_H }); break;
        case "Q": ents.push({ t: "lore", x, y, s: cell.lore || (cell.s === "secret" ? "secret" : biome + "1") }); break;
        case "U": ents.push({ t: "bucket", x, y, d: 1 }); break;
        case "D": ents.push({ t: "bossdoor", x, y }); break;
        case "e": ents.push({ t: pickFrom(mons.e), x, y }); break;
        case "a": ents.push({ t: pickFrom(mons.a), x, y }); break;
        case "V": ents.push({ t: "pot", x, y }); break;
        case "J": ents.push({ t: "goldchest", x, y }); break;
        case "I": ents.push({ t: "treasure", x, y }); break;
        case "Y": ents.push({ t: "shopitem", x, y }); break;
        case "y": ents.push({ t: "shopgood", x, y }); break;
        case "Z": ents.push({ t: "sacrifice", x, y }); break;
        case "M": ents.push({ t: "merchant", x, y }); break;
        case "W": ents.push({ t: "wheel", x, y }); break;
        case "N": ents.push({ t: "dice", x, y }); break;
        case "X": ents.push({ t: "gamble", x, y }); break;
        case "j": ents.push({ t: "prisoner", x, y }); break;
      }
    }
    scatterLoot(cell, rows, x0, y0, ents, lootRand);
    // Une tablette d'histoire demandée sur une salle qui n'en a pas
    if (cell.lore && !rows.some(r => r.includes("Q"))) ents.push({ t: "lore", x: x0 + 4, y: y0 + 10, s: cell.lore });
  }

  for (const ln of plan.links) {
    const [ac, ar] = parseKey(ln.a), [bc, br] = parseKey(ln.b);
    // a est toujours à gauche ou au-dessus de b
    const [k1, k2] = (bc < ac || br < ar) ? [ln.b, ln.a] : [ln.a, ln.b];
    const [x1, y1] = origin(k1), [c1, r1] = parseKey(k1), [c2, r2] = parseKey(k2);
    const cellA = plan.cells[k1], cellB = plan.cells[k2];
    const trial = (cellA && SALLES[cellA.s].trial) || (cellB && SALLES[cellB.s].trial);
    const fill = ln.lock || (trial ? "B" : ".");
    if (r1 === r2 && c2 === c1 + 1) {                    // porte de côté
      for (let y = y1 + 8; y <= y1 + 10; y++) g[y][x1 + ROOM_W] = fill;
    } else if (c1 === c2 && r2 === r1 + 1) {             // porte verticale
      for (let x = x1 + 7; x <= x1 + 10; x++) { g[y1 + ROOM_H - 1][x] = "."; g[y1 + ROOM_H][x] = fill; }
      // Un courant d'air sous la porte la prolonge jusque dans la salle du dessus
      if (cellB && SALLES[cellB.s].upFree && rowsHave(cellB, "%"))
        for (let x = x1 + 7; x <= x1 + 10; x++) { g[y1 + ROOM_H][x] = ln.lock || "%"; g[y1 + ROOM_H - 1][x] = "%"; g[y1 + ROOM_H - 2][x] = "%"; }
    } else throw new Error("Lien entre salles non voisines : " + ln.a + " → " + ln.b);
    // Cristal et levier posés près de la porte, dans la salle demandée
    const near = (k, side) => { const [x, y] = origin(k); return { x: x + (side < 0 ? 2 : ROOM_W - 3), y: y + 10 }; };
    if (ln.lock === "H" && ln.crystalIn && !hasEnt(ents, "crystal", origin(ln.crystalIn))) {
      const p = near(ln.crystalIn, ln.crystalIn === k1 ? -1 : 1); ents.push({ t: "crystal", x: p.x, y: p.y });
    }
    if (ln.lock === "G" && ln.leverIn) {
      const p = near(ln.leverIn, ln.leverIn === k1 ? 1 : -1); ents.push({ t: "lever", x: p.x, y: p.y });
    }
  }

  if (plan.arena) {                                      // l'arène du Gardien, sous la grille
    const ax = Math.floor((W - 40) / 2), ay = gridH;
    for (let y = ay; y < H; y++) for (let x = ax + 4; x < ax + 36; x++) g[y][x] = (y >= ay + 2 && y <= ay + 17) ? "." : "#";
    for (let x = ax + 8; x <= ax + 12; x++) g[ay + 13][x] = "-";
    for (let x = ax + 27; x <= ax + 31; x++) g[ay + 13][x] = "-";
    for (let x = ax + 17; x <= ax + 22; x++) g[ay + 9][x] = "-";
    ents.push({ t: "arena", x: ax + 6, y: ay + 17 }, { t: "boss", x: ax + 30, y: ay + 17 });
    biomes.push({ x: 0, y: gridH, w: W, h: arenaH, id: "antre" });
  }
  return { v: 1, base: plan.base || null, w: W, h: H, rows: g.map(r => r.join("")), ents: ents.map(e => { const o = { ...e }; for (const k in o) if (o[k] === undefined) delete o[k]; return o; }), biomes };
}
// Jarres et coffres dorés semés au hasard (le hasard du plan : la map d'histoire reste toujours la même)
const NO_SCATTER = new Set(["depart", "antichambre", "secret", "epreuve", "boutique", "tresor", "sacrifice", "tripot", "prison", "relique_saut", "relique_dash", "relique_frappe", "relique_grappin"]);
function scatterLoot(cell, rows, x0, y0, ents, rand) {
  if (NO_SCATTER.has(cell.s) || globalThis.NOSCATTER) return;
  const spots = [];
  for (let c = 2; c <= 15; c++) for (let r = 10; r >= 2; r--) {
    if (r === 10 && c >= 6 && c <= 11) continue;                 // trappe possible au sol
    const below = rows[r + 1][c];
    if (rows[r][c] === "." && rows[r - 1][c] === "." && (below === "#" || below === "-")) { spots.push([c, r]); break; }
  }
  const taken = new Set();
  const free = ([c, r]) => !taken.has(c) && !taken.has(c - 1) && !taken.has(c + 1) && !ents.some(e => e.x === x0 + c && e.y === y0 + r);
  const place = t => {
    const ok = spots.filter(free);
    if (!ok.length) return;
    const [c, r] = ok[Math.floor(rand() * ok.length)];
    taken.add(c); ents.push({ t, x: x0 + c, y: y0 + r });
  };
  const n = Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) place("pot");
  if (rand() < 0.06) place("goldchest");
  else if (rand() < 0.08) place("chest");
  else if (rand() < 0.05) place("mimic");
}
const rowsHave = (cell, ch) => SALLES[cell.s].rows.some(r => r.includes(ch));
function hasEnt(ents, t, [x0, y0]) { return ents.some(e => e.t === t && e.x >= x0 && e.x < x0 + ROOM_W && e.y >= y0 && e.y < y0 + ROOM_H); }

/* Vérification logique d'un plan : en partant du départ, quelles salles sont atteignables avec quels pouvoirs,
   dans quel ordre on trouve les reliques, et est-ce qu'on peut rester coincé quelque part. */
function planEdges(plan, skills) {
  const has = s => !s || skills.has(s);
  const lockNeeds = { x: "smash", "|": "phase", H: "bolt", f: null, B: null, G: "lever", k: null };
  const out = {};
  for (const k of Object.keys(plan.cells)) out[k] = [];
  for (const ln of plan.links) {
    const [ac, ar] = parseKey(ln.a), [bc, br] = parseKey(ln.b);
    const [k1, k2] = (bc < ac || br < ar) ? [ln.b, ln.a] : [ln.a, ln.b];
    const vertical = ac === bc;
    let need = ln.lock ? lockNeeds[ln.lock] : null;
    if (need === "lever") need = null;                    // levier : vérifié à part (il doit être du côté atteignable)
    const ok = need === null || skills.has(need);
    if (!ok) continue;
    if (!vertical) { out[k1].push({ to: k2, door: "R", entry: "L" }); out[k2].push({ to: k1, door: "L", entry: "R" }); }
    else {
      const upper = plan.cells[k1], lower = plan.cells[k2], L = SALLES[lower.s];
      // Descendre : toujours, sauf dans un courant d'air qui repousse vers le haut
      if (!(L.upFree && rowsHave(lower, "%"))) out[k1].push({ to: k2, door: "D", entry: "U" });
      // Monter : seulement si la salle du dessous aide à monter (échelle, courant, murs d'accroche, anneau)
      if (L.up && (L.upFree || skills.has("doubleJump"))) out[k2].push({ to: k1, door: "U", entry: "D" });
    }
  }
  // Exigences à l'intérieur des salles (« porte d'entrée > porte de sortie »)
  for (const k of Object.keys(out)) {
    const cell = plan.cells[k], raw = SALLES[cell.s].req || {}, req = {};
    // Une salle retournée échange aussi la gauche et la droite de ses exigences
    const sw = s => cell.flip ? s.replace(/L/g, "_").replace(/R/g, "L").replace(/_/g, "R") : s;
    for (const [kk, v] of Object.entries(raw)) req[sw(kk)] = v;
    out[k] = out[k].map(e => ({ ...e, req }));
    // Salle de relique gardée : elle se ferme pendant le combat et ne se rouvre qu'une fois la relique prise
    if (cell.relic && !skills.has(cell.relic) && plan.guarded !== false) out[k] = [];
  }
  return out;
}
function planReach(plan, start, skills) {
  const edges = planEdges(plan, skills), flip = d => d;
  const seen = new Map([[start + "|*", true]]), rooms = new Set([start]), queue = [[start, "*"]];
  while (queue.length) {
    const [k, entry] = queue.shift();
    for (const e of edges[k]) {
      const need = entry === "*" ? null : (e.req[`${entry}>${e.door}`] || null);
      if (need && !skills.has(need)) continue;
      const st = e.to + "|" + e.entry;
      if (seen.has(st)) continue;
      seen.set(st, true); rooms.add(e.to); queue.push([e.to, e.entry]);
    }
  }
  return { rooms, states: [...seen.keys()] };
}
function checkPlan(plan) {
  const start = Object.keys(plan.cells).find(k => plan.cells[k].s === "depart");
  const skills = new Set(), order = [], report = [];
  let ok = true;
  for (let step = 0; step < 10; step++) {
    const { rooms } = planReach(plan, start, skills);
    const found = [...rooms].map(k => plan.cells[k].relic).filter(s => s && !skills.has(s));
    if (!found.length) {
      const boss = [...rooms].some(k => plan.cells[k].s === "antichambre");
      const all = Object.keys(plan.cells).length;
      report.push(`Salles atteintes à la fin : ${rooms.size} / ${all}`, `Porte du Gardien atteignable : ${boss ? "oui" : "NON"}`);
      if (!boss) ok = false;
      const missing = Object.keys(plan.cells).filter(k => !rooms.has(k));
      if (missing.length) report.push("Jamais atteintes : " + missing.join(" "));
      break;
    }
    // Pièges : depuis chaque état atteignable, peut-on encore atteindre la prochaine relique ?
    const { states } = planReach(plan, start, skills);
    const relicRooms = [...rooms].filter(k => plan.cells[k].relic && !skills.has(plan.cells[k].relic));
    for (const st of states) {
      const [k, entry] = st.split("|");
      const sub = planReachFrom(plan, k, entry, skills);
      // coincé = plus aucune relique à prendre ET plus moyen d'atteindre le Gardien (rater une relique bonus n'est pas être coincé)
      if (!relicRooms.some(r => sub.has(r)) && ![...sub].some(r => plan.cells[r].s === "antichambre")) { ok = false; report.push(`ATTENTION : coincé possible en ${k} (entrée ${entry}) avant ${found.join(", ")}`); }
    }
    for (const s of found) { skills.add(s); order.push(s); }
  }
  report.unshift("Ordre des reliques : " + order.join(" → "));
  return { ok, order, report };
}
function planReachFrom(plan, k0, entry0, skills) {
  const edges = planEdges(plan, skills), seen = new Set([k0 + "|" + entry0]), rooms = new Set([k0]), queue = [[k0, entry0]];
  while (queue.length) {
    const [k, entry] = queue.shift();
    for (const e of edges[k]) {
      const need = entry === "*" ? null : (e.req[`${entry}>${e.door}`] || null);
      if (need && !skills.has(need)) continue;
      const st = e.to + "|" + e.entry;
      if (seen.has(st)) continue;
      seen.add(st); rooms.add(e.to); queue.push([e.to, e.entry]);
    }
  }
  return rooms;
}
if (typeof module !== "undefined") module.exports = { assemblePlan, checkPlan };
