"use strict";
// ---------- 28i. Économie et difficulté, à la Isaac ----------
/* Moins d'objets, mais chacun compte :
   - le BUTIN DU GARDIEN : chaque gardien vaincu laisse sa relique ET trois objets au choix. On en prend un seul ;
     les deux autres s'enchaînent. Une clé brise une chaîne (le « reliquaire ») : un second objet, et le troisième disparaît ;
   - les AUTELS DES OMBRES : un seul par profondeur (au plus), et l'objet se paie avec un peu de lumière ;
   - le COLPORTEUR : un marchand ambulant, un par profondeur, jamais au même endroit. Ses prix montent en descendant.
     Le frapper deux fois, c'est le voler : son stock devient gratuit, mais les ténèbres montent fort
     et plus aucun colporteur ne se montrera de toute la partie ;
   - le TRIPOT : la roue des âmes, les dés d'os et le coffre du parieur, pour dépenser ses pièces ;
   - la PRISON : une clé ouvre la cellule. Le prisonnier te suit comme compagnon, te bénit… ou c'était un piège ;
   - en HISTOIRE, la carte reste la même mais les salles spéciales (boutiques, trésors, prisons, tripots…)
     sont tirées au sort à chaque partie.
   Et la difficulté suit ta puissance :
   - les monstres gagnent des PV et de la vitesse en descendant, des CHAMPIONS (élites colorées) apparaissent ;
   - les bonus de dégâts ont des rendements décroissants (le 5e bonus compte moins que le premier). */

const ECO = {
  shuffleStory: true,       // histoire : salles spéciales tirées au sort à chaque partie
  altarChance: 0.65,        // chance qu'une profondeur garde un autel des ombres
  altarDark: 10,            // ténèbres payées pour l'objet d'un autel
  merchantChance: 0.85,     // chance qu'un colporteur passe dans une profondeur
  stealDark: 22,            // ténèbres d'un vol
  hpPerTier: 0.12,          // +12 % de PV aux monstres par profondeur
  speedPerTier: 0.04,
  championRate: [0.03, 0.07, 0.11, 0.15, 0.19, 0.24],   // chance de champion selon la profondeur (5 = dimensions)
  dmgSoftStart: 1.25, dmgSoftRange: 1.6,                 // dégâts : × 1,25 plein pot, puis rendements décroissants (max ≈ × 2,85)
  wheelPrice: 5, dicePrice: 5, gamblePrice: 15,
};
// Les objets les plus forts ne se vendent pas : il faut les trouver (trésor) ou les gagner (gardien)
const STRONG_ITEMS = new Set(["aiguise", "bourreau", "echo", "spectrale", "etoiles", "lune", "foudre", "lamebraise", "revers", "frenesie", "grimoire", "orbe", "percant", "venin"]);
const COMPANIONS = {
  archere:    { name: "L'archère",          color: "#9fd8a0", hint: "Elle tire sur tes ennemis." },
  chevalier:  { name: "Le chevalier déchu", color: "#c8c0e8", hint: "Il fonce sur ceux qui t'approchent." },
  lanternier: { name: "Le porte-lanterne",  color: "#f2d45a", hint: "Ta lumière tient plus longtemps, et chaque gardien vaincu te soigne." },
};
const CHAMPIONS = {
  rapide:   { color: "#ff8a3a", name: "rapide" },
  blinde:   { color: "#9fb4c8", name: "blindé" },
  explosif: { color: "#ffb020", name: "explosif" },
  vampire:  { color: "#e0453c", name: "vampire" },
  spectral: { color: "#a8d8ff", name: "spectral" },
};

let runSeed = Math.floor(Math.random() * 1e9), merchantGone = false, companions = [], boons = { hp: 0, dmg: 0 };
let wanderers = [], games = [], prisoners = [], shadowAltars = [];
let ecoPending = null, storyBase = null;

// La profondeur : 0 (entrée) à 4 (antre), 5 dans les dimensions
function depthTier(y) {
  if (typeof DIM !== "undefined" && DIM) return 5;
  return Math.max(0, Math.min(4, Math.floor(5 * y / Math.max(1, MH * T))));
}
// Réserves d'objets selon la source
function itemPool(src, exclude = []) {
  const all = eligibleItems(exclude);
  let pool;
  if (src === "boutique") pool = all.filter(it => !it.mystery && !STRONG_ITEMS.has(it.id));
  else if (src === "maudit") pool = Math.random() < 0.6 ? all.filter(it => it.mystery) : all;
  else pool = all.filter(it => !it.mystery);
  return pool.length ? pool : all;
}
function giveItemFrom(src) {
  const pool = itemPool(src);
  if (!pool.length) { toast("Il n'y a plus rien à gagner ici.", 2000); spawnCoins(5, player.x + 5, player.y); return null; }
  const it = pick(pool); addItem(it.id);
  freeze = Math.max(freeze, 0.12); itemToast(it);
  return it;
}

