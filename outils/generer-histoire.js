// Génère le plan du mode histoire (niveaux/plan-histoire.js) : un grand puits labyrinthique, puis on le fige.
//   node outils/generer-histoire.js            → essaie des graines, garde la meilleure, écrit le plan
//   node outils/generer-histoire.js 1234       → utilise cette graine
// Principe (à la Symphony of the Night) :
//   - chaque biome est une bande de rangées ; à l'intérieur, un labyrinthe (arbre couvrant + boucles), avec des masses de roche ;
//   - on remonte par des échelles (double saut) ou des murs d'accroche ; on descend par des trappes ;
//   - la relique du biome est au fond d'un cul-de-sac ; la sortie du biome est fermée par la serrure de cette relique ;
//   - chaque biome a une salle spéciale derrière une porte à clé, un secret, des feux de camp, une stèle, une épreuve ;
//   - les premiers biomes cachent des passages qu'on n'ouvre qu'avec un pouvoir trouvé plus bas (retours en arrière).
const fs = require("fs"), path = require("path"), vm = require("vm");
const racine = path.dirname(__dirname);
const ctx = { TERRAIN: new Set(["#", "x", "^", "-", "|", "H", "=", "~", "%", "g", "G", "f", "B", "k", "."]), console, Math };
vm.createContext(ctx);
const src = ["niveaux/salles.js", "js/23-assembleur.js"].map(f => fs.readFileSync(path.join(racine, f), "utf8").replace(/^"use strict";/, "")).join("\n;\n");
vm.runInContext(src + "\nthis.SALLES = SALLES; this.checkPlan = checkPlan; this.salleDoors = salleDoors; this.rng = rng; this.planEdges = planEdges;", ctx);
const { SALLES, checkPlan, salleDoors, rng } = ctx;

const COLS = 7;
// Les bandes : [biome, première rangée, nombre de rangées, relique, serrure de sortie]
const BANDS = [
  { biome: "entree", r0: 0,  rows: 4, relic: "doubleJump", exit: { room: "marche" },       lore: ["entree1", "entree2"], special: "boutique" },
  { biome: "mines",  r0: 4,  rows: 4, relic: "dash",       exit: { room: "couloir_dash" }, lore: ["mines1", "mines2"],   special: "tresor" },
  { biome: "noyee",  r0: 8,  rows: 4, relic: "grapple",    exit: { room: "gouffre" },      lore: ["noyee1", "noyee2"],   special: "sacrifice" },
  { biome: "spores", r0: 12, rows: 3, relic: "smash",      exit: { lock: "x" },            lore: ["spores1", "spores2"], special: "boutique" },
  { biome: "antre",  r0: 15, rows: 2, relic: "bolt",       exit: { lock: "H" },            lore: ["antre1"],             special: "tresor" },
  { biome: "antre",  r0: 17, rows: 2, relic: "phase",      exit: { final: true, lock: "|" }, lore: ["antre2"],           special: "sacrifice" },
];
const ORDER = BANDS.map(b => b.relic);
const FILL = { entree: ["hall", "hall_autel", "crypte", "statues", "pont_friable", "hall"], mines: ["galerie", "hall", "fosse", "seaux", "hall_autel"],
  noyee: ["noyee", "village", "bassin", "hall", "noyee"], spores: ["racines", "hall", "pont_friable", "fosse", "hall_autel"], antre: ["ossuaire", "statues", "hall", "crypte", "galerie"] };
const key = (c, r) => `${c},${r}`;
const fits = (name, need, flip) => { const d = salleDoors({ s: name, flip }); for (const ch of need) if (!d.includes(ch)) return false; return true; };
function choose(list, need, rand) {
  const ok = [];
  for (const s of list) for (const flip of [false, true]) if (SALLES[s] && fits(s, need, flip)) ok.push({ s, flip });
  return ok.length ? ok[Math.floor(rand() * ok.length)] : null;
}

