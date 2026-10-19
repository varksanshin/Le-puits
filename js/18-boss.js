"use strict";
// ---------- 17. Le Gardien du puits ----------
/* La porte du Gardien prend l'apparence de la fin que la jauge prépare.
   Rester devant la porte fait entrer dans l'arène : la jauge se fige et le combat commence. */
const BOSS_VARIANTS = {
  normal: { name: "Le Gardien du puits", hp: 40, idle: 1.35, volley: 3, waveSpeed: 135, charge: 190, contact: 1, color: "#6a6270", dark: "#4e4854", eye: "#ff7a3a", summons: [0.5] },
  pure:   { name: "Le Gardien enragé",    hp: 55, idle: 0.75, volley: 5, waveSpeed: 185, charge: 245, contact: 2, color: "#d8d0bc", dark: "#a89f8a", eye: "#fff6c8", summons: [], doubleSlam: true },
  abyss:  { name: "Le Gardien dévoré",    hp: 50, idle: 1.1,  volley: 4, waveSpeed: 150, charge: 210, contact: 1, color: "#3a2448", dark: "#24142e", eye: "#c88aff", summons: [0.66, 0.33], summonMore: true },
};
let bossFight = null;          // { tier, boss, after, summoned:Set }
const bossBarEl = document.getElementById("bossBar"), bossNameEl = document.getElementById("bossName"), bossFillEl = document.getElementById("bossFill");

function updateBossDoor(dt) {
  const p = player, d = bossDoor;
  if (!d || bossFight || p.dead) return;
  if (overlap(p, d)) {
    if (!d.near) toast(doorText(), 3200);
    d.near = true;
    if (actOffer(d, "ENTRER", true)) { d.hold = 1; enterArena(); }
  } else { d.near = false; d.hold = 0; }
}
function doorText() {
  const t = darkTier();
  if (t === "pure") return "La porte rayonne d'une lumière blanche. Derrière, le Gardien t'attend, enragé. Reste immobile pour entrer.";
  if (t === "abyss") return "Des racines noires dévorent la porte. Derrière, le Gardien a été englouti par les ténèbres. Reste immobile pour entrer.";
  return "La porte du Gardien. Il est encore temps de faire demi-tour. Reste immobile pour entrer.";
}
function enterArena() {
  const p = player;
  if (!arenaEntry || !bossSpawn) { toast("Cette map n'a pas encore d'arène : place une entrée d'arène et le Gardien dans l'éditeur.", 3600); bossDoor.hold = 0; return; }
  const tier = darkTier();
  darkLocked = true;
  recordSplit("Porte du Gardien");
  enemies = []; shots = []; projectiles = []; hazards = [];
  p.x = arenaEntry.x; p.y = arenaEntry.y; p.vx = p.vy = 0; p.prevX = p.x; p.prevY = p.y; p.safeX = p.x; p.safeY = p.y;
  p.grapple = null; p.zone = zoneOf(p); visited.add(p.zone);
  cam.x = p.x - VW / 2; cam.y = p.y - VH / 2;
  const boss = makeBoss(tier);
  enemies.push(boss);
  bossFight = { tier, boss, after: 0, summoned: new Set() };
  bossNameEl.textContent = BOSS_VARIANTS[tier].name;
  bossBarEl.dataset.tier = tier; bossBarEl.hidden = false;
  renderBossBar();
  freeze = 0.35; shake(4, 0.4);
  toast(BOSS_VARIANTS[tier].name.toUpperCase(), 2600);
}
function makeBoss(tier) {
  const V = BOSS_VARIANTS[tier];
  const e = makeEnemy({ type: "boss", cx: bossSpawn.cx, cy: bossSpawn.cy });
  e.boss = true; e.variant = tier; e.hp = e.maxHp = V.hp * (has("couronne") ? 1.25 : 1);
  e.damage = V.contact; e.dir = -1; e.state = "intro"; e.stateT = 1.6; e.slams = 0; e.lastAtk = "";
  return e;
}
function renderBossBar() {
  if (!bossFight) return;
  bossFillEl.style.width = `${Math.max(0, bossFight.boss.hp / bossFight.boss.maxHp) * 100}%`;
}