// ----- La carte de l'histoire : mêmes couloirs, salles spéciales tirées au sort -----
const STORY_BAGS = {
  entree: [["boutique"], ["secret"]],
  mines:  [["tresor"], ["prison"], ["secret", "tripot"]],
  noyee:  [["tripot", "sacrifice"], ["secret"], ["boutique", "prison"]],
  spores: [["tresor"], ["boutique", "tripot"], ["prison", "sacrifice"]],
  antre:  [["tresor", "boutique"], ["sacrifice", "tripot", "prison"]],
};
const SLOT_ROOMS = new Set(["boutique", "tresor", "sacrifice", "secret", "tripot", "prison", "hall", "stele"]);
function shuffledStoryPlan(seed) {
  const P = PLAN_HISTOIRE, rand = rng(seed);
  const plan = { ...P, cells: {}, links: P.links.map(l => ({ ...l })) };
  for (const k in P.cells) plan.cells[k] = { ...P.cells[k] };
  const deg = {};
  for (const l of plan.links) for (const k of [l.a, l.b]) (deg[k] = deg[k] || []).push(l);
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const byBiome = {};
  for (const [k, c] of Object.entries(plan.cells)) {
    const d = deg[k] || [];
    if (d.length !== 1 || c.relic || c.lore || !SLOT_ROOMS.has(c.s)) continue;
    if (d[0].a.split(",")[1] !== d[0].b.split(",")[1]) continue;              // seulement les culs-de-sac de côté
    (byBiome[c.biome] = byBiome[c.biome] || []).push(k);
  }
  for (const [b, slots] of Object.entries(byBiome)) {
    const bag = (STORY_BAGS[b] || []).map(opts => opts[Math.floor(rand() * opts.length)]);
    while (bag.length < slots.length) bag.push(rand() < 0.5 ? "secret" : "stele");
    shuffle(bag); shuffle(slots);
    slots.forEach((k, i) => {
      const room = bag[i], link = deg[k][0];
      plan.cells[k].s = room;
      const power = link.lock && "x|HG".includes(link.lock) ? link.lock : null;    // un passage à pouvoir reste un passage à pouvoir
      const lock = power || (room === "secret" ? "f" : SALLES[room].special ? "k" : null);
      if (lock) link.lock = lock; else delete link.lock;
    });
  }
  return plan;
}
function buildStoryLevel(seed) {
  try {
    const plan = shuffledStoryPlan(seed);
    if (!checkPlan(plan).ok) return null;
    const lv = assemblePlan(plan);
    lv.shuffled = seed;
    return lv;
  } catch (e) { return null; }
}
const storyShuffleOK = () => ECO.shuffleStory && typeof PLAN_HISTOIRE !== "undefined" && gameMode === "story" && !(typeof DIM !== "undefined" && DIM) &&
  level.base === DEFAULT_LEVEL.base && PLAN_HISTOIRE.base === DEFAULT_LEVEL.base &&
  (level.shuffled != null || levelSource === "default") && !(typeof editSeq !== "undefined" && editSeq > 0);

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  const S = n => { if (typeof SFX !== "undefined") SFX.play(n); };
  const R = salt => rng(((runSeed ^ salt) >>> 0) || 1);
  const loading = () => typeof loadingSave !== "undefined" && loadingSave;
  const entering = () => typeof dimEntering !== "undefined" && dimEntering;

  // ===== Nouvelle partie : graine, carte tirée au sort, état remis à zéro =====
  around("resetRun", (o, ...a) => {
    if (typeof DIM !== "undefined" && DIM && !entering()) leaveDimension();
    // filet de sécurité : jamais une map de dimension comme map de l'histoire
    if (!entering() && gameMode === "story" && level && /^dimension/.test(level.base || "")) level = storyBase || clone(DEFAULT_LEVEL);
    if (!entering()) {
      if (loading() && ecoPending) runSeed = ecoPending.runSeed || 0;
      else if (!loading()) runSeed = Math.floor(Math.random() * 1e9);
      if (level.shuffled == null && gameMode === "story") storyBase = level;
      if (storyShuffleOK() && !(loading() && ecoPending && ecoPending.noShuffle)) {
        const lv = buildStoryLevel(runSeed);
        if (lv) level = lv;
      } else if (level.shuffled != null && storyBase) level = storyBase;
      merchantGone = false; companions = []; boons = { hp: 0, dmg: 0 };
    }
    const r = o(...a);
    scaleEnemies();
    return r;
  });
  // L'éditeur et l'atelier travaillent sur la map d'origine, pas sur la version tirée au sort
  around("setMode", (o, m, ...a) => { if (m === "edit" && level.shuffled != null && storyBase) level = storyBase; return o(m, ...a); });

  // ===== Au chargement de la map : autels, colporteurs, tripot, prisonniers =====
  around("loadMap", (o, ...a) => {
    const r = o(...a);
    setupEco();
    return r;
  });
  function setupEco() {
    wanderers = []; games = []; prisoners = []; shadowAltars = [];
    // Les autels : un seul au plus par profondeur
    const ar = R(0xA17A), byTier = {};
    for (const pk of pickups) (byTier[depthTier(pk.y)] = byTier[depthTier(pk.y)] || []).push(pk);
    for (const list of Object.values(byTier)) {
      const keep = list[Math.floor(ar() * list.length)];
      if (ar() < ECO.altarChance || (typeof DIM !== "undefined" && DIM)) shadowAltars.push({ x: keep.x, y: keep.y, w: 10, h: 10, t: keep.t, rest: 0, taken: false, near: false });
    }
    pickups = [];
    // Tripot et prison
    for (const e of level.ents) {
      if (e.t === "wheel" || e.t === "dice" || e.t === "gamble") games.push({ kind: e.t, x: e.x * T, y: e.y * T, w: 16, h: 16, rest: 0, cd: 0, anim: 0, uses: 0, t: Math.random() * 6, result: null });
      if (e.t === "prisoner") prisoners.push({ x: e.x * T + 3, y: e.y * T + 2, w: 10, h: 14, state: "caged", t: Math.random() * 6, out: null, idx: prisoners.length, fade: 0 });
    }
    const pr = R(0x9150);
    for (const p of prisoners) { const k = pr(); p.out = k < 0.5 ? "ally" : k < 0.8 ? "boon" : "trap"; p.roll = pr(); }
    // Les colporteurs
    if (typeof DIM === "undefined" || !DIM) placeWanderers();
  }
  function placeWanderers() {
    const rand = R(0xC0F0), banned = new Set();
    const cellOf = (x, y) => `${Math.floor((x / T - 1) / CELL_W)},${Math.floor((y / T - 1) / CELL_H)}`;
    for (const e of level.ents) if (["relic", "spawn", "bossdoor", "treasure", "shopitem", "sacrifice", "wheel", "prisoner", "trial", "arena", "boss", "lore"].includes(e.t)) banned.add(cellOf(e.x * T + 1, e.y * T + 1));
    const ok = (c, r) => tile(c, r) === "." && tile(c, r - 1) === "." && tile(c, r - 2) === "." && solid(tile(c, r + 1)) && tile(c, r + 1) !== "=" && tile(c, r + 1) !== "k";
    const cands = {};
    const gridH = MH - 21;
    for (let r = 3; r < Math.min(MH - 2, gridH); r++) for (let c = 2; c < MW - 9; c++) {
      let good = true;
      for (let i = 0; i < 7 && good; i++) if (!ok(c + i, r) || tile(c + i, r) === "^" || tile(c + i, r + 1) === "^") good = false;
      if (!good) continue;
      if (banned.has(cellOf(c * T, r * T)) || banned.has(cellOf((c + 6) * T, r * T))) continue;
      const tier = depthTier(r * T);
      (cands[tier] = cands[tier] || []).push([c, r]);
    }
    for (const tier of Object.keys(cands).sort()) {
      const list = cands[tier];
      if (rand() > ECO.merchantChance) continue;
      const [c, r] = list[Math.floor(rand() * list.length)];
      const w = { x: c * T + 2, y: r * T, w: 12, h: 16, t: rand() * 6, warned: 0, hitCd: 0, fled: false, fleeT: 0, vanish: false, gone: false, greeted: false, wares: [] };
      const wareAt = (col, item, good, deal) => {
        const pd = { x: col * T + 2, y: r * T + 4, w: 12, h: 12, kind: "wander", item, good, taken: false, rest: 0, near: false, t: rand() * 6, deal };
        pedestals.push(pd); w.wares.push(pd);
      };
      const pool = itemPool("boutique", pedestals.filter(o => o.item).map(o => o.item));
      const it1 = pool.length ? pool[Math.floor(rand() * pool.length)].id : null;
      wareAt(c + 2, it1, it1 ? null : "heart", rand() < 0.2);
      wareAt(c + 4, null, rand() < 0.5 ? "heart" : "key", false);
      if (rand() < 0.4) {
        const cur = itemPool("maudit", [it1]).filter(x => x.mystery);
        const it2 = cur.length ? cur[Math.floor(rand() * cur.length)].id : null;
        wareAt(c + 6, it2, it2 ? null : "key", false);
      } else wareAt(c + 6, null, rand() < 0.5 ? "key" : "heart", rand() < 0.3);
      wanderers.push(w);
    }
  }

  // ===== Les monstres : plus forts en profondeur, et des champions =====
  function scaleEnemies() {
    const inDim = typeof DIM !== "undefined" && DIM;
    for (const e of enemies) {
      if (e.boss || e.mini || e.summonedBy || e.scaled) continue;
      e.scaled = true;
      const tier = depthTier(e.y);
      if (!inDim && !entering()) { e.hp *= 1 + ECO.hpPerTier * tier; e.baseSpeed *= 1 + ECO.speedPerTier * tier; e.speed = e.baseSpeed; }
      const rr = rng(((runSeed * 7 + (e.si || 0) * 131 + 17) >>> 0) || 1);
      if (e.type !== "mimic" && rr() < ECO.championRate[Math.min(5, entering() ? 5 : tier)]) {
        const keys = Object.keys(CHAMPIONS);
        makeChampion(e, keys[Math.floor(rr() * keys.length)], tier);
      }
      e.maxHp = e.hp;
    }
  }
  function makeChampion(e, trait, tier) {
    if (trait === "spectral" && (e.type === "fouisseur" || e.type === "reflet")) trait = "rapide";
    e.champion = trait; e.hp *= 1.5;
    if (trait === "rapide") { e.baseSpeed *= 1.6; e.speed = e.baseSpeed; }
    if (trait === "blinde") { e.hp *= 1.6; e.weight *= 0.3; e.armor = 0.7; }
    if (trait === "vampire") e.hp *= 1.2;
    if (trait === "spectral") e.specT = Math.random() * 3;
    if (tier >= 3) e.damage = (e.damage || 1) + 1;
  }
  globalThis.makeChampion = makeChampion;
  globalThis.championLoot = (e, x, y, mult) => {
    spawnCoins((3 + Math.floor(Math.random() * 3)) * mult, x, y);
    if (Math.random() < 0.35) spawnLoot("heart", x, y);
    if (Math.random() < 0.2) spawnLoot("key", x, y);
  };
  around("hitEnemy", (o, e, dmg, ...a) => {
    if (e && e.armor && !e.dead) dmg *= e.armor;
    const wasAlive = e && !e.dead;
    const r = o(e, dmg, ...a);
    if (wasAlive && e.dead && e.champion === "explosif") {
      const x = e.x + e.w / 2, y = e.y + e.h / 2;
      warn(x - 26, y - 4, 52, "none", 0.55, () => {
        burst(x, y, 40, "#ffb020", 170, true); shake(3, 0.25); S("bossBoom");
        if (!player.dead && Math.hypot(player.x + player.w / 2 - x, player.y + player.h / 2 - y) < 30) hurtPlayer({ x, y, w: 1, h: 1 }, 1);
        for (const k of pots) if (!k.broken && Math.hypot(k.x - x, k.y - y) < 30) breakPot(k);
      });
      blasts.push({ x, y, t: 0.55 });
    }
    return r;
  });
  const blasts = [];
  around("hurtPlayer", (o, src, dmg, ...a) => {
    const before = player.hp;
    const r = o(src, dmg, ...a);
    if (src && src.champion === "vampire" && player.hp < before && !src.dead) { src.hp += 2; burst(src.x + src.w / 2, src.y, 8, "#e0453c", 60); popText(src.x + src.w / 2, src.y - 4, "+2", "#e0453c"); }
    return r;
  });
  // Les bonus de dégâts : rendements décroissants
  around("dmgOf", (o, base, ...a) => {
    const d = o(base, ...a);
    if (!base) return d;
    const m = d / base, s0 = ECO.dmgSoftStart, A = ECO.dmgSoftRange;
    if (m <= s0) return d;
    return base * (s0 + A * (1 - Math.exp(-(m - s0) / A)));
  });
  // Bénédictions des prisonniers et porte-lanterne
  around("deriveStats", (o, ...a) => { const s = o(...a); s.maxHp += boons.hp; s.damageMult *= 1 + boons.dmg; return s; });
  around("computeStats", (o, ...a) => { const r = o(...a); if (companions.some(c => c.type === "lanternier")) DARK.tickEvery *= 1.25; return r; });

  // ===== Le butin du gardien : la relique, et un objet au choix parmi trois =====
  around("beatMini", (o, m, ...a) => {
    const r = o(m, ...a);
    if (companions.some(c => c.type === "lanternier") && player.hp < stats.maxHp) { player.hp++; renderHearts(); popText(player.x + 5, player.y - 4, "+1 PV", "#ff8a80"); }
    guardianLoot(m);
    return r;
  });
  function guardianLoot(m) {
    const { c0, r0 } = m.room, rc = Math.floor((m.relic.x + 4) / T), cx = c0 + ROOM_W / 2;
    const spots = [];
    for (let r = r0 + ROOM_H - 2; r >= r0 + 2 && spots.length < 30; r--) for (let c = c0 + 2; c < c0 + ROOM_W - 2; c++) {
      if (tile(c, r) !== "." || tile(c, r - 1) !== "." || !solid(tile(c, r + 1)) || tile(c, r + 1) === "^" || tile(c, r) === "^") continue;
      if (Math.abs(c - rc) < 2) continue;
      spots.push([c, r]);
    }
    spots.sort((p, q) => (q[1] - p[1]) * 4 + Math.abs(p[0] - cx) - Math.abs(q[0] - cx));
    const chosen = [];
    for (const s of spots) if (chosen.every(c => Math.abs(c[0] - s[0]) >= 3 || c[1] !== s[1])) { chosen.push(s); if (chosen.length === 3) break; }
    const pool = ITEMS.filter(it => !it.soon && !items.has(it.id) && !it.mystery && (!it.skill || skills[it.skill] || it.skill === m.relic.skill) && !pedestals.some(p => p.item === it.id && !p.taken));
    // un objet lié au pouvoir qu'on vient de gagner si possible
    const pickIt = list => { if (!list.length) return null; const i = Math.floor(Math.random() * list.length); return list.splice(i, 1)[0].id; };
    const own = pool.filter(it => it.skill === m.relic.skill), rest = pool.filter(it => it.skill !== m.relic.skill);
    const ids = [pickIt(own.length ? own : rest), pickIt(rest), pickIt(rest)].filter(Boolean);
    chosen.forEach(([c, r], i) => {
      if (!ids[i]) return;
      pedestals.push({ x: c * T + 2, y: r * T + 4, w: 12, h: 12, kind: "guardian", group: m.key, item: ids[i], good: null, taken: false, rest: 0, near: false, t: i });
      burst(c * T + 8, r * T + 4, 18, "#f2d45a", 90);
    });
    if (chosen.length) toast(`${m.def.name} est vaincu ! Prends la relique, et choisis <b>un</b> objet du butin.`, 3400, true);
  }
  globalThis.onPedestalTaken = pd => {
    if (pd.kind === "guardian") {
      const others = pedestals.filter(o => o.group === pd.group && o !== pd && !o.taken && !o.gone);
      if (!pd.chained) {
        others.forEach(o => { o.chained = true; burst(o.x + 6, o.y, 10, "#a9b7b0", 60); });
        if (others.length) toast("Les autres trésors s'enchaînent… une clé peut briser une chaîne.", 2800);
      } else others.forEach(o => { o.gone = true; burst(o.x + 6, o.y, 16, "#8a7f74", 70); });
    }
    if (pd.kind === "wander") S("buy");
  };

  // ===== Mise à jour : autels, colporteurs, tripot, prisonniers, compagnons =====
  around("updateLoot", (o, dt, ...a) => {
    const r = o(dt, ...a), p = player;
    for (const b of blasts) b.t -= dt;
    for (let i = blasts.length - 1; i >= 0; i--) if (blasts[i].t <= 0) blasts.splice(i, 1);
    updateSpectral(dt);
    updateCompanions(dt);
    if (p.dead) return r;
    updateAltars(dt);
    updateWanderers(dt);
    updateGames(dt);
    updatePrisoners(dt);
    return r;
  });
  function updateSpectral(dt) {
    for (const e of enemies) if (e.champion === "spectral" && !e.dead) {
      e.specT = (e.specT || 0) + dt;
      const ph = e.specT % 3.6;
      e.hidden = ph > 2.4;
    }
  }
  function updateAltars(dt) {
    const p = player;
    for (const al of shadowAltars) {
      al.t += dt;
      if (al.taken) continue;
      const near = Math.abs(p.x - al.x) < 26 && Math.abs(p.y - al.y) < 26;
      if (near && !al.near) toast(`<b>Autel des ombres</b> : un objet, contre un peu de ta lumière.<br><small>Reste dessus pour accepter.</small>`, 3200, true);
      al.near = near;
      if (!(overlap(p, al))) { al.rest = 0; continue; }
      al.rest += dt;
      if (al.rest < 0.5) continue;
      al.taken = true;
      burst(al.x + 5, al.y + 5, 30, "#b48ae0", 120);
      addDark(ECO.altarDark, true);
      giveItemFrom("autel");
    }
  }
  function updateWanderers(dt) {
    const p = player;
    for (const w of wanderers) {
      w.t += dt; w.hitCd = Math.max(0, w.hitCd - dt);
      if (w.gone) continue;
      if (w.fled || w.vanish) {
        w.fleeT += dt;
        if (w.fled) { w.x += (w.fleeDir || 1) * 160 * dt; if (Math.random() < dt * 30) dust(w.x + 6, w.y + 16, 1); }
        if (w.fleeT > (w.fled ? 1.4 : 0.5)) w.gone = true;
        continue;
      }
      const near = Math.abs(p.x - w.x) < 70 && Math.abs(p.y - w.y) < 30;
      if (near && !w.greeted) { w.greeted = true; toast(pick(["« Psst ! Le colporteur a ce qu'il te faut. »", "« Approche, approche… tout se paie, rien ne se vole. »", "« Des affaires ! Mes prix montent avec la profondeur, hé hé. »"]), 2600); }
      w.face = Math.sign(p.x - w.x) || 1;
      if (p.atkTimer > 0 && w.hitCd <= 0 && overlap(attackBox(p.x, p.y), w)) {
        w.hitCd = 0.4; S("hit");
        burst(w.x + 6, w.y + 6, 8, "#f2d45a", 70);
        if (!w.warned) { w.warned = 1; toast("« Hé ! Encore un coup et j'appelle… personne. Mais je file ! »<br><small>Frappe encore pour le voler.</small>", 2800, true); }
        else steal(w);
      }
    }
  }
  function steal(w) {
    const p = player;
    w.fled = true; w.fleeT = 0; w.fleeDir = Math.sign(w.x - p.x) || 1;
    for (const pd of w.wares) if (!pd.taken) { pd.stolen = true; pd.near = false; }
    addDark(ECO.stealDark, true);
    merchantGone = true;
    for (const o of wanderers) if (o !== w && !o.fled && !o.gone) { o.vanish = true; o.fleeT = 0; for (const pd of o.wares) if (!pd.taken) pd.gone = true; }
    shake(2, 0.2); burst(w.x + 6, w.y + 8, 26, "#3a2a48", 100);
    S("steal");
    toast("Tu as volé le colporteur ! Son stock est à toi… mais il ne reviendra plus de la partie.", 3400, true);
  }
  // ----- Le tripot -----
  function updateGames(dt) {
    const p = player;
    for (const g of games) {
      g.t += dt; g.cd = Math.max(0, g.cd - dt);
      if (g.anim > 0) { g.anim -= dt; if (g.anim <= 0) resolveGame(g); continue; }
      const near = Math.abs(p.x + p.w / 2 - g.x - 8) < 22 && Math.abs(p.y + p.h - g.y - 16) < 20;
      if (near && !g.near) toast(gameLabel(g), 3600, true);
      g.near = near;
      if (!(near && p.onGround) || g.cd > 0) { g.rest = 0; continue; }
      g.rest += dt;
      if (g.rest < 0.5) continue;
      g.rest = 0;
      const price = gamePrice(g);
      if (g.kind === "gamble" && g.uses >= 2) { g.cd = 2; toast("« Le coffre est vide, l'ami. Reviens à la prochaine partie. »", 2000); continue; }
      if (coins < price) { g.cd = 1.2; toast(`Il te manque ${price - coins} pièce${price - coins > 1 ? "s" : ""}.`, 1600); continue; }
      addCoins(-price); g.uses++; g.anim = g.kind === "wheel" ? 1.3 : g.kind === "dice" ? 0.9 : 0.6; g.spin = 0;
      S(g.kind === "dice" ? "dice" : g.kind === "wheel" ? "wheel" : "chest");
    }
  }
  const gamePrice = g => g.kind === "wheel" ? ECO.wheelPrice : g.kind === "dice" ? ECO.dicePrice : ECO.gamblePrice + 5 * g.uses;
  function gameLabel(g) {
    if (g.kind === "wheel") return `<b>La roue des âmes</b> · ${ECO.wheelPrice} pièces<br><small>Pièces, cœur, clé… ou rien. Parfois un objet, parfois une malédiction.</small>`;
    if (g.kind === "dice") return `<b>Les dés d'os</b> · ${ECO.dicePrice} pièces<br><small>Bats le squelette aux dés : double mise. Double six : le gros lot.</small>`;
    return `<b>Le coffre du parieur</b> · ${gamePrice(g)} pièces<br><small>Un objet au hasard… souvent maudit.</small>`;
  }
  function resolveGame(g) {
    const x = g.x + 8, y = g.y;
    g.cd = 0.8;
    if (g.kind === "wheel") {
      const roll = Math.random() * 100;
      let acc = 0; const pickW = list => { for (const [w, f] of list) { acc += w; if (roll < acc) return f(); } };
      pickW([
        [25, () => { g.result = "RIEN"; popText(x, y - 6, "RIEN", "#8a7f74"); }],
        [20, () => { g.result = "+3"; spawnCoins(3, x, y); }],
        [12, () => { g.result = "+8"; spawnCoins(8, x, y); S("coin"); }],
        [14, () => { g.result = "COEUR"; spawnLoot("heart", x, y); }],
        [12, () => { g.result = "CLE"; spawnLoot("key", x, y); }],
        [11, () => { g.result = "MAUDIT"; addDark(8, true); popText(x, y - 6, "MAUDIT", "#9d6bc4"); toast("La roue s'arrête sur un crâne. Les ténèbres ricanent.", 2200); }],
        [6,  () => { g.result = "OBJET"; giveItemFrom("maudit"); S("item"); }],
      ]);
    } else if (g.kind === "dice") {
      const a1 = 1 + Math.floor(Math.random() * 6), a2 = 1 + Math.floor(Math.random() * 6), b1 = 1 + Math.floor(Math.random() * 6), b2 = 1 + Math.floor(Math.random() * 6);
      g.dice = [a1, a2, b1, b2];
      if (a1 === 6 && a2 === 6) { spawnCoins(20, x, y); spawnLoot("key", x, y); popText(x, y - 8, "JACKPOT", "#f2d45a"); S("relic"); toast("Double six ! Le squelette en perd la mâchoire.", 2400); }
      else if (a1 + a2 > b1 + b2) { spawnCoins(9, x, y); popText(x, y - 8, `${a1 + a2} CONTRE ${b1 + b2}`, "#f2d45a"); }
      else popText(x, y - 8, `${a1 + a2} CONTRE ${b1 + b2}`, "#c4413b");
    } else {
      giveItemFrom("maudit");
    }
  }
  // ----- La prison -----
  function updatePrisoners(dt) {
    const p = player;
    for (const pr of prisoners) {
      pr.t += dt;
      if (pr.state !== "caged") { pr.fade += dt; continue; }
      const near = Math.abs(p.x - pr.x) < 50 && Math.abs(p.y - pr.y) < 24;
      if (near && !pr.hinted) { pr.hinted = true; toast("« Libère-moi… une clé, par pitié. Je saurai te remercier. »", 2800); }
      if (!overlap(p, { x: pr.x - 2, y: pr.y, w: pr.w + 4, h: pr.h })) continue;
      freePrisoner(pr);
    }
  }
  function freePrisoner(pr) {
    pr.state = "free"; pr.fade = 0;
    const x = pr.x + 5, y = pr.y + 4;
    burst(x, y, 24, "#e9e1cf", 90); S("freed");
    let out = pr.out;
    const free = Object.keys(COMPANIONS).filter(t => !companions.some(c => c.type === t));
    if (out === "ally" && (companions.length >= 2 || !free.length)) out = "boon";
    if (out === "ally") {
      const type = free[Math.floor(pr.roll * free.length)];
      companions.push({ type, x: pr.x, y: pr.y, vx: 0, vy: 0, cd: 1, t: 0, dash: 0 });
      computeStats();
      toast(`<b>${COMPANIONS[type].name}</b> te suit.<br><i>${COMPANIONS[type].hint}</i>`, 4200, true);
    } else if (out === "boon") {
      const k = Math.floor(pr.roll * 4);
      if (k === 0) { boons.hp++; computeStats(); player.hp = Math.min(stats.maxHp, player.hp + 1); renderHearts(); toast("« Merci… prends ma force. » <b>+1 PV max</b>", 3200, true); }
      else if (k === 1) { boons.dmg += 0.15; computeStats(); toast("« Merci… que ta lame ne tremble pas. » <i>Tes coups sont plus forts.</i>", 3200, true); }
      else if (k === 2) { addDark(-20, true); toast("« Merci… que ta flamme brûle encore. » <i>La lumière revient.</i>", 3200, true); }
      else { addKeys(2); spawnCoins(6, x, y); toast("« Merci ! Tiens, mes économies de prison. »", 3000); }
    } else {
      pr.state = "trap";
      const type = depthTier(pr.y) >= 3 ? "rodeur" : "squelette";
      const e = makeEnemy({ type, cx: 0, cy: 0 });
      Object.assign(e, { x: pr.x, y: pr.y + pr.h - ENEMY_TYPES[type].h, prevX: pr.x, prevY: pr.y });
      e.prevY = e.y; e.homeX = e.x; e.homeY = e.y; e.scaled = true;
      makeChampion(e, pick(Object.keys(CHAMPIONS)), depthTier(pr.y)); e.maxHp = e.hp;
      enemies.push(e);
      shake(3, 0.25); S("enrage");
      toast("« Hé hé hé… merci pour la clé. » C'était un piège !", 2800, true);
    }
  }
  // ----- Les compagnons -----
  function updateCompanions(dt) {
    const p = player;
    if (!p) return;
    companions.forEach((c, i) => {
      c.t += dt; c.cd -= dt;
      const tx = p.x + p.w / 2 - p.face * (14 + i * 10), ty = p.y - 6 - i * 4 + Math.sin(c.t * 2.5 + i) * 2;
      if (c.dash > 0 && c.target && !c.target.dead) {
        c.dash -= dt;
        const dx = c.target.x + c.target.w / 2 - c.x, dy = c.target.y + c.target.h / 2 - c.y, d = Math.hypot(dx, dy) || 1;
        c.x += dx / d * 260 * dt; c.y += dy / d * 260 * dt;
        if (d < 8) { hitEnemy(c.target, dmgOf(1.2), Math.sign(dx) || 1, { power: 0.7, freeze: 0.03 }); burst(c.x, c.y, 10, COMPANIONS[c.type].color, 90); c.dash = 0; c.target = null; }
        return;
      }
      c.dash = 0;
      c.x += (tx - c.x) * Math.min(1, dt * 5); c.y += (ty - c.y) * Math.min(1, dt * 5);
      if (p.dead || c.cd > 0) return;
      const reach = c.type === "archere" ? 150 : c.type === "chevalier" ? 80 : 0;
      if (!reach) return;
      let best = null, bd = reach;
      for (const e of enemies) {
        if (e.dead || e.hidden || e.decoy) continue;
        const d = Math.hypot(e.x + e.w / 2 - c.x, e.y + e.h / 2 - c.y);
        if (d < bd && lineClear(c.x, c.y, e.x + e.w / 2, e.y + e.h / 2)) { bd = d; best = e; }
      }
      if (!best) return;
      if (c.type === "archere") {
        c.cd = 1.3;
        const dx = best.x + best.w / 2 - c.x, dy = best.y + best.h / 2 - c.y, d = Math.hypot(dx, dy) || 1;
        projectiles.push({ kind: "arrow", x: c.x - 3, y: c.y - 1.5, w: 6, h: 3, vx: dx / d * 260, vy: dy / d * 260, grav: 0, life: 0.8, bounces: 0, dmg: dmgOf(0.6), hits: new Set() });
        S("swing");
      } else { c.cd = 2.2; c.dash = 0.5; c.target = best; S("dash"); }
    });
  }

  // ===== Dessin =====
  around("drawLoot", (o, ox, oy, ...a) => {
    const r = o(ox, oy, ...a);
    for (const al of shadowAltars) if (!al.taken) drawShadowAltar(al, ox, oy);
    for (const g of games) drawGame(g, ox, oy);
    for (const pr of prisoners) drawPrisoner(pr, ox, oy);
    for (const w of wanderers) if (!w.gone) drawWanderer(w, ox, oy);
    for (const c of companions) drawCompanion(c, ox, oy);
    for (const b of blasts) {
      const k = 1 - b.t / 0.55;
      ctx.strokeStyle = `rgba(255,176,32,${0.4 + 0.5 * k})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x - ox, b.y - oy, 28, 0, Math.PI * 2); ctx.stroke();
    }
    return r;
  });
  around("lootLights", (o, hole, ox, oy, ...a) => {
    const r = o(hole, ox, oy, ...a);
    for (const al of shadowAltars) if (!al.taken) hole(al.x + 5 - ox, al.y + 5 - oy, 34);
    for (const g of games) hole(g.x + 8 - ox, g.y + 8 - oy, 40);
    for (const pr of prisoners) if (pr.state === "caged") hole(pr.x + 5 - ox, pr.y + 6 - oy, 22);
    for (const w of wanderers) if (!w.gone) hole(w.x + 6 - ox, w.y + 6 - oy, 46);
    for (const c of companions) hole(c.x - ox, c.y - oy, c.type === "lanternier" ? 70 : 24);
    return r;
  });
  function drawShadowAltar(al, ox, oy) {
    const x = snap(al.x - ox), y = snap(al.y - oy + Math.sin(al.t * 2.2) * 2);
    ctx.fillStyle = "rgba(90,40,120,0.35)"; ctx.fillRect(x - 2, y - 2, 14, 14);
    drawPickupAt(x, y);
    ctx.fillStyle = "#1a1020"; ctx.fillRect(snap(al.x - ox) - 1, snap(al.y - oy) + 11, 12, 3);
  }
  function drawGame(g, ox, oy) {
    const x = snap(g.x - ox), y = snap(g.y - oy);
    if (g.kind === "wheel") {
      const cx = x + 8, cy = y + 5, rr = 7, spin = g.anim > 0 ? (1.3 - g.anim) * 22 : 0;
      ctx.fillStyle = "#2a1a10"; ctx.fillRect(x + 7, y + 8, 2, 8); ctx.fillRect(x + 3, y + 15, 10, 1.34);
      const cols = ["#c4413b", "#f2d45a", "#3a2a48", "#7fd6c0", "#e9e1cf", "#9d6bc4"];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rr, spin + i * Math.PI / 3, spin + (i + 1) * Math.PI / 3); ctx.fill();
      }
      ctx.fillStyle = "#140e18"; ctx.fillRect(cx - 1, cy - 1, 2, 2);
      ctx.fillStyle = "#f6efe0"; ctx.fillRect(cx - 0.67, y - 3, 1.34, 3);
    } else if (g.kind === "dice") {
      // la table et le squelette joueur derrière
      const bob = Math.sin(g.t * 2) * 0.5;
      ctx.fillStyle = "#e6dcc8"; ctx.fillRect(x + 9, y - 1 + bob, 5, 5); ctx.fillStyle = "#c4413b"; ctx.fillRect(x + 10, y + 1 + bob, 1, 1); ctx.fillRect(x + 12, y + 1 + bob, 1, 1);
      ctx.fillStyle = "#e6dcc8"; ctx.fillRect(x + 10, y + 4, 3, 5); ctx.fillRect(x + 8, y + 5, 7, 1);
      ctx.fillStyle = "#4a3020"; ctx.fillRect(x - 2, y + 8, 20, 2); ctx.fillRect(x, y + 10, 2, 6); ctx.fillRect(x + 14, y + 10, 2, 6);
      ctx.fillStyle = "#2e5a3a"; ctx.fillRect(x - 1, y + 7, 18, 1.34);
      const show = g.dice && g.anim <= 0 && g.cd > 0 ? g.dice : [1 + Math.floor((g.t * 13) % 6), 1 + Math.floor((g.t * 7) % 6)];
      for (let i = 0; i < 2; i++) {
        const dx = x + 1 + i * 5, dy = y + 2 + (g.anim > 0 ? -Math.abs(Math.sin(g.anim * 18 + i)) * 4 : 0);
        ctx.fillStyle = "#f6efe0"; ctx.fillRect(dx, dy, 4, 4);
        ctx.fillStyle = "#140e18"; const n = show[i] || 1;
        if (n % 2) ctx.fillRect(dx + 1.5, dy + 1.5, 1, 1);
        if (n > 1) { ctx.fillRect(dx + 0.5, dy + 0.5, 1, 1); ctx.fillRect(dx + 2.5, dy + 2.5, 1, 1); }
        if (n > 3) { ctx.fillRect(dx + 2.5, dy + 0.5, 1, 1); ctx.fillRect(dx + 0.5, dy + 2.5, 1, 1); }
      }
    } else {
      const open = g.anim > 0, empty = g.uses >= 2;
      ctx.fillStyle = "#1a1020"; ctx.fillRect(x + 1, y + 8, 14, 8);
      ctx.fillStyle = empty ? "#3a2a48" : "#6a3a8a"; ctx.fillRect(x + 2, y + 9, 12, 6);
      ctx.fillStyle = "#b48ae0"; ctx.fillRect(x + 2, y + 11, 12, 1);
      ctx.fillStyle = empty ? "#3a2a48" : "#8a5ab0"; ctx.fillRect(x + 2, open ? y + 3 : y + 6, 12, 3);
      if (!empty) { ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 7, y + 12, 2, 2); drawTinyText(x + 8, y - 2 + Math.sin(g.t * 3), "?", "#b48ae0"); }
    }
    if (g.near && g.anim <= 0) drawPrice(x + 8, y + 18, gamePrice(g), coins >= gamePrice(g));
  }
  function drawPrisoner(pr, ox, oy) {
    if (pr.state !== "caged" && pr.fade > 1) return;
    const x = snap(pr.x - ox), y = snap(pr.y - oy), a = pr.state === "caged" ? 1 : Math.max(0, 1 - pr.fade);
    ctx.globalAlpha = a;
    const bob = Math.sin(pr.t * 1.4) * 0.6;
    ctx.fillStyle = "#3a3440"; ctx.fillRect(x + 1, y + 4 + bob, 8, 9);
    ctx.fillStyle = "#6a6270"; ctx.fillRect(x + 2, y + 5 + bob, 6, 7);
    ctx.fillStyle = "#e3c39a"; ctx.fillRect(x + 2, y + bob, 6, 5);
    ctx.fillStyle = "#140e18"; ctx.fillRect(x + 3, y + 2 + bob, 1, 1); ctx.fillRect(x + 6, y + 2 + bob, 1, 1);
    ctx.fillStyle = "#a9b7b0"; ctx.fillRect(x + 1, y + 12, 8, 1); ctx.fillRect(x + 2, y + 13, 1, 1); ctx.fillRect(x + 7, y + 13, 1, 1);
    if (pr.state === "free") { ctx.fillStyle = "rgba(255,246,200,0.5)"; ctx.fillRect(x, y - pr.fade * 12, 10, 14); }
    ctx.globalAlpha = 1;
  }
  function drawWanderer(w, ox, oy) {
    const x = snap(w.x - ox), y = snap(w.y - oy), a = w.vanish ? Math.max(0, 1 - w.fleeT * 2) : 1, f = w.fled ? w.fleeDir : (w.face || 1);
    ctx.globalAlpha = a;
    const step = w.fled ? Math.round(Math.sin(w.fleeT * 30)) : 0, b = Math.sin(w.t * 1.6) * 0.6;
    // le grand sac sur le dos
    const bx = f > 0 ? x - 4 : x + 8;
    ctx.fillStyle = "#4a3020"; ctx.fillRect(bx, y + 2 + b, 8, 10);
    ctx.fillStyle = "#7a5030"; ctx.fillRect(bx + 1, y + 3 + b, 6, 8);
    ctx.fillStyle = "#c8962c"; ctx.fillRect(bx + 2, y + 1 + b, 2, 2); ctx.fillRect(bx + 5, y + 4 + b, 1.34, 4);
    // la cape et la capuche
    ctx.fillStyle = "#1c1622"; ctx.fillRect(x + 1, y + 4 + b, 10, 12 - b);
    ctx.fillStyle = "#5a4a32"; ctx.fillRect(x + 2, y + 3 + b, 8, 11 - b); ctx.fillRect(x + 3, y + 1 + b, 6, 4);
    ctx.fillStyle = "#0b0810"; ctx.fillRect(x + 4, y + 3 + b, 4, 3);
    ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + (f > 0 ? 6 : 4), y + 4 + b, 1, 1);
    ctx.fillStyle = "#2a1f2e"; ctx.fillRect(x + 3 + step, y + 14, 2, 2); ctx.fillRect(x + 7 - step, y + 14, 2, 2);
    // la lanterne au bout d'un bâton
    const lx = f > 0 ? x + 12 : x - 2;
    ctx.fillStyle = "#4a3020"; ctx.fillRect(lx, y + 2 + b, 1.34, 13);
    ctx.fillStyle = "#f2b54a"; ctx.fillRect(lx - 1, y + 1 + b, 3.34, 3);
    ctx.globalAlpha = 1;
    if (w.warned && !w.fled) drawTinyText(x + 6, y - 9, "!", "#c4413b");
  }
  function drawCompanion(c, ox, oy) {
    const C = COMPANIONS[c.type], x = snap(c.x - ox - 4), y = snap(c.y - oy - 6);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x - 1, y - 1, 10, 13);
    ctx.fillStyle = C.color; ctx.fillRect(x + 2, y, 4, 4); ctx.fillRect(x + 1, y + 4, 6, 5);
    ctx.fillRect(x + 2 + Math.round(Math.sin(c.t * 6)), y + 9, 1.34, 2); ctx.fillRect(x + 5 - Math.round(Math.sin(c.t * 6)), y + 9, 1.34, 2);
    ctx.fillStyle = "#140e18"; ctx.fillRect(x + 3, y + 1.5, 1, 1); ctx.fillRect(x + 5, y + 1.5, 1, 1);
    if (c.type === "archere") { ctx.fillStyle = "#6a4a2a"; ctx.fillRect(x + 7, y + 2, 1, 7); }
    if (c.type === "chevalier") { ctx.fillStyle = "#e9e1cf"; ctx.fillRect(x + 7, y + 1, 1, 7); ctx.fillRect(x + 6, y + 6, 3, 1); }
    if (c.type === "lanternier") { ctx.fillStyle = "#fff3b8"; ctx.fillRect(x + 7, y + 4 + Math.sin(c.t * 3), 2.5, 3); }
    ctx.globalAlpha = 1;
  }
  around("drawProjectileExtra", (o, q, x, y, ...a) => {
    if (q.kind === "arrow") {
      ctx.fillStyle = "#9fd8a0"; ctx.fillRect(x, y + 1, 6, 1.34);
      ctx.fillStyle = "#f6efe0"; ctx.fillRect(q.vx > 0 ? x + 5 : x - 1, y + 0.5, 2, 2);
      return;
    }
    return o(q, x, y, ...a);
  });
  // Les champions brillent de leur couleur, avec une petite couronne
  around("drawEnemy", (o, e, ox, oy, a, ...rest) => {
    if (!e.champion || e.dead) return o(e, ox, oy, a, ...rest);
    const C = CHAMPIONS[e.champion], q = at(e, a), x = snap(q.x - ox), y = snap(q.y - oy);
    const k = 0.5 + 0.5 * Math.sin(time * 6 + e.t);
    ctx.fillStyle = C.color; ctx.globalAlpha = 0.22 + 0.18 * k;
    ctx.fillRect(x - 2, y - 2, e.w + 4, e.h + 4);
    ctx.globalAlpha = e.hidden ? 0.25 : 1;
    const r = o(e, ox, oy, a, ...rest);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.color;
    const cx = x + e.w / 2;
    ctx.fillRect(cx - 3, y - 5, 6, 1.34); ctx.fillRect(cx - 3, y - 7, 1.34, 2); ctx.fillRect(cx - 0.67, y - 8, 1.34, 3); ctx.fillRect(cx + 1.67, y - 7, 1.34, 2);
    return r;
  });

  // ===== Sauvegarde =====
  around("saveGame", (o, quiet, ...a) => {
    const r = o(quiet, ...a);
    if (!r) return r;
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      s.eco = {
        runSeed, shuffled: level.shuffled != null, merchantGone, companions: companions.map(c => ({ type: c.type })), boons,
        altars: shadowAltars.map(al => al.taken),
        wanderers: wanderers.map(w => ({ fled: w.fled || w.gone && w.fled, vanish: w.vanish, gone: w.gone, warned: w.warned, wares: w.wares.map(pd => ({ stolen: !!pd.stolen, gone: !!pd.gone })) })),
        games: games.map(g => g.uses), prisoners: prisoners.map(p => p.state),
        guardian: pedestals.filter(pd => pd.kind === "guardian").map(pd => ({ x: pd.x, y: pd.y, item: pd.item, taken: pd.taken, chained: !!pd.chained, gone: !!pd.gone, group: pd.group })),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch (e) {}
    return r;
  });
  around("loadGame", (o, ...a) => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
    const eco = s && s.eco;
    ecoPending = eco ? { runSeed: eco.runSeed, noShuffle: !eco.shuffled } : { runSeed: 0, noShuffle: true };
    let r;
    try { r = o(...a); } finally { ecoPending = null; }
    if (!r || !eco) return r;
    merchantGone = !!eco.merchantGone; boons = eco.boons || { hp: 0, dmg: 0 };
    companions = (eco.companions || []).map((c, i) => ({ type: c.type, x: player.x, y: player.y - 8, vx: 0, vy: 0, cd: 1 + i, t: i, dash: 0 }));
    (eco.altars || []).forEach((t, i) => { if (shadowAltars[i]) shadowAltars[i].taken = t; });
    (eco.wanderers || []).forEach((o2, i) => {
      const w = wanderers[i]; if (!w) return;
      if (o2.fled || o2.vanish || o2.gone) w.gone = true;
      w.warned = o2.warned || 0;
      (o2.wares || []).forEach((f, j) => { if (w.wares[j]) { w.wares[j].stolen = f.stolen; w.wares[j].gone = f.gone; } });
    });
    if (merchantGone) for (const w of wanderers) if (!w.gone) { w.gone = true; for (const pd of w.wares) if (!pd.taken && !pd.stolen) pd.gone = true; }
    (eco.games || []).forEach((u, i) => { if (games[i]) games[i].uses = u; });
    (eco.prisoners || []).forEach((st, i) => { if (prisoners[i] && st !== "caged") { prisoners[i].state = st; prisoners[i].fade = 9; } });
    for (const g of eco.guardian || []) pedestals.push({ ...g, kind: "guardian", good: null, rest: 0, near: false, t: 0, w: 12, h: 12 });
    computeStats(); renderHearts();
    return r;
  });
})();