function generate(seed) {
  const rand = rng(seed), pick = a => a[Math.floor(rand() * a.length)];
  const cells = {}, links = [], linkSet = new Set();
  const link = (a, b, extra = {}) => { const k = [a, b].sort().join("|"); if (linkSet.has(k)) return; linkSet.add(k); links.push({ a, b, ...extra }); };
  const doors = {};                                         // case → portes demandées
  const addDoor = (k, d) => { (doors[k] = doors[k] || new Set()).add(d); };
  const role = {};                                          // case → rôle imposé (salle précise)
  let entryCol = 1 + Math.floor(rand() * (COLS - 2));
  const owned = new Set();

  let failed = false;
  BANDS.forEach((B, bi) => {
    if (failed) return;
    const R0 = B.r0, R1 = B.r0 + B.rows - 1, last = bi === BANDS.length - 1;
    // 1. Sortie : la case X tout en bas, la serrure L à côté, et M de l'autre côté de L
    let xc, lc, mc;
    for (let t = 0; t < 40; t++) {
      xc = Math.floor(rand() * COLS); const dir = rand() < 0.5 ? -1 : 1; lc = xc + dir; mc = xc + 2 * dir;
      if (mc >= 0 && mc < COLS && (B.rows > 1 || Math.abs(xc - entryCol) > 2) && !(xc === entryCol && R1 === R0)) break;
    }
    const X = key(xc, R1), L = key(lc, R1), M = key(mc, R1);
    // 2. Labyrinthe sur les autres cases de la bande (arbre couvrant aléatoire depuis l'entrée)
    const free = new Set();
    for (let r = R0; r <= R1; r++) for (let c = 0; c < COLS; c++) if (![X, L].includes(key(c, r))) free.add(key(c, r));
    const entry = key(entryCol, R0);
    const inTree = new Set([entry]), stack = [entry], tree = [];
    while (stack.length) {
      const cur = stack[stack.length - 1], [c, r] = cur.split(",").map(Number);
      const nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].map(([a, b]) => key(a, b)).filter(k => free.has(k) && !inTree.has(k));
      if (!nb.length) { stack.pop(); continue; }
      // on préfère les couloirs horizontaux (plus jouables), sans s'interdire de monter ou descendre
      const horiz = nb.filter(k => k.split(",")[1] === String(r));
      const nx = (horiz.length && rand() < 0.68) ? pick(horiz) : pick(nb);
      inTree.add(nx); tree.push([cur, nx]); stack.push(nx);
    }
    // 3. Des masses de roche : on retire des feuilles (jamais l'entrée, ni M)
    const deg = k => tree.filter(([a, b]) => a === k || b === k).length;
    for (let i = 0; i < Math.round(free.size * 0.22); i++) {
      const leaves = [...inTree].filter(k => deg(k) === 1 && k !== entry && k !== M);
      if (!leaves.length) break;
      const lf = pick(leaves); inTree.delete(lf);
      for (let j = tree.length - 1; j >= 0; j--) if (tree[j].includes(lf)) tree.splice(j, 1);
    }
    if (!inTree.has(M)) { failed = true; return; }                              // M doit faire partie du labyrinthe
    // 4. Des boucles : quelques passages en plus entre cases voisines
    const extra = [];
    for (const k of inTree) {
      const [c, r] = k.split(",").map(Number);
      for (const n of [key(c + 1, r), key(c, r + 1)]) if (inTree.has(n) && !tree.some(([a, b]) => (a === k && b === n) || (a === n && b === k)) && rand() < 0.16) extra.push([k, n]);
    }
    const edges = [...tree, ...extra];
    // 5. La relique : le cul-de-sac horizontal le plus loin de l'entrée
    const dist = new Map([[entry, 0]]), q = [entry];
    while (q.length) { const k = q.shift(); for (const [a, b] of edges) { const n = a === k ? b : b === k ? a : null; if (n && !dist.has(n)) { dist.set(n, dist.get(k) + 1); q.push(n); } } }
    const cands = [...inTree].filter(k => k !== entry && k !== M && edges.filter(e => e.includes(k)).length === 1)
      .filter(k => { const e = edges.find(e => e.includes(k)); const o = e[0] === k ? e[1] : e[0]; return o.split(",")[1] === k.split(",")[1]; })
      .sort((a, b) => dist.get(b) - dist.get(a));
    if (!cands.length) { failed = true; return; }
    const relicCell = cands[0];
    role[relicCell] = { s: "relique_simple", relic: B.relic };
    // 6. On pose les liens et les portes
    for (const [a, b] of edges) {
      const [ac, ar] = a.split(",").map(Number), [bc, br] = b.split(",").map(Number);
      link(a, b);
      if (ar === br) { const [lft, rgt] = ac < bc ? [a, b] : [b, a]; addDoor(lft, "R"); addDoor(rgt, "L"); }
      else { const [up, lo] = ar < br ? [a, b] : [b, a]; addDoor(up, "D"); addDoor(lo, "U"); }
    }
    // la sortie
    const sideLM = lc < mc ? ["R", "L"] : ["L", "R"];          // portes : de L vers M
    if (B.exit.room) {
      role[L] = { s: B.exit.room };
      link(M, L); addDoor(M, sideLM[1] === "L" ? "L" : "R"); addDoor(L, sideLM[0]);
      link(L, X); addDoor(L, xc > lc ? "R" : "L"); addDoor(X, xc > lc ? "L" : "R");
    } else {
      link(M, L); addDoor(M, mc < lc ? "R" : "L"); addDoor(L, lc < mc ? "R" : "L");
      const lk = { lock: B.exit.lock }; if (B.exit.lock === "H") { lk.crystalIn = L; role[L] = { s: "cristal" }; }
      link(L, X, lk); addDoor(L, xc > lc ? "R" : "L"); addDoor(X, xc > lc ? "L" : "R");
    }
    if (B.exit.final) role[X] = { s: "antichambre" };
    else {
      // on descend vers la bande suivante par une trappe ; la case du dessous a une échelle pour pouvoir remonter
      addDoor(X, "D"); const below = key(xc, R1 + 1); link(X, below); addDoor(below, "U");
      role[below] = { s: "echelle" };
      entryCol = xc;
    }
    // 7. Choix des salles de la bande
    const bandCells = [...inTree, L, X];
    const fillers = FILL[B.biome].filter(s => Object.values(SALLES[s].req || {}).every(k => owned.has(k)));
    for (const k of bandCells) {
      const need = [...(doors[k] || [])];
      let cell;
      if (role[k]) cell = choose([role[k].s], need, rand);
      else if (bi === 0 && k === entry) cell = choose(["depart"], need, rand);
      else if (need.includes("U")) cell = choose(["echelle"], need, rand);        // on remonte par les échelles (double saut) : avant, on ne fait que descendre
      else cell = choose(fillers, need, rand) || choose(["hall", "hall_autel", "village", "crypte"], need, rand);
      if (!cell) { failed = true; return; }
      cell.biome = B.biome;
      if (role[k] && role[k].relic) cell.relic = role[k].relic;
      cells[k] = cell;
    }
    if (bi === 0) { if (cells[entry].s !== "depart") { const d = choose(["depart"], [...(doors[entry] || [])], rand); if (!d) { failed = true; return; } d.biome = B.biome; cells[entry] = d; } }
    // 8. Ce qui donne envie d'explorer : feux de camp, stèle, épreuve, histoire, salle spéciale, secret, passage pour plus tard
    const plain = () => bandCells.filter(k => !role[k] && cells[k] && !["depart", "echelle"].includes(cells[k].s));
    const swap = (name, n) => { for (let i = 0; i < n; i++) { const opts = plain().filter(k => fits(name, [...(doors[k] || [])], false) || fits(name, [...(doors[k] || [])], true)); if (!opts.length) { failed = true; return; } const k = pick(opts); const c = choose([name], [...(doors[k] || [])], rand); c.biome = B.biome; cells[k] = c; role[k] = { s: name }; } };
    swap("repos", B.rows >= 3 ? 2 : 1); swap("stele", 1); if (B.rows >= 3) swap("epreuve", 1);
    // tablettes d'histoire : à l'arrivée dans le biome, et près de la relique
    if (B.lore[0]) cells[entry].lore = B.lore[0];
    if (B.lore[1]) cells[relicCell].lore = B.lore[1];
    // branches hors du labyrinthe : salle spéciale (clé), secret (faux mur), passage pour plus tard (pouvoir d'une bande plus basse)
    const later = ORDER.slice(bi + 1).filter(s => s === "smash" || s === "phase")[0];
    const branches = [[B.special, "k"], ["secret", "f"], ...(later ? [[bi % 2 ? "tresor" : "secret", later === "smash" ? "x" : "|"]] : [])];
    for (const [name, lock] of branches) {
      let done = false;
      for (const k of [...inTree].sort(() => rand() - 0.5)) {
        const [c, r] = k.split(",").map(Number);
        for (const dc of [-1, 1]) {
          const n = key(c + dc, r);
          if (c + dc < 0 || c + dc >= COLS || cells[n] || role[k] || [X, L].includes(n)) continue;
          if (r !== R0 && r !== R1 && rand() < 0.3) continue;
          const host = cells[k], side = dc > 0 ? "R" : "L";
          const hostNeed = [...(doors[k] || []), side];
          const nh = choose([host.s], hostNeed, rand) || choose(fillers.concat(["hall", "hall_autel"]), hostNeed, rand);
          if (!nh) continue;
          const room = choose([name], [dc > 0 ? "L" : "R"], rand); if (!room) continue;
          nh.biome = B.biome; if (host.lore) nh.lore = host.lore; if (host.relic) continue;
          cells[k] = nh; addDoor(k, side); room.biome = B.biome; cells[n] = room; role[n] = { s: name };
          link(k, n, { lock }); done = true; break;
        }
        if (done) break;
      }
    }
    owned.add(B.relic);
  });
  if (failed || Object.keys(cells).length < 60) return null;
  if (links.some(l => !cells[l.a] || !cells[l.b])) return null;
  return { cols: COLS, rows: BANDS[BANDS.length - 1].r0 + BANDS[BANDS.length - 1].rows, seed, arena: true, base: "histoire-3", cells, links };
}

