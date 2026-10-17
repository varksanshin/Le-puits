"use strict";
// ---------- 20. Éléments du décor ----------
/* Terrain :
     =  plateforme friable : s'effondre peu après qu'on a marché dessus, revient ensuite
     ~  eau : on y flotte, on y nage (Saut), on y est ralenti
     %  courant d'air : il te soulève
     g  mur d'accroche : on y glisse et on rebondit dessus (saut mural)
     G  vanne : fermée jusqu'à ce qu'on actionne un levier
     f  faux mur : on le traverse, il cache une salle secrète
     B  barrière d'arène : se ferme pendant une épreuve
   Éléments : lever (levier), chest (coffre), trial (arène qui se ferme), lore (tablette d'histoire) */
const ELEM = {
  crumbleDelay: 0.45, crumbleBack: 4,
  swimStroke: 190, waterFall: 70, waterSpeed: 0.65,
  draftLift: 210,
  wallSlide: 55, wallJumpPush: 1.5,
  gateRadius: 20,
};
let crumbling = new Map(), crumbled = [], levers = [], chests = [], trials = [], lores = [];
let barriersUp = false, secretsFound = 0, secretsTotal = 0, revealed = new Set();

const LORE = {
  entree1:  "« Puits-Clair. Ici, les enfants jetaient des vœux dans le puits. Un jour, le puits a répondu. »",
  entree2:  "Gravé dans la pierre : « Ceux qui descendent pour sauver le pays ne remontent jamais les mêmes. »",
  mines1:   "Registre de la prison des mines : « Les condamnés creusent. Plus bas. Toujours plus bas. Ordre du roi. »",
  mines2:   "Griffonné sur un mur de cellule : « On a percé quelque chose cette nuit. Ça respire. »",
  noyee1:   "Le village de Brume-sous-Terre. Les eaux sont montées en une nuit. Les cloches sonnent encore, sous la surface.",
  noyee2:   "Une plaque de maison noyée : « Famille Orvain. Nous avons fermé les volets. L'eau est entrée quand même. »",
  spores1:  "Le jardin de la Mère-Spore. Tout ce qui pourrit ici repousse… mais pas tout à fait pareil.",
  spores2:  "Les champignons s'illuminent quand tu passes. Ils te suivent. Ils se souviennent de toi.",
  antre1:   "L'antre corrompu. La menace n'est pas venue d'en bas. C'est le puits lui-même qui a faim.",
  antre2:   "Une voix : « Tu as tant pris aux profondeurs. Que vas-tu leur rendre ? »",
  secret:   "Une salle oubliée. Quelqu'un s'est caché ici, il y a longtemps, et n'en est jamais sorti.",
};
const TRIAL_WAVES = {
  entree: [["crawler", "crawler", "bat"], ["crawler", "spitter", "bat"]],
  mines:  [["crawler", "golem"], ["bat", "squelette", "spitter"]],
  noyee:  [["crawler", "champi", "wisp"], ["golem", "bat"]],
  spores: [["spitter", "champi", "wisp"], ["golem", "champi", "bat"]],
  antre:  [["rodeur", "wisp", "squelette"], ["golem", "rodeur", "bat", "wisp"]],
};

