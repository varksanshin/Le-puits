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
  playerHp: 6, speed: 82, iframes: 1.0, revive: 2.5,
  xpBase: 6, xpGrow: 5,                              // expérience du niveau n : xpBase + xpGrow × n
  sendHz: 15, inHz: 20,
};
const SG_ENEMIES = {
  crawler:   { hp: 12, spd: 30, r: 6, dmg: 1, heart: 2, xp: 1, sprite: "crawler", from: 1 },
  bat:       { hp: 8, spd: 58, r: 5, dmg: 1, heart: 1, xp: 1, sprite: "bat", fly: true, from: 2 },
  squelette: { hp: 26, spd: 24, r: 6, dmg: 1, heart: 2, xp: 2, sprite: "squelette", ranged: true, from: 3 },
  golem:     { hp: 110, spd: 17, r: 10, dmg: 2, heart: 8, xp: 6, sprite: "golem", from: 4 },
  wisp:      { hp: 8, spd: 46, r: 5, dmg: 2, heart: 4, xp: 1, sprite: "wisp", fly: true, explode: true, from: 6 },
  rodeur:    { hp: 36, spd: 34, r: 7, dmg: 1, heart: 3, xp: 3, sprite: "rodeur", lunge: true, from: 7 },
  belier:    { hp: 520, spd: 15, r: 14, dmg: 2, heart: 25, xp: 40, sprite: "golem", boss: true, scale: 1.8, from: 99 },
};
// Améliorations de niveau (sans objet) et objets entre les vagues (les objets du puits, adaptés)
const SG_UPGRADES = [
  { id: "force",   name: "Force",            desc: "+15 % de dégâts.",                      max: 6, apply: s => { s.dmg *= 1.15; } },
  { id: "cadence", name: "Cadence",          desc: "Tu attaques 12 % plus vite.",           max: 6, apply: s => { s.rate *= 1.12; } },
  { id: "bottes",  name: "Bottes de course", desc: "+10 % de vitesse.",                     max: 4, apply: s => { s.speed *= 1.1; } },
  { id: "ampleur", name: "Ampleur",          desc: "Coups et zones 15 % plus grands.",      max: 5, apply: s => { s.area *= 1.15; } },
  { id: "aimant",  name: "Aimant",           desc: "Tu attires l'expérience de plus loin.", max: 3, apply: s => { s.magnet *= 1.5; } },
  { id: "vigueur", name: "Vigueur",          desc: "+1 PV max, et tu te soignes de 1.",     max: 5, apply: (s, p) => { s.maxHp += 1; p.hp = Math.min(p.hp + 1, s.maxHp); } },
  { id: "tir",     name: "Tir magique",      desc: "Ton tir magique : plus fort, plus rapide, plus de projectiles.", max: 5, apply: s => { s.bolt += 1; } },
  { id: "remparts",name: "Remparts",         desc: "Le Cœur du village : +20 PV max, réparé de 20.", max: 99, team: true, apply: () => { siege.heart.max += 20; siege.heart.hp = Math.min(siege.heart.max, siege.heart.hp + 20); } },
  { id: "reparer", name: "Réparer le village", desc: "Le Cœur regagne 35 PV.",             max: 99, team: true, apply: () => { siege.heart.hp = Math.min(siege.heart.max, siege.heart.hp + 35); } },
];
const SG_ITEMS = {
  spectrale: s => { s.orbit += 1; },              lamebraise: s => { s.burn = true; },        venin: s => { s.poison = true; },
  foudre: s => { s.lightning += 1; },             boomerang: s => { s.boomer += 1; },        etoiles: s => { s.stars += 1; },
  braise: s => { s.aura += 1; },                  grimoire: s => { s.multi += 2; s.dmg *= 0.85; }, chouette: s => { s.homing = true; },
  percant: s => { s.pierce += 2; },               ricochet: s => { s.bounce += 2; },         orbe: s => { s.size *= 1.5; s.dmg *= 1.25; },
  bourreau: s => { s.crit += 0.15; },             sangsue: s => { s.leech += 0.04; },        pilon: s => { s.knock *= 2; },
  aiguise: s => { s.dmg *= 1.3; },                frenesie: s => { s.rate *= 1.35; },        allonge: s => { s.area *= 1.4; },
  pierre: s => { s.maxHp += 2; },                 eperons: s => { s.speed *= 1.15; },        echo: s => { s.echo = true; },
  lune: s => { s.moon = true; },                  pacte: s => { s.dmg *= 2; s.maxHp -= 2; }, armure: s => { s.maxHp += 3; s.speed *= 0.9; },
  revers: s => { s.backstab = true; },            gantelet: s => { s.shards += 1; },
};
const SG_ITEM_DESC = {
  spectrale: "Des lames fantômes tournent autour de toi.", lamebraise: "Tout ce que tu touches brûle.", venin: "Tout ce que tu touches est empoisonné.",
  foudre: "La foudre frappe les ennemis proches.", boomerang: "Tu lances des os qui reviennent.", etoiles: "Des étoiles tombent sur les ennemis.",
  braise: "Une aura de feu brûle ce qui t'approche.", grimoire: "+2 projectiles par tir.", chouette: "Tes projectiles cherchent les ennemis.",
  percant: "Tes projectiles traversent 2 ennemis de plus.", ricochet: "Tes projectiles rebondissent sur les murs.", orbe: "Projectiles énormes et plus forts.",
  bourreau: "15 % de coups critiques (triple dégâts).", sangsue: "Chaque coup peut te soigner.", pilon: "Tu repousses fort.",
  aiguise: "+30 % de dégâts.", frenesie: "Tu attaques 35 % plus vite.", allonge: "Ton épée porte 40 % plus loin.",
  pierre: "+2 PV max.", eperons: "+15 % de vitesse.", echo: "Chaque coup d'épée se répète.", lune: "Un ennemi vaincu libère quatre éclats.",
  pacte: "Dégâts doublés, 2 PV max en moins.", armure: "+3 PV max, un peu plus lent.", revers: "Ton épée frappe aussi derrière toi.", gantelet: "Tes coups d'épée projettent des éclats.",
};
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
  return { dmg: 1, rate: 1, speed: 1, area: 1, magnet: 1, maxHp: SG.playerHp, bolt: 1, multi: 0, pierce: 0, bounce: 0, size: 1, homing: false,
    burn: false, poison: false, crit: 0, leech: 0, knock: 1, orbit: 0, aura: 0, lightning: 0, boomer: 0, stars: 0, echo: false, moon: false, backstab: false, shards: 0 };
}
function sgMakePlayer(i, src, name, pid) {
  const h = siege.map.heart, a = (i / 4) * Math.PI * 2 + 0.6;
  const p = { i, src, name: name || `Joueur ${i + 1}`, pid: pid || "local-" + i, x: h.x + Math.cos(a) * 34, y: h.y + Math.sin(a) * 30, r: 5,
    face: 1, aim: 0, hp: SG.playerHp, iv: 0, down: false, reviveT: 0, upg: {}, items: [], cd: { sword: 0.3, bolt: 1, boomer: 1.5, light: 2, stars: 2.5, aura: 0.5 },
    orbitA: 0, swing: 0, swingA: 0, kills: 0, input: { mx: 0, my: 0, ax: 0, ay: 0, fire: false, aim: false }, anim: 0 };
  p.s = sgBaseStats();
  return p;
}
function sgRecompute(p) {
  const s = sgBaseStats();
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
    wave: 0, phase: "prep", phaseT: SG.firstWave, toSpawn: 0, spawnT: 0, enemies: [], shots: [], foeShots: [], gems: [], fx: [], nums: [],
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
  document.body.classList.remove("siege-on");
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
    if (performance.now() - sgMouse.seen < 4000) {
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
  if (S_.paused || S_.choice) return;
  S_.time += dt;
  for (const p of S_.local) if (p.src !== "bot") p.input = sgReadInput(p);
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
  const boss = S_.wave % 5 === 0;
  S_.toSpawn = Math.round(6 + S_.wave * 4.5 + (S_.players.length - 1) * (3 + S_.wave * 2));
  S_.spawnT = 0.5; S_.bossLeft = boss ? 1 : 0;
  toast(boss ? `<b>Vague ${S_.wave}</b> · un Bélier approche des portes !` : `<b>Vague ${S_.wave}</b>`, 2400, true);
  if (typeof SFX !== "undefined") SFX.play(boss ? "bossEnter" : "warn");
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
function sgSpawn() {
  const S_ = siege, m = S_.map, h = m.heart, w = S_.wave;
  let type;
  if (S_.bossLeft > 0 && S_.toSpawn <= 1 + S_.players.length) { type = "belier"; S_.bossLeft--; }
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
  const mult = (1 + 0.16 * (w - 1)) * (1 + 0.35 * (S_.players.length - 1));
  const e = { id: S_.nextId++, type, x, y, r: d.r * (d.scale || 1), hp: d.hp * mult, max: d.hp * mult, spd: d.spd * (1 + Math.min(0.5, w * 0.02)) * (0.9 + S_.rand() * 0.2),
    cd: 0, flash: 0, burn: 0, poison: 0, stuck: 0, lx: x, ly: y, t: S_.rand() * 6, kb: { x: 0, y: 0 }, hit: {} };
  S_.enemies.push(e); S_.toSpawn--;
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
    // la cible : le joueur le plus proche s'il est tout près, sinon le Cœur (en passant par une porte)
    // (seulement un joueur du même côté de la palissade, sinon il resterait collé au mur ; et s'il bute trop longtemps, il lâche l'affaire)
    let tx = h.x, ty = h.y, target = null, bd = d.boss || e.ignoreT > 0 ? 0 : 75;
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
    let sp = e.spd * want * (e.lungeT > 0 ? 4 : 1) * (e.slow > 0 ? 0.5 : 1);
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
  if (p && p.s.moon) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; S_.shots.push(sgShot(p, e.x, e.y, Math.cos(a), Math.sin(a), { kind: "moon", dmg: 6, spd: 170, t: 0.5, r: 2.5, pierce: 0, noMods: true })); }
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
  const sp = SG.speed * s.speed;
  p.kbx = (p.kbx || 0) * Math.pow(0.01, dt); p.kby = (p.kby || 0) * Math.pow(0.01, dt);
  sgMove(S_.map, p, (I.mx * sp + p.kbx) * dt, (I.my * sp + p.kby) * dt, false);
  if (Math.abs(I.mx) > 0.1) p.face = Math.sign(I.mx);
  p.anim += Math.hypot(I.mx, I.my) * dt * 8;
  // la visée
  const auto = (p.src === "net" ? p.autoAim : sgAutoAim()) || !I.aim;
  let target = null;
  if (auto) { target = sgNearest(p, 170); if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x); else if (Math.hypot(I.mx, I.my) > 0.2) p.aim = Math.atan2(I.my, I.mx); }
  else p.aim = Math.atan2(I.ay, I.ax);
  if (Math.abs(Math.cos(p.aim)) > 0.2) p.face = Math.sign(Math.cos(p.aim));
  const fire = (p.src === "net" ? p.autoFire : sgAutoFire()) ? !!(target || sgNearest(p, 150)) : I.fire;
  const ux = Math.cos(p.aim), uy = Math.sin(p.aim);
  for (const k in p.cd) p.cd[k] -= dt * s.rate;
  // l'épée : un arc devant soi
  if (fire && p.cd.sword <= 0) {
    p.cd.sword = 0.62; p.swing = 0.16; p.swingA = p.aim;
    sgSlash(p, p.aim);
    if (s.backstab) sgSlash(p, p.aim + Math.PI);
    if (s.echo) p.echoT = 0.18;
    for (let k = 0; k < s.shards * 3; k++) { const a = p.aim + (k - (s.shards * 3 - 1) / 2) * 0.25; S_.shots.push(sgShot(p, p.x, p.y, Math.cos(a), Math.sin(a), { kind: "shard", dmg: 4, spd: 180, t: 0.45, r: 2 })); }
    if (typeof SFX !== "undefined" && p.src !== "net") SFX.play("swing");
  }
  if (p.echoT > 0) { p.echoT -= dt; if (p.echoT <= 0) sgSlash(p, p.swingA, 0.5); }
  p.swing = Math.max(0, p.swing - dt);
  // le tir magique (amélioration « Tir magique », ou Grimoire)
  const bolts = s.bolt;
  if (bolts > 0 && p.cd.bolt <= 0 && (fire || sgNearest(p, 160))) {
    p.cd.bolt = 1.2 / (1 + 0.15 * (bolts - 1));
    const n = 1 + s.multi + Math.floor((bolts - 1) / 2);
    for (let k = 0; k < n; k++) { const a = p.aim + (k - (n - 1) / 2) * 0.18; S_.shots.push(sgShot(p, p.x, p.y, Math.cos(a), Math.sin(a), { dmg: 8 + 2 * bolts, spd: 230, t: 1.2, pierce: 0 })); }
    if (typeof SFX !== "undefined" && p.src !== "net") SFX.play("bolt");
  }
  // le boomerang
  if (s.boomer > 0 && p.cd.boomer <= 0) {
    p.cd.boomer = 1.8;
    for (let k = 0; k < s.boomer + Math.floor(s.multi / 2); k++) { const a = p.aim + (k - (s.boomer - 1) / 2) * 0.4; S_.shots.push(sgShot(p, p.x, p.y, Math.cos(a), Math.sin(a), { kind: "boomer", dmg: 9, spd: 190, t: 1.6, r: 4, pierce: 99, back: true })); }
  }
  // la foudre
  if (s.lightning > 0 && p.cd.light <= 0) {
    const t0 = sgNearest(p, 190);
    if (t0) {
      p.cd.light = 2.2 / (1 + 0.2 * (s.lightning - 1));
      let cur = t0; const done = new Set();
      for (let k = 0; k < 2 + s.lightning && cur; k++) {
        done.add(cur); sgDamage(cur, 10 * s.dmg, p); S_.fx.push({ kind: "bolt", x: cur.x, y: cur.y, t: 0.18 });
        let nx = null, nd = 70; for (const e of S_.enemies) if (!done.has(e)) { const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < nd) { nd = d; nx = e; } }
        cur = nx;
      }
    }
  }
  // pluie d'étoiles
  if (s.stars > 0 && p.cd.stars <= 0) {
    p.cd.stars = 2.6;
    const near = S_.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 200);
    for (let k = 0; k < 2 + s.stars && near.length; k++) { const e = near[Math.floor(S_.rand() * near.length)]; S_.fx.push({ kind: "star", x: e.x, y: e.y, t: 0.35 }); sgDamage(e, 12 * s.dmg, p); }
  }
  // aura de feu
  if (s.aura > 0 && p.cd.aura <= 0) {
    p.cd.aura = 0.5;
    const R = (26 + 6 * s.aura) * s.area;
    for (const e of S_.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < R + e.r) { sgDamage(e, (2 + s.aura) * s.dmg, p, true); e.burn = Math.max(e.burn, 1.5); }
  }
  // lames qui tournent
  if (s.orbit > 0) {
    p.orbitA += dt * 3.2;
    const n = s.orbit + Math.floor(s.multi / 2), R = 26 * s.area;
    p.orbs = [];
    for (let k = 0; k < n; k++) {
      const a = p.orbitA + k * Math.PI * 2 / n, ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
      p.orbs.push([ox, oy]);
      for (const e of S_.enemies) if (Math.hypot(e.x - ox, e.y - oy) < 5 * s.size + e.r && !(e.hit["o" + p.i] > S_.time)) { e.hit["o" + p.i] = S_.time + 0.45; sgDamage(e, 7 * s.dmg, p); }
    }
  } else p.orbs = null;
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
  S_.cam.x += (cx - VW / 2 - S_.cam.x) * Math.min(1, dt * 6); S_.cam.y += (cy - VH / 2 - S_.cam.y) * Math.min(1, dt * 6);
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
function sgOptionsFor(p, kind) {
  const S_ = siege, r = S_.rand;
  if (kind === "item") {
    const pool = Object.keys(SG_ITEMS).filter(id => ITEM[id] && !p.items.includes(id));
    const out = []; while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out.map(id => ({ id: "item:" + id, item: id, name: ITEM[id].name, desc: SG_ITEM_DESC[id] }));
  }
  const pool = SG_UPGRADES.filter(u => (p.upg[u.id] || 0) < u.max);
  const out = []; while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out.map(u => ({ id: "upg:" + u.id, name: u.name + (p.upg[u.id] ? ` ${p.upg[u.id] + 1}` : ""), desc: u.desc }));
}
function sgApply(p, opt) {
  if (opt.startsWith("item:")) { p.items.push(opt.slice(5)); }
  else { const u = SG_UPGRADES.find(x => x.id === opt.slice(4)); if (!u) return; if (u.team) u.apply(p.s, p); else p.upg[u.id] = (p.upg[u.id] || 0) + 1; }
  const before = p.s.maxHp; sgRecompute(p); if (p.s.maxHp > before) p.hp += p.s.maxHp - before;
}
// chaque joueur choisit : les joueurs locaux l'un après l'autre, les joueurs en ligne en même temps
function sgOfferChoice(kind) {
  const S_ = siege;
  S_.choice = { kind, queue: S_.players.filter(p => p.src !== "net" && !(kind === "item" && p.down)).map(p => p.i), remote: {}, t: 25 };
  for (const p of S_.players) if (p.src === "net") { const opts = sgOptionsFor(p, kind); S_.choice.remote[p.pid] = opts; S_.net && S_.net.send("offer", { to: p.pid, kind, opts, level: S_.level, wave: S_.wave }); }
  sgNextLocalChoice();
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
function sgRemotePick(pid, opt) {
  const S_ = siege, c = S_.choice; if (!c || !c.remote[pid]) return;
  const p = S_.players.find(q => q.pid === pid); if (!p) return;
  if (c.remote[pid].some(o => o.id === opt)) sgApply(p, opt);
  delete c.remote[pid];
  if (!c.queue.length && !Object.keys(c.remote).length) { S_.choice = null; sgResume(); }
}
function sgResume() { menuEl.hidden = true; screen = "play"; document.body.classList.remove("pvp-drafting"); try { cv.focus({ preventScroll: true }); } catch (e) {} }
function sgCards(opts) {
  return `<nav class="pvp-cards">${opts.map(o => `<button class="mi pvp-card" data-act="sgPick:${o.id}">${o.item ? `<canvas class="pvp-ic" width="8" height="10" data-icon="${o.item}"></canvas><span class="pvp-card-f">Objet</span>` : `<span class="sg-up">${o.name[0]}</span><span class="pvp-card-f">Amélioration</span>`}<span class="pvp-card-n">${o.name}</span><small>${o.desc}</small></button>`).join("")}</nav>`;
}
function sgShowChoice(p, kind, opts, done) {
  const el = document.getElementById("siegePanel");
  siege.pickDone = done; siege.pickOpts = opts;
  screen = "siegemenu"; menuRoot = "siege"; document.body.classList.add("pvp-drafting");
  const who = siege.players.length > 1 ? `<span class="sg-who" style="color:${SG_COLORS[p.i]}">${p.name}</span> · ` : "";
  el.innerHTML = `<div><span class="kicker">${who}${kind === "item" ? `Vague ${siege.wave} repoussée` : `Niveau ${siege.level}`}</span><div class="big small">${kind === "item" ? "Choisis un objet" : "Choisis une amélioration"}</div></div>
    ${sgCards(opts)}<p class="pvp-help">${p.items.length ? "Tes objets : " + p.items.map(id => ITEM[id].name).join(", ") : ""}</p>`;
  showPanel("siege");
  for (const c of el.querySelectorAll("canvas[data-icon]")) { const src = itemIconCanvas(c.dataset.icon), x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0); }
  const b = el.querySelector(".pvp-card"); if (b) b.focus({ preventScroll: true });
}
function sgShowWait() {
  const el = document.getElementById("siegePanel");
  screen = "siegemenu"; menuRoot = "siege";
  el.innerHTML = `<div><span class="kicker">Siège</span><div class="big small">On attend tes alliés…</div></div><p class="pvp-help">Ils choisissent leur ${siege.choice.kind === "item" ? "objet" : "amélioration"}.</p>`;
  showPanel("siege");
}
function sgShowEnd() {
  const o = siege.over, el = document.getElementById("siegePanel");
  screen = "siegemenu"; menuRoot = "siege"; document.body.classList.remove("pvp-drafting");
  el.innerHTML = `<div><span class="kicker">Siège du village</span><div class="big small">${o.why}</div></div>
    <div class="pvp-result lose"><b>Vague ${o.wave}</b><span>${o.kills} monstres vaincus · niveau ${o.level} · ${fmtTime(o.time)}</span><span>Record : vague ${o.best}</span></div>
    <nav class="menu-list">${siege.net ? "" : `<button class="mi" data-act="sgAgain">Rejouer</button>`}<button class="mi" data-act="sgQuit">Retour au menu</button></nav>`;
  showPanel("siege");
}