function score(plan) {
  const c = checkPlan(plan);
  if (!c.ok || c.order.join() !== ORDER.join()) return null;
  const all = Object.keys(plan.cells).length;
  const reached = Number((c.report.find(l => l.startsWith("Salles atteintes")) || "").match(/(\d+) \//)?.[1] || 0);
  if (reached !== all) return null;
  const loops = plan.links.length - (all - 1);
  return { all, loops, s: all + loops * 2 };
}

let best = null;
const seeds = process.argv[2] ? [Number(process.argv[2])] : Array.from({ length: 1500 }, (_, i) => 1000 + i * 7);
let tried = 0, valid = 0;
for (const s of seeds) {
  let plan; tried++;
  try { plan = generate(s); } catch (e) { continue; }
  if (!plan) continue;
  const sc = score(plan); if (!sc) continue;
  valid++;
  if (!best || sc.s > best.sc.s) best = { plan, sc, seed: s };
}
console.log(`${tried} graines essayées, ${valid} plans valides`);
if (!best) { console.log("aucun plan valide"); process.exit(1); }
console.log(`meilleure graine ${best.seed} : ${best.sc.all} salles, ${best.sc.loops} boucles`);
console.log(checkPlan(best.plan).report.join("\n"));
// affichage en texte
const P = best.plan;
for (let r = 0; r < P.rows; r++) {
  let line = String(r).padStart(2) + " ";
  for (let c = 0; c < P.cols; c++) { const x = P.cells[`${c},${r}`]; line += (x ? (x.relic ? "★" + x.relic.slice(0, 5) : x.s.slice(0, 7)) : "·").padEnd(10); }
  console.log(line);
}
// écriture du plan
const ent = o => "{ " + Object.entries(o).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ") + " }";
const out = `"use strict";
/* Plan du mode histoire : ${P.cols} colonnes × ${P.rows} rangées de salles, cinq biomes du haut vers le bas.
   Généré par outils/generer-histoire.js (graine ${best.seed}) puis figé ici : tu peux le retoucher à la main,
   puis reconstruire la map avec « NOSCATTER=1 node outils/construire-histoire.js ».
   L'ordre des reliques : ${ORDER.join(" → ")} → le Gardien.
   Chaque biome est un petit labyrinthe : sa relique est au fond d'un cul-de-sac, sa sortie demande cette relique.
   Les premiers biomes cachent des passages qui ne s'ouvrent qu'avec la frappe chargée ou la phase (retours en arrière). */
const PLAN_HISTOIRE = {
  cols: ${P.cols}, rows: ${P.rows}, seed: ${P.seed}, arena: true, base: "${P.base}",
  cells: {
${Object.entries(P.cells).sort((a, b) => { const [ac, ar] = a[0].split(",").map(Number), [bc, br] = b[0].split(",").map(Number); return ar - br || ac - bc; }).map(([k, v]) => `    "${k}": ${ent(v)},`).join("\n")}
  },
  links: [
${P.links.map(l => "    " + ent(l) + ",").join("\n")}
  ],
};
`;
if (!process.env.DRY) fs.writeFileSync(path.join(racine, "niveaux/plan-histoire.js"), out), console.log("niveaux/plan-histoire.js écrit");