// Le Gardien : un colosse qui saute, charge et crache, et appelle des renforts quand il faiblit
function updateBoss(e, dt, p) {
  const V = BOSS_VARIANTS[e.variant];
  e.vy = Math.min(e.vy + 1500 * dt, 600);
  const ex = e.x + e.w / 2, px = p.x + p.w / 2;
  const face = () => { e.dir = Math.sign(px - ex) || e.dir; };
  e.stateT -= dt;
  if (e.daze > 0) { e.vx = approach(e.vx, 0, 600 * dt); }
  else switch (e.state) {
    case "intro":
      e.vx = 0; face();
      if (e.stateT <= 0) nextBossAttack(e);
      break;
    case "idle":                                         // il marche vers toi entre deux attaques
      face(); e.vx = approach(e.vx, Math.abs(px - ex) > 40 ? e.dir * 34 : 0, 200 * dt);
      if (e.stateT <= 0) nextBossAttack(e);
      break;
    case "slamWind":
      e.vx = 0; face();
      if (e.stateT <= 0) {
        const tt = 0.62, dx = Math.max(-150, Math.min(150, px - ex));
        e.vx = dx / tt; e.vy = -460; e.state = "slamAir"; e.stateT = 2;
      }
      break;
    case "slamAir":
      if (e.onGround && e.vy >= 0 && e.stateT < 1.9) {
        e.vx = 0; bossShockwave(e, V);
        e.slams++;
        if (V.doubleSlam && e.slams < 2) { e.state = "slamWind"; e.stateT = 0.25; }
        else { e.state = "idle"; e.stateT = V.idle; }
      }
      break;
    case "chargeWind":
      e.vx = 0;
      if (e.stateT <= 0) { e.state = "charge"; e.stateT = 2.2; shake(1.5, 0.1); }
      break;
    case "charge":
      e.vx = e.dir * V.charge;
      if (Math.random() < dt * 40) dust(e.dir > 0 ? e.x : e.x + e.w, e.y + e.h, 1);
      if (e.stateT <= 0) { e.state = "idle"; e.stateT = V.idle; }
      break;
    case "volleyWind":
      e.vx = 0; face();
      if (e.stateT <= 0) { bossVolley(e, V); e.state = "idle"; e.stateT = V.idle; }
      break;
    case "stunned":                                      // il a percuté le mur : c'est le moment de frapper
      e.vx = 0;
      if (e.stateT <= 0) { e.state = "idle"; e.stateT = V.idle * 0.6; }
      break;
  }
  e.hitWall = false;
  moveX(e, e.vx * dt);
  if (e.hitWall && e.state === "charge") {
    e.state = "stunned"; e.stateT = e.variant === "pure" ? 0.9 : 1.6;
    shake(4, 0.3); freeze = Math.max(freeze, 0.08);
    burst(e.dir > 0 ? e.x + e.w : e.x, e.y + e.h / 2, 20, "#7a7180", 120);
  }
  moveY(e, e.vy * dt);
  // Renforts quand sa vie passe sous certains seuils
  for (const th of V.summons) {
    if (e.hp / e.maxHp <= th && !bossFight.summoned.has(th)) { bossFight.summoned.add(th); bossSummon(e, V); }
  }
}
function nextBossAttack(e) {
  const p = player, dist = Math.abs((p.x + p.w / 2) - (e.x + e.w / 2));
  const options = [["slam", 3], ["charge", dist > 50 ? 3 : 1], ["volley", dist > 70 ? 3 : 2]].filter(o => o[0] !== e.lastAtk);
  let r = Math.random() * options.reduce((s, o) => s + o[1], 0), atk = options[0][0];
  for (const [n, w] of options) { if ((r -= w) <= 0) { atk = n; break; } }
  e.lastAtk = atk; e.slams = 0;
  const quick = e.variant === "pure" ? 0.7 : 1;
  if (atk === "slam") { e.state = "slamWind"; e.stateT = 0.5 * quick; }
  else if (atk === "charge") { e.dir = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) || e.dir; e.state = "chargeWind"; e.stateT = 0.65 * quick; }
  else { e.state = "volleyWind"; e.stateT = 0.5 * quick; }
}
// Onde de choc au sol : on l'évite en sautant
function bossShockwave(e, V) {
  shake(4, 0.25);
  const fy = e.y + e.h - 8;
  for (const d of [-1, 1]) shots.push({ kind: "wave", x: e.x + e.w / 2 - 4, y: fy, w: 8, h: 8, vx: d * V.waveSpeed, vy: 0, grav: 0, life: 3 });
  for (const d of [-1, 1]) for (let i = 0; i < 8; i++) particles.push({ x: e.x + e.w / 2, y: e.y + e.h - 1, vx: d * (60 + i * 20), vy: -20 - Math.random() * 30, life: 0.4, max: 0.4, color: e.variant === "abyss" ? "#9d6bc4" : "#e8913a", g: 80 });
}
function bossVolley(e, V) {
  const p = player, ex = e.x + e.w / 2, ey = e.y + 6;
  const dx = (p.x + p.w / 2) - ex, dy = (p.y + p.h / 2) - ey;
  for (let i = 0; i < V.volley; i++) {
    const spread = (i - (V.volley - 1) / 2) * 34;
    const tx = dx + spread, tt = Math.max(0.55, Math.min(1.3, Math.abs(tx) / 120)), g = 420;
    shots.push({ kind: e.variant === "abyss" ? "void" : "acid", x: ex - 2.5, y: ey - 2.5, w: 5, h: 5, vx: tx / tt, vy: (dy - 0.5 * g * tt * tt) / tt, grav: g, life: 3 });
  }
  burst(ex, ey, 10, e.variant === "abyss" ? "#9d6bc4" : "#b8d048", 70);
}
function bossSummon(e, V) {
  const list = V.summonMore ? ["wisp", "wisp", "bat", "wisp"] : ["wisp", "wisp"];
  list.forEach((type, i) => {
    const m = makeEnemy({ type, cx: Math.floor((e.x + e.w / 2) / T) + (i % 2 ? 3 : -3), cy: Math.floor(e.y / T) - 2 - Math.floor(i / 2) });
    enemies.push(m);
    burst(m.x + 4, m.y + 4, 14, "#8ff0d0", 80);
  });
  toast("Le Gardien appelle les âmes du puits !", 2200);
}
function onBossDeath(e) {
  freeze = Math.max(freeze, 0.5); shake(6, 0.6);
  for (let i = 0; i < 4; i++) burst(e.x + Math.random() * e.w, e.y + Math.random() * e.h, 30, BOSS_VARIANTS[e.variant].eye, 160);
  for (const m of enemies) if (!m.boss) { m.dead = true; burst(m.x + 4, m.y + 4, 10, "#8ff0d0", 60); }
  shots = [];
  bossFight.after = 2.2;
  bossBarEl.hidden = true;
}
function updateBossFight(dt) {
  if (!bossFight) return;
  renderBossBar();
  if (bossFight.boss.dead && bossFight.after > 0) {
    bossFight.after -= dt;
    if (bossFight.after <= 0) endRun("win", bossFight.tier);
  }
}

