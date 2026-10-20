"use strict";
// ---------- 37. Mode Siège (en test) : défendre le village, vue du dessus ----------
/* Un autre jeu dans le jeu, à la Vampire Survivors, mais avec une base à défendre :
   - le Cœur du village est au centre, derrière une palissade percée de quatre portes ;
   - les monstres arrivent par vagues de tous les côtés et foncent vers le Cœur (ou vers toi si tu es près d'eux) ;
   - le village tombe si le Cœur tombe ; en solo, tu tombes si tu tombes ; en coop, un allié à terre se relève si on reste près de lui ;
   - chaque monstre lâche de l'expérience : à chaque niveau, une amélioration au choix parmi trois ;
   - entre deux vagues, un court répit et un OBJET du puits au choix parmi trois (mêmes icônes, effets adaptés) ;
   - une vague sur cinq, un Bélier vient enfoncer les portes.
   Commandes : se déplacer (ZQSD / flèches, stick gauche, croix tactile). Sur PC on vise à la souris et on frappe (clic ou Frapper) ;
   sur manette, stick droit et RT. « Attaque auto » et « Visée auto » se règlent dans le menu du Siège (activées d'office au tactile).
   Coop : seul, à deux sur le même écran (clavier-souris + manette, ou deux manettes), ou en ligne de 2 à 4 (salon avec code). */

const SG = {
  W: 70, H: 46, ringR: 10, gateW: 1,                 // carte en tuiles, rayon de la palissade, demi-largeur des portes
  heartHp: 100, breakTime: 9, firstWave: 3,          // PV du Cœur, durée du répit, attente avant la 1re vague
  playerHp: 6, speed: 92, accel: 1100, iframes: 1.0, revive: 2.5, slots: 6,   // vitesse, accélération (px/s²), emplacements de sorts
  xpBase: 6, xpGrow: 5,                              // expérience du niveau n : xpBase + xpGrow × n
  finalWave: 25,                                     // la vague du boss final (le Seigneur de la Horde)
  coopCount: 0.6, coopHp: 0.3, lvCount: 0.03,        // par joueur en plus : +60 % de monstres, +30 % de PV ; +3 % de monstres par niveau d'équipe
  sendHz: 15, inHz: 20, pickWait: 30,             // en ligne : délai max pour qu'un allié choisisse
};
const SG_ENEMIES = {
  crawler:   { hp: 12, spd: 30, r: 6, dmg: 1, heart: 2, xp: 1, sprite: "crawler", from: 1 },
  bat:       { hp: 8, spd: 58, r: 5, dmg: 1, heart: 1, xp: 1, sprite: "bat", fly: true, from: 2 },
  squelette: { hp: 26, spd: 24, r: 6, dmg: 1, heart: 2, xp: 2, sprite: "squelette", ranged: true, from: 3 },
  golem:     { hp: 110, spd: 17, r: 10, dmg: 2, heart: 8, xp: 6, sprite: "golem", from: 4 },
  wisp:      { hp: 8, spd: 46, r: 5, dmg: 2, heart: 4, xp: 1, sprite: "wisp", fly: true, explode: true, from: 6 },
  rodeur:    { hp: 36, spd: 34, r: 7, dmg: 1, heart: 3, xp: 3, sprite: "rodeur", lunge: true, from: 7 },
  belier:    { hp: 520, spd: 15, r: 14, dmg: 2, heart: 25, xp: 40, sprite: "golem", boss: true, scale: 1.8, from: 99 },
  // le boss final (vague SG.finalWave, puis toutes les 10 vagues en mode infini)
  seigneur:  { hp: 5200, spd: 16, r: 20, dmg: 3, heart: 40, xp: 250, sprite: "seigneur", boss: true, lord: true, scale: 2.8, from: 999 },
};
// le Seigneur : la silhouette du golem, en pierre sombre veinée de rouge, aux yeux de braise
try { if (SPRITES.golem0 && !SPRITES.seigneur0) { SPRITES.seigneur0 = SPRITES.golem0; SPRITE_PAL.seigneur = { ...(SPRITE_PAL.golem || {}), M: "#3a1a26", g: "#8a1a2a", e: "#ff5a3a", o: "#120a10", "#": "#5a2a3a", X: "#7a3a4a" }; } } catch (e) {}
// ===== Les sorts : niveaux 1 à 10, un emplacement chacun (SG.slots au départ) =====
/* Au niveau 5, le sort s'ÉVEILLE (un nouvel effet) ; au niveau 10, il prend sa FORME FINALE (il change de nom et de visuel).
   On ne peut pas dépasser le niveau 10, et chaque nouveau sort prend un emplacement : il faut choisir. */
const SG_SPELLS = {
  epee:      { name: "Épée",            col: "#e9e1cf", desc: "Un arc tranchant devant toi.",
               awake: "Revers : frappe aussi derrière toi.",               final: "Lame céleste",   finalDesc: "Chaque coup projette deux vagues tranchantes qui traversent tout." },
  tir:       { name: "Tir magique",     col: "#7fc8d6", desc: "Des projectiles vers ta visée.",
               awake: "Les tirs traversent 2 ennemis de plus.",            final: "Rayon",          finalDesc: "Un laser qui transperce tout sur sa ligne." },
  eclair:    { name: "Éclair",          col: "#f2d45a", desc: "La foudre frappe et rebondit d'ennemi en ennemi.",
               awake: "Deux éclairs à la fois, qui étourdissent.",         final: "Tempête",        finalDesc: "La foudre tombe sans arrêt autour de toi." },
  feu:       { name: "Feu",             col: "#e8913a", desc: "Une zone de feu brûle ce qui t'approche.",
               awake: "Un monstre qui meurt en brûlant explose.",          final: "Brasier",        finalDesc: "Une fournaise immense qui sème des flaques de feu." },
  boomerang: { name: "Boomerang",       col: "#e6dcc8", desc: "Des os qui partent et reviennent.",
               awake: "Tu en lances aussi derrière toi.",                  final: "Tourbillon",     finalDesc: "Quatre boomerangs géants dans toutes les directions." },
  lames:     { name: "Lames tournantes", col: "#bed7ff", desc: "Des lames fantômes tournent autour de toi.",
               awake: "Lames plus grandes et plus rapides.",               final: "Danse des lames", finalDesc: "Un second cercle de lames tourne en sens inverse." },
  etoiles:   { name: "Pluie d'étoiles", col: "#ffe08a", desc: "Des étoiles tombent sur les ennemis proches.",
               awake: "Chaque étoile explose.",                            final: "Météores",       finalDesc: "De gros météores écrasent les groupes d'ennemis." },
  glace:     { name: "Glace",           col: "#9fe0ff", desc: "Une onde de givre qui blesse et ralentit.",
               awake: "L'onde gèle sur place.",                            final: "Blizzard",       finalDesc: "Une tempête de neige permanente qui ralentit et blesse." },
  poison:    { name: "Poison",          col: "#9cbf6a", desc: "Des fioles qui laissent une flaque toxique.",
               awake: "Deux fioles à la fois.",                            final: "Marais",         finalDesc: "Des flaques géantes qui durent et ralentissent." },
};
const SG_SPELL_ICONS = {           // 8×8 : a = couleur, b = clair, c = sombre
  epee:      ["......bb", ".....bab", "....bab.", "c..bab..", ".cbab...", "..cc....", ".c.c....", "c......."],
  tir:       ["...b....", "..bab...", ".baaab..", "baabaab.", ".baaab..", "..bab...", "...b....", "........"],
  eclair:    ["....aab.", "...aab..", "..aab...", ".aaaaab.", "...aab..", "..aab...", ".ab.....", "a......."],
  feu:       ["...b....", "..ba....", "..aab...", ".aabaa..", ".abbba..", "aabbbaa.", ".acccac.", "..cccc.."],
  boomerang: ["bb......", "baa.....", ".baa....", "..baa...", "..bab...", ".baa....", "baa.....", "bb......"],
  lames:     ["..b.....", ".bab..b.", "..b..bab", "..c...b.", ".b..c...", "bab..b..", ".b..bab.", ".....b.."],
  etoiles:   ["...b....", "...a....", "baaaaab.", ".aabaa..", "..aaa...", ".aa.aa..", ".a...a..", "........"],
  glace:     ["...b....", ".b.a.b..", "..aaa...", "baabaab.", "..aaa...", ".b.a.b..", "...b....", "........"],
  poison:    ["..cc....", "..bb....", "..ab....", ".aaaa...", "aabaaa..", "aaaaba..", "aaaaaa..", ".cccc..."],
};
const sgShade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
function sgDrawSpellIcon(c, id, x, y, sc = 1) {
  const pat = SG_SPELL_ICONS[id], col = SG_SPELLS[id].col; if (!pat) return;
  const P = { a: col, b: "#ffffff", c: sgShade(col, 0.5) };
  for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) { const ch = pat[r][k]; if (ch !== ".") { c.fillStyle = P[ch]; c.fillRect(x + k * sc, y + r * sc, sc, sc); } }
}
const sgSpellIconCanvas = (() => { const cache = {}; return id => { if (cache[id]) return cache[id]; const cv2 = document.createElement("canvas"); cv2.width = 8; cv2.height = 8; try { sgDrawSpellIcon(cv2.getContext("2d"), id, 0, 0, 1); } catch (e) {} return (cache[id] = cv2); }; })();

// Améliorations de niveau (passives)
const SG_UPGRADES = [
  { id: "force",   name: "Force",            desc: "+15 % de dégâts.",                      max: 6, apply: s => { s.dmg *= 1.15; } },
  { id: "cadence", name: "Cadence",          desc: "Tu attaques 12 % plus vite.",           max: 6, apply: s => { s.rate *= 1.12; } },
  { id: "bottes",  name: "Bottes de course", desc: "+10 % de vitesse.",                     max: 4, apply: s => { s.speed *= 1.1; } },
  { id: "ampleur", name: "Ampleur",          desc: "Coups et zones 15 % plus grands.",      max: 5, apply: s => { s.area *= 1.15; } },
  { id: "aimant",  name: "Aimant",           desc: "Tu attires l'expérience de plus loin.", max: 3, apply: s => { s.magnet *= 1.5; } },
  { id: "vigueur", name: "Vigueur",          desc: "+1 PV max, et tu te soignes de 1.",     max: 5, apply: (s, p) => { s.maxHp += 1; p.hp = Math.min(p.hp + 1, s.maxHp); } },
  { id: "remparts",name: "Remparts",         desc: "Le Cœur du village : +20 PV max, réparé de 20.", max: 99, team: true, apply: () => { siege.heart.max += 20; siege.heart.hp = Math.min(siege.heart.max, siege.heart.hp + 20); } },
  { id: "reparer", name: "Réparer le village", desc: "Le Cœur regagne 35 PV.",             max: 99, team: true, apply: () => { siege.heart.hp = Math.min(siege.heart.max, siege.heart.hp + 35); } },
];
// Les objets du puits (entre les vagues) : passifs, avec une RARETÉ ; les « parchemins » font monter un sort de 2 niveaux
const SG_ITEMS = {
  lamebraise: s => { s.burn = true; },          venin: s => { s.poison = true; },              grimoire: s => { s.multi += 2; s.dmg *= 0.85; },
  chouette: s => { s.homing = true; },          percant: s => { s.pierce += 2; },              ricochet: s => { s.bounce += 2; },
  orbe: s => { s.size *= 1.5; s.dmg *= 1.25; }, bourreau: s => { s.crit += 0.15; },            sangsue: s => { s.leech += 0.04; },
  pilon: s => { s.knock *= 2; },                aiguise: s => { s.dmg *= 1.3; },               frenesie: s => { s.rate *= 1.35; },
  allonge: s => { s.area *= 1.4; },             pierre: s => { s.maxHp += 2; },                eperons: s => { s.speed *= 1.15; },
  echo: s => { s.echo = true; },                lune: s => { s.moon = true; },                 pacte: s => { s.dmg *= 2; s.maxHp -= 2; },
  armure: s => { s.maxHp += 3; s.speed *= 0.9; }, revers: s => { s.backstab = true; },         gantelet: s => { s.shards += 1; },
  sablier: s => { s.rate *= 1.2; s.area *= 1.1; }, phenix: s => { s.phenix = true; },          couronne: s => { s.slots += 1; },
};
const SG_SCROLLS = { spectrale: "lames", foudre: "eclair", boomerang: "boomerang", meteore: "etoiles", braise: "feu", givre: "glace" };
const SG_ITEM_DESC = {
  lamebraise: "Tout ce que tu touches brûle.", venin: "Tout ce que tu touches est empoisonné.", grimoire: "+2 projectiles par tir.",
  chouette: "Tes projectiles cherchent les ennemis.", percant: "Tes projectiles traversent 2 ennemis de plus.", ricochet: "Tes projectiles rebondissent sur les murs.",
  orbe: "Projectiles énormes et plus forts.", bourreau: "15 % de coups critiques (triple dégâts).", sangsue: "Chaque coup peut te soigner.",
  pilon: "Tu repousses fort.", aiguise: "+30 % de dégâts.", frenesie: "Tu attaques 35 % plus vite.", allonge: "Coups et zones 40 % plus grands.",
  pierre: "+2 PV max.", eperons: "+15 % de vitesse.", echo: "Chaque coup d'épée se répète.", lune: "Un ennemi vaincu libère quatre éclats.",
  pacte: "Dégâts doublés, 2 PV max en moins.", armure: "+3 PV max, un peu plus lent.", revers: "Ton épée frappe aussi derrière toi.", gantelet: "Tes coups d'épée projettent des éclats.",
  sablier: "Sorts 20 % plus rapides, zones 10 % plus grandes.", phenix: "Une fois par partie, tu te relèves seul avec tous tes PV.", couronne: "+1 emplacement de sort.",
};
const SG_RARITY = {
  commun:     { label: "Commun",     col: "#b8b0a0", w: 55, items: ["pierre", "eperons", "sangsue", "pilon", "allonge", "armure", "ricochet"] },
  rare:       { label: "Rare",       col: "#5aa0e0", w: 30, items: ["aiguise", "percant", "bourreau", "lamebraise", "venin", "revers", "gantelet", "spectrale", "foudre", "boomerang", "meteore", "braise", "givre"] },
  epique:     { label: "Épique",     col: "#b77ae0", w: 12, items: ["grimoire", "orbe", "chouette", "echo", "lune", "frenesie", "sablier"] },
  legendaire: { label: "Légendaire", col: "#f2b54a", w: 3,  items: ["pacte", "phenix", "couronne"] },
};
const SG_RARITY_OF = {}; for (const [r, d] of Object.entries(SG_RARITY)) for (const id of d.items) SG_RARITY_OF[id] = r;
const SG_COLORS = ["#e8913a", "#5aa0e0", "#7fd6a0", "#c88aff"];
let siege = null;
const sgOpts = { autoFire: null, autoAim: null };
try { Object.assign(sgOpts, JSON.parse(localStorage.getItem("lepuits.siege.opts")) || {}); } catch (e) {}
const sgAutoFire = () => sgOpts.autoFire ?? (typeof isTouch !== "undefined" && isTouch);
const sgAutoAim = () => sgOpts.autoAim ?? (typeof isTouch !== "undefined" && isTouch);
const sgSaveOpts = () => { try { localStorage.setItem("lepuits.siege.opts", JSON.stringify(sgOpts)); } catch (e) {} };

// ===== La carte =====
function sgBuildMap(seed) {
  const rand = rng(seed || 1), W = SG.W, H = SG.H, cx = W / 2, cy = H / 2;
  const g = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (r === 0 || c === 0 || r === H - 1 || c === W - 1) ? "#" : "."));
  // la palissade, percée de quatre portes
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const d = Math.hypot(c + 0.5 - cx, (r + 0.5 - cy) * 1.15);
    if (Math.abs(d - SG.ringR) < 0.6) {
      const gate = Math.abs(c + 0.5 - cx) <= SG.gateW + 0.6 || Math.abs(r + 0.5 - cy) <= SG.gateW + 0.6;
      if (!gate) g[r][c] = "W";
    }
  }
  // des maisons dans le village
  const houses = [];
  for (let k = 0; k < 40 && houses.length < 6; k++) {
    const a = rand() * Math.PI * 2, d = 4 + rand() * 3, w = 2 + Math.floor(rand() * 2), h = 2;
    const c0 = Math.round(cx + Math.cos(a) * d - w / 2), r0 = Math.round(cy + Math.sin(a) * d / 1.15 - h / 2);
    if (Math.abs(c0 + w / 2 - cx) < 3.5 && Math.abs(r0 + h / 2 - cy) < 3) continue;
    if (Math.abs(c0 + w / 2 - cx) < 2.5 || Math.abs(r0 + h / 2 - cy) < 2) continue;            // les allées vers les portes restent libres
    let ok = true;
    for (let r = r0 - 1; r <= r0 + h && ok; r++) for (let c = c0 - 1; c <= c0 + w && ok; c++) if (g[r] && g[r][c] !== ".") ok = false;
    if (!ok) continue;
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) g[r][c] = "H";
    houses.push({ c: c0, r: r0, w, h });
  }
  // arbres et rochers dehors (loin des allées)
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
    const d = Math.hypot(c + 0.5 - cx, (r + 0.5 - cy) * 1.15);
    if (d < SG.ringR + 2.5 || Math.abs(c + 0.5 - cx) < 3 || Math.abs(r + 0.5 - cy) < 3) continue;
    if (rand() < 0.035) g[r][c] = rand() < 0.7 ? "T" : "R";
  }
  return { g, houses, W, H, heart: { x: cx * T, y: cy * T } };
}
// fly = true (vole : seuls les bords arrêtent) ou "ghost" (un monstre coincé trop longtemps passe arbres et maisons, pas la palissade)
const sgSolid = (m, c, r, fly) => { const t = m.g[r] && m.g[r][c]; return t === undefined || t === "#" || (!fly && t !== ".") || (fly === "ghost" && t === "W"); };
function sgMove(m, o, dx, dy, fly) {
  const r = o.r;
  const blocked = (x, y) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) if (sgSolid(m, Math.floor((x + ox) / T), Math.floor((y + oy) / T), fly)) return true;
    return false;
  };
  let hit = false;
  if (dx) { if (!blocked(o.x + dx, o.y)) o.x += dx; else hit = true; }
  if (dy) { if (!blocked(o.x, o.y + dy)) o.y += dy; else hit = true; }
  return hit;
}