// Appelé par loadMap : prépare les éléments posés sur la map
function loadElements(e) {
  if (e.t === "lever") { levers.push({ x: e.x * T + 4, y: e.y * T + 4, w: 8, h: 12, cx: e.x, cy: e.y, on: false }); return true; }
  if (e.t === "chest") { chests.push({ x: e.x * T + 1, y: e.y * T + 6, w: 14, h: 10, open: false, rest: 0, secret: e.s === "secret" }); return true; }
  if (e.t === "lore") { lores.push({ x: e.x * T + 2, y: e.y * T + 2, w: 12, h: 14, key: e.s || "entree1", seen: false }); return true; }
  if (e.t === "trial") {
    const w = e.w || 18, h = e.h || 12;
    trials.push({ x: e.x * T, y: e.y * T, rx: (e.x - Math.floor(w / 2)) * T, ry: (e.y - h + 1) * T, rw: w * T, rh: h * T, cx: e.x, cy: e.y, state: "idle", wave: 0, mobs: [] });
    return true;
  }
  return loadLoot(e);
}
function resetElements() {
  resetLoot();
  crumbling = new Map(); crumbled = []; levers = []; chests = []; trials = []; lores = [];
  barriersUp = false; secretsFound = 0; revealed = new Set();
}
function countSecrets() {
  // Chaque groupe de faux murs connectés compte pour un secret
  const seen = new Set(); let n = 0;
  for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
    if (grid[r][c] !== "f" || seen.has(r * MW + c)) continue;
    n++; floodTiles(c, r, "f", seen);
  }
  secretsTotal = n;
}
function floodTiles(c0, r0, ch, seen) {
  const stack = [[c0, r0]], out = [];
  while (stack.length) {
    const [c, r] = stack.pop(), k = r * MW + c;
    if (c < 0 || r < 0 || c >= MW || r >= MH || seen.has(k) || grid[r][c] !== ch) continue;
    seen.add(k); out.push([c, r]);
    stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  return out;
}

// ----- Héros : eau, courants d'air, murs d'accroche -----
const tileAtPx = (x, y) => tile(Math.floor(x / T), Math.floor(y / T));
function senseEnvironment(p) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  p.inWater = tileAtPx(cx, cy) === "~" || tileAtPx(cx, p.y + p.h - 2) === "~";
  p.inDraft = tileAtPx(cx, cy) === "%" || tileAtPx(cx, p.y + p.h - 2) === "%";
  p.wallDir = 0;
  if (!p.onGround) {
    if (tileAtPx(p.x - 1, cy) === "g" || tileAtPx(p.x - 1, p.y + 3) === "g") p.wallDir = -1;
    else if (tileAtPx(p.x + p.w + 1, cy) === "g" || tileAtPx(p.x + p.w + 1, p.y + 3) === "g") p.wallDir = 1;
  }
}
// Saut mural : renvoie true s'il a eu lieu
function tryWallJump(p) {
  if (!p.wallDir || p.onGround) return false;
  p.vy = -stats.jumpVel * 0.95; p.vx = -p.wallDir * stats.runSpeed * ELEM.wallJumpPush;
  p.face = -p.wallDir; p.wallLock = 0.16; p.buffer = 0; p.jumping = true;
  p.airJumps = skills.doubleJump ? stats.extraJumps : 0;
  p.sx = 0.8; p.sy = 1.25;
  dust(p.wallDir < 0 ? p.x : p.x + p.w, p.y + p.h / 2, 5);
  return true;
}
// Après le calcul normal des vitesses : l'environnement les corrige
function applyEnvironment(p, dt, ix) {
  p.wallLock = Math.max(0, (p.wallLock || 0) - dt);
  if (p.inWater) {
    p.vx = Math.max(-stats.runSpeed * ELEM.waterSpeed, Math.min(stats.runSpeed * ELEM.waterSpeed, p.vx));
    p.vy = Math.min(p.vy, ELEM.waterFall);
    if (input.jumpPressed) { p.vy = -ELEM.swimStroke; p.jumping = false; if (Math.random() < 0.5) particles.push({ x: p.x + p.w / 2, y: p.y, vx: 0, vy: -20, life: 0.5, max: 0.5, color: "#bfe6ef", g: -30 }); }
    p.airJumps = skills.doubleJump ? stats.extraJumps : 0;
    p.coyote = 0.06;                                    // on peut sauter hors de l'eau depuis la surface
  }
  if (p.inDraft) {
    // la poussée compense la gravité du réglage choisi (sinon les réglages lourds retombent)
    p.vy = approach(p.vy, -ELEM.draftLift, (900 + stats.gravity * stats.fallGravMult) * dt);
    if (Math.random() < dt * 20) particles.push({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: 0, vy: -90, life: 0.3, max: 0.3, color: "#d8e8e0", g: 0 });
  }
  if (p.wallDir && ix === p.wallDir && p.vy > ELEM.wallSlide) {
    p.vy = ELEM.wallSlide; p.gliding = false;
    if (Math.random() < 0.3) particles.push({ x: p.wallDir < 0 ? p.x : p.x + p.w, y: p.y + p.h - 2, vx: 0, vy: -10, life: 0.3, max: 0.3, color: "#6f8f4c", g: 40 });
  }
}
// Plateformes friables sous les pieds
function stepOnCrumbles(p) {
  if (!p.onGround) return;
  const r = Math.floor((p.y + p.h + 1) / T);
  for (let c = Math.floor(p.x / T); c <= Math.floor((p.x + p.w - 0.01) / T); c++) {
    if (tile(c, r) !== "=") continue;
    const k = r * MW + c;
    if (!crumbling.has(k)) crumbling.set(k, ELEM.crumbleDelay);
  }
}