// ----- Dessin -----
function drawBossDoor(ox, oy) {
  const d = bossDoor; if (!d) return;
  const x = d.x - ox, y = d.y - oy, tier = darkLocked && bossFight ? bossFight.tier : darkTier(), pul = 0.6 + 0.4 * Math.sin(time * 3);
  const frame = tier === "pure" ? "#d8d0bc" : tier === "abyss" ? "#24142e" : "#4e4854";
  ctx.fillStyle = frame; ctx.fillRect(x, y, d.w, d.h);
  ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + d.w / 2, y - 4); ctx.lineTo(x + d.w, y + 6); ctx.fill();
  ctx.fillStyle = tier === "pure" ? `rgba(255,246,200,${0.5 + 0.3 * pul})` : tier === "abyss" ? "#0a0410" : "#16121c";
  ctx.fillRect(x + 4, y + 4, d.w - 8, d.h - 4);
  if (tier === "normal") {
    ctx.fillStyle = "#3a3440"; ctx.fillRect(x + d.w / 2 - 0.5, y + 4, 1, d.h - 4);
    ctx.fillStyle = `rgba(232,145,58,${pul})`; ctx.fillRect(x + d.w / 2 - 2, y + 12, 4, 4);
  } else if (tier === "abyss") {
    ctx.fillStyle = "#3a2448";
    for (let i = 0; i < 5; i++) { const rx = x + 2 + i * 5, sw = Math.sin(time * 2 + i) * 1.5; ctx.fillRect(rx + sw, y - 2 + (i % 2) * 4, 1.67, d.h); }
    ctx.fillStyle = `rgba(200,138,255,${pul})`; ctx.fillRect(x + d.w / 2 - 1.5, y + 14, 3, 3);
  } else {
    ctx.fillStyle = "#fff"; ctx.fillRect(x + d.w / 2 - 0.5, y + 8, 1, 12); ctx.fillRect(x + d.w / 2 - 4, y + 12, 8, 1);
  }
  if (d.hold > 0) { ctx.fillStyle = "rgba(232,145,58,0.9)"; ctx.fillRect(x, y - 8, d.w * Math.min(1, d.hold), 1.33); }
}
function drawBoss(e, x, y, white) {
  const V = BOSS_VARIANTS[e.variant || "normal"];
  const wind = e.state && e.state.endsWith("Wind") && Math.floor(time * 16) % 2 === 0;
  const lean = e.state === "charge" ? (e.dir || 1) * 2 : 0, squash = e.state === "slamWind" ? 3 : 0;
  // bras levés avant de frapper le sol, sinon la pose de garde ; il respire quand il attend
  const frame = e.state === "slamWind" || e.state === "slamAir" ? "boss_raise" : "boss_idle";
  const breathe = e.state === "idle" || e.state === "intro" ? Math.sin(time * 2.6) * 0.025 : 0;
  if (typeof spriteCanvas === "function" && SPRITES[frame]) {
    const c = spriteCanvas(frame, white || wind, `${V.color}>${V.dark}>${V.eye}`);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round((x + 14) * S) / S, Math.round((y + 28) * S) / S);
    ctx.transform(1, 0, -lean * 0.05, 1, 0, 0);                                   // il se penche dans sa charge
    ctx.scale(1 + squash * 0.04, 1 - squash * 0.06 + breathe);
    ctx.drawImage(c, -17, -31);
    ctx.restore();
  }
  if (e.variant === "abyss" && !white) {
    ctx.fillStyle = "#5a3470";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 7 + Math.sin(time * 3 + i) * 1.2, y + 6, 1.33, 18);
  }
}
function drawBossOverlay(e, x, y) {
  const V = BOSS_VARIANTS[e.variant || "normal"];
  const lean = e.state === "charge" ? (e.dir || 1) * 2 : 0, squash = e.state === "slamWind" ? 3 : 0;
  ctx.fillStyle = e.state === "stunned" ? "#5a5060" : V.eye;
  ctx.fillRect(x + 10 + lean * 1.5, y + 3 + squash, 3, 1.67); ctx.fillRect(x + 15 + lean * 1.5, y + 3 + squash, 3, 1.67);
  if (e.state === "stunned") {
    ctx.fillStyle = "#f2d45a";
    for (let i = 0; i < 4; i++) { const an = time * 6 + i * 1.6; ctx.fillRect(snap(x + 14 + Math.cos(an) * 10), snap(y - 6 + Math.sin(an) * 2), 1, 1); }
  }
}