// ===== Les joueurs =====
function sgBaseStats() {
  return { dmg: 1, rate: 1, speed: 1, area: 1, magnet: 1, maxHp: SG.playerHp, multi: 0, pierce: 0, bounce: 0, size: 1, homing: false,
    burn: false, poison: false, crit: 0, leech: 0, knock: 1, echo: false, moon: false, backstab: false, shards: 0, slots: SG.slots, phenix: false };
}
function sgMakePlayer(i, src, name, pid) {
  const h = siege.map.heart, a = (i / 4) * Math.PI * 2 + 0.6;
  const p = { i, src, name: name || `Joueur ${i + 1}`, pid: pid || "local-" + i, x: h.x + Math.cos(a) * 34, y: h.y + Math.sin(a) * 30, r: 5,
    face: 1, aim: 0, hp: SG.playerHp, iv: 0, down: false, reviveT: 0, upg: {}, items: [], vx: 0, vy: 0,
    spells: { epee: 1, tir: 1 }, cd: { epee: 0.3, tir: 1, eclair: 1.5, feu: 0.5, boomerang: 1.2, etoiles: 2, glace: 2, poison: 1.5, storm: 0.3, puddle: 1, frost: 0.5 },
    orbitA: 0, swing: 0, swingA: 0, kills: 0, input: { mx: 0, my: 0, ax: 0, ay: 0, fire: false, aim: false }, anim: 0 };
  p.s = sgBaseStats();
  return p;
}
// Bonus cumulables : ils complètent les cartes quand tous les objets (ou toutes les améliorations) sont pris
const SG_BONUS = [
  { id: "puissance", name: "Éclat de puissance", desc: "+10 % de dégâts. Cumulable.",            apply: s => { s.dmg *= 1.1; } },
  { id: "frenesie",  name: "Frénésie",           desc: "Tu attaques 8 % plus vite. Cumulable.",  apply: s => { s.rate *= 1.08; } },
  { id: "robuste",   name: "Cœur robuste",       desc: "+1 PV max et tous tes PV rendus. Cumulable.", apply: s => { s.maxHp += 1; }, heal: true },
  { id: "bastion",   name: "Bastion",            desc: "Le Cœur du village : +25 PV max, entièrement réparé.", team: true },
];
function sgRecompute(p) {
  const s = sgBaseStats();
  for (const [id, n] of Object.entries(p.bonus || {})) { const b = SG_BONUS.find(x => x.id === id); if (b && b.apply) for (let k = 0; k < n; k++) b.apply(s); }
  for (const [id, n] of Object.entries(p.upg)) { const u = SG_UPGRADES.find(x => x.id === id); if (u && !u.team) for (let k = 0; k < n; k++) u.apply(s, { hp: 0 }); }
  for (const id of p.items) if (SG_ITEMS[id]) SG_ITEMS[id](s);
  s.maxHp = Math.max(1, s.maxHp);
  p.s = s; p.hp = Math.min(p.hp, s.maxHp);
}

// ===== Démarrer =====
function siegeStart(o = {}) {
  const seed = o.seed || Math.floor(Math.random() * 1e9);
  siege = {
    seed, rand: rng(seed ^ 0x51E6E), map: sgBuildMap(seed), net: o.net || null, host: o.host !== false,
    wave: 0, phase: "prep", phaseT: SG.firstWave, toSpawn: 0, spawnT: 0, enemies: [], shots: [], foeShots: [], gems: [], fx: [], nums: [], zones: [],
    level: 1, xp: 0, kills: 0, time: 0, players: [], heart: { hp: SG.heartHp, max: SG.heartHp, hitT: 0 }, nextId: 1, over: null,
    choice: null, cam: { x: 0, y: 0 }, running: true, paused: false, lastSnap: 0, remote: null,
  };
  (o.players || [{ src: "auto", name: pvpPseudo || "Toi" }]).forEach((d, i) => siege.players.push(sgMakePlayer(i, d.src, d.name, d.pid)));
  for (const p of siege.players) p.hp = p.s.maxHp;
  siege.local = siege.players.filter(p => p.src !== "net");
  const h = siege.map.heart; siege.cam.x = h.x - VW / 2; siege.cam.y = h.y - VH / 2;
  menuEl.hidden = true; $("hud").hidden = true; screen = "play"; mode = "play";
  document.body.classList.add("siege-on");
  if (siege.host) toast("Défends le Cœur du village ! La première vague arrive…", 3200);
  try { cv.focus({ preventScroll: true }); } catch (e) {}
}
function siegeStop() {
  if (siege && siege.net) { try { siege.net.leave(); } catch (e) {} }
  siege = null;
  document.body.classList.remove("siege-on", "pvp-drafting");
  openTitle();
}

// ===== Les commandes de chaque joueur =====
const sgMouse = { x: 0, y: 0, down: false, seen: 0 };
try {
  cv.addEventListener("mousemove", e => { const r = cv.getBoundingClientRect(); sgMouse.x = (e.clientX - r.left) / r.width * VW; sgMouse.y = (e.clientY - r.top) / r.height * VH; sgMouse.seen = performance.now(); });
  cv.addEventListener("mousedown", e => { if (siege && e.button === 0) { sgMouse.down = true; e.preventDefault(); } });
  addEventListener("mouseup", () => { sgMouse.down = false; });
  cv.addEventListener("contextmenu", e => { if (siege) e.preventDefault(); });
} catch (e) {}
function sgPads() { try { return [...navigator.getGamepads()].filter(g => g && g.connected && g.buttons.length >= 4).map(normalizePad); } catch (e) { return []; } }
function sgReadInput(p) {
  const I = { mx: 0, my: 0, ax: 0, ay: 0, fire: false, aim: false };
  const pads = sgPads();
  const usePad = src => {
    const g = pads[+src.split(":")[1]] || null; if (!g) return;
    const b = i => g.buttons[i] && g.buttons[i].pressed, dz = v => Math.abs(v) > 0.22 ? v : 0;
    I.mx += dz(g.axes[0] || 0) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0); I.my += dz(g.axes[1] || 0) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
    const ax = g.axes[2] || 0, ay = g.axes[3] || 0;
    if (Math.hypot(ax, ay) > 0.4) { I.ax = ax; I.ay = ay; I.aim = true; I.fire = true; }
    if (b(7) || b(2) || b(5)) I.fire = true;
  };
  if (p.src === "kbm" || p.src === "auto") {
    if (bound("left")) I.mx -= 1; if (bound("right")) I.mx += 1; if (bound("up")) I.my -= 1; if (bound("down")) I.my += 1;
    if (typeof touchIn !== "undefined") { I.mx += touchIn.x; if (touchIn.up) I.my -= 1; if (touchIn.down) I.my += 1; if (touchIn.attack) I.fire = true; }
    if (bound("attack") || sgMouse.down) I.fire = true;
    if (sgMouse.seen && (!pads.length || performance.now() - sgMouse.seen < 4000)) {
      const wx = siege.cam.x + sgMouse.x, wy = siege.cam.y + sgMouse.y;
      I.ax = wx - p.x; I.ay = wy - p.y; I.aim = true;
    }
    if (p.src === "auto" && pads.length) usePad("pad:0");
  } else if (p.src.startsWith("pad:")) usePad(p.src);
  const l = Math.hypot(I.mx, I.my); if (l > 1) { I.mx /= l; I.my /= l; }
  return I;
}

// ===== Une image =====
function siegeUpdate(dt) {
  const S_ = siege;
  if (!S_ || S_.over) return;
  if (!S_.host) { sgGuestUpdate(dt); return; }
  if (S_.choice) { sgChoiceTick(dt); if (S_.net) sgHostNet(dt); return; }
  if (S_.paused) { if (S_.net) sgHostNet(dt); return; }
  S_.time += dt;
  for (const p of S_.local) if (p.src !== "bot") p.input = screen === "play" ? sgReadInput(p) : { mx: 0, my: 0, ax: 0, ay: 0, fire: false, aim: false, idle: true };
  // la vague
  S_.phaseT -= dt;
  if (S_.phase === "prep" && S_.phaseT <= 0) sgStartWave();
  if (S_.phase === "wave") {
    S_.spawnT -= dt;
    while (S_.toSpawn > 0 && S_.spawnT <= 0) { S_.spawnT += Math.max(0.12, 1.1 - S_.wave * 0.06) * (0.6 + S_.rand() * 0.8); sgSpawn(); }
    if (S_.toSpawn <= 0 && !S_.enemies.length) sgEndWave();
  }
  for (const p of S_.players) sgUpdatePlayer(p, dt);
  sgUpdateEnemies(dt);
  sgUpdateShots(dt);
  sgUpdateZones(dt);
  sgUpdateGems(dt);
  for (const f of S_.fx) f.t -= dt;
  S_.fx = S_.fx.filter(f => f.t > 0);
  for (const n of S_.nums) { n.t -= dt; n.y -= 16 * dt; }
  S_.nums = S_.nums.filter(n => n.t > 0);
  S_.heart.hitT = Math.max(0, S_.heart.hitT - dt);
  // la flamme du Cœur crache une braise sur le monstre le plus proche
  S_.heart.cd = (S_.heart.cd || 0) - dt;
  if (S_.heart.cd <= 0) {
    const h = S_.map.heart, e = sgNearestPt(h.x, h.y, 95);
    if (e) { S_.heart.cd = 1.4; const d = Math.hypot(e.x - h.x, e.y - h.y) || 1; S_.shots.push({ owner: -1, kind: "ember", x: h.x, y: h.y - 8, vx: (e.x - h.x) / d * 200, vy: (e.y - h.y + 8) / d * 200, t: 0.6, r: 2.5, dmg: 6 + S_.wave, pierce: 0, bounce: 0, hit: new Set(), age: 0 }); }
  }
  // défaite
  if (S_.heart.hp <= 0) return sgGameOver("Le Cœur du village est tombé.");
  if (S_.players.every(p => p.down)) return sgGameOver(S_.players.length > 1 ? "Toute l'équipe est à terre." : "Tu es tombé.");
  sgCamera(dt);
  if (S_.net) sgHostNet(dt);
}
function sgStartWave() {
  const S_ = siege;
  S_.wave++; S_.phase = "wave";
  const n = S_.players.length, lord = S_.wave === SG.finalWave || (S_.endless && S_.wave > SG.finalWave && S_.wave % 10 === 0);
  const boss = !lord && S_.wave % 5 === 0;
  // plus de monstres avec plus de joueurs, et à mesure que l'équipe monte de niveau
  S_.toSpawn = Math.round((6 + S_.wave * 4.5) * (1 + SG.coopCount * (n - 1)) * (1 + SG.lvCount * (S_.level - 1)) * (lord ? 0.6 : 1));
  S_.spawnT = 0.5; S_.bossLeft = boss ? 1 : 0;
  if (lord) { sgSpawn("seigneur"); S_.lordUp = true; }
  toast(lord ? `<b>Vague ${S_.wave}</b> · LE SEIGNEUR DE LA HORDE ARRIVE !` : boss ? `<b>Vague ${S_.wave}</b> · un Bélier approche des portes !` : `<b>Vague ${S_.wave}</b>`, lord ? 3600 : 2400, true);
  if (typeof SFX !== "undefined") SFX.play(boss || lord ? "bossEnter" : "warn");
  if (lord) shake(4, 0.6);
}
function sgEndWave() {
  const S_ = siege;
  S_.phase = "prep"; S_.phaseT = SG.breakTime;
  for (const p of S_.players) if (p.down) { p.down = false; p.hp = Math.ceil(p.s.maxHp / 2); }
  for (const p of S_.players) p.hp = Math.min(p.s.maxHp, p.hp + 1);
  S_.heart.hp = Math.min(S_.heart.max, S_.heart.hp + 5);
  toast(`Vague ${S_.wave} repoussée ! Choisis un objet.`, 2600);
  if (typeof SFX !== "undefined") SFX.play("miniBeat");
  sgOfferChoice("item");
}
function sgSpawn(force) {
  const S_ = siege, m = S_.map, h = m.heart, w = S_.wave;
  let type = force;
  if (force) {}
  else if (S_.bossLeft > 0 && S_.toSpawn <= 1 + S_.players.length) { type = "belier"; S_.bossLeft--; }
  else {
    const pool = Object.entries(SG_ENEMIES).filter(([, d]) => d.from <= w);
    const weights = pool.map(([k]) => k === "crawler" ? 4 : k === "bat" ? 3 : k === "golem" ? 1 : 2);
    let x = S_.rand() * weights.reduce((a, b) => a + b, 0);
    type = pool[0][0];
    for (let i = 0; i < pool.length; i++) { x -= weights[i]; if (x <= 0) { type = pool[i][0]; break; } }
  }
  const d = SG_ENEMIES[type];
  // un point au bord de la carte, sur une case libre
  let x = 0, y = 0;
  // à mi-distance entre la palissade et le bord : ils arrivent vite, mais on les voit venir
  for (let k = 0; k < 40; k++) {
    const an = S_.rand() * Math.PI * 2, rd = 250 + S_.rand() * 110;
    x = Math.max(2 * T, Math.min((m.W - 3) * T, h.x + Math.cos(an) * rd));
    y = Math.max(2 * T, Math.min((m.H - 3) * T, h.y + Math.sin(an) * rd * 0.75));
    if (!sgSolid(m, Math.floor(x / T), Math.floor(y / T), d.fly) && Math.hypot(x - h.x, (y - h.y) * 1.15) > SG.ringR * T + 30) break;
  }
  const n = S_.players.length, mult = (1 + 0.16 * (w - 1)) * (1 + SG.coopHp * (n - 1)) * (d.boss ? 1 + 0.5 * (n - 1) : 1) * (d.lord && S_.endless ? 1 + 0.5 * Math.floor((w - SG.finalWave) / 10) : 1);
  const e = { id: S_.nextId++, type, x, y, r: d.r * (d.scale || 1), hp: d.hp * mult, max: d.hp * mult, spd: d.spd * (1 + Math.min(0.5, w * 0.02)) * (0.9 + S_.rand() * 0.2),
    cd: 0, flash: 0, burn: 0, poison: 0, stuck: 0, lx: x, ly: y, t: S_.rand() * 6, kb: { x: 0, y: 0 }, hit: {} };
  S_.enemies.push(e); if (!force) S_.toSpawn--;
}
// Le Seigneur de la Horde : il annonce chaque attaque (cercle rouge), puis
//   onde de choc (une couronne de projectiles), invocation (des monstres autour de lui) ou charge vers un héros.
//   Sous la moitié de ses PV, il enrage : attaques plus rapprochées, onde plus dense.
function sgLord(e, dt) {
  const S_ = siege, rage = e.hp < e.max * 0.5;
  if (rage && !e.raged) { e.raged = true; toast("Le Seigneur de la Horde enrage !", 2200, true); shake(3, 0.4); }
  e.atkT = (e.atkT ?? 3) - dt;
  if (e.chargeT > 0) e.chargeT -= dt;
  if (e.windT > 0) {
    e.windT -= dt;
    if (e.windT <= 0) {
      const n = S_.players.length;
      if (e.next === "slam") {
        const k = rage ? 22 : 14;
        for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2 + e.t; S_.foeShots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, t: 3, r: 4, dmg: 1, heart: 3, big: true }); }
        S_.fx.push({ kind: "boom", x: e.x, y: e.y, t: 0.4, r: 40, c: "#c4413b" }); shake(2.5, 0.25);
      } else if (e.next === "summon") {
        for (let i = 0; i < 3 + 2 * n + (rage ? 3 : 0); i++) {
          const before = S_.enemies.length; sgSpawn(["crawler", "bat", "wisp", "rodeur"][i % 4]);
          const m2 = S_.enemies[before]; if (m2) { const a = i * 1.3; m2.x = e.x + Math.cos(a) * 30; m2.y = e.y + Math.sin(a) * 24; if (sgSolid(S_.map, Math.floor(m2.x / T), Math.floor(m2.y / T), false)) { m2.x = e.x; m2.y = e.y; } }
        }
        S_.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0.3, c: "#c88aff", r: 40 });
      } else e.chargeT = rage ? 0.9 : 0.7;
    }
    return;
  }
  if (e.atkT <= 0) {
    e.atkT = rage ? 2.4 : 3.6; e.windT = 0.7;
    const opts = ["slam", "summon", "charge"]; e.next = opts[(e.atkN = (e.atkN || 0) + 1) % 3];
    S_.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0.3, c: "#e0453c", r: 46 });
  }
}
function sgVictory() {
  const S_ = siege;
  S_.won = (S_.won || 0) + 1;
  S_.enemies = []; S_.foeShots = []; S_.toSpawn = 0;
  if (typeof SFX !== "undefined") SFX.play("relic");
  S_.over = { why: "Le village est sauvé !", win: true, wave: S_.wave, kills: S_.kills, level: S_.level, time: S_.time };
  let best = 0; try { best = +localStorage.getItem("lepuits.siege.best") || 0; } catch (e) {}
  if (S_.wave > best) try { localStorage.setItem("lepuits.siege.best", String(S_.wave)); } catch (e) {}
  S_.over.best = Math.max(best, S_.wave);
  if (S_.net && S_.host) S_.net.send("end", S_.over);
  sgShowEnd();
}
// après la victoire : la horde continue (mode infini, un Seigneur plus fort toutes les 10 vagues)
function sgContinue() {
  const S_ = siege; if (!S_ || !S_.over || !S_.over.win) return;
  S_.over = null; S_.endless = true; S_.phase = "prep"; S_.phaseT = SG.breakTime;
  if (S_.net && S_.host) S_.net.send("cont", {});
  sgResume(); toast("Mode infini : la horde ne s'arrête plus.", 2600, true);
}
const sgGates = () => { const h = siege.map.heart, R = SG.ringR * T; return [[h.x, h.y - R / 1.15], [h.x + R, h.y], [h.x, h.y + R / 1.15], [h.x - R, h.y]]; };
function sgUpdateEnemies(dt) {
  const S_ = siege, m = S_.map, h = m.heart;
  for (const e of S_.enemies) {
    const d = SG_ENEMIES[e.type];
    e.t += dt; e.flash = Math.max(0, e.flash - dt); e.cd = Math.max(0, e.cd - dt);
    // brûlure et poison
    if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.5; sgDamage(e, 3, null, true); } }
    if (e.poison > 0) { e.poison -= dt; e.poisT = (e.poisT || 0) - dt; if (e.poisT <= 0) { e.poisT = 0.6; sgDamage(e, 2.5, null, true); } }
    if (e.hp <= 0) continue;
    if (d.lord) sgLord(e, dt);
    // la cible : le joueur le plus proche s'il est tout près, sinon le Cœur (en passant par une porte)
    // (seulement un joueur du même côté de la palissade, sinon il resterait collé au mur ; et s'il bute trop longtemps, il lâche l'affaire)
    let tx = h.x, ty = h.y, target = null, bd = d.lord ? 150 : d.boss || e.ignoreT > 0 ? 0 : 75;
    const RR = SG.ringR * T, inRing = (x, y) => Math.hypot(x - h.x, (y - h.y) * 1.15) < RR;
    if (e.ignoreT > 0) e.ignoreT -= dt;
    for (const p of S_.players) if (!p.down && (d.fly || inRing(p.x, p.y) === inRing(e.x, e.y))) { const dd = Math.hypot(p.x - e.x, p.y - e.y); if (dd < bd) { bd = dd; target = p; } }
    if (target) { e.chaseT = Math.max(0, (e.chaseT || 0) + (e.stuck > 0.2 || e.detourT > 0 ? dt : -dt * 0.5)); if (e.chaseT > 2.5) { e.chaseT = 0; e.ignoreT = 4; target = null; } } else e.chaseT = 0;
    if (target) { tx = target.x; ty = target.y; }
    else if (!d.fly) {
      const R = SG.ringR * T, dh = Math.hypot(e.x - h.x, (e.y - h.y) * 1.15);
      if (dh > R + 10) { let g = null, gd = 1e9; for (const [gx, gy] of sgGates()) { const q = Math.hypot(gx - e.x, gy - e.y); if (q < gd) { gd = q; g = [gx, gy]; } } if (g) { tx = g[0] + (g[0] - h.x) * 0.04; ty = g[1] + (g[1] - h.y) * 0.04; if (gd < 26) { tx = h.x; ty = h.y; } } }
    }
    const dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy) || 1;
    // tireur : il garde ses distances
    let want = 1;
    if (d.ranged && dist < 90) want = dist < 60 ? -0.6 : 0;
    if (d.ranged && dist < 130 && e.cd <= 0) {
      e.cd = 2.4; const sp = 110;
      S_.foeShots.push({ x: e.x, y: e.y, vx: dx / dist * sp, vy: dy / dist * sp, t: 2.5, r: 3, dmg: 1, heart: 2 });
    }
    // rôdeur : il bondit
    if (d.lunge && dist < 70 && e.cd <= 0 && !e.lungeT) { e.lungeT = 0.35; e.cd = 2; }
    let sp = e.spd * want * (e.lungeT > 0 ? 4 : 1) * (e.chargeT > 0 ? 6 : 1) * (e.windT > 0 ? 0 : 1) * (e.slow > 0 && !d.lord ? 0.5 : 1) * (e.frozen > 0 && !d.lord ? 0 : 1);
    if (e.frozen > 0) e.frozen -= dt;
    if (e.lungeT > 0) e.lungeT -= dt; else e.lungeT = 0;
    if (e.slow > 0) e.slow -= dt;
    const atHeart = !target && Math.hypot(e.x - h.x, e.y - h.y) < 14 + e.r;
    // s'il ne se rapproche plus du Cœur depuis longtemps, il finit par se faufiler
    const dh0 = Math.hypot(e.x - h.x, e.y - h.y);
    if (dh0 < (e.bestD ?? 1e9) - 4) { e.bestD = dh0; e.bestT = 0; } else if (!target && !atHeart) e.bestT = (e.bestT || 0) + dt;
    const mode = d.fly ? true : e.bestT > 6 ? "ghost" : false;
    if (atHeart) sp = 0;
    let mx = dx / dist * sp * dt + e.kb.x * dt, my = dy / dist * sp * dt + e.kb.y * dt;
    e.kb.x *= Math.pow(0.02, dt); e.kb.y *= Math.pow(0.02, dt);
    // décoincer : s'il bute contre un arbre ou un mur, il le contourne un moment par un côté (puis par l'autre)
    if (e.detourT > 0) {
      e.detourT -= dt;
      const s2 = e.spd * dt;
      if (sgMove(m, e, e.dvx * s2, e.dvy * s2, mode)) e.detourT = 0;
    } else if (sgMove(m, e, mx, my, mode)) {
      e.stuck += dt;
      if (e.stuck > 0.35) { e.side = -(e.side || (e.id % 2 ? 1 : -1)); e.dvx = -dy / dist * e.side; e.dvy = dx / dist * e.side; e.detourT = 0.5 + Math.min(1.5, e.stuck); }
    } else e.stuck = Math.max(0, e.stuck - dt * 0.5);
    // contact : joueur ou Cœur
    if (atHeart && e.cd <= 0) {
      e.cd = 1; S_.heart.hp -= d.heart; S_.heart.hitT = 0.25;
      S_.fx.push({ kind: "ring", x: h.x, y: h.y, t: 0.25, c: "#c4413b" });
      if (d.explode) { e.hp = 0; sgKill(e, null); }
    }
    for (const p of S_.players) if (!p.down && p.iv <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
      sgHurtPlayer(p, d.dmg, e);
      if (d.explode) { e.hp = 0; sgKill(e, null); S_.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0.35, c: "#8ff0d0", r: 24 }); }
    }
  }
  // un peu d'écart entre les monstres
  const L = S_.enemies;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < Math.min(L.length, i + 12); j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
    if (d > 0 && d < min) { const k = (min - d) / d * 0.5; a.x -= dx * k * 0.5; a.y -= dy * k * 0.5; b.x += dx * k * 0.5; b.y += dy * k * 0.5; }
  }
  S_.enemies = S_.enemies.filter(e => e.hp > 0);
}
function sgHurtPlayer(p, dmg, src) {
  p.hp -= dmg; p.iv = SG.iframes;
  if (src) { const dx = p.x - src.x, dy = p.y - src.y, d = Math.hypot(dx, dy) || 1; p.kbx = dx / d * 160; p.kby = dy / d * 160; }
  siege.fx.push({ kind: "ring", x: p.x, y: p.y, t: 0.3, c: "#c4413b" });
  if (typeof SFX !== "undefined" && p.src !== "net") SFX.play("hurt");
  if (p.hp <= 0 && p.s.phenix && !p.phenixUsed) {
    p.phenixUsed = true; p.hp = p.s.maxHp; p.iv = 2;
    siege.fx.push({ kind: "boom", x: p.x, y: p.y, t: 0.5, r: 40, c: "#f2b54a" }); toast(`${p.name} renaît de ses cendres !`, 2200); return;
  }
  if (p.hp <= 0) { p.down = true; p.hp = 0; p.reviveT = 0; toast(siege.players.length > 1 ? `${p.name} est à terre ! Reste près de lui pour le relever.` : "Tu es à terre…", 2400); }
}
function sgDamage(e, dmg, p, dot) {
  if (e.hp <= 0) return;
  let crit = false;
  if (p && !dot && p.s.crit && siege.rand() < p.s.crit) { dmg *= 3; crit = true; }
  e.hp -= dmg; e.flash = 0.1;
  siege.nums.push({ x: e.x + (siege.rand() - 0.5) * 6, y: e.y - e.r - 4, v: Math.round(dmg), t: 0.6, c: crit ? "#f2d45a" : dot ? "#9cbf6a" : "#f6efe0" });
  if (p && !dot) {
    if (p.s.burn) e.burn = 3;
    if (p.s.poison) e.poison = 4;
    if (p.s.leech && siege.rand() < p.s.leech && p.hp < p.s.maxHp) { p.hp++; siege.nums.push({ x: p.x, y: p.y - 10, v: "+1", t: 0.8, c: "#ff8a80" }); }
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1, k = 70 * p.s.knock * (SG_ENEMIES[e.type].boss ? 0.1 : 1);
    e.kb.x += (e.x - p.x) / d * k; e.kb.y += (e.y - p.y) / d * k;
  }
  if (e.hp <= 0) sgKill(e, p);
}
function sgKill(e, p) {
  const S_ = siege, d = SG_ENEMIES[e.type];
  S_.kills++; if (p) p.kills++;
  S_.gems.push({ x: e.x, y: e.y, v: d.xp, t: 0 });
  S_.fx.push({ kind: "puff", x: e.x, y: e.y, t: 0.3, c: d.boss ? "#c4413b" : "#e9e1cf", r: e.r });
  const fp = S_.players.find(q => sgLv(q, "feu") >= 5);
  if (e.burn > 0 && fp) { sgAoe(e.x, e.y, 22 * fp.s.area, 8 * sgMul(sgLv(fp, "feu")) * fp.s.dmg, fp, { dot: true, burn: 1.5 }); S_.fx.push({ kind: "boom", x: e.x, y: e.y, t: 0.3, r: 22 * fp.s.area, c: "#e8913a" }); }
  if (p && p.s.moon) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; S_.shots.push(sgShot(p, e.x, e.y, Math.cos(a), Math.sin(a), { kind: "moon", dmg: 6, spd: 170, t: 0.5, r: 2.5, pierce: 0, noMods: true })); }
  if (d.lord) { sgVictory(); return; }
  if (d.boss) toast("Le Bélier est abattu !", 2000);
}