// ===== Dessin =====
function siegeDraw() {
  const S_ = siege; if (!S_) return;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  const m = S_.map, ox = Math.round(S_.cam.x * S) / S, oy = Math.round(S_.cam.y * S) / S;
  ctx.fillStyle = "#2c3a22"; ctx.fillRect(0, 0, VW, VH);
  const c0 = Math.max(0, Math.floor(ox / T)), c1 = Math.min(m.W - 1, Math.floor((ox + VW) / T)), r0 = Math.max(0, Math.floor(oy / T)), r1 = Math.min(m.H - 1, Math.floor((oy + VH) / T));
  const h = m.heart;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const x = c * T - ox, y = r * T - oy, t = m.g[r][c], n = (c * 7 + r * 13) % 5;
    const inside = Math.hypot(c + 0.5 - m.W / 2, (r + 0.5 - m.H / 2) * 1.15) < SG.ringR;
    ctx.fillStyle = inside ? (n ? "#6b5a3e" : "#615136") : (n ? "#34452a" : "#2f3f26"); ctx.fillRect(x, y, T, T);
    if (!inside && n === 0) { ctx.fillStyle = "#4a6338"; ctx.fillRect(x + 4, y + 6, 1.34, 2); ctx.fillRect(x + 10, y + 3, 1.34, 2); }
    if (t === "W") { ctx.fillStyle = "#3a2414"; ctx.fillRect(x + 1, y, T - 2, T); ctx.fillStyle = "#8a5a30"; ctx.fillRect(x + 2, y - 3, 3, T); ctx.fillRect(x + 7, y - 4, 3, T + 1); ctx.fillRect(x + 12, y - 3, 3, T); ctx.fillStyle = "#c08a50"; ctx.fillRect(x + 2, y - 3, 3, 1.34); ctx.fillRect(x + 7, y - 4, 3, 1.34); ctx.fillRect(x + 12, y - 3, 3, 1.34); }
    if (t === "#") { ctx.fillStyle = "#1c2416"; ctx.fillRect(x, y, T, T); }
    if (t === "R") { ctx.fillStyle = "#4a4652"; ctx.fillRect(x + 2, y + 4, 12, 10); ctx.fillStyle = "#6a6672"; ctx.fillRect(x + 3, y + 4, 10, 3); }
    if (t === "T") { ctx.fillStyle = "#3a2414"; ctx.fillRect(x + 7, y + 9, 3, 6); ctx.fillStyle = "#24361c"; ctx.fillRect(x + 1, y - 2, 14, 12); ctx.fillStyle = "#3a5a2a"; ctx.fillRect(x + 3, y - 3, 10, 9); ctx.fillStyle = "#4f7a3a"; ctx.fillRect(x + 5, y - 2, 4, 3); }
  }
  for (const hs of m.houses) {
    const x = hs.c * T - ox, y = hs.r * T - oy, w = hs.w * T, hh = hs.h * T;
    ctx.fillStyle = "#3a2a1e"; ctx.fillRect(x, y + 4, w, hh - 4);
    ctx.fillStyle = "#8a6a48"; ctx.fillRect(x + 1, y + hh * 0.45, w - 2, hh * 0.55 - 1);
    ctx.fillStyle = "#7a2e24"; ctx.fillRect(x - 2, y - 2, w + 4, hh * 0.5);
    ctx.fillStyle = "#a8433a"; ctx.fillRect(x - 2, y - 2, w + 4, 3);
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x + w / 2 - 2, y + hh - 7, 4, 6);
  }
  // le Cœur du village : une grande flamme sur un autel
  const hx = h.x - ox, hy = h.y - oy, k = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.fillStyle = "rgba(242,180,80,0.18)"; ctx.beginPath(); ctx.arc(hx, hy, 22 + k * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4a4652"; ctx.fillRect(hx - 9, hy - 2, 18, 9); ctx.fillStyle = "#6a6672"; ctx.fillRect(hx - 9, hy - 2, 18, 2);
  ctx.fillStyle = S_.heart.hitT > 0 ? "#ffffff" : "#e8913a"; ctx.fillRect(hx - 5, hy - 12 - k * 2, 10, 11 + k * 2);
  ctx.fillStyle = "#f2d45a"; ctx.fillRect(hx - 3, hy - 9 - k * 2, 6, 8 + k * 2); ctx.fillStyle = "#fff3b8"; ctx.fillRect(hx - 1, hy - 6, 2, 5);
  // l'expérience
  for (const g of S_.gems) { const x = g.x - ox, y = g.y - oy - Math.abs(Math.sin(g.t * 4)); ctx.fillStyle = g.v >= 5 ? "#c88aff" : "#7fd6c0"; ctx.fillRect(x - 1.5, y - 2, 3, 4); ctx.fillRect(x - 2, y - 1, 4, 2); }
  // monstres et joueurs, triés de haut en bas
  const list = [...S_.enemies.map(e => ({ y: e.y, e })), ...S_.players.map(p => ({ y: p.y, p }))].sort((a, b) => a.y - b.y);
  for (const o of list) o.e ? sgDrawEnemy(o.e, ox, oy) : sgDrawPlayer(o.p, ox, oy);
  // tirs
  for (const q of S_.shots) {
    const x = q.x - ox, y = q.y - oy, col = SG_COLORS[q.owner] || "#7fc8d6";
    if (q.kind === "boomer") { ctx.save(); ctx.translate(x, y); ctx.rotate(q.age * 14); ctx.fillStyle = "#e6dcc8"; ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8); ctx.restore(); }
    else { ctx.fillStyle = q.kind === "moon" ? "#eaf3ff" : q.kind === "shard" ? "#c9c2b4" : q.kind === "ember" || q.owner === -1 ? "#f2b54a" : col; ctx.fillRect(x - q.r, y - q.r, q.r * 2, q.r * 2); ctx.fillStyle = "#fff"; ctx.fillRect(x - q.r / 3, y - q.r / 3, q.r / 1.5, q.r / 1.5); }
  }
  for (const q of S_.foeShots) { ctx.fillStyle = "#e6dcc8"; ctx.fillRect(q.x - ox - 2, q.y - oy - 2, 4, 4); }
  // effets
  for (const f of S_.fx) {
    const x = f.x - ox, y = f.y - oy;
    if (f.kind === "slash") { ctx.strokeStyle = f.c; ctx.globalAlpha = Math.min(1, f.t / 0.1); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, f.r * 0.85, f.a - 1.1, f.a + 1.1); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1; }
    else if (f.kind === "ring") { ctx.strokeStyle = f.c; ctx.globalAlpha = f.t / 0.3; ctx.beginPath(); ctx.arc(x, y, (f.r || 14) * (1.2 - f.t), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.kind === "puff") { ctx.fillStyle = f.c; ctx.globalAlpha = f.t / 0.3; for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.fillRect(x + Math.cos(a) * (0.3 - f.t) * 40, y + Math.sin(a) * (0.3 - f.t) * 40, 2, 2); } ctx.globalAlpha = 1; }
    else if (f.kind === "bolt") { ctx.fillStyle = "#fff3b8"; ctx.fillRect(x - 1, y - 40, 2, 40); ctx.fillStyle = "rgba(242,212,90,0.5)"; ctx.fillRect(x - 3, y - 40, 6, 40); }
    else if (f.kind === "star") { ctx.fillStyle = "#f2d45a"; ctx.fillRect(x - 1, y - 30 * f.t / 0.35 - 2, 2, 6); ctx.fillRect(x - 3, y - 30 * f.t / 0.35, 6, 2); }
  }
  for (const n of S_.nums) { ctx.globalAlpha = Math.min(1, n.t * 3); drawTinyText(n.x - ox, n.y - oy, String(n.v), n.c); }
  ctx.globalAlpha = 1;
  // la nuit tombe doucement sur les bords
  const gr = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VW * 0.65);
  gr.addColorStop(0, "rgba(10,8,20,0)"); gr.addColorStop(1, "rgba(10,8,20,0.55)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  sgDrawHud();
}
function sgDrawEnemy(e, ox, oy) {
  const d = SG_ENEMIES[e.type], sc = d.scale || 1, x = e.x - ox, y = e.y - oy;
  if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) return;
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x - e.r, y + e.r * 0.6, e.r * 2, 2);
  const step = Math.floor(e.t * 6) % 2;
  const name = d.sprite === "golem" ? "golem0" : d.sprite === "wisp" || d.sprite === "bat" || d.sprite === "rodeur" || d.sprite === "squelette" || d.sprite === "crawler" ? d.sprite + step : d.sprite + "0";
  if (!SPRITES[name]) { ctx.fillStyle = "#c4413b"; ctx.fillRect(x - e.r, y - e.r, e.r * 2, e.r * 2); return; }
  const w = spriteW(name), h = spriteH(name), flip = siege.map.heart.x < e.x;
  ctx.save(); ctx.translate(x, y + e.r * 0.6); ctx.scale(sc, sc);
  drawSprite(name, -w / 2, -h, flip, e.flash > 0);
  ctx.restore();
  if (d.boss || e.hp < e.max) { ctx.fillStyle = "rgba(10,8,14,0.7)"; ctx.fillRect(x - 8, y - h * sc - 2, 16, 2); ctx.fillStyle = d.boss ? "#c4413b" : "#e9e1cf"; ctx.fillRect(x - 8, y - h * sc - 2, 16 * Math.max(0, e.hp / e.max), 2); }
  if (e.burn > 0 && Math.random() < 0.3) { ctx.fillStyle = "#f2b54a"; ctx.fillRect(x + (Math.random() - 0.5) * 8, y - 6, 1.34, 1.34); }
  if (e.poison > 0 && Math.random() < 0.3) { ctx.fillStyle = "#9cbf6a"; ctx.fillRect(x + (Math.random() - 0.5) * 8, y - 2, 1.34, 1.34); }
}
function sgDrawPlayer(p, ox, oy) {
  const x = p.x - ox, y = p.y - oy, col = SG_COLORS[p.i];
  ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(x, y + 5, 6, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  if (p.down) {
    ctx.save(); ctx.translate(x, y + 4); ctx.rotate(Math.PI / 2); drawSprite("hero_idle0", -6, -14, false, false); ctx.restore();
    if (p.reviveT > 0) { ctx.fillStyle = "#7fd6a0"; ctx.fillRect(x - 8, y - 12, 16 * p.reviveT / SG.revive, 2); }
    drawTinyText(x, y - 20, "A TERRE", "#c4413b"); return;
  }
  if (p.iv > 0 && Math.floor(time * 20) % 2) return;
  const moving = Math.hypot(p.input.mx || 0, p.input.my || 0) > 0.2;
  const f = moving ? ["hero_run0", "hero_run1", "hero_run2", "hero_run1"][Math.floor(p.anim) % 4] : "hero_idle0";
  drawSprite(f, x - 6, y - 13, p.face < 0, false);
  // l'arme pointe vers la visée
  const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
  ctx.fillStyle = "#e9e1cf"; for (let k = 4; k < 11; k += 1.5) ctx.fillRect(x + ax * k - 0.67, y - 5 + ay * k - 0.67, 1.34, 1.34);
  if (p.orbs) for (const [bx, by] of p.orbs) { ctx.fillStyle = "rgba(190,215,255,0.9)"; ctx.fillRect(bx - ox - 2 * p.s.size, by - oy - 2 * p.s.size, 4 * p.s.size, 4 * p.s.size); }
  if (p.s.aura > 0) { ctx.strokeStyle = "rgba(242,150,60,0.35)"; ctx.beginPath(); ctx.arc(x, y, (26 + 6 * p.s.aura) * p.s.area, 0, Math.PI * 2); ctx.stroke(); }
  if (siege.players.length > 1) drawTinyText(x, y - 22, p.name.slice(0, 10).toUpperCase(), col);
}
function sgDrawHud() {
  const S_ = siege;
  // le Cœur du village
  ctx.fillStyle = "rgba(10,8,14,0.75)"; ctx.fillRect(VW / 2 - 61, 4, 122, 9);
  ctx.fillStyle = "#3a2a2a"; ctx.fillRect(VW / 2 - 60, 5, 120, 7);
  ctx.fillStyle = S_.heart.hp / S_.heart.max < 0.3 ? "#e0453c" : "#e8913a"; ctx.fillRect(VW / 2 - 60, 5, 120 * Math.max(0, S_.heart.hp / S_.heart.max), 7);
  drawTinyText(VW / 2, 15, `COEUR DU VILLAGE ${Math.max(0, Math.ceil(S_.heart.hp))}`, "#f6efe0");
  // vague
  const wtxt = S_.phase === "prep" ? (S_.wave ? `REPIT ${Math.ceil(S_.phaseT)}` : `VAGUE 1 DANS ${Math.ceil(S_.phaseT)}`) : `VAGUE ${S_.wave}  ${S_.enemies.length + S_.toSpawn}`;
  drawTinyText(VW - 4 - wtxt.length * 2, 5, wtxt, "#f2d45a");
  // niveau et expérience
  const need = SG.xpBase + SG.xpGrow * S_.level;
  ctx.fillStyle = "rgba(10,8,14,0.7)"; ctx.fillRect(0, VH - 4, VW, 4);
  ctx.fillStyle = "#7fd6c0"; ctx.fillRect(0, VH - 3, VW * Math.min(1, S_.xp / need), 2);
  drawTinyText(16, VH - 12, `NIV ${S_.level}`, "#7fd6c0");
  // les PV de chaque joueur
  S_.players.forEach((p, k) => {
    const x = 4, y = 4 + k * 10;
    for (let i = 0; i < p.s.maxHp; i++) { ctx.fillStyle = i < p.hp ? SG_COLORS[p.i] : "rgba(233,225,207,0.2)"; ctx.fillRect(x + i * 5, y, 4, 4); }
    if (S_.players.length > 1) drawTinyText(x + p.s.maxHp * 5 + 4 + p.name.slice(0, 8).length * 2, y - 0.5, p.name.slice(0, 8).toUpperCase(), SG_COLORS[p.i]);
  });
  // objets du premier joueur local
  const me = S_.players.find(p => p.src !== "net") || S_.players[0];
  me.items.forEach((id, k) => { if (ITEM[id]) drawItemIcon(id, VW - 12 - k * 11, VH - 18); });
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
    pl: S_.players.map(p => [p.pid, r1(p.x), r1(p.y), p.hp, p.s.maxHp, p.face, p.down ? 1 : 0, r1(p.aim), p.iv > 0 ? 1 : 0, p.items, p.orbs ? p.orbs.map(o => [r1(o[0]), r1(o[1])]) : 0, p.s.aura, r1(p.reviveT), Math.round(Math.hypot(p.input.mx, p.input.my) * 10)]),
    en: S_.enemies.slice(0, 160).map(e => [e.id, e.type, r1(e.x), r1(e.y), Math.round(100 * e.hp / e.max), e.flash > 0 ? 1 : 0]),
    sh: S_.shots.slice(0, 120).map(q => [q.owner, q.kind === "boomer" ? 1 : q.kind === "moon" ? 2 : 0, r1(q.x), r1(q.y), r1(q.r)]),
    fs: S_.foeShots.map(q => [r1(q.x), r1(q.y)]),
    gm: S_.gems.slice(0, 80).map(g => [r1(g.x), r1(g.y), g.v]),
    fx: S_.fx.filter(f => f.t > 0.08 && !f.sent).map(f => { f.sent = true; return [f.kind, r1(f.x), r1(f.y), r1(f.a || 0), r1(f.r || 0), f.c || ""]; }),
  });
}
function sgGuestUpdate(dt) {
  const S_ = siege, me = S_.players.find(p => p.pid === S_.myPid);
  if (me) {
    me.input = sgReadInput({ ...me, src: "auto" });
    // l'aide à la visée et le tir auto se règlent chez l'invité : on les envoie avec les commandes
    S_.inT = (S_.inT || 0) - dt;
    if (S_.inT <= 0) { S_.inT = 1 / SG.inHz; const I = me.input; S_.net.send("in", { pid: S_.myPid, mx: I.mx, my: I.my, ax: I.ax, ay: I.ay, fire: I.fire, aim: I.aim, af: sgAutoFire(), aa: sgAutoAim() }); }
  }
  // positions lissées vers le dernier état reçu
  const k = Math.min(1, dt * 14);
  for (const p of S_.players) if (p.tx != null) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
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
    if (p.tx == null) { p.x = a[1]; p.y = a[2]; }
    p.tx = a[1]; p.ty = a[2]; p.hp = a[3]; p.s.maxHp = a[4]; p.face = a[5]; p.down = !!a[6]; p.aim = a[7]; p.iv = a[8] ? 0.1 : 0; p.items = a[9] || [];
    p.orbs = a[10] || null; p.s.aura = a[11]; p.reviveT = a[12]; p.input = { mx: a[13] / 10, my: 0 }; p.anim += a[13] / 10 * 0.13;
  }
  const seen = new Map(S_.enemies.map(e => [e.id, e]));
  S_.enemies = m.en.map(a => { let e = seen.get(a[0]); if (!e) e = { id: a[0], type: a[1], x: a[2], y: a[3], t: Math.random() * 6, r: SG_ENEMIES[a[1]].r * (SG_ENEMIES[a[1]].scale || 1) }; e.tx = a[2]; e.ty = a[3]; e.hp = a[4]; e.max = 100; e.flash = a[5] ? 0.1 : 0; return e; });
  S_.shots = m.sh.map(a => ({ owner: a[0], kind: a[1] === 1 ? "boomer" : a[1] === 2 ? "moon" : "bolt", x: a[2], y: a[3], r: a[4], age: time }));
  S_.foeShots = m.fs.map(a => ({ x: a[0], y: a[1] }));
  S_.gems = m.gm.map(a => ({ x: a[0], y: a[1], v: a[2], t: 0 }));
  for (const f of m.fx) S_.fx.push({ kind: f[0], x: f[1], y: f[2], a: f[3], r: f[4], c: f[5], t: f[0] === "slash" ? 0.14 : 0.3 });
}
// Le salon : l'hôte crée, les autres rejoignent avec le code, l'hôte lance
async function sgLobby(code, asHost) {
  if (!PVP.me && !pvpPseudo) { toast("Choisis d'abord un pseudo dans « Duel en ligne ».", 2600); return; }
  await cloudEnsure().catch(() => {});
  const me = PVP.me || { pid: "g-" + pvpId(8), pseudo: pvpPseudo || "Joueur" };
  if (!me.pid) me.pid = "g-" + pvpId(8);
  const L = { code, host: asHost, me, members: [], net: null };
  sgLobbyState = L;
  renderSiegeLobby();
  try {
    L.net = await PVP_NET.join(`siege:${code}`, {
      key: me.pid, events: ["start", "in", "snap", "offer", "pick", "end", "bye"],
      onSync: ms => { L.members = ms.sort((a, b) => a.at - b.at).slice(0, 4); renderSiegeLobby(); },
      onMsg: (ev, m) => sgOnNet(ev, m),
    });
    await L.net.track({ pid: me.pid, name: me.pseudo, host: asHost, at: Date.now() });
  } catch (e) { toast("Connexion impossible.", 2400); sgLobbyState = null; renderSiegeLobby(); }
}
let sgLobbyState = null;
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
  if (ev === "in" && siege.host) { const p = siege.players.find(q => q.pid === m.pid); if (p) { p.input = { mx: +m.mx || 0, my: +m.my || 0, ax: +m.ax || 0, ay: +m.ay || 0, fire: !!m.fire, aim: !!m.aim }; p.autoFire = !!m.af; p.autoAim = !!m.aa; } }
  if (ev === "offer" && !siege.host && m.to === siege.myPid) {
    siege.level = m.level; siege.wave = m.wave;
    const me = siege.players.find(p => p.pid === siege.myPid) || { i: 0, name: "Toi", items: [] };
    sgShowChoice(me, m.kind, m.opts, opt => { siege.net.send("pick", { pid: siege.myPid, opt }); sgResume(); });
  }
  if (ev === "pick" && siege.host) sgRemotePick(m.pid, m.opt);
  if (ev === "end" && !siege.host) { siege.over = m; sgShowEnd(); }
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
function renderSiegeLobby() {
  const el = document.getElementById("siegePanel"); if (!el) return;
  const L = sgLobbyState, best = (() => { try { return +localStorage.getItem("lepuits.siege.best") || 0; } catch (e) { return 0; } })();
  const onoff = v => v ? "Activée" : "Coupée";
  if (L) {
    el.innerHTML = `<div><span class="kicker">Siège · coop en ligne</span><div class="big small">Salon ${L.code}</div></div>
      <p class="pvp-help">${L.host ? "Donne ce code à tes amis (jusqu'à 3). Lance quand tout le monde est là." : "En attente du lancement par l'hôte…"}</p>
      <p class="pvp-picks">${L.members.map((m, i) => `<span class="pvp-chip" style="color:${SG_COLORS[i]}">${m.name}${m.host ? " (hôte)" : ""}</span>`).join("") || `<span class="pvp-chip empty">connexion…</span>`}</p>
      <nav class="menu-list">${L.host ? `<button class="mi" data-act="sgHostStart">Lancer la partie<small>${L.members.length} joueur${L.members.length > 1 ? "s" : ""}</small></button>` : ""}<button class="mi" data-act="sgLeave">Quitter le salon</button></nav>`;
  } else {
    const pads = sgPads().length;
    el.innerHTML = `<div><span class="kicker">Nouveau mode · en test</span><div class="big small">Siège du village</div></div>
      <p class="pvp-help">Défends le Cœur du village contre des vagues de monstres. Gagne des niveaux, choisis un objet après chaque vague. ${best ? `Record : vague ${best}.` : ""}</p>
      <nav class="menu-list">
        <button class="mi" data-act="sgSolo">Seul</button>
        <button class="mi" data-act="sgLocal">À deux, même écran<small>${pads >= 2 ? "deux manettes" : pads === 1 ? "clavier-souris + manette" : "branche une manette pour le joueur 2"}</small></button>
        <button class="mi" data-act="sgHost">Coop en ligne : créer un salon<small>2 à 4 joueurs</small></button>
        <div class="sync-link"><input id="sgRoomInput" type="text" maxlength="11" autocomplete="off" spellcheck="false" placeholder="SIEGE-XXXX" aria-label="Code d'un salon"></div>
        <button class="mi" data-act="sgJoin">Rejoindre un salon</button>
        <button class="mi" data-act="sgAutoFire">Attaque auto : ${onoff(sgAutoFire())}<small>les armes frappent seules</small></button>
        <button class="mi" data-act="sgAutoAim">Visée auto : ${onoff(sgAutoAim())}<small>vise l'ennemi le plus proche (sinon : souris ou stick droit)</small></button>
        <button class="mi" data-act="back">Retour</button>
      </nav>`;
    const inp = el.querySelector("#sgRoomInput");
    if (inp) for (const ev of ["keydown", "keyup", "keypress"]) inp.addEventListener(ev, e => { e.stopPropagation(); if (ev === "keydown" && e.key === "Enter") menuAction("sgJoin"); });
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
    if (screen === "play") siegeUpdate(dt); else pollMenuPad();
    siegeDraw();
    requestAnimationFrame(frame);
  });
  // Échap : la pause du Siège
  around("openPause", (o, ...a) => {
    if (!siege) return o(...a);
    if (siege.over || siege.choice) return;
    if (!siege.net) siege.paused = true;
    screen = "siegemenu"; menuRoot = "siege";
    const el = document.getElementById("siegePanel");
    el.innerHTML = `<div><span class="kicker">Siège · vague ${siege.wave}</span><div class="big small">Pause</div></div>
      <nav class="menu-list"><button class="mi" data-act="sgResume">Reprendre</button><button class="mi" data-act="sgQuit">Abandonner</button></nav>`;
    showPanel("siege");
  });
  around("showPanel", (o, name, ...a) => { const r = o(name, ...a); if (name === "siegeLobby") { menuRoot = "main"; } return r; });
  around("menuAction", (o, act, ...a) => {
    if (act === "siege") { sgLobbyState = null; showPanel("siege"); renderSiegeLobby(); menuPanel = "siege"; return; }
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
    if (act === "sgAutoFire") { sgOpts.autoFire = !sgAutoFire(); sgSaveOpts(); renderSiegeLobby(); return; }
    if (act === "sgAutoAim") { sgOpts.autoAim = !sgAutoAim(); sgSaveOpts(); renderSiegeLobby(); return; }
    if (act && act.startsWith("sgPick:") && siege && siege.pickDone) { const f = siege.pickDone; siege.pickDone = null; f(act.slice(7)); return; }
    if (act === "sgResume") { if (siege) { siege.paused = false; sgResume(); } return; }
    if (act === "sgQuit") { if (siege && siege.net) { try { siege.net.send("bye", { pid: siege.myPid || (PVP.me && PVP.me.pid) }); } catch (e) {} } sgLobbyState = null; siegeStop(); return; }
    if (act === "sgAgain") { const ps = siege.players.map(p => ({ src: p.src, name: p.name })); siegeStop(); siegeStart({ players: ps }); return; }
    if (act === "back" && siege && screen === "siegemenu") { if (!siege.over && !siege.choice && !siege.pickDone) { siege.paused = false; sgResume(); } return; }
    return o(act, ...a);
  });
})();
