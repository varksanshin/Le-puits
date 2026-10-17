"use strict";
// ---------- 23. Mode chaos ----------
/* Chaque partie tire une nouvelle map à partir des salles modèles :
   1. un chemin principal qui descend du haut vers le Gardien, un seul étage à la fois
   2. un biome = deux étages ; sa sortie est fermée par une serrure (mur fissuré, grille, marche, gouffre…),
      et la relique qui l'ouvre est sur le même étage que la serrure, avant elle, souvent dans une salle à l'écart :
      on peut toujours revenir la chercher, et aucune salle qui demande un pouvoir n'est posée avant qu'on l'ait
   3. des branches en cul-de-sac avec des récompenses : autels, coffres secrets, stèles, feux de camp, épreuves
   4. le vérificateur de l'assembleur rejoue la partie dans sa tête : si quelque chose cloche, on retire */
const CHAOS = { cols: 5, rows: 10, relics: 4, branches: 10 };
const CHAOS_BIOMES = ["entree", "entree", "mines", "mines", "noyee", "noyee", "spores", "spores", "antre", "antre"];
// Serrure posée après chaque relique : une salle-serrure (passage horizontal) ou un verrou de porte
const CHAOS_LOCKS = {
  doubleJump: { room: "marche" }, dash: { room: "couloir_dash" }, grapple: { room: "gouffre" },
  smash: { lock: "x" }, phase: { lock: "|" }, bolt: { lock: "H" },
};
const FILLERS = ["hall", "hall_autel", "echelle", "fosse", "pont_friable", "seaux", "noyee", "village", "stele", "repos", "hall",
  "crypte", "galerie", "piliers", "bassin", "racines", "ossuaire", "statues"];
// Salles qui vont mieux dans un biome : poids × 3 dans ce biome, × 0,5 ailleurs
const ROOM_BIOME = { galerie: "mines", piliers: "mines", bassin: "noyee", racines: "spores", ossuaire: "antre", crypte: "entree", statues: "antre" };

function ceilingOpen(name) { return SALLES[name].rows[0].slice(7, 11) === "...."; }
function fits(name, need, flip) {
  const d = salleDoors({ s: name, flip });
  for (const ch of need) {
    if (ch === "u") { if (!ceilingOpen(name)) return false; }
    else if (!d.includes(ch)) return false;
  }
  return true;
}
// Choisit une salle qui a les portes demandées (« u » = on y tombe par le plafond)
// « owned » : les pouvoirs qu'on a forcément à cet endroit ; une salle qui en demande un autre n'est pas posée là
function pickRoom(list, need, rand, biome, owned) {
  const ok = [];
  const allowed = name => !owned || Object.values(SALLES[name].req || {}).every(s => owned.has(s));
  for (const name of list) if (allowed(name)) for (const flip of [false, true]) if (fits(name, need, flip)) ok.push({ s: name, flip });
  if (!ok.length) return null;
  // L'eau surtout dans la zone noyée, les seaux surtout dans les mines
  const w = ok.map(o => (o.s === "noyee" || o.s === "village") ? (biome === "noyee" ? 4 : 0.2) : o.s === "seaux" ? (biome === "mines" ? 3 : 0.5)
    : ROOM_BIOME[o.s] ? (ROOM_BIOME[o.s] === biome ? 3 : 0.5) : 1);
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ok.length; i++) if ((r -= w[i]) <= 0) return ok[i];
  return ok[ok.length - 1];
}