// ----- Armes -----
function sgShot(p, x, y, ux, uy, o) {
  const s = p.s;
  return { owner: p.i, kind: o.kind || "bolt", x, y, vx: ux * o.spd, vy: uy * o.spd, t: o.t || 1.2, r: (o.r || 3) * (o.noMods ? 1 : s.size),
    dmg: o.dmg * s.dmg, pierce: (o.pierce ?? 0) + (o.noMods ? 0 : s.pierce), bounce: o.noMods ? 0 : s.bounce, homing: !o.noMods && s.homing, hit: new Set(), back: o.back, age: 0 };
}
function sgNearest(p, range) {
  let best = null, bd = range;
  for (const e of siege.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function sgUpdatePlayer(p, dt) {
  const S_ = siege, s = p.s, I = p.input;
  p.iv = Math.max(0, p.iv - dt);
  if (p.down) {
    // un allié à côté le relève
    const helper = S_.players.find(q => q !== p && !q.down && Math.hypot(q.x - p.x, q.y - p.y) < 22);
    if (helper) { p.reviveT += dt; if (p.reviveT >= SG.revive) { p.down = false; p.hp = Math.ceil(s.maxHp / 2); p.iv = 1.5; toast(`${p.name} est relevé !`, 1600); } }
    else p.reviveT = Math.max(0, p.reviveT - dt);
    return;
  }
  // déplacement
  const sp = SG.speed * s.speed, acc = SG.accel * dt;
  p.kbx = (p.kbx || 0) * Math.pow(0.01, dt); p.kby = (p.kby || 0) * Math.pow(0.01, dt);
  const app = (v, t) => v < t ? Math.min(t, v + acc) : Math.max(t, v - acc);
  p.vx = app(p.vx || 0, I.mx * sp); p.vy = app(p.vy || 0, I.my * sp);
  // l'invité en ligne déplace lui-même son héros (pas de retard) : l'hôte prend la position qu'il envoie
  if (!(p.src === "net" && p.netPos)) sgMove(S_.map, p, (p.vx + p.kbx) * dt, (p.vy + p.kby) * dt, false);
  if (Math.abs(I.mx) > 0.1) p.face = Math.sign(I.mx);
  p.anim += Math.hypot(I.mx, I.my) * dt * 8;
  // la visée
  const auto = p.src === "net" ? p.autoAim : sgAutoAim();
  let target = null;
  if (auto) { target = sgNearest(p, 170); if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x); else if (Math.hypot(I.mx, I.my) > 0.2) p.aim = Math.atan2(I.my, I.mx); }
  else if (I.aim) p.aim = Math.atan2(I.ay, I.ax);
  else if (Math.hypot(I.mx, I.my) > 0.2) p.aim = Math.atan2(I.my, I.mx);   // ni souris ni stick : on vise devant soi
  if (Math.abs(Math.cos(p.aim)) > 0.2) p.face = Math.sign(Math.cos(p.aim));
  const fire = I.idle ? false : (p.src === "net" ? p.autoFire : sgAutoFire()) ? !!(target || sgNearest(p, 150)) : I.fire;
  const ux = Math.cos(p.aim), uy = Math.sin(p.aim);
  for (const k in p.cd) p.cd[k] -= dt * s.rate;
  sgCastSpells(p, dt, fire);
}
const sgLv = (p, id) => (p.spells && p.spells[id]) || 0;
const sgMul = L => 1 + 0.2 * (L - 1) + (L >= 10 ? 0.6 : 0);          // dégâts selon le niveau (gros bond à la forme finale)
function sgAoe(x, y, R, dmg, p, o = {}) {
  for (const e of siege.enemies) if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) < R + e.r) {
    sgDamage(e, dmg, p, o.dot);
    if (o.slow) e.slow = Math.max(e.slow || 0, o.slow);
    if (o.freeze) e.frozen = Math.max(e.frozen || 0, o.freeze);
    if (o.burn) e.burn = Math.max(e.burn, o.burn);
    if (o.poison) e.poison = Math.max(e.poison, o.poison);
  }
}
function sgCastSpells(p, dt, fire) {
  const S_ = siege, s = p.s, cd = p.cd;
  // --- Épée ---
  const LE = sgLv(p, "epee");
  if (LE && fire && cd.epee <= 0) {
    cd.epee = 0.62 / (1 + 0.04 * (LE - 1)); p.swing = 0.16; p.swingA = p.aim;
    const k = sgMul(LE);
    sgSlash(p, p.aim, k);
    if (s.backstab || LE >= 5) sgSlash(p, p.aim + Math.PI, k * 0.8);
    if (LE >= 10) for (const da of [0, Math.PI]) S_.shots.push(sgShot(p, p.x, p.y, Math.cos(p.aim + da), Math.sin(p.aim + da), { kind: "wave", dmg: 12 * k, spd: 210, t: 0.6, r: 7, pierce: 99, a: p.aim + da }));
    if (s.echo) p.echoT = 0.18;
    for (let j = 0; j < s.shards * 3; j++) { const a = p.aim + (j - (s.shards * 3 - 1) / 2) * 0.25; S_.shots.push(sgShot(p, p.x, p.y, Math.cos(a), Math.sin(a), { kind: "shard", dmg: 4, spd: 180, t: 0.45, r: 2 })); }
    if (typeof SFX !== "undefined" && p.src !== "net") SFX.play("swing");
  }
  if (p.echoT > 0) { p.echoT -= dt; if (p.echoT <= 0) sgSlash(p, p.swingA, 0.5 * sgMul(LE || 1)); }
  p.swing = Math.max(0, p.swing - dt);
  // --- Tir magique → Rayon ---
  const LT = sgLv(p, "tir");
  if (LT && fire && cd.tir <= 0) {
    const k = sgMul(LT);
    if (LT >= 10) {
      cd.tir = 1.3;
      const n = 1 + Math.floor(s.multi / 2);
      for (let j = 0; j < n; j++) sgBeam(p, p.aim + (j - (n - 1) / 2) * 0.22, 240, 5 * s.size, 26 * k);
      if (typeof SFX !== "undefined" && p.src !== "net") SFX.play("bolt");
    } else {
      cd.tir = 1.1 / (1 + 0.08 * (LT - 1));
      const n = 1 + s.multi + (LT >= 3 ? 1 : 0) + (LT >= 7 ? 1 : 0);
      for (let j = 0; j < n; j++) { const a = p.aim + (j - (n - 1) / 2) * 0.16; S_.shots.push(sgShot(p, p.x, p.y, Math.cos(a), Math.sin(a), { dmg: 10 * k, spd: 240, t: 1.2, pierce: LT >= 5 ? 2 : 0 })); }
      if (typeof SFX !== "undefined" && p.src !== "net") SFX.play("bolt");
    }
  }
  // --- Boomerang → Tourbillon ---
  const LB = sgLv(p, "boomerang");
  if (LB && fire && cd.boomerang <= 0) {
    cd.boomerang = 1.8 / (1 + 0.06 * (LB - 1));
    const k = sgMul(LB), dirs = LB >= 10 ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : LB >= 5 ? [0, Math.PI] : [0];
    const n = 1 + Math.floor(LB / 4) + Math.floor(s.multi / 2);
    for (const d0 of dirs) for (let j = 0; j < n; j++) { const a = p.aim + d0 + (j - (n - 1) / 2) * 0.4; S_.shots.push(sgShot(p, p.x, p.y, Math.cos(a), Math.sin(a), { kind: "boomer", dmg: 9 * k, spd: 190, t: 1.6, r: LB >= 10 ? 7 : 4, pierce: 99, back: true })); }
  }
  // --- Éclair → Tempête ---
  const LL = sgLv(p, "eclair");
  if (LL && cd.eclair <= 0) {
    const t0 = sgNearest(p, 190);
    if (t0) {
      cd.eclair = 2.2 / (1 + 0.1 * (LL - 1));
      const near = S_.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 190);
      for (let c = 0; c < (LL >= 5 ? 2 : 1); c++) sgChain(p, c === 0 ? t0 : near[Math.floor(S_.rand() * near.length)] || t0, 2 + LL, 10 * sgMul(LL), LL >= 5 ? 0.45 : 0);
    }
  }
  if (LL >= 10 && cd.storm <= 0) {
    cd.storm = 0.32;
    const near = S_.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 230);
    if (near.length) sgChain(p, near[Math.floor(S_.rand() * near.length)], 2, 14 * sgMul(LL), 0.2);
  }
  // --- Feu → Brasier ---
  const LF = sgLv(p, "feu");
  p.fireR = LF ? (24 + 4 * LF) * s.area * (LF >= 10 ? 1.5 : 1) : 0;
  if (LF && cd.feu <= 0) { cd.feu = 0.5; sgAoe(p.x, p.y, p.fireR, (2 + LF) * s.dmg * (LF >= 10 ? 1.5 : 1), p, { dot: true, burn: 1.5 }); }
  if (LF >= 10 && cd.puddle <= 0) {
    cd.puddle = 1.4; const a = S_.rand() * Math.PI * 2, d = p.fireR * (0.5 + S_.rand() * 0.7);
    S_.zones.push({ kind: "fire", x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 18 * s.area, t: 3.5, dur: 3.5, dps: 10 * s.dmg, owner: p.i, tick: 0 });
  }
  // --- Lames tournantes → Danse des lames ---
  const LO = sgLv(p, "lames");
  if (LO) {
    const fast = LO >= 5, k = sgMul(LO), n = 1 + Math.floor((LO + 1) / 2) + Math.floor(s.multi / 2);
    p.orbitA += dt * (fast ? 4.4 : 3.2);
    const rings = [[26 * s.area, 1]]; if (LO >= 10) rings.push([46 * s.area, -1.3]);
    p.orbs = [];
    for (const [R, dir] of rings) for (let j = 0; j < n; j++) {
      const a = p.orbitA * dir + j * Math.PI * 2 / n, ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R, sz = (fast ? 6.5 : 5) * s.size;
      p.orbs.push([ox, oy, a]);
      for (const e of S_.enemies) if (Math.hypot(e.x - ox, e.y - oy) < sz + e.r && !(e.hit["o" + p.i] > S_.time)) { e.hit["o" + p.i] = S_.time + 0.4; sgDamage(e, 7 * k * s.dmg, p); }
    }
  } else p.orbs = null;
  // --- Pluie d'étoiles → Météores ---
  const LS = sgLv(p, "etoiles");
  if (LS && cd.etoiles <= 0) {
    const near = S_.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 210);
    if (near.length) {
      cd.etoiles = 2.6 / (1 + 0.05 * (LS - 1));
      const k = sgMul(LS);
      for (let j = 0; j < 2 + LS && near.length; j++) {
        const e = near[Math.floor(S_.rand() * near.length)];
        S_.fx.push({ kind: "star", x: e.x, y: e.y, t: 0.35 });
        sgDamage(e, 12 * k * s.dmg, p);
        if (LS >= 5) { sgAoe(e.x, e.y, 16 * s.area, 5 * k * s.dmg, p); S_.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0.25, c: "#ffe08a", r: 16 * s.area }); }
      }
      if (LS >= 10) for (let j = 0; j < 2; j++) { const e = near[Math.floor(S_.rand() * near.length)]; S_.zones.push({ kind: "meteor", x: e.x, y: e.y, r: 34 * s.area, t: 0.7, dur: 0.7, dmg: 40 * k * s.dmg, owner: p.i }); }
    }
  }
  // --- Glace → Blizzard ---
  const LG = sgLv(p, "glace");
  if (LG && cd.glace <= 0 && sgNearest(p, (40 + 5 * LG) * s.area)) {
    cd.glace = 3.2 / (1 + 0.08 * (LG - 1));
    const R = (40 + 5 * LG) * s.area;
    sgAoe(p.x, p.y, R, 6 * sgMul(LG) * s.dmg, p, { slow: 2, freeze: LG >= 5 ? 0.8 : 0 });
    S_.fx.push({ kind: "nova", x: p.x, y: p.y, t: 0.35, r: R, c: "#9fe0ff" });
  }
  p.frostR = LG >= 10 ? 70 * s.area : 0;
  if (LG >= 10 && cd.frost <= 0) { cd.frost = 0.5; sgAoe(p.x, p.y, p.frostR, 3 * sgMul(LG) * s.dmg, p, { dot: true, slow: 0.7 }); }
  // --- Poison → Marais ---
  const LP = sgLv(p, "poison");
  if (LP && cd.poison <= 0) {
    const near = S_.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 170);
    if (near.length) {
      cd.poison = 2.8 / (1 + 0.07 * (LP - 1));
      const big = LP >= 10 ? 1.6 : 1;
      for (let j = 0; j < 1 + (LP >= 5 ? 1 : 0) + Math.floor(s.multi / 2); j++) {
        const e = near[Math.floor(S_.rand() * near.length)];
        S_.zones.push({ kind: "vial", x: p.x, y: p.y, tx: e.x, ty: e.y, t: 0.4, dur: 0.4, owner: p.i,
          then: { kind: "poison", r: (16 + 2 * LP) * s.area * big, t: (3 + 0.2 * LP) * (LP >= 10 ? 2 : 1), dps: 4 * sgMul(LP) * s.dmg, slow: LP >= 10, owner: p.i } });
      }
    }
  }
}
// Un rayon (forme finale du Tir magique) : touche tout ce qui est sur sa ligne
function sgBeam(p, a, len, w, dmg) {
  const S_ = siege, ux = Math.cos(a), uy = Math.sin(a);
  for (const e of S_.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y, t = dx * ux + dy * uy;
    if (t < 0 || t > len) continue;
    if (Math.abs(dx * uy - dy * ux) < w + e.r) sgDamage(e, dmg, p);
  }
  S_.fx.push({ kind: "beam", x: p.x, y: p.y, a, r: len, t: 0.22, c: "#7fe8ff" });
}
// Un éclair qui rebondit d'ennemi en ennemi
function sgChain(p, first, hops, dmg, stun) {
  const S_ = siege; let cur = first, px = p.x, py = p.y; const done = new Set();
  for (let k = 0; k < hops && cur; k++) {
    done.add(cur); sgDamage(cur, dmg * p.s.dmg, p); if (stun) cur.frozen = Math.max(cur.frozen || 0, stun);
    S_.fx.push({ kind: "zap", x: px, y: py, a: cur.x, r: cur.y, t: 0.16 });
    px = cur.x; py = cur.y;
    let nx = null, nd = 70; for (const e of S_.enemies) if (!done.has(e) && e.hp > 0) { const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < nd) { nd = d; nx = e; } }
    cur = nx;
  }
}
// Les zones au sol : flaques de feu, de poison, fioles en vol, météores qui tombent
function sgUpdateZones(dt) {
  const S_ = siege, out = [];
  for (const z of S_.zones) {
    z.t -= dt; const p = S_.players[z.owner];
    if (z.kind === "vial") { if (z.t <= 0) { out.push({ ...z.then, x: z.tx, y: z.ty, dur: z.then.t, tick: 0 }); S_.fx.push({ kind: "ring", x: z.tx, y: z.ty, t: 0.25, c: "#9cbf6a", r: z.then.r }); continue; } }
    else if (z.kind === "meteor") { if (z.t <= 0) { sgAoe(z.x, z.y, z.r, z.dmg, p, { burn: 2 }); S_.fx.push({ kind: "boom", x: z.x, y: z.y, t: 0.4, r: z.r }); continue; } }
    else {
      z.tick -= dt;
      if (z.tick <= 0) { z.tick = 0.5; sgAoe(z.x, z.y, z.r, z.dps * 0.5, p, { dot: true, poison: z.kind === "poison" ? 2 : 0, burn: z.kind === "fire" ? 1 : 0, slow: z.slow ? 0.7 : 0 }); }
      if (z.t <= 0) continue;
    }
    out.push(z);
  }
  S_.zones = out.slice(-80);
}
function sgSlash(p, a, k = 1) {
  const S_ = siege, s = p.s, R = 26 * s.area;
  S_.fx.push({ kind: "slash", x: p.x, y: p.y, a, r: R, t: 0.14, c: SG_COLORS[p.i] });
  for (const e of S_.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > R + e.r) continue;
    let da = Math.atan2(dy, dx) - a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 1.1 || d < e.r + 4) sgDamage(e, 10 * s.dmg * k, p);
  }
}
function sgUpdateShots(dt) {
  const S_ = siege, m = S_.map;
  for (const q of S_.shots) {
    q.t -= dt; q.age += dt;
    const p = S_.players[q.owner];
    if (q.homing) { const e = sgNearestPt(q.x, q.y, 120, q.hit); if (e) { const sp = Math.hypot(q.vx, q.vy), a = Math.atan2(q.vy, q.vx), w = Math.atan2(e.y - q.y, e.x - q.x); let da = w - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; const na = a + Math.max(-5 * dt, Math.min(5 * dt, da)); q.vx = Math.cos(na) * sp; q.vy = Math.sin(na) * sp; } }
    if (q.back && q.age > 0.55 && p) { const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1; q.vx = dx / d * 220; q.vy = dy / d * 220; if (d < 8) q.t = 0; if (!q.turned) { q.turned = true; q.hit = new Set(); } }
    const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
    const wall = t => t === "W" || t === "H" || t === "#" || t === "R";
    if (!q.back && wall(m.g[Math.floor(ny / T)] && m.g[Math.floor(ny / T)][Math.floor(nx / T)])) {
      if (q.bounce > 0) { q.bounce--; if (wall(m.g[Math.floor(q.y / T)][Math.floor(nx / T)])) q.vx *= -1; else q.vy *= -1; continue; }
      q.t = 0; continue;
    }
    q.x = nx; q.y = ny;
    for (const e of S_.enemies) {
      if (q.hit.has(e) || Math.hypot(e.x - q.x, e.y - q.y) > e.r + q.r) continue;
      q.hit.add(e); sgDamage(e, q.dmg, p);
      if (q.pierce-- <= 0) { q.t = 0; break; }
    }
  }
  S_.shots = S_.shots.filter(q => q.t > 0);
  for (const q of S_.foeShots) {
    q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
    const t = m.g[Math.floor(q.y / T)] && m.g[Math.floor(q.y / T)][Math.floor(q.x / T)];
    if (t !== "." && t !== "T") q.t = 0;
    for (const p of S_.players) if (!p.down && p.iv <= 0 && Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r) { sgHurtPlayer(p, q.dmg, q); q.t = 0; }
    if (Math.hypot(m.heart.x - q.x, m.heart.y - q.y) < 12) { S_.heart.hp -= q.heart; S_.heart.hitT = 0.25; q.t = 0; }
  }
  S_.foeShots = S_.foeShots.filter(q => q.t > 0);
}
function sgNearestPt(x, y, range, skip) { let best = null, bd = range; for (const e of siege.enemies) { if (skip && skip.has(e)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } } return best; }
function sgUpdateGems(dt) {
  const S_ = siege;
  for (const g of S_.gems) {
    g.t += dt;
    let best = null, bd = 1e9;
    for (const p of S_.players) if (!p.down) { const d = Math.hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; best = p; } }
    if (!best) continue;
    const R = 28 * best.s.magnet;
    if (bd < R || g.pull) { g.pull = true; const k = Math.min(1, dt * 9); g.x += (best.x - g.x) * k; g.y += (best.y - g.y) * k; }
    if (bd < 7) { g.taken = true; S_.xp += g.v; if (typeof SFX !== "undefined") SFX.play("coin"); }
  }
  S_.gems = S_.gems.filter(g => !g.taken);
  const need = SG.xpBase + SG.xpGrow * S_.level;
  if (S_.xp >= need && !S_.choice) { S_.xp -= need; S_.level++; toast(`Niveau ${S_.level} !`, 1400); sgOfferChoice("level"); }
}
function sgCamera(dt) {
  const S_ = siege, live = S_.local.filter(p => !p.down);
  const L = live.length ? live : S_.local.length ? S_.local : S_.players;
  const cx = L.reduce((a, p) => a + p.x, 0) / L.length, cy = L.reduce((a, p) => a + p.y, 0) / L.length;
  S_.cam.x += (cx - VW / 2 - S_.cam.x) * Math.min(1, dt * 11); S_.cam.y += (cy - VH / 2 - S_.cam.y) * Math.min(1, dt * 11);
  S_.cam.x = Math.max(0, Math.min(S_.map.W * T - VW, S_.cam.x)); S_.cam.y = Math.max(0, Math.min(S_.map.H * T - VH, S_.cam.y));
  // à deux sur le même écran : on reste dans l'image
  for (const p of S_.local) { p.x = Math.max(S_.cam.x + 6, Math.min(S_.cam.x + VW - 6, p.x)); p.y = Math.max(S_.cam.y + 8, Math.min(S_.cam.y + VH - 6, p.y)); }
}
function sgGameOver(why) {
  const S_ = siege;
  S_.over = { why, wave: S_.wave, kills: S_.kills, level: S_.level, time: S_.time };
  let best = 0; try { best = +localStorage.getItem("lepuits.siege.best") || 0; } catch (e) {}
  if (S_.wave > best) try { localStorage.setItem("lepuits.siege.best", String(S_.wave)); } catch (e) {}
  S_.over.best = Math.max(best, S_.wave);
  if (S_.net && S_.host) S_.net.send("end", S_.over);
  if (typeof SFX !== "undefined") SFX.play("death");
  sgShowEnd();
}