// ----- Monde -----
function updateElements(dt) {
  const p = player;
  // Effondrements
  for (const [k, t] of crumbling) {
    const nt = t - dt;
    if (nt > 0) { crumbling.set(k, nt); continue; }
    crumbling.delete(k);
    const c = k % MW, r = Math.floor(k / MW);
    if (grid[r][c] !== "=") continue;
    grid[r][c] = ".";
    crumbled.push({ c, r, t: ELEM.crumbleBack });
    for (let i = 0; i < 8; i++) particles.push({ x: c * T + Math.random() * T, y: r * T + Math.random() * 6, vx: (Math.random() - 0.5) * 40, vy: Math.random() * 40, life: 0.7, max: 0.7, color: "#7a6a5a", g: 400 });
  }
  for (const b of crumbled) {
    b.t -= dt;
    if (b.t <= 0 && !overlap(p, { x: b.c * T, y: b.r * T, w: T, h: T })) { grid[b.r][b.c] = "="; b.done = true; }
  }
  crumbled = crumbled.filter(b => !b.done);
  // Faux murs : on les découvre en s'en approchant
  const pc = Math.floor((p.x + p.w / 2) / T), pr = Math.floor((p.y + p.h / 2) / T);
  for (let r = pr - 1; r <= pr + 1; r++) for (let c = pc - 1; c <= pc + 1; c++) {
    if (tile(c, r) !== "f" || revealed.has(r * MW + c)) continue;
    const group = floodTiles(c, r, "f", new Set());
    for (const [gc, gr] of group) revealed.add(gr * MW + gc);
    secretsFound++;
    toast(`Un passage secret ! (${secretsFound} / ${secretsTotal})`, 2400);
    burst(p.x + p.w / 2, p.y + p.h / 2, 16, "#f2d45a", 70);
  }
  // Coffres : rester devant, ou frapper
  for (const ch of chests) {
    if (ch.open) continue;
    if (overlap(p, ch) && p.onGround) {
      ch.rest += dt;
      if (ch.rest >= 0.35 || p.atkTimer > 0) openChest(ch);
    } else ch.rest = 0;
  }
  // Tablettes d'histoire
  for (const l of lores) {
    if (l.seen) continue;
    if (Math.abs((p.x + p.w / 2) - (l.x + 6)) < 20 && Math.abs((p.y + p.h) - (l.y + 14)) < 20) {
      l.seen = true; toast(LORE[l.key] || l.key, 6000);
    }
  }
  // Arènes qui se ferment
  for (const tr of trials) updateTrial(tr, dt);
}
function hitLevers(box) {
  for (const lv of levers) if (!lv.on && overlap(box, lv)) pullLever(lv);
}
function pullLever(lv) {
  lv.on = true;
  let opened = 0;
  for (let r = Math.max(0, lv.cy - ELEM.gateRadius); r <= Math.min(MH - 1, lv.cy + ELEM.gateRadius); r++)
    for (let c = Math.max(0, lv.cx - ELEM.gateRadius); c <= Math.min(MW - 1, lv.cx + ELEM.gateRadius); c++)
      if (grid[r][c] === "G") {
        grid[r][c] = "."; opened++;
        for (let i = 0; i < 5; i++) particles.push({ x: c * T + Math.random() * T, y: r * T + Math.random() * T, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 0.5, max: 0.5, color: "#a07044", g: 200 });
      }
  shake(2, 0.2); freeze = Math.max(freeze, 0.08);
  toast(opened ? "Un mécanisme grince : une vanne s'ouvre." : "Le levier bascule.", 2400);
}
function openChest(ch) {
  ch.open = true;
  burst(ch.x + 7, ch.y + 4, 26, "#f2d45a", 110);
  chestLoot(ch, ch.secret);
}
const biomeAtPx = (x, y) => biomeAt(Math.floor(x / T), Math.floor(y / T));
function updateTrial(tr, dt) {
  const p = player;
  if (tr.state === "done") return;
  const inside = overlap(p, { x: tr.rx + T, y: tr.ry, w: tr.rw - 2 * T, h: tr.rh });
  if (tr.state === "idle") {
    if (!inside || p.dead) return;
    tr.state = "active"; barriersUp = true; tr.wave = 0;
    toast("Les issues se referment ! Survis à l'épreuve.", 2600);
    shake(3, 0.3);
    spawnTrialWave(tr);
    return;
  }
  // Épreuve en cours : vague suivante quand tous les monstres de la vague sont morts
  if (tr.mobs.every(m => m.dead)) {
    const waves = TRIAL_WAVES[biomeAtPx(tr.x, tr.y)] || TRIAL_WAVES.entree;
    if (tr.wave < waves.length) spawnTrialWave(tr);
    else {
      tr.state = "done"; barriersUp = false;
      chests.push({ x: tr.x + 1, y: tr.y + 6, w: 14, h: 10, open: false, rest: 0, secret: true });
      burst(tr.x + 8, tr.y + 8, 40, "#f2d45a", 140);
      toast("Épreuve réussie ! Un coffre apparaît.", 2600);
    }
  }
}
function spawnTrialWave(tr) {
  const waves = TRIAL_WAVES[biomeAtPx(tr.x, tr.y)] || TRIAL_WAVES.entree;
  const list = waves[tr.wave++];
  const cols = Math.floor(tr.rw / T) - 4, c0 = Math.floor(tr.rx / T) + 2, floorRow = tr.cy;
  tr.mobs = list.map((type, i) => {
    const cx = c0 + Math.floor(((i + 0.5) / list.length) * cols);
    const fly = ENEMY_TYPES[type].fly;
    const m = makeEnemy({ type, cx, cy: fly ? floorRow - 5 : floorRow });
    m.dir = Math.random() < 0.5 ? -1 : 1;
    enemies.push(m);
    burst(m.x + m.w / 2, m.y + m.h / 2, 16, "#9d6bc4", 80);
    return m;
  });
}