function generateChaosPlan(seed) {
  const rand = rng(seed), C = CHAOS.cols, R = CHAOS.rows;
  const key = cellKey, used = new Map(), path = [];
  // 1. Chemin : sur chaque rangée on avance d'au moins une case sur le côté (deux sur la 2e rangée d'un biome),
  //    puis on descend d'UN seul étage : jamais deux trappes l'une sous l'autre, on ne tombe jamais plusieurs étages d'un coup
  let c = Math.floor(rand() * C), r = 0;
  path.push([c, r]); used.set(key(c, r), 0);
  for (;;) {
    const minSteps = r % 2 === 1 ? 2 : 1, room = d => d > 0 ? C - 1 - c : c;
    let dir = rand() < 0.5 ? -1 : 1;
    if (room(dir) < minSteps) dir = -dir;
    const steps = Math.min(room(dir), minSteps + (rand() < 0.4 ? 1 : 0));
    for (let i = 0; i < steps; i++) { c += dir; path.push([c, r]); used.set(key(c, r), path.length - 1); }
    if (r === R - 1) break;                                          // la dernière case de la dernière rangée : l'antichambre
    r++; path.push([c, r]); used.set(key(c, r), path.length - 1);
  }

  // Portes de chaque case du chemin
  const doors = path.map(() => new Set());
  const links = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ac, ar] = path[i], [bc, br] = path[i + 1];
    if (br > ar) { doors[i].add("D"); doors[i + 1].add("u"); }
    else if (bc > ac) { doors[i].add("R"); doors[i + 1].add("L"); }
    else { doors[i].add("L"); doors[i + 1].add("R"); }
    links.push({ a: key(ac, ar), b: key(bc, br) });
  }
  // 2. Une relique par biome, et la sortie du biome fermée par la serrure de cette relique (comme dans Symphony of the Night) :
  //    la relique est sur la 1re rangée du biome (sa salle se ferme tant que le gardien n'est pas vaincu),
  //    la serrure sur la 2e rangée, juste avant de descendre vers le biome suivant.
  const pool = Object.keys(CHAOS_LOCKS).sort(() => rand() - 0.5);
  const gated = pool.slice(0, CHAOS.relics), bonus = pool.slice(CHAOS.relics);
  const plan = { cols: C, rows: R, seed, arena: true, base: "chaos", cells: {}, links };
  const reserved = new Map();                                        // index de case → { relic } ou { lockRoom } ou { lockLink }
  const extraDoor = new Map();                                       // index de case → porte de côté vers la salle de la relique
  const relicBranches = [];                                          // salles de relique à l'écart du chemin
  const onRow = row => path.map((p, i) => p[1] === row ? i : -1).filter(i => i >= 0);
  const shuffle = a => a.map(v => [rand(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  gated.forEach((skill, k) => {
    const rowA = onRow(2 * k), rowB = onRow(2 * k + 1);
    if (!rowA.length || !rowB.length) return;
    // la serrure d'abord, sur la 2e rangée du biome, juste avant de descendre vers le biome suivant
    const L = CHAOS_LOCKS[skill], last = rowB[rowB.length - 1];
    let before;                                                                     // la relique doit être AVANT cette case
    if (L.room) { reserved.set(rowB[1], { lockRoom: L.room }); before = rowB[1]; }
    else {
      const li = last - 1;                                                          // le dernier passage horizontal avant la descente
      links[li].lock = L.lock;
      if (L.lock === "H") { links[li].crystalIn = key(...path[li]); reserved.set(li, { lockLink: "H" }); }
      before = li + 1;
    }
    // la relique : dans une salle à l'écart, sur le MÊME étage que la serrure et avant elle.
    // Les trappes ne se remontent pas : si la relique était à l'étage du dessus, on pourrait descendre sans elle
    // et rester bloqué devant la serrure. Sur le même étage, on peut toujours revenir la chercher à pied.
    // Jamais collée au départ : au moins deux salles à traverser avant de croiser un gardien.
    const minHost = k === 0 ? 2 : rowA[0];
    const hosts = shuffle(rowB.filter(i => i >= minHost && i < before && !reserved.has(i) && !extraDoor.has(i)));
    for (const i of hosts) {
      const [hc, hr] = path[i];
      for (const dir of shuffle([-1, 1])) {
        const nc = hc + dir;
        if (nc < 0 || nc >= C || used.has(key(nc, hr))) continue;
        extraDoor.set(i, dir < 0 ? "L" : "R");
        used.set(key(nc, hr), -1);
        relicBranches.push({ host: i, at: [nc, hr], need: dir < 0 ? "R" : "L", skill });
        return;
      }
    }
    // pas de place sur le côté : la relique va sur le chemin (on la traverse forcément, et sa salle se ferme), pas à côté du départ
    const cands = [...rowA, ...rowB].filter(i => i >= minHost + (k === 0 ? 1 : 0) && i < before && !reserved.has(i) && path[i - 1][1] === path[i][1]);
    if (!cands.length) throw new Error("pas de place pour la relique " + skill);   // la map est retirée : jamais de serrure sans sa relique
    reserved.set(cands[Math.floor(rand() * cands.length)], { relic: skill });
  });
  // Les pouvoirs qu'on a forcément sur une rangée : ceux des biomes déjà franchis (leur sortie demande leur relique)
  const ownedAt = row => new Set(gated.filter((s, k) => 2 * k + 1 < row));
  // Salles du chemin
  path.forEach(([pc, pr], i) => {
    const biome = CHAOS_BIOMES[pr], need = [...doors[i]], res = reserved.get(i) || {};
    if (extraDoor.has(i)) need.push(extraDoor.get(i));
    let cell;
    if (i === 0) cell = pickRoom(["depart"], need, rand, biome);
    else if (i === path.length - 1) cell = pickRoom(["antichambre"], need, rand, biome);
    else if (res.lockRoom) cell = pickRoom([res.lockRoom], need, rand, biome);
    else if (res.relic) cell = pickRoom(["relique_simple", "relique_frappe"], need, rand, biome) || pickRoom(FILLERS, need, rand, biome, ownedAt(pr));
    else if (res.lockLink === "H") cell = pickRoom(["cristal"], need, rand, biome) || pickRoom(FILLERS, need, rand, biome, ownedAt(pr));
    else cell = pickRoom(FILLERS, need, rand, biome, ownedAt(pr));
    if (!cell) throw new Error("aucune salle pour " + need.join(""));
    cell.biome = biome;
    if (res.relic) { cell.relic = res.relic; if (!SALLES[cell.s].rows.some(r => r.includes("R"))) cell.extraRelic = true; }
    plan.cells[key(pc, pr)] = cell;
  });
  // Les salles de relique à l'écart
  for (const b of relicBranches) {
    const [nc, nr] = b.at, cell = pickRoom(["relique_simple"], [b.need], rand, CHAOS_BIOMES[nr]);
    if (!cell) throw new Error("pas de salle de relique");
    cell.biome = CHAOS_BIOMES[nr]; cell.relic = b.skill;
    plan.cells[key(nc, nr)] = cell;
    links.push({ a: key(...path[b.host]), b: key(nc, nr) });
  }
  // 3. Branches : une ou deux cases sur le côté, avec une récompense au bout
  const rewards = ["relique_simple", "boutique", "prison", "tresor", "tripot", "secret", "sacrifice", "repos", "epreuve", "stele", "hall_autel"];
  for (let b = 0, placed = 0; b < 40 && placed < CHAOS.branches; b++) {
    const i = 1 + Math.floor(rand() * (path.length - 3)), [pc, pr] = path[i];
    const dir = rand() < 0.5 ? -1 : 1, nc = pc + dir;
    if (nc < 0 || nc >= C || used.has(key(nc, pr))) continue;
    const host = plan.cells[key(pc, pr)], sideCh = dir < 0 ? "L" : "R";
    if (!salleDoors(host).includes(sideCh)) continue;
    const reward = rewards[placed % rewards.length], need = [dir < 0 ? "R" : "L"];
    if (reward === "relique_simple" && i < 4) continue;                             // pas de gardien bonus juste à côté du départ
    const cell = pickRoom([reward], need, rand, CHAOS_BIOMES[pr]);
    if (!cell) continue;
    cell.biome = CHAOS_BIOMES[pr];
    if (reward === "relique_simple") { if (!bonus.length) continue; cell.relic = bonus[0]; }      // une relique en bonus, hors du chemin
    plan.cells[key(nc, pr)] = cell; used.set(key(nc, pr), -1); placed++;
    links.push({ a: key(pc, pr), b: key(nc, pr), lock: reward === "secret" ? "f" : SALLES[reward].special ? "k" : undefined });
  }
  return plan;
}

// Tire des maps jusqu'à en trouver une que le vérificateur valide
function buildChaosLevel(seed) {
  for (let t = 0; t < 40; t++) {
    const s = (seed + t * 7919) >>> 0;
    let plan;
    try { plan = generateChaosPlan(s); } catch (e) { continue; }
    const check = checkPlan(plan);
    if (!check.ok || check.order.length < 3) continue;          // au moins trois reliques par partie
    const lv = assemblePlan(plan);
    // Les reliques posées dans une salle sans emplacement prévu : au sol, à gauche
    for (const [k, cell] of Object.entries(plan.cells)) if (cell.extraRelic) {
      const [c, r] = parseKey(k);
      lv.ents.push({ t: "relic", x: 1 + c * CELL_W + 3, y: 1 + r * CELL_H + 10, s: cell.relic });
    }
    lv.seed = s; lv.order = check.order;
    return lv;
  }
  return null;
}

// ----- Lancer une partie en mode chaos -----
let gameMode = "story", storyLevel = null, chaosSeed = 0;
function startChaos() {
  if (gameMode === "story") storyLevel = level;
  chaosSeed = Math.floor(Math.random() * 1e9);
  const lv = buildChaosLevel(chaosSeed);
  if (!lv) { toast("Le puits refuse de se former… réessaie.", 2400); return false; }
  gameMode = "chaos"; level = lv; chaosSeed = lv.seed;
  resetRun(); closeMenu();
  toast(`Mode chaos · graine ${chaosSeed} · reliques : ${lv.order.map(s => RELIC_INFO[s].name).join(", ")}`, 4200);
  return true;
}
function backToStory() {
  if (gameMode === "chaos" && storyLevel) { level = storyLevel; gameMode = "story"; }
}