// ===== Choix : niveau (amélioration) ou fin de vague (objet) =====
const sgSlotsUsed = p => Object.keys(p.spells || {}).length;
const sgSlotsMax = p => p.s.slots;
// La carte d'un sort : nouveau (prend un emplacement) ou niveau suivant (éveil au 5, forme finale au 10)
function sgSpellOpt(p, id, plus = 1) {
  const d = SG_SPELLS[id], L = sgLv(p, id), to = Math.min(10, L + plus);
  let desc = L ? `Niveau ${L} → ${to} : plus fort.` : `${d.desc} Prend un emplacement (${sgSlotsUsed(p) + 1}/${sgSlotsMax(p)}).`;
  if (L < 5 && to >= 5) desc = `${L ? `Niveau ${L} → ${to}. ` : ""}ÉVEIL : ${d.awake}`;
  if (to >= 10) desc = `FORME FINALE : ${d.final}. ${d.finalDesc}`;
  const name = to >= 10 ? d.final : d.name;
  return { id: (plus > 1 ? "scroll:" : "spell:") + id, spell: id, name, lv: to, isNew: !L, tag: to >= 10 ? "final" : to >= 5 && L < 5 ? "awake" : "", desc };
}
// Les sorts qu'on peut encore prendre ou monter
const sgSpellChoices = p => Object.keys(SG_SPELLS).filter(id => sgLv(p, id) ? sgLv(p, id) < 10 : sgSlotsUsed(p) < sgSlotsMax(p));
function sgOptionsFor(p, kind) {
  const S_ = siege, r = S_.rand;
  if (kind === "item") {
    // trois objets ; la rareté se tire pour chaque carte (plus de belles raretés au fil des vagues, une épique garantie toutes les 5 vagues)
    const sh = Math.min(1, S_.wave / 20), W = { commun: 55 - 25 * sh, rare: 30 + 5 * sh, epique: 12 + 12 * sh, legendaire: 3 + 8 * sh };
    const order = ["commun", "rare", "epique", "legendaire"], out = [], used = new Set();
    const ok = id => {
      if (used.has(id) || !ITEM[id]) return false;
      if (SG_SCROLLS[id]) return sgSpellChoices(p).includes(SG_SCROLLS[id]);
      return !p.items.includes(id);
    };
    for (let k = 0; k < 3; k++) {
      let x = r() * order.reduce((a, o) => a + W[o], 0), rar = "commun";
      for (const o of order) { x -= W[o]; if (x <= 0) { rar = o; break; } }
      if (k === 0 && S_.wave % 5 === 0 && order.indexOf(rar) < 2) rar = "epique";
      // si la rareté tirée n'a plus rien, on essaie la plus proche
      let pick = null;
      for (const o of [rar, ...order.slice().sort((a, b) => Math.abs(order.indexOf(a) - order.indexOf(rar)) - Math.abs(order.indexOf(b) - order.indexOf(rar)))]) {
        const pool = SG_RARITY[o].items.filter(ok); if (pool.length) { pick = pool[Math.floor(r() * pool.length)]; rar = o; break; }
      }
      if (!pick) break;
      used.add(pick);
      if (SG_SCROLLS[pick]) { const o = sgSpellOpt(p, SG_SCROLLS[pick], 2); out.push({ ...o, id: "item:" + pick, item: pick, rarity: rar, name: `${ITEM[pick].name}`, desc: `Parchemin : ${SG_SPELLS[SG_SCROLLS[pick]].name} +2 niveaux. ${o.desc}` }); }
      else out.push({ id: "item:" + pick, item: pick, rarity: rar, name: ITEM[pick].name, desc: SG_ITEM_DESC[pick] });
    }
    return sgFillBonus(p, out);
  }
  // niveau : un mélange de sorts (nouveaux ou à monter) et d'améliorations passives
  const pool = [];
  for (const id of sgSpellChoices(p)) pool.push({ w: sgLv(p, id) ? 3 : 2, o: () => sgSpellOpt(p, id) });
  for (const u of SG_UPGRADES) if ((p.upg[u.id] || 0) < u.max) pool.push({ w: u.team ? 0.7 : 1.5, o: () => ({ id: "upg:" + u.id, name: u.name + (p.upg[u.id] ? ` ${p.upg[u.id] + 1}` : ""), desc: u.desc }) });
  const out = [];
  while (out.length < 3 && pool.length) {
    let x = r() * pool.reduce((a, q) => a + q.w, 0), i = 0;
    for (; i < pool.length - 1; i++) { x -= pool[i].w; if (x <= 0) break; }
    out.push(pool.splice(i, 1)[0].o());
  }
  return sgFillBonus(p, out);
}
function sgFillBonus(p, opts) {
  const pool = SG_BONUS.slice(), r = siege.rand;
  while (opts.length < 3 && pool.length) { const b = pool.splice(Math.floor(r() * pool.length), 1)[0], n = (p.bonus && p.bonus[b.id]) || 0; opts.push({ id: "bonus:" + b.id, name: b.name + (n ? ` ${n + 1}` : ""), desc: b.desc }); }
  return opts;
}
function sgLearn(p, id, plus) {
  const before = sgLv(p, id);
  if (!before && sgSlotsUsed(p) >= sgSlotsMax(p)) return;
  const L = Math.min(10, before + plus); p.spells[id] = L;
  const d = SG_SPELLS[id];
  if (before < 10 && L >= 10) { toast(`<b>${d.final}</b> ! ${d.name} atteint sa forme finale.`, 3000, true); siege.fx.push({ kind: "boom", x: p.x, y: p.y, t: 0.6, r: 46, c: d.col }); if (typeof SFX !== "undefined" && p.src !== "net") SFX.play("relic"); }
  else if (before < 5 && L >= 5) { toast(`${d.name} s'éveille : ${d.awake}`, 2600); siege.fx.push({ kind: "ring", x: p.x, y: p.y, t: 0.4, r: 30, c: d.col }); }
}
function sgApply(p, opt) {
  if (!opt) return;
  if (opt.startsWith("spell:")) { sgLearn(p, opt.slice(6), 1); return; }
  if (opt.startsWith("item:")) {
    const id = opt.slice(5);
    if (SG_SCROLLS[id]) { sgLearn(p, SG_SCROLLS[id], 2); return; }
    p.items.push(id);
  }
  else if (opt.startsWith("bonus:")) {
    const b = SG_BONUS.find(x => x.id === opt.slice(6)); if (!b) return;
    if (b.team) { siege.heart.max += 25; siege.heart.hp = siege.heart.max; }
    else { p.bonus = p.bonus || {}; p.bonus[b.id] = (p.bonus[b.id] || 0) + 1; }
    if (b.heal) { sgRecompute(p); p.hp = p.s.maxHp; return; }
  }
  else { const u = SG_UPGRADES.find(x => x.id === opt.slice(4)); if (!u) return; if (u.team) u.apply(p.s, p); else p.upg[u.id] = (p.upg[u.id] || 0) + 1; }
  const before = p.s.maxHp; sgRecompute(p); if (p.s.maxHp > before) p.hp += p.s.maxHp - before;
}
// chaque joueur choisit : les joueurs locaux l'un après l'autre, les joueurs en ligne en même temps
function sgOfferChoice(kind) {
  const S_ = siege;
  S_.offerN = (S_.offerN || 0) + 1;
  S_.choice = { id: S_.offerN, kind, queue: S_.players.filter(p => p.src !== "net" && !(kind === "item" && p.down)).map(p => p.i), remote: {}, t: SG.pickWait, resend: 2 };
  for (const p of S_.players) if (p.src === "net" && !p.left) S_.choice.remote[p.pid] = sgOptionsFor(p, kind);
  sgSendOffers();
  sgNextLocalChoice();
}
// en ligne, un message peut se perdre : l'hôte renvoie la proposition toutes les 2 s ;
// au bout de SG.pickWait secondes (ou si le joueur est parti), il choisit à sa place pour ne bloquer personne
function sgSendOffers() {
  const S_ = siege, c = S_.choice; if (!c || !S_.net) return;
  for (const pid in c.remote) S_.net.send("offer", { id: c.id, to: pid, kind: c.kind, opts: c.remote[pid], level: S_.level, wave: S_.wave, t: Math.ceil(c.t) });
}
function sgChoiceTick(dt) {
  const S_ = siege, c = S_.choice; if (!c || !Object.keys(c.remote).length) return;
  c.t -= dt; c.resend -= dt;
  if (c.resend <= 0) { c.resend = 2; sgSendOffers(); }
  for (const pid of Object.keys(c.remote)) {
    const p = S_.players.find(q => q.pid === pid);
    if (!p || p.left || c.t <= 0) { if (p && !p.left) { sgApply(p, c.remote[pid][0].id); toast(`${p.name} n'a pas répondu : choix automatique.`, 2000); S_.net && S_.net.send("picked", { to: pid, id: c.id }); } delete c.remote[pid]; }
  }
  if (!c.queue.length && !Object.keys(c.remote).length) { S_.choice = null; sgResume(); }
  else if (!c.queue.length && screen === "siegemenu" && document.getElementById("sgWaitT")) document.getElementById("sgWaitT").textContent = Math.max(0, Math.ceil(c.t));
}
function sgNextLocalChoice() {
  const S_ = siege, c = S_.choice;
  if (!c) return;
  if (!c.queue.length) {
    if (Object.keys(c.remote).length) { sgShowWait(); return; }
    S_.choice = null; sgResume(); return;
  }
  const p = S_.players[c.queue[0]];
  c.cur = p; c.opts = sgOptionsFor(p, c.kind);
  sgShowChoice(p, c.kind, c.opts, opt => { sgApply(p, opt); c.queue.shift(); sgNextLocalChoice(); });
}
function sgRemotePick(pid, opt, id) {
  const S_ = siege, c = S_.choice; if (!c || !c.remote[pid] || (id != null && id !== c.id)) return;
  const p = S_.players.find(q => q.pid === pid); if (!p) return;
  if (c.remote[pid].some(o => o.id === opt)) sgApply(p, opt);
  delete c.remote[pid];
  if (S_.net) S_.net.send("picked", { to: pid, id: c.id });
  if (!c.queue.length && !Object.keys(c.remote).length) { S_.choice = null; sgResume(); }
}
function sgResume() { menuEl.hidden = true; screen = "play"; document.body.classList.remove("pvp-drafting"); try { cv.focus({ preventScroll: true }); } catch (e) {} }
function sgCards(opts) {
  return `<nav class="pvp-cards">${opts.map(o => {
    const rar = o.rarity ? SG_RARITY[o.rarity] : null;
    const icon = o.item ? `<canvas class="pvp-ic" width="8" height="10" data-icon="${o.item}"></canvas>` : o.spell ? `<canvas class="pvp-ic" width="8" height="8" data-spell="${o.spell}"></canvas>` : `<span class="sg-up">${o.name[0]}</span>`;
    const kind = rar ? rar.label : o.spell ? (o.tag === "final" ? "Forme finale" : o.tag === "awake" ? "Éveil" : o.isNew ? "Nouveau sort" : `Sort · niv ${o.lv}`) : o.id.startsWith("bonus:") ? "Bonus" : "Amélioration";
    const cls = rar ? `sg-r-${o.rarity}` : o.tag === "final" ? "sg-r-legendaire" : o.tag === "awake" ? "sg-r-epique" : o.spell ? "sg-r-spell" : "";
    return `<button class="mi pvp-card ${cls}" data-act="sgPick:${o.id}" ${rar ? `style="--rar:${rar.col}"` : ""}>${icon}<span class="pvp-card-f">${kind}</span><span class="pvp-card-n">${o.name}${o.spell && !o.rarity && !o.isNew && o.tag !== "final" ? ` <small class="sg-lv">${o.lv}</small>` : ""}</span><small>${o.desc}</small></button>`;
  }).join("")}</nav>`;
}
function sgShowChoice(p, kind, opts, done) {
  if (!opts || !opts.length) { done(""); return; }   // rien à proposer : on passe
  const el = document.getElementById("siegePanel");
  siege.pickDone = done; siege.pickOpts = opts;
  screen = "siegemenu"; menuRoot = "siege"; document.body.classList.add("pvp-drafting");
  const who = siege.players.length > 1 ? `<span class="sg-who" style="color:${SG_COLORS[p.i]}">${p.name}</span> · ` : "";
  el.innerHTML = `<div><span class="kicker">${who}${kind === "item" ? `Vague ${siege.wave} repoussée` : `Niveau ${siege.level}`}</span><div class="big small">${kind === "item" ? "Choisis un objet" : "Choisis une amélioration"}</div></div>
    ${sgCards(opts)}<p class="pvp-help">Sorts (${sgSlotsUsed(p)}/${sgSlotsMax(p)}) : ${Object.entries(p.spells).map(([id, L]) => `${L >= 10 ? SG_SPELLS[id].final : SG_SPELLS[id].name} ${L}`).join(" · ")}${p.items.length ? "<br>Objets : " + p.items.map(id => ITEM[id].name).join(", ") : ""}</p>`;
  showPanel("siege");
  for (const c of el.querySelectorAll("canvas[data-icon]")) { const src = itemIconCanvas(c.dataset.icon), x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0); }
  for (const c of el.querySelectorAll("canvas[data-spell]")) { const x = c.getContext("2d"); sgDrawSpellIcon(x, c.dataset.spell, 0, 0, 1); }
  const b = el.querySelector(".pvp-card"); if (b) b.focus({ preventScroll: true });
}
function sgShowWait() {
  const el = document.getElementById("siegePanel");
  screen = "siegemenu"; menuRoot = "siege";
  el.innerHTML = `<div><span class="kicker">Siège</span><div class="big small">On attend tes alliés…</div></div><p class="pvp-help">Ils choisissent leur ${siege.choice.kind === "item" ? "objet" : "amélioration"}. Choix automatique dans <b id="sgWaitT">${Math.ceil(siege.choice.t)}</b> s.</p>
    <nav class="menu-list"><button class="mi" data-act="sgQuit">Abandonner la partie</button></nav>`;
  showPanel("siege");
}
function sgShowEnd() {
  const o = siege.over, el = document.getElementById("siegePanel");
  screen = "siegemenu"; menuRoot = "siege"; document.body.classList.remove("pvp-drafting");
  el.innerHTML = `<div><span class="kicker">Siège du village</span><div class="big small">${o.why}</div></div>
    <div class="pvp-result ${o.win ? "win" : "lose"}"><b>${o.win ? "Victoire !" : `Vague ${o.wave}`}</b><span>${o.win ? `Le Seigneur de la Horde est tombé à la vague ${o.wave}. ` : ""}${o.kills} monstres vaincus · niveau ${o.level} · ${fmtTime(o.time)}</span><span>Record : vague ${o.best}</span></div>
    <nav class="menu-list">${o.win && (!siege.net || siege.host) ? `<button class="mi" data-act="sgContinue">Continuer : mode infini<small>la horde ne s'arrête plus</small></button>` : ""}${o.win && siege.net && !siege.host ? `<p class="pvp-help">L'hôte peut continuer en mode infini.</p>` : ""}${siege.net ? "" : `<button class="mi" data-act="sgAgain">Rejouer</button>`}<button class="mi" data-act="sgQuit">Retour au menu</button></nav>`;
  showPanel("siege");
}