// ----- Dessin -----
function drawLeverAt(x, y, on) {
  ctx.fillStyle = "#3a3440"; ctx.fillRect(x, y + 9, 8, 3);
  ctx.strokeStyle = on ? "#f2d45a" : "#a07044"; ctx.lineWidth = 1.33;
  ctx.beginPath(); ctx.moveTo(x + 4, y + 10); ctx.lineTo(x + (on ? 8 : 0), y + 1); ctx.stroke();
  ctx.fillStyle = on ? "#f2d45a" : "#c4413b"; ctx.fillRect(x + (on ? 7 : -1), y, 2.33, 2.33);
}
function drawChestAt(x, y, open, secret) {
  ctx.fillStyle = secret ? "#8a6a2a" : "#6b4a2c"; ctx.fillRect(x, y + 3, 14, 7);
  ctx.fillStyle = secret ? "#f2d45a" : "#a07044";
  if (open) { ctx.fillRect(x, y - 1, 14, 2); } else { ctx.fillRect(x, y, 14, 4); ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 6, y + 3, 2, 3); }
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x, y + 6, 14, 1);
}
function drawLoreAt(x, y, seen) {
  ctx.fillStyle = "#3a3440"; ctx.fillRect(x, y + 2, 12, 12);
  ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + 6, y - 1); ctx.lineTo(x + 12, y + 2); ctx.fill();
  ctx.fillStyle = seen ? "#7a7180" : `rgba(232,145,58,${0.6 + 0.3 * Math.sin(time * 3)})`;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 3, y + 5 + i * 3, 6 - (i % 2) * 2, 1);
}
function drawTrialMark(x, y, state) {
  ctx.strokeStyle = state === "active" ? "#c4413b" : state === "done" ? "#5a5060" : `rgba(196,65,59,${0.4 + 0.3 * Math.sin(time * 3)})`;
  ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 12.5, 11, 3);
  ctx.beginPath(); ctx.moveTo(x + 8, y + 2); ctx.lineTo(x + 5, y + 8); ctx.lineTo(x + 11, y + 8); ctx.closePath(); ctx.stroke();
}
function drawElements(ox, oy) {
  for (const lv of levers) drawLeverAt(lv.x - ox, lv.y - oy, lv.on);
  for (const ch of chests) drawChestAt(ch.x - ox, ch.y - oy, ch.open, ch.secret);
  for (const l of lores) drawLoreAt(l.x - ox, l.y - oy, l.seen);
  for (const tr of trials) if (tr.state !== "done") drawTrialMark(tr.x - ox, tr.y - oy, tr.state);
}
function elementLights(hole, ox, oy) {
  for (const ch of chests) if (!ch.open) hole(ch.x + 7 - ox, ch.y + 4 - oy, ch.secret ? 34 : 24);
  for (const l of lores) if (!l.seen) hole(l.x + 6 - ox, l.y + 6 - oy, 22);
}
// Eau dessinée par-dessus les personnages : on est vraiment dedans
function drawWater(get, ox, oy, vw, vh) {
  const c0 = Math.floor(ox / T), c1 = Math.ceil((ox + vw) / T), r0 = Math.floor(oy / T), r1 = Math.ceil((oy + vh) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (get(c, r) !== "~") continue;
    const x = c * T - ox, y = r * T - oy;
    ctx.fillStyle = "rgba(40,110,140,0.42)"; ctx.fillRect(x, y, T, T);
    if (get(c, r - 1) !== "~") {
      const w = Math.sin(time * 3 + c) * 1;
      ctx.fillStyle = "rgba(160,220,235,0.55)"; ctx.fillRect(x, y + 1 + w, T, 1.33);
    }
  }
}