// ===== Dessin =====
/* Le sol est dessiné une fois pour toutes dans une image (herbe nuancée, fleurs, chemins de terre vers les portes,
   place pavée autour du Cœur) ; arbres, rochers, pieux et maisons sont triés en profondeur avec les personnages ;
   la nuit tombe sur la carte et les feux (Cœur, sorts, héros) l'éclairent. */
const sgHash = (c, r, k = 0) => { let h = (c * 374761393 + r * 668265263 + k * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function sgGround(m) {
  if (m.groundCv) return m.groundCv;
  const cvs = document.createElement("canvas"); cvs.width = m.W * T; cvs.height = m.H * T;
  const g = cvs.getContext("2d"); if (!g) return null;
  const cx = m.W / 2, cy = m.H / 2;
  for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
    const x = c * T, y = r * T, t = m.g[r][c], n = sgHash(c, r), d = Math.hypot(c + 0.5 - cx, (r + 0.5 - cy) * 1.15);
    const inside = d < SG.ringR, plaza = d < 2.6, path = !inside && (Math.abs(c + 0.5 - cx) < 1.6 || Math.abs(r + 0.5 - cy) < 1.4);
    if (t === "#") { g.fillStyle = "#16200f"; g.fillRect(x, y, T, T); g.fillStyle = "#1f2c16"; for (let k = 0; k < 4; k++) g.fillRect(x + sgHash(c, r, k) * 14, y + sgHash(r, c, k) * 14, 3, 3); continue; }
    if (plaza) {
      g.fillStyle = "#6a6258"; g.fillRect(x, y, T, T);
      for (let k = 0; k < 4; k++) { const bx = x + (k % 2) * 8 + ((r % 2) * 4), by = y + Math.floor(k / 2) * 8; g.fillStyle = sgHash(c, r, k) < 0.5 ? "#7a7266" : "#857c6e"; g.fillRect(bx + 0.5, by + 0.5, 7, 7); g.fillStyle = "#958b7c"; g.fillRect(bx + 0.5, by + 0.5, 7, 1); }
      continue;
    }
    if (inside || path) {
      g.fillStyle = inside ? "#69583c" : "#5c4e33"; g.fillRect(x, y, T, T);
      for (let k = 0; k < 14; k++) { const v = sgHash(c, r, k + 9); g.fillStyle = v < 0.35 ? (inside ? "#736144" : "#655638") : v < 0.7 ? (inside ? "#61513a" : "#55472f") : v < 0.9 ? "#7d6a4a" : "#4a3d28"; g.fillRect(x + Math.floor(sgHash(c, r, k) * 16), y + Math.floor(sgHash(r, c, k) * 16), v < 0.7 ? 2 : 1, 1); }
      if (path && n < 0.25) { g.fillStyle = "#3f5a2c"; g.fillRect(x + n * 40 % 14, y + 13, 2, 2); }
      continue;
    }
    // l'herbe : trois nuances, des brins, quelques fleurs
    // une base unique + des taches douces à cheval sur les cases (pas d'effet damier)
    g.fillStyle = "#32442a"; g.fillRect(x, y, T, T);
    const blot = (sgHash(Math.floor(c / 3), Math.floor(r / 3), 11) + sgHash(Math.floor((c + 1) / 2), Math.floor((r + 1) / 2), 12)) / 2;
    if (blot > 0.62) { g.fillStyle = "rgba(70,100,50,0.25)"; g.fillRect(x, y, T, T); } else if (blot < 0.3) { g.fillStyle = "rgba(20,30,14,0.22)"; g.fillRect(x, y, T, T); }
    for (let k = 0; k < 12; k++) { const bx = x + Math.floor(sgHash(c, r, k) * 16), by = y + Math.floor(sgHash(r, c, k + 3) * 15), v = sgHash(c, r, k + 7); g.fillStyle = v < 0.4 ? "#456238" : v < 0.75 ? "#2a3b21" : "#3c5530"; g.fillRect(bx, by, 1, v < 0.4 ? 2 : 1); }
    if (n > 0.93) { const fc = ["#e8d27a", "#c88aff", "#e9e1cf", "#e07a6a"][Math.floor(sgHash(r, c, 2) * 4)]; g.fillStyle = fc; g.fillRect(x + 5, y + 6, 1, 1); g.fillRect(x + 10, y + 9, 1, 1); g.fillStyle = "#4f7a3a"; g.fillRect(x + 5, y + 7, 1, 2); }
    if (d < SG.ringR + 1.2) { g.fillStyle = "rgba(20,14,8,0.18)"; g.fillRect(x, y, T, T); }
  }
  // une ombre douce le long de la lisière
  const grd = g.createLinearGradient(0, 0, 0, 3 * T); grd.addColorStop(0, "rgba(0,0,0,0.5)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(0, T, m.W * T, 3 * T);
  return (m.groundCv = cvs);
}
// les éléments du décor qui ont une hauteur (triés avec les personnages)
function sgProps(m) {
  if (m.props) return m.props;
  const out = [];
  for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
    const t = m.g[r][c];
    if (t === "T") out.push({ kind: "tree", x: c * T + 8, y: r * T + 14, v: sgHash(c, r, 5) });
    else if (t === "R") out.push({ kind: "rock", x: c * T + 8, y: r * T + 13, v: sgHash(c, r, 6) });
    else if (t === "W") out.push({ kind: "post", x: c * T + 8, y: r * T + 14, v: sgHash(c, r, 7) });
  }
  for (const hs of m.houses) out.push({ kind: "house", x: hs.c * T, y: (hs.r + hs.h) * T, hs, v: sgHash(hs.c, hs.r) });
  return (m.props = out);
}
const sgPx = v => Math.round(v * S) / S;
function sgDrawProp(o, ox, oy) {
  const x = sgPx(o.x - ox), y = sgPx(o.y - oy);
  if (x < -60 || x > VW + 60 || y < -20 || y > VH + 70) return;
  const sh = (w, h) => { ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); };
  if (o.kind === "tree") {
    sh(9, 3);
    ctx.fillStyle = "#3a2414"; ctx.fillRect(x - 1.5, y - 8, 3, 8); ctx.fillStyle = "#5a3a20"; ctx.fillRect(x - 1.5, y - 8, 1, 8);
    const sway = Math.sin(time * 1.3 + o.v * 6) * 0.6, big = o.v > 0.5 ? 1.15 : 1;
    const blob = (bx, by, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + bx * big + sway, y + by * big, r * big, 0, Math.PI * 2); ctx.fill(); };
    blob(0, -14, 8.5, "#1e3018"); blob(-3, -15, 6.5, "#2c4422"); blob(3, -17, 6, "#36532a"); blob(-1, -19, 4.5, "#45683a"); blob(1, -21, 2.5, "#5a8248");
  } else if (o.kind === "rock") {
    sh(7, 2.5);
    ctx.fillStyle = "#3e3a46"; ctx.fillRect(x - 6, y - 8, 12, 8); ctx.fillRect(x - 5, y - 10, 10, 2);
    ctx.fillStyle = "#5a5664"; ctx.fillRect(x - 5, y - 9, 7, 3); ctx.fillStyle = "#77738a"; ctx.fillRect(x - 4, y - 9, 3, 1);
    if (o.v > 0.5) { ctx.fillStyle = "#3f5a2c"; ctx.fillRect(x + 1, y - 10, 4, 2); }
  } else if (o.kind === "post") {
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x - 7, y - 1, 15, 3);
    for (const [dx, hh] of [[-5, 15], [0, 17], [5, 15]]) {
      ctx.fillStyle = "#4a2e18"; ctx.fillRect(x + dx - 2, y - hh, 4, hh);
      ctx.fillStyle = "#8a5a30"; ctx.fillRect(x + dx - 2, y - hh, 2, hh);
      ctx.fillStyle = "#b07a44"; ctx.fillRect(x + dx - 1, y - hh - 2, 2, 2);
    }
    ctx.fillStyle = "#6a4a2a"; ctx.fillRect(x - 8, y - 10, 16, 1.5);
  } else if (o.kind === "house") {
    const hs = o.hs, w = hs.w * T, hh = hs.h * T, top = y - hh;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + 2, y - 2, w + 2, 4);
    // murs en planches
    ctx.fillStyle = "#6e5236"; ctx.fillRect(x, top + hh * 0.42, w, hh * 0.58);
    ctx.fillStyle = "#5a4230"; for (let k = 3; k < w; k += 4) ctx.fillRect(x + k, top + hh * 0.42, 1, hh * 0.58);
    ctx.fillStyle = "#8a6a48"; ctx.fillRect(x, top + hh * 0.42, w, 1);
    // porte et fenêtre éclairée
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x + w / 2 - 2.5, y - 8, 5, 8); ctx.fillStyle = "#c08a50"; ctx.fillRect(x + w / 2 + 1, y - 4, 1, 1);
    const fl = 0.8 + 0.2 * Math.sin(time * 6 + o.v * 9);
    ctx.fillStyle = `rgba(242,${170 + 30 * fl | 0},80,1)`; ctx.fillRect(x + 4, y - 12, 4, 4); if (w > 36) ctx.fillRect(x + w - 8, y - 12, 4, 4);
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x + 5.5, y - 12, 1, 4);
    // toit en tuiles
    ctx.fillStyle = "#5a2018"; ctx.fillRect(x - 3, top - 1, w + 6, hh * 0.46);
    for (let rr = 0; rr < hh * 0.46 - 2; rr += 3) { ctx.fillStyle = rr % 6 ? "#8a3428" : "#7a2e24"; ctx.fillRect(x - 3, top + rr, w + 6, 2); }
    ctx.fillStyle = "#b04a3a"; ctx.fillRect(x - 3, top - 2, w + 6, 2);
    // cheminée et fumée
    ctx.fillStyle = "#4a4652"; ctx.fillRect(x + w - 9, top - 7, 4, 6);
    for (let k = 0; k < 3; k++) { const ph = (time * 0.6 + k / 3 + o.v) % 1; ctx.fillStyle = `rgba(200,195,190,${0.35 * (1 - ph)})`; ctx.fillRect(x + w - 8 + Math.sin(ph * 6) * 2, top - 9 - ph * 14, 2 + ph * 2, 2 + ph * 2); }
  }
}
function siegeDraw() {
  const S_ = siege; if (!S_) return;
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false;
  const m = S_.map, ox = Math.round(S_.cam.x * S) / S, oy = Math.round(S_.cam.y * S) / S;
  ctx.fillStyle = "#16200f"; ctx.fillRect(0, 0, VW, VH);
  const gcv = sgGround(m);
  if (gcv) ctx.drawImage(gcv, ox, oy, VW, VH, 0, 0, VW, VH);
  const h = m.heart;
  // les zones au sol (sous les personnages)
  for (const z of S_.zones) sgDrawZone(z, ox, oy);
  // l'expérience
  for (const g of S_.gems) {
    const x = sgPx(g.x - ox), y = sgPx(g.y - oy - Math.abs(Math.sin(g.t * 4)) * 1.5), big = g.v >= 5;
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x - 1.5, g.y - oy + 2, 3, 1);
    ctx.fillStyle = big ? "#8a4ad0" : "#3a9a88"; ctx.fillRect(x - 2, y - 1, 4, 2); ctx.fillRect(x - 1, y - 3, 2, 6);
    ctx.fillStyle = big ? "#c88aff" : "#7fd6c0"; ctx.fillRect(x - 1, y - 2, 2, 3);
    if (Math.sin(g.t * 5 + g.x) > 0.8) { ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 1, y - 2, 1, 1); }
  }
  // le Cœur du village : un brasier sur un autel de pierre
  const hx = sgPx(h.x - ox), hy = sgPx(h.y - oy), k = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(hx, hy + 6, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3e3a46"; ctx.fillRect(hx - 10, hy - 3, 20, 10); ctx.fillStyle = "#5a5664"; ctx.fillRect(hx - 10, hy - 3, 20, 3); ctx.fillStyle = "#77738a"; ctx.fillRect(hx - 9, hy - 3, 18, 1);
  ctx.fillStyle = "#2a1a10"; ctx.fillRect(hx - 7, hy - 5, 14, 3);
  const hit = S_.heart.hitT > 0;
  for (let j = 0; j < 7; j++) { const ph = (time * 1.6 + j / 7) % 1, fx = hx + Math.sin(j * 2.3 + time * 3) * (5 - ph * 4), fy = hy - 6 - ph * 18; ctx.fillStyle = hit ? "#ffffff" : ph < 0.35 ? "#fff3b8" : ph < 0.7 ? "#f2b54a" : "#e8613a"; const sz = (1 - ph) * 5 + 1; ctx.fillRect(fx - sz / 2, fy - sz / 2, sz, sz); }
  ctx.fillStyle = hit ? "#ffffff" : "#e8913a"; ctx.fillRect(hx - 4, hy - 11 - k * 2, 8, 7 + k * 2); ctx.fillStyle = "#f2d45a"; ctx.fillRect(hx - 2.5, hy - 9 - k * 2, 5, 5 + k * 2); ctx.fillStyle = "#fff3b8"; ctx.fillRect(hx - 1, hy - 7, 2, 3);
  // décor, monstres et joueurs, triés de haut en bas
  const list = [];
  for (const o of sgProps(m)) if (o.x - ox > -60 && o.x - ox < VW + 60 && o.y - oy > -20 && o.y - oy < VH + 70) list.push({ y: o.y, d: o });
  for (const e of S_.enemies) list.push({ y: e.y + e.r * 0.6, e });
  for (const p of S_.players) list.push({ y: p.y + 5, p });
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.e ? sgDrawEnemy(o.e, ox, oy) : o.p ? sgDrawPlayer(o.p, ox, oy) : sgDrawProp(o.d, ox, oy);
  // tirs
  for (const q of S_.shots) sgDrawShot(q, ox, oy);
  for (const q of S_.foeShots) { const x = sgPx(q.x - ox), y = sgPx(q.y - oy);
    if (q.big) { ctx.globalAlpha = 0.4; ctx.fillStyle = "#e0453c"; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.globalAlpha = 1; ctx.fillStyle = "#c4413b"; ctx.fillRect(x - 2.5, y - 2.5, 5, 5); ctx.fillStyle = "#ffd0c8"; ctx.fillRect(x - 1, y - 1, 2, 2); }
    else { ctx.fillStyle = "#8a7a62"; ctx.fillRect(x - 2.5, y - 2.5, 5, 5); ctx.fillStyle = "#e6dcc8"; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); } }
  // effets
  for (const f of S_.fx) sgDrawFx(f, ox, oy);
  for (const n of S_.nums) { ctx.globalAlpha = Math.min(1, n.t * 3); drawTinyText(n.x - ox, n.y - oy, String(n.v), n.c); }
  ctx.globalAlpha = 1;
  sgDrawLight(ox, oy);
  sgDrawHud();
}
// la nuit et les lumières : une couche sombre percée par les feux
function sgDrawLight(ox, oy) {
  const S_ = siege;
  if (!sgDrawLight.cv) { sgDrawLight.cv = document.createElement("canvas"); sgDrawLight.cv.width = VW; sgDrawLight.cv.height = VH; }
  const L = sgDrawLight.cv, g = L.getContext && L.getContext("2d"); if (!g || !g.createRadialGradient) return;
  g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, VW, VH);
  g.fillStyle = "rgba(10,8,26,0.5)"; g.fillRect(0, 0, VW, VH);
  g.globalCompositeOperation = "destination-out";
  const hole = (x, y, r, a = 1) => { if (x < -r || y < -r || x > VW + r || y > VH + r) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  const h = S_.map.heart;
  hole(h.x - ox, h.y - oy - 6, 95 + Math.sin(time * 5) * 3, 1);
  for (const p of S_.players) hole(p.x - ox, p.y - oy, p.down ? 30 : 62, 0.9);
  for (const z of S_.zones) if (z.kind === "fire") hole(z.x - ox, z.y - oy, z.r * 2, 0.7);
  for (const f of S_.fx) if (f.kind === "beam" || f.kind === "boom" || f.kind === "zap") hole(f.x - ox, f.y - oy, 50, 0.6);
  for (const hs of S_.map.houses) hole(hs.c * T + 6 - ox, (hs.r + hs.h) * T - 10 - oy, 18, 0.5);
  g.globalCompositeOperation = "source-over";
  ctx.drawImage(L, 0, 0);
  // un halo chaud autour du Cœur
  const hx = h.x - ox, hy = h.y - oy - 6, gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, 60);
  gr.addColorStop(0, `rgba(242,160,60,${0.18 + 0.04 * Math.sin(time * 5)})`); gr.addColorStop(1, "rgba(242,160,60,0)");
  ctx.fillStyle = gr; ctx.fillRect(hx - 60, hy - 60, 120, 120);
}
function sgDrawZone(z, ox, oy) {
  const x = z.x - ox, y = z.y - oy;
  if (x < -60 || y < -60 || x > VW + 60 || y > VH + 60) return;
  const life = z.dur ? Math.max(0, Math.min(1, z.t / Math.min(0.5, z.dur))) : 1;
  if (z.kind === "poison") {
    ctx.globalAlpha = 0.55 * life; ctx.fillStyle = "#4a6a2a"; ctx.beginPath(); ctx.ellipse(x, y, z.r, z.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6 * life; ctx.fillStyle = "#7fae4a"; ctx.beginPath(); ctx.ellipse(x, y, z.r * 0.7, z.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = life; for (let k = 0; k < 4; k++) { const ph = (time * 0.8 + k / 4 + z.x * 0.01) % 1; ctx.fillStyle = "#c8e08a"; ctx.fillRect(x + Math.cos(k * 1.7) * z.r * 0.5, y + Math.sin(k * 2.3) * z.r * 0.3 - ph * 5, 1.5, 1.5); }
  } else if (z.kind === "fire") {
    ctx.globalAlpha = 0.45 * life; ctx.fillStyle = "#8a2a14"; ctx.beginPath(); ctx.ellipse(x, y, z.r, z.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = life; for (let k = 0; k < 6; k++) { const ph = (time * 1.8 + k / 6) % 1, a = k * 1.05 + z.x; ctx.fillStyle = ph < 0.4 ? "#fff3b8" : ph < 0.7 ? "#f2b54a" : "#e8613a"; const sz = (1 - ph) * 3 + 1; ctx.fillRect(x + Math.cos(a) * z.r * 0.6, y + Math.sin(a) * z.r * 0.35 - ph * 8, sz, sz); }
  } else if (z.kind === "vial") {
    const k = 1 - z.t / z.dur, vx = z.x + (z.tx - z.x) * k, vy = z.y + (z.ty - z.y) * k - Math.sin(k * Math.PI) * 20;
    ctx.fillStyle = "#9cbf6a"; ctx.fillRect(vx - ox - 2, vy - oy - 2, 4, 4); ctx.fillStyle = "#e9e1cf"; ctx.fillRect(vx - ox - 1, vy - oy - 4, 2, 2);
  } else if (z.kind === "meteor") {
    const k = 1 - z.t / z.dur;
    ctx.globalAlpha = 0.25 + 0.35 * k; ctx.fillStyle = "#c4413b"; ctx.beginPath(); ctx.ellipse(x, y, z.r * k, z.r * 0.6 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const my = y - (1 - k) * 120; ctx.fillStyle = "#e8613a"; ctx.fillRect(x - 5, my - 5, 10, 10); ctx.fillStyle = "#f2d45a"; ctx.fillRect(x - 3, my - 3, 6, 6); ctx.fillStyle = "rgba(242,180,80,0.5)"; ctx.fillRect(x - 3, my - 20, 6, 15);
  }
  ctx.globalAlpha = 1;
}
function sgDrawShot(q, ox, oy) {
  const x = sgPx(q.x - ox), y = sgPx(q.y - oy), col = SG_COLORS[q.owner] || "#7fc8d6";
  if (x < -20 || y < -20 || x > VW + 20 || y > VH + 20) return;
  if (q.kind === "boomer") { ctx.save(); ctx.translate(x, y); ctx.rotate((q.age || time) * 14); const r = q.r || 4; ctx.fillStyle = "#8a7a62"; ctx.fillRect(-r, -1.5, r * 2, 3); ctx.fillRect(-1.5, -r, 3, r * 2); ctx.fillStyle = "#e6dcc8"; ctx.fillRect(-r + 0.5, -0.5, r * 2 - 1, 1); ctx.fillRect(-0.5, -r + 0.5, 1, r * 2 - 1); ctx.restore(); return; }
  if (q.kind === "wave") { ctx.save(); ctx.translate(x, y); ctx.rotate(q.a != null ? q.a : Math.atan2(q.vy || 0, q.vx || 1)); ctx.strokeStyle = "rgba(230,240,255,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-4, 0, q.r, -1.1, 1.1); ctx.stroke(); ctx.strokeStyle = "rgba(160,200,255,0.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-6, 0, q.r, -1, 1); ctx.stroke(); ctx.lineWidth = 1; ctx.restore(); return; }
  const c = q.kind === "moon" ? "#eaf3ff" : q.kind === "shard" ? "#c9c2b4" : q.kind === "ember" || q.owner === -1 ? "#f2b54a" : col, r = q.r || 3;
  // une traînée, un halo, un cœur blanc
  if (q.vx != null) { ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.fillRect(x - q.vx * 0.025 - r * 0.6, y - q.vy * 0.025 - r * 0.6, r * 1.2, r * 1.2); }
  ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2); ctx.globalAlpha = 1;
  ctx.fillStyle = c; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.fillStyle = "#fff"; ctx.fillRect(x - r / 3, y - r / 3, r / 1.5, r / 1.5);
}
function sgDrawFx(f, ox, oy) {
  const x = f.x - ox, y = f.y - oy;
  if (f.kind === "slash") { ctx.strokeStyle = f.c; ctx.globalAlpha = Math.min(1, f.t / 0.1); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, f.r * 0.85, f.a - 1.1, f.a + 1.1); ctx.stroke(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, f.r * 0.85, f.a - 0.7, f.a + 0.7); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.kind === "ring") { ctx.strokeStyle = f.c; ctx.globalAlpha = Math.max(0, f.t / 0.3); ctx.beginPath(); ctx.arc(x, y, (f.r || 14) * (1.2 - f.t), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.kind === "puff") { ctx.fillStyle = f.c; ctx.globalAlpha = Math.max(0, f.t / 0.3); for (let i = 0; i < 8; i++) { const a = i * 0.785 + f.x; ctx.fillRect(x + Math.cos(a) * (0.3 - f.t) * 45, y + Math.sin(a) * (0.3 - f.t) * 45 - (0.3 - f.t) * 10, 2, 2); } ctx.globalAlpha = 1; }
  else if (f.kind === "bolt" || f.kind === "zap") {
    // un éclair en zigzag
    const x2 = f.kind === "zap" ? f.a - ox : x, y2 = f.kind === "zap" ? f.r - oy : y, x1 = f.kind === "zap" ? x : x + 4, y1 = f.kind === "zap" ? y : y - 60;
    ctx.globalAlpha = Math.min(1, f.t / 0.1);
    for (const [col, w] of [["rgba(242,212,90,0.45)", 4], ["#fff3b8", 1.5]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1);
      for (let k = 1; k < 5; k++) { const t = k / 5; ctx.lineTo(x1 + (x2 - x1) * t + (sgHash(k, Math.floor(time * 20)) - 0.5) * 8, y1 + (y2 - y1) * t + (sgHash(Math.floor(time * 20), k) - 0.5) * 8); }
      ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.globalAlpha = 1;
  }
  else if (f.kind === "star") { const k = f.t / 0.35; ctx.fillStyle = "#ffe08a"; ctx.fillRect(x - 1, y - 34 * k - 2, 2, 7); ctx.fillRect(x - 3, y - 34 * k, 6, 2); ctx.fillStyle = "rgba(255,224,138,0.4)"; ctx.fillRect(x - 1, y - 34 * k - 14, 2, 12); }
  else if (f.kind === "beam") {
    const ux = Math.cos(f.a), uy = Math.sin(f.a), x2 = x + ux * f.r, y2 = y + uy * f.r, k = Math.max(0, f.t / 0.22);
    for (const [col, w] of [["rgba(80,200,255,0.3)", 10 * k + 2], ["rgba(127,232,255,0.8)", 5 * k + 1], ["#ffffff", 2 * k + 0.5]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x2, y2 - 4); ctx.stroke(); }
    ctx.lineWidth = 1;
  }
  else if (f.kind === "nova") { const k = 1 - f.t / 0.35; ctx.globalAlpha = 0.4 * (1 - k); ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(x, y, f.r * k, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, f.r * k, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.kind === "boom") { const k = 1 - f.t / 0.4; ctx.globalAlpha = Math.max(0, 0.6 * (1 - k)); ctx.fillStyle = f.c || "#f2b54a"; ctx.beginPath(); ctx.arc(x, y, f.r * (0.4 + k * 0.6), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = "#fff3b8"; ctx.beginPath(); ctx.arc(x, y, f.r * 0.4 * (1 - k), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
}
function sgDrawEnemy(e, ox, oy) {
  const d = SG_ENEMIES[e.type], sc = d.scale || 1, x = sgPx(e.x - ox), y = sgPx(e.y - oy);
  if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) return;
  ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.6, e.r * 1.1, e.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  const step = Math.floor(e.t * 6) % 2;
  const name = d.sprite === "golem" ? "golem0" : d.sprite === "wisp" || d.sprite === "bat" || d.sprite === "rodeur" || d.sprite === "squelette" || d.sprite === "crawler" ? d.sprite + step : d.sprite + "0";
  if (!SPRITES[name]) { ctx.fillStyle = "#c4413b"; ctx.fillRect(x - e.r, y - e.r, e.r * 2, e.r * 2); return; }
  const w = spriteW(name), h = spriteH(name), flip = siege.map.heart.x < e.x;
  const hop = d.fly ? Math.sin(e.t * 6) * 1.5 : 0;
  if (d.lord) {   // une aura rouge qui pulse sous le Seigneur
    const k = 0.5 + 0.5 * Math.sin(time * (e.raged ? 9 : 4));
    ctx.globalAlpha = 0.25 + 0.15 * k; ctx.fillStyle = "#c4413b"; ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.6, e.r * 1.8, e.r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.translate(x, y + e.r * 0.6 - hop); ctx.scale(sc, sc);
  // le flash de coup : bref et intermittent sur les boss (sinon ils resteraient blancs sous les coups)
  drawSprite(name, -w / 2, -h, flip, e.flash > 0 && (!d.boss || Math.floor(time * 30) % 4 === 0));
  if (d.lord) {
    // la couronne
    ctx.fillStyle = "#f2b54a"; ctx.fillRect(-4, -h - 3, 8, 2); ctx.fillRect(-4, -h - 5, 1.5, 2); ctx.fillRect(-0.75, -h - 6, 1.5, 3); ctx.fillRect(2.5, -h - 5, 1.5, 2);
    ctx.fillStyle = "#e0453c"; ctx.fillRect(-0.5, -h - 3, 1, 1);
  }
  ctx.restore();
  if (e.frozen > 0) { ctx.globalAlpha = 0.45; ctx.fillStyle = "#9fe0ff"; ctx.fillRect(x - w * sc / 2, y + e.r * 0.6 - h * sc, w * sc, h * sc); ctx.globalAlpha = 1; }
  else if (e.slow > 0) { ctx.fillStyle = "#cdefff"; if (Math.random() < 0.3) ctx.fillRect(x + (Math.random() - 0.5) * 8, y - 4 - Math.random() * 6, 1, 1); }
  if (d.boss || e.hp < e.max) { const bw = d.boss ? 30 : 14; ctx.fillStyle = "rgba(10,8,14,0.75)"; ctx.fillRect(x - bw / 2 - 0.5, y - h * sc - 3.5, bw + 1, 3); ctx.fillStyle = d.boss ? "#c4413b" : "#e9e1cf"; ctx.fillRect(x - bw / 2, y - h * sc - 3, bw * Math.max(0, e.hp / e.max), 2); }
  if (e.burn > 0 && Math.random() < 0.5) { ctx.fillStyle = Math.random() < 0.5 ? "#f2b54a" : "#e8613a"; ctx.fillRect(x + (Math.random() - 0.5) * 9, y - 4 - Math.random() * 8, 1.5, 1.5); }
  if (e.poison > 0 && Math.random() < 0.4) { ctx.fillStyle = "#9cbf6a"; ctx.fillRect(x + (Math.random() - 0.5) * 9, y - 2 - Math.random() * 6, 1.5, 1.5); }
}
function sgDrawPlayer(p, ox, oy) {
  const x = sgPx(p.x - ox), y = sgPx(p.y - oy), col = SG_COLORS[p.i];
  // zones de sorts autour du héros (sous lui)
  if (p.fireR > 0) {
    ctx.globalAlpha = 0.16; ctx.fillStyle = "#e8613a"; ctx.beginPath(); ctx.arc(x, y, p.fireR, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    for (let k = 0; k < 10; k++) { const a = k * 0.628 + time * 1.5, ph = (time * 2 + k * 0.37) % 1; ctx.fillStyle = ph < 0.4 ? "#fff3b8" : ph < 0.7 ? "#f2b54a" : "#e8613a"; ctx.fillRect(x + Math.cos(a) * p.fireR * 0.92, y + Math.sin(a) * p.fireR * 0.92 - ph * 5, 1.5 + (1 - ph), 1.5 + (1 - ph)); }
  }
  if (p.frostR > 0) {
    ctx.globalAlpha = 0.14; ctx.fillStyle = "#9fe0ff"; ctx.beginPath(); ctx.arc(x, y, p.frostR, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.8;
    for (let k = 0; k < 14; k++) { const a = k * 0.449 - time * 2.2, rr = p.frostR * (0.3 + ((k * 0.37 + time * 0.5) % 1) * 0.7); ctx.fillStyle = "#eaf8ff"; ctx.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1, 1); }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = col; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(x, y + 5, 6, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  if (p.down) {
    ctx.save(); ctx.translate(x, y + 4); ctx.rotate(Math.PI / 2); drawSprite("hero_idle0", -6, -14, false, false); ctx.restore();
    if (p.reviveT > 0) { ctx.fillStyle = "#7fd6a0"; ctx.fillRect(x - 8, y - 12, 16 * p.reviveT / SG.revive, 2); }
    drawTinyText(x, y - 20, "A TERRE", "#c4413b"); return;
  }
  if (!(p.iv > 0 && Math.floor(time * 20) % 2)) {
    const moving = Math.hypot(p.input.mx || 0, p.input.my || 0) > 0.2;
    const f = moving ? ["hero_run0", "hero_run1", "hero_run2", "hero_run1"][Math.floor(p.anim) % 4] : "hero_idle0";
    const bob = moving ? 0 : Math.round(Math.sin(time * 3) * 0.5);
    drawSprite(f, x - 6, y - 13 + bob, p.face < 0, false);
    // l'arme pointe vers la visée
    const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
    ctx.fillStyle = "#c9c2b4"; for (let k = 5; k < 12; k += 1) ctx.fillRect(x + ax * k - 0.5, y - 5 + ay * k - 0.5, 1, 1);
    ctx.fillStyle = col; ctx.fillRect(x + ax * 4 - 1, y - 5 + ay * 4 - 1, 2, 2);
  }
  // les lames tournantes
  if (p.orbs) for (const o of p.orbs) {
    const bx = o[0] - ox, by = o[1] - oy, a = (o[2] || 0) + Math.PI / 2, L2 = 4 * (p.s ? p.s.size : 1);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
    ctx.globalAlpha = 0.35; ctx.fillStyle = "#bed7ff"; ctx.fillRect(-L2 - 2, -1.5, L2 * 2 + 4, 3); ctx.globalAlpha = 1;
    ctx.fillStyle = "#eaf3ff"; ctx.fillRect(-L2, -1, L2 * 2, 2); ctx.fillStyle = "#ffffff"; ctx.fillRect(-L2 + 1, -0.5, L2, 1);
    ctx.restore();
  }
  if (siege.players.length > 1) drawTinyText(x, y - 23, p.name.slice(0, 10).toUpperCase(), col);
}
function sgDrawHud() {
  const S_ = siege;
  // le Cœur du village
  const fr = Math.max(0, S_.heart.hp / S_.heart.max), bx = VW / 2 - 60;
  ctx.fillStyle = "rgba(10,8,14,0.8)"; ctx.fillRect(bx - 2, 3, 124, 11);
  ctx.fillStyle = "#2a1c1c"; ctx.fillRect(bx, 5, 120, 7);
  ctx.fillStyle = fr < 0.3 ? "#c4413b" : "#c86a2a"; ctx.fillRect(bx, 5, 120 * fr, 7);
  ctx.fillStyle = fr < 0.3 ? "#e0453c" : "#e8913a"; ctx.fillRect(bx, 5, 120 * fr, 4);
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(bx, 5, 120 * fr, 1);
  drawTinyText(VW / 2, 16, `COEUR DU VILLAGE ${Math.max(0, Math.ceil(S_.heart.hp))}`, "#f6efe0");
  // la barre du Seigneur de la Horde
  const lord = S_.enemies.find(e => e.type === "seigneur");
  if (lord) {
    const fr2 = Math.max(0, lord.hp / lord.max), lx = VW / 2 - 80;
    ctx.fillStyle = "rgba(10,8,14,0.85)"; ctx.fillRect(lx - 2, 24, 164, 9);
    ctx.fillStyle = "#3a1018"; ctx.fillRect(lx, 26, 160, 5); ctx.fillStyle = lord.raged ? "#e0453c" : "#a8243a"; ctx.fillRect(lx, 26, 160 * fr2, 5);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(lx, 26, 160 * fr2, 1);
    drawTinyText(VW / 2, 35, "LE SEIGNEUR DE LA HORDE", lord.raged ? "#ff8a80" : "#f2b54a");
  }
  // vague
  const wtxt = S_.phase === "prep" ? (S_.wave ? `REPIT ${Math.ceil(S_.phaseT)}` : `VAGUE 1 DANS ${Math.ceil(S_.phaseT)}`) : `VAGUE ${S_.wave}  ${S_.enemies.length + S_.toSpawn}`;
  drawTinyText(VW - 4 - wtxt.length * 2, 5, wtxt, "#f2d45a");
  // niveau et expérience
  const need = SG.xpBase + SG.xpGrow * S_.level;
  ctx.fillStyle = "rgba(10,8,14,0.75)"; ctx.fillRect(0, VH - 4, VW, 4);
  ctx.fillStyle = "#3a9a88"; ctx.fillRect(0, VH - 3, VW * Math.min(1, S_.xp / need), 2);
  ctx.fillStyle = "#7fd6c0"; ctx.fillRect(0, VH - 3, VW * Math.min(1, S_.xp / need), 1);
  drawTinyText(VW - 18, VH - 12, `NIV ${S_.level}`, "#7fd6c0");
  // les PV de chaque joueur (petits cœurs)
  S_.players.forEach((p, k) => {
    const x = 4, y = 4 + k * 10;
    for (let i = 0; i < p.s.maxHp; i++) {
      const full = i < p.hp, hx = x + i * 6;
      ctx.fillStyle = full ? SG_COLORS[p.i] : "rgba(233,225,207,0.18)";
      ctx.fillRect(hx, y + 1, 5, 2); ctx.fillRect(hx + 1, y, 1, 1); ctx.fillRect(hx + 3, y, 1, 1); ctx.fillRect(hx + 1, y + 3, 3, 1); ctx.fillRect(hx + 2, y + 4, 1, 1);
      if (full) { ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(hx + 1, y + 1, 1, 1); }
    }
    if (S_.players.length > 1) drawTinyText(x + p.s.maxHp * 6 + 4 + p.name.slice(0, 8).length * 2, y - 0.5, p.name.slice(0, 8).toUpperCase(), SG_COLORS[p.i]);
  });
  // les sorts (emplacements) et les objets du joueur local
  const me = S_.players.find(p => p.pid === S_.myPid) || S_.players.find(p => p.src !== "net") || S_.players[0];
  const ids = Object.keys(me.spells || {}), slots = me.s.slots || SG.slots;
  for (let k = 0; k < slots; k++) {
    const x = 4 + k * 14, y = VH - 20, id = ids[k], L = id ? me.spells[id] : 0;
    ctx.fillStyle = "rgba(10,8,14,0.75)"; ctx.fillRect(x, y, 13, 13);
    ctx.strokeStyle = L >= 10 ? "#f2b54a" : L >= 5 ? "#b77ae0" : id ? "rgba(233,225,207,0.5)" : "rgba(233,225,207,0.15)"; ctx.lineWidth = L >= 10 ? 1.34 : 0.67; ctx.strokeRect(x + 0.5, y + 0.5, 12, 12); ctx.lineWidth = 1;
    if (id) {
      sgDrawSpellIcon(ctx, id, x + 2.5, y + 1.5, 1);
      ctx.fillStyle = L >= 10 ? "#f2b54a" : "#e9e1cf"; const t = L >= 10 ? "X" : String(L);
      drawTinyText(x + 10, y + 7.5, t, L >= 10 ? "#f2b54a" : "#e9e1cf");
      // recharge
      const c = me.cd && me.cd[id]; if (c > 0 && id !== "feu" && id !== "lames") { ctx.fillStyle = "rgba(10,8,14,0.45)"; ctx.fillRect(x + 1, y + 1, 11, Math.min(11, c * 6)); }
    }
  }
  me.items.forEach((id, k) => { if (ITEM[id]) { const x = VW - 12 - (k % 12) * 10, y = VH - 30 - Math.floor(k / 12) * 11; ctx.fillStyle = (SG_RARITY[SG_RARITY_OF[id]] || {}).col || "#888"; ctx.globalAlpha = 0.5; ctx.fillRect(x - 1, y - 1, 10, 12); ctx.globalAlpha = 1; drawItemIcon(id, x, y); } });
}

// ===== Coop en ligne =====
/* L'hôte fait tourner la partie ; chaque invité envoie ses commandes (20 fois par seconde)
   et reçoit l'état de la partie (15 fois par seconde) qu'il affiche. */
function sgHostNet(dt) {
  const S_ = siege, now = Date.now();
  if (now - S_.lastSnap < 1000 / SG.sendHz) return;
  S_.lastSnap = now;
  const r1 = v => Math.round(v * 10) / 10;
  S_.net.send("snap", {
    w: S_.wave, ph: S_.phase, pt: r1(S_.phaseT), hh: Math.ceil(S_.heart.hp), hm: S_.heart.max, hit: S_.heart.hitT > 0 ? 1 : 0, lv: S_.level, xp: S_.xp, k: S_.kills, ts: S_.toSpawn,
    pl: S_.players.map(p => [p.pid, r1(p.x), r1(p.y), p.hp, p.s.maxHp, p.face, p.down ? 1 : 0, r1(p.aim), p.iv > 0 ? 1 : 0, p.items, p.orbs ? p.orbs.map(o => [r1(o[0]), r1(o[1]), r1(o[2])]) : 0,
      [r1(p.fireR || 0), r1(p.frostR || 0)], r1(p.reviveT), Math.round(Math.hypot(p.input.mx, p.input.my) * 10), p.spells, p.s.slots, r1(p.s.speed), r1(p.s.size), p.cd ? Object.fromEntries(Object.entries(p.cd).map(([k, v]) => [k, r1(Math.max(0, v))])) : 0]),
    en: S_.enemies.slice(0, 160).map(e => [e.id, e.type, r1(e.x), r1(e.y), Math.round(100 * e.hp / e.max), e.flash > 0 ? 1 : 0]),
    sh: S_.shots.slice(0, 120).map(q => [q.owner, q.kind === "boomer" ? 1 : q.kind === "moon" ? 2 : q.kind === "wave" ? 3 : q.kind === "shard" ? 4 : 0, r1(q.x), r1(q.y), r1(q.r), r1(q.a || 0)]),
    zn: S_.zones.slice(0, 40).map(z => [z.kind, r1(z.x), r1(z.y), r1(z.r || 0), r1(z.t), r1(z.dur || 1), r1(z.tx || 0), r1(z.ty || 0)]),
    fs: S_.foeShots.map(q => [r1(q.x), r1(q.y), q.big ? 1 : 0]),
    gm: S_.gems.slice(0, 80).map(g => [r1(g.x), r1(g.y), g.v]),
    fx: S_.fx.filter(f => f.t > 0.08 && !f.sent).map(f => { f.sent = true; return [f.kind, r1(f.x), r1(f.y), r1(f.a || 0), r1(f.r || 0), f.c || ""]; }),
  });
}
function sgGuestUpdate(dt) {
  const S_ = siege, me = S_.players.find(p => p.pid === S_.myPid);
  if (me) {
    me.input = sgReadInput({ ...me, src: "auto" });
    // mon héros bouge tout de suite chez moi (sans attendre l'hôte) : j'envoie ma position avec mes commandes
    if (!me.down) {
      const I = me.input, sp = SG.speed * (me.s.speed || 1), acc = SG.accel * dt, app = (v, t) => v < t ? Math.min(t, v + acc) : Math.max(t, v - acc);
      me.vx = app(me.vx || 0, I.mx * sp); me.vy = app(me.vy || 0, I.my * sp);
      sgMove(S_.map, me, me.vx * dt, me.vy * dt, false);
      me.anim += Math.hypot(I.mx, I.my) * dt * 8;
      if (Math.abs(I.mx) > 0.1) me.face = Math.sign(I.mx);
      if (I.aim) me.aim = Math.atan2(I.ay, I.ax); else if (Math.hypot(I.mx, I.my) > 0.2 && !sgAutoAim()) me.aim = Math.atan2(I.my, I.mx);
    }
    // l'aide à la visée et le tir auto se règlent chez l'invité : on les envoie avec les commandes
    S_.inT = (S_.inT || 0) - dt;
    if (S_.inT <= 0) { S_.inT = 1 / SG.inHz; const I = me.input; S_.net.send("in", { pid: S_.myPid, mx: I.mx, my: I.my, ax: I.ax, ay: I.ay, fire: I.fire, aim: I.aim, af: sgAutoFire(), aa: sgAutoAim(), x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10 }); }
  }
  // positions lissées vers le dernier état reçu (sauf mon héros, que je déplace moi-même)
  const k = Math.min(1, dt * 14);
  for (const p of S_.players) if (p.tx != null && p !== me) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
  for (const z of S_.zones) z.t -= dt;
  for (const e of S_.enemies) if (e.tx != null) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.t += dt; }
  for (const f of S_.fx) f.t -= dt; S_.fx = S_.fx.filter(f => f.t > 0);
  sgCamera(dt);
  if (Date.now() - (S_.lastRx || Date.now()) > 15000) { S_.over = { why: "L'hôte a quitté la partie.", wave: S_.wave, kills: S_.kills, level: S_.level, time: S_.time, best: S_.wave }; sgShowEnd(); }
}
function sgApplySnap(m) {
  const S_ = siege; if (!S_ || S_.host) return;
  S_.lastRx = Date.now();
  Object.assign(S_, { wave: m.w, phase: m.ph, phaseT: m.pt, level: m.lv, xp: m.xp, kills: m.k, toSpawn: m.ts });
  S_.heart.hp = m.hh; S_.heart.max = m.hm; S_.heart.hitT = m.hit ? 0.1 : 0;
  for (const a of m.pl) {
    let p = S_.players.find(q => q.pid === a[0]);
    if (!p) { p = sgMakePlayer(S_.players.length, "net", "?", a[0]); S_.players.push(p); }
    const mine = p.pid === S_.myPid;
    // mon héros : je garde ma position, sauf si l'hôte me voit vraiment ailleurs (relevé, coincé…)
    if (p.tx == null || (mine && (Math.hypot(p.x - a[1], p.y - a[2]) > 48 || a[6]))) { p.x = a[1]; p.y = a[2]; }
    p.tx = a[1]; p.ty = a[2]; p.hp = a[3]; p.s.maxHp = a[4]; p.down = !!a[6]; p.iv = a[8] ? 0.1 : 0; p.items = a[9] || [];
    if (!mine) { p.face = a[5]; p.aim = a[7]; p.input = { mx: a[13] / 10, my: 0 }; p.anim += a[13] / 10 * 0.13; } else if (sgAutoAim()) p.aim = a[7];
    p.orbs = a[10] || null; p.fireR = (a[11] && a[11][0]) || 0; p.frostR = (a[11] && a[11][1]) || 0; p.reviveT = a[12];
    if (a[14]) p.spells = a[14]; if (a[15]) p.s.slots = a[15]; if (a[16]) p.s.speed = a[16]; if (a[17]) p.s.size = a[17]; if (a[18]) p.cd = a[18];
  }
  const seen = new Map(S_.enemies.map(e => [e.id, e]));
  S_.enemies = m.en.map(a => { let e = seen.get(a[0]); if (!e) e = { id: a[0], type: a[1], x: a[2], y: a[3], t: Math.random() * 6, r: SG_ENEMIES[a[1]].r * (SG_ENEMIES[a[1]].scale || 1) }; e.tx = a[2]; e.ty = a[3]; e.hp = a[4]; e.max = 100; e.flash = a[5] ? 0.1 : 0; if (a[1] === "seigneur") e.raged = a[4] < 50; return e; });
  S_.shots = m.sh.map(a => ({ owner: a[0], kind: ["bolt", "boomer", "moon", "wave", "shard"][a[1]] || "bolt", x: a[2], y: a[3], r: a[4], a: a[5], age: time }));
  S_.zones = (m.zn || []).map(z => ({ kind: z[0], x: z[1], y: z[2], r: z[3], t: z[4], dur: z[5], tx: z[6], ty: z[7] }));
  S_.foeShots = m.fs.map(a => ({ x: a[0], y: a[1], big: !!a[2] }));
  S_.gems = m.gm.map(a => ({ x: a[0], y: a[1], v: a[2], t: 0 }));
  const FXT = { slash: 0.14, beam: 0.22, zap: 0.16, nova: 0.35, boom: 0.4, star: 0.35 };
  for (const f of m.fx) S_.fx.push({ kind: f[0], x: f[1], y: f[2], a: f[3], r: f[4], c: f[5], t: FXT[f[0]] || 0.3 });
}
// Le salon : l'hôte crée, les autres rejoignent avec le code, l'hôte lance
async function sgLobby(code, asHost) {
  // pas besoin de passer par le Duel : on retrouve le pseudo du compte, sinon on prend celui tapé ici
  if (!PVP.me) await pvpProfile().catch(() => null);
  if (!PVP.me) { toast("Crée ton compte ou connecte-toi (pseudo + mot de passe) pour jouer en ligne.", 3000); renderSiegeLobby(); return; }
  await cloudEnsure().catch(() => {});
  const me = PVP.me || { pid: "g-" + pvpId(8), pseudo: pvpPseudo || "Joueur" };
  if (!me.pid) me.pid = "g-" + pvpId(8);
  const L = { code, host: asHost, me, members: [], net: null };
  sgLobbyState = L;
  renderSiegeLobby();
  try {
    L.net = await PVP_NET.join(`siege:${code}`, {
      key: me.pid, events: ["start", "in", "snap", "offer", "pick", "picked", "end", "bye", "cont"],
      onSync: ms => { L.members = ms.sort((a, b) => a.at - b.at).slice(0, 4); if (!siege) renderSiegeLobby(); },   // en partie, on ne redessine pas le salon par-dessus un choix
      onMsg: (ev, m) => sgOnNet(ev, m),
    });
    await L.net.track({ pid: me.pid, name: me.pseudo, host: asHost, at: Date.now() });
  } catch (e) { toast("Connexion impossible.", 2400); sgLobbyState = null; renderSiegeLobby(); }
}
let sgLobbyState = null, sgOptFrom = null;
function sgOnNet(ev, m) {
  const L = sgLobbyState;
  if (ev === "start" && L && !L.host && !siege) {
    siegeStart({ seed: m.seed, host: false, net: L.net, players: m.players.map(p => ({ src: "net", name: p.name, pid: p.pid })) });
    siege.myPid = L.me.pid; siege.lastRx = Date.now();
    siege.local = siege.players.filter(p => p.pid === L.me.pid);
    return;
  }
  if (!siege) return;
  if (ev === "snap") sgApplySnap(m);
  if (ev === "in" && siege.host) { const p = siege.players.find(q => q.pid === m.pid); if (p) { p.input = { mx: +m.mx || 0, my: +m.my || 0, ax: +m.ax || 0, ay: +m.ay || 0, fire: !!m.fire, aim: !!m.aim, idle: !m.af && !m.fire && !m.mx && !m.my && m.aa === false && m.af === false };
      // la position de l'invité : il se déplace chez lui ; on la prend si elle est plausible (et libre)
      if (m.x != null && !p.down) { p.netPos = true; const nx = +m.x, ny = +m.y; if (Math.hypot(nx - p.x, ny - p.y) < 60 && !sgSolid(siege.map, Math.floor(nx / T), Math.floor(ny / T), false)) { p.x = nx; p.y = ny; } } p.autoFire = !!m.af; p.autoAim = !!m.aa; } }
  if (ev === "offer" && !siege.host && m.to === siege.myPid && !siege.over) {
    siege.answered = siege.answered || {};
    // déjà répondu (la réponse s'est perdue) : on la renvoie ; déjà à l'écran : rien à faire
    if (siege.answered[m.id]) { siege.net.send("pick", { pid: siege.myPid, id: m.id, opt: siege.answered[m.id] }); return; }
    if (siege.curOffer === m.id) return;
    siege.curOffer = m.id; siege.level = m.level; siege.wave = m.wave;
    const me = siege.players.find(p => p.pid === siege.myPid) || { i: 0, name: "Toi", items: [] };
    sgShowChoice(me, m.kind, m.opts, opt => { siege.answered[m.id] = opt; siege.curOffer = null; siege.net.send("pick", { pid: siege.myPid, id: m.id, opt }); sgResume(); });
  }
  // l'hôte a tranché (réponse reçue, ou choix automatique) : on ferme la carte si elle est encore ouverte
  if (ev === "picked" && !siege.host && m.to === siege.myPid) {
    siege.answered = siege.answered || {}; siege.answered[m.id] = siege.answered[m.id] || "auto";
    if (siege.curOffer === m.id) { siege.curOffer = null; siege.pickDone = null; toast("Temps écoulé : choix automatique.", 1800); sgResume(); }
  }
  if (ev === "pick" && siege.host) sgRemotePick(m.pid, m.opt, m.id);
  if (ev === "cont" && !siege.host) { siege.over = null; siege.endless = true; sgResume(); toast("Mode infini : la horde ne s'arrête plus.", 2600, true); }
  if (ev === "end" && !siege.host && !siege.over) { siege.over = m; siege.pickDone = null; siege.curOffer = null; sgShowEnd(); }
  if (ev === "bye" && siege.host) { const p = siege.players.find(q => q.pid === m.pid); if (p) { p.down = true; p.hp = 0; p.left = true; toast(`${p.name} a quitté la partie.`, 2000); } }
}
function sgHostStart() {
  const L = sgLobbyState; if (!L || !L.host) return;
  const seed = Math.floor(Math.random() * 1e9);
  const others = L.members.filter(m => m.pid !== L.me.pid).slice(0, 3);
  const players = [{ src: "auto", name: L.me.pseudo, pid: L.me.pid }, ...others.map(m => ({ src: "net", name: m.name, pid: m.pid }))];
  L.net.send("start", { seed, players: players.map(p => ({ name: p.name, pid: p.pid })) });
  siegeStart({ seed, host: true, net: L.net, players });
}
// les deux options de combat : chaque joueur règle les siennes (aussi en ligne et pendant la pause)
function sgOptButtons() {
  const onoff = v => v ? "Activée" : "Coupée";
  return `<button class="mi" data-act="sgAutoFire">Attaque auto : ${onoff(sgAutoFire())}<small>les armes frappent seules</small></button>
        <button class="mi" data-act="sgAutoAim">Visée auto : ${onoff(sgAutoAim())}<small>vise l'ennemi le plus proche (sinon : souris ou stick droit)</small></button>`;
}
function sgShowPause() {
  screen = "siegemenu"; menuRoot = "siege";
  const el = document.getElementById("siegePanel");
  el.innerHTML = `<div><span class="kicker">Siège · vague ${siege.wave}</span><div class="big small">Pause</div></div>
    ${siege.net ? `<p class="pvp-help">En ligne, la partie continue pendant la pause.</p>` : ""}
    <nav class="menu-list"><button class="mi" data-act="sgResume">Reprendre</button>${sgOptButtons()}<button class="mi" data-act="sgOptions">Options<small>son, commandes, affichage</small></button><button class="mi" data-act="sgQuit">Abandonner</button></nav>`;
  showPanel("siege");
}
function renderSiegeLobby() {
  const el = document.getElementById("siegePanel"); if (!el) return;
  const L = sgLobbyState, best = (() => { try { return +localStorage.getItem("lepuits.siege.best") || 0; } catch (e) { return 0; } })();
  const onoff = v => v ? "Activée" : "Coupée";
  if (L) {
    el.innerHTML = `<div><span class="kicker">Siège · coop en ligne</span><div class="big small">Salon ${L.code}</div></div>
      <p class="pvp-help">${L.host ? "Donne ce code à tes amis (jusqu'à 3). Lance quand tout le monde est là." : "En attente du lancement par l'hôte…"}</p>
      <p class="pvp-picks">${L.members.map((m, i) => `<span class="pvp-chip" style="color:${SG_COLORS[i]}">${m.name}${m.host ? " (hôte)" : ""}</span>`).join("") || `<span class="pvp-chip empty">connexion…</span>`}</p>
      <nav class="menu-list">${L.host ? `<button class="mi" data-act="sgHostStart">Lancer la partie<small>${L.members.length} joueur${L.members.length > 1 ? "s" : ""}</small></button>` : ""}
        ${sgOptButtons()}
        <button class="mi" data-act="sgLeave">Quitter le salon</button></nav>`;
  } else {
    const pads = sgPads().length;
    el.innerHTML = `<div><span class="kicker">Nouveau mode · en test</span><div class="big small">Siège du village</div></div>
      <p class="pvp-help">Défends le Cœur du village contre des vagues de monstres. Gagne des niveaux, choisis un objet après chaque vague. ${best ? `Record : vague ${best}.` : ""}</p>
      <nav class="menu-list">
        <button class="mi" data-act="sgSolo">Seul</button>
        <button class="mi" data-act="sgLocal">À deux, même écran<small>${pads >= 2 ? "deux manettes" : pads === 1 ? "clavier-souris + manette" : "branche une manette pour le joueur 2"}</small></button>
        ${pvpAccountForm()}
        <button class="mi" data-act="sgHost">Coop en ligne : créer un salon<small>2 à 4 joueurs${PVP.me ? ` · tu joues en tant que ${PVP.me.pseudo}` : " · compte en ligne nécessaire"}</small></button>
        <div class="sync-link"><input id="sgRoomInput" type="text" maxlength="11" autocomplete="off" spellcheck="false" placeholder="SIEGE-XXXX" aria-label="Code d'un salon"></div>
        <button class="mi" data-act="sgJoin">Rejoindre un salon</button>
        ${sgOptButtons()}
        <button class="mi" data-act="sgOptions">Options<small>son, commandes, affichage</small></button>
        <button class="mi" data-act="back">Retour</button>
      </nav>`;
    pvpBindInputs(el);
  }
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  // la boucle : en Siège, on fait tourner le Siège à la place du jeu de plateforme
  let lastT = 0;
  around("frame", (o, now, ...a) => {
    if (!siege || mode !== "play") return o(now, ...a);
    const dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000 || 0)); lastT = now; time += dt;
    if (screen === "play") siegeUpdate(dt);
    else {
      pollMenuPad();
      // en ligne, la partie ne s'arrête pas quand un joueur ouvre un menu (choix, attente, pause) : son héros reste immobile
      if (siege && siege.net && !siege.over) {
        if (siege.host) siegeUpdate(dt);
        else { siege.inT = (siege.inT || 0) - dt; if (siege.inT <= 0) { siege.inT = 0.25; siege.net.send("in", { pid: siege.myPid, mx: 0, my: 0, ax: 0, ay: 0, fire: false, aim: false, af: false, aa: false }); } }
      }
    }
    if (siege && siege.net && !siege.host && !siege.over && Date.now() - (siege.lastRx || Date.now()) > 20000) { siege.over = { why: "L'hôte ne répond plus.", wave: siege.wave, kills: siege.kills, level: siege.level, time: siege.time, best: siege.wave }; siege.pickDone = null; sgShowEnd(); }
    siegeDraw();
    requestAnimationFrame(frame);
  });
  // Échap : la pause du Siège
  around("openPause", (o, ...a) => {
    if (!siege) return o(...a);
    if (siege.over || siege.choice) return;
    if (!siege.net) siege.paused = true;
    sgShowPause();
  });
  around("showPanel", (o, name, ...a) => { const r = o(name, ...a); if (name === "siegeLobby") { menuRoot = "main"; } return r; });
  around("menuAction", (o, act, ...a) => {
    if (act === "siege") {
      sgLobbyState = null; showPanel("siege"); renderSiegeLobby(); menuPanel = "siege";
      if (!PVP.me && typeof CLOUD !== "undefined" && CLOUD.secret) pvpProfile().then(() => { if (!siege && !sgLobbyState && menuPanel === "siege") renderSiegeLobby(); }, () => {});
      return;
    }
    if (act === "sgSolo") { siegeStart({ players: [{ src: "auto", name: pvpPseudo || "Toi" }] }); return; }
    if (act === "sgLocal") {
      const pads = sgPads().length;
      if (!pads) { toast("Branche une manette pour le joueur 2 (le joueur 1 joue au clavier et à la souris).", 3000); return; }
      siegeStart({ players: pads >= 2 ? [{ src: "pad:0", name: "Joueur 1" }, { src: "pad:1", name: "Joueur 2" }] : [{ src: "kbm", name: "Joueur 1" }, { src: "pad:0", name: "Joueur 2" }] });
      return;
    }
    if (act === "sgHost") { sgLobby("SIEGE-" + pvpId(4), true); return; }
    if (act === "sgJoin") { const inp = document.getElementById("sgRoomInput"), v = (inp ? inp.value : "").toUpperCase().replace(/\s+/g, ""); if (!/^SIEGE-[A-Z0-9]{4}$/.test(v)) { toast("Le code ressemble à SIEGE-XXXX.", 2000); return; } sgLobby(v, false); return; }
    if (act === "sgHostStart") { sgHostStart(); return; }
    if (act === "sgLeave") { if (sgLobbyState && sgLobbyState.net) sgLobbyState.net.leave(); sgLobbyState = null; renderSiegeLobby(); return; }
    if (act === "sgAutoFire" || act === "sgAutoAim") {
      if (act === "sgAutoFire") sgOpts.autoFire = !sgAutoFire(); else sgOpts.autoAim = !sgAutoAim();
      sgSaveOpts();
      if (siege && !siege.over) sgShowPause(); else renderSiegeLobby();
      try { const b = document.querySelector(`#siegePanel [data-act="${act}"]`); if (b) b.focus({ preventScroll: true }); } catch (e) {}
      return;
    }
    if (act && act.startsWith("sgPick:") && siege && siege.pickDone) { const f = siege.pickDone; siege.pickDone = null; f(act.slice(7)); return; }
    if (act === "sgContinue") { sgContinue(); return; }
    // les Options du jeu, depuis le Siège : « Retour » ramène au Siège (pause ou menu du mode)
    if (act === "sgOptions") { sgOptFrom = { root: menuRoot }; menuRoot = "siege"; syncOptions(); showPanel("options"); return; }
    if (act === "back" && sgOptFrom && (menuPanel === "options" || menuPanel === "keys")) {
      if (menuPanel === "keys") { showPanel("options"); return; }
      menuRoot = sgOptFrom.root; sgOptFrom = null;
      showPanel("siege"); menuPanel = "siege";
      if (siege && !siege.over && !siege.choice && !siege.pickDone) sgShowPause(); else if (!siege) renderSiegeLobby();
      return;
    }
    if (act === "sgResume") { if (siege) { siege.paused = false; sgResume(); } return; }
    if (act === "sgQuit") {
      if (siege && siege.net) { try {
        if (siege.host) { if (!siege.over) siege.net.send("end", { why: "L'hôte a quitté la partie.", wave: siege.wave, kills: siege.kills, level: siege.level, time: siege.time, best: siege.wave }); }
        else siege.net.send("bye", { pid: siege.myPid || (PVP.me && PVP.me.pid) });
      } catch (e) {} }
      sgLobbyState = null; siegeStop(); return;
    }
    if (act === "sgAgain") { const ps = siege.players.map(p => ({ src: p.src, name: p.name })); siegeStop(); siegeStart({ players: ps }); return; }
    if (act === "back" && siege && screen === "siegemenu") { if (!siege.over && !siege.choice && !siege.pickDone) { siege.paused = false; sgResume(); } return; }
    return o(act, ...a);
  });
})();
