"use strict";
// ---------- 9. Monde ----------
let flags = {}, freeze = 0, time = 0, visited = new Set([0]);
let shakeT = 0, shakeM = 0;
let shakeOn = true;
try { shakeOn = localStorage.getItem("lepuits.shake") !== "off"; } catch (e) {}
function shake(m, t) { if (REDUCED || !shakeOn) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, t); }
const ZONE_H = 14 * T;                                  // une « profondeur » = 14 tuiles
const zoneOf = p => Math.max(0, Math.floor((p.y + p.h) / ZONE_H));

function eligibleItems(exclude = []) {
  return ITEMS.filter(it => !it.soon && !items.has(it.id) && !exclude.includes(it.id) && (!it.skill || skills[it.skill]));
}
function addItem(id) {
  if (items.has(id)) return;
  items.add(id);
  if (ITEM[id].dark) addDark(ITEM[id].dark, true);
  if (id === "couronne") for (const e of enemies) e.hp *= 1.5;
  computeStats(); renderItems();
  onItemAdded(id);
}
function removeItem(id) {
  if (!items.delete(id)) return;
  if (id === "couronne") for (const e of enemies) e.hp /= 1.5;
  computeStats(); renderItems();
}
// En jeu on n'affiche qu'une phrase floue : à toi de deviner ce que fait l'objet (l'atelier montre la vraie description)
function itemToast(it, prefix = "", exact = false) { toast(`${prefix}<b>${it.name}</b><br><i>${exact ? it.desc : it.hint}</i>`, 4500, true); }
function giveRandomItem() {
  const pool = eligibleItems();
  if (!pool.length) { toast("L'autel s'éteint… tu possèdes déjà tout ce qu'il pouvait offrir.", 2400); return; }
  const it = pick(pool);
  addItem(it.id);
  freeze = Math.max(freeze, 0.12);
  itemToast(it);
}
function rerollItem() {
  const owned = [...items].filter(id => id !== "de");
  if (!owned.length) { toast("Le Dé du chaos roule… mais tu n'as rien à relancer.", 2200); return; }
  const out = pick(owned);
  const pool = eligibleItems([out, "de"]);
  if (!pool.length) return;
  removeItem(out);
  const it = pick(pool); addItem(it.id);
  itemToast(it, `Dé du chaos : ${ITEM[out].name} devient `);
}
function grantSkill(id) {
  skills[id] = true;
  if (id === "doubleJump") player.airJumps = stats.extraJumps;
  if (id === "dash") player.dashCharges = stats.dashCharges;
  renderSkills(); renderAtelier();
}

function updateWorld(dt) {
  const p = player;
  if (p.dead) return;
  for (const r of relics) {
    if (!r.taken && !r.guarded && overlap(p, r)) {
      r.taken = true; grantSkill(r.skill); recordSplit(RELIC_INFO[r.skill].name);
      freeze = 0.18;
      burst(r.x + 4, r.y + 4, 40, RELIC_INFO[r.skill].color, 140);
      toast(`Skill obtenu : ${RELIC_INFO[r.skill].name}. ${RELIC_INFO[r.skill].how}`, 4200);
    }
  }
  for (const pk of pickups) {
    pk.t += dt;
    if (!pk.taken && overlap(p, pk)) {
      pk.taken = true;
      burst(pk.x + 5, pk.y + 5, 30, "#b48ae0", 120);
      giveRandomItem();
    }
  }
  pickups = pickups.filter(pk => !pk.taken);
  const z = zoneOf(p);
  if (z !== p.zone) {
    p.zone = z;
    if (!visited.has(z)) {
      visited.add(z);
      addDark(DARK.perZone, true);
      if (has("oeil")) { p.hp -= 1; renderHearts(); toast("L'Œil du devin se nourrit : −1 PV.", 2200); if (p.hp <= 0) { die(); return; } }
      if (has("de")) rerollItem();
    }
  }
  updateDark(dt);
  updateElements(dt);
  updateLoot(dt);
  updateBestiary(dt);
  updateMinis(dt);
  updateMapSeen();
  updateBiome(p);
  updateBossDoor(dt);
  updateBossFight(dt);
  if (!flags.hintBucket && p.onPlat) {
    flags.hintBucket = true;
    toast("Le vieux seau s'enfonce sous ton poids… ne traîne pas.", 2600);
  }
  if (!flags.hintWall) {
    const r = Math.floor((p.y + p.h - 2) / T);
    if (tile(Math.floor((p.x - 10) / T), r) === "x" || tile(Math.floor((p.x + p.w + 10) / T), r) === "x") {
      flags.hintWall = true;
      toast(skills.smash ? "Ce mur est fissuré : maintiens Frapper, puis relâche." : "Ce mur sonne creux… il faudrait une frappe bien plus puissante.", 3200);
    }
  }
  if (exitRune && !flags.finished && overlap(p, exitRune)) {
    flags.finished = true;
    burst(exitRune.x + 8, exitRune.y + 12, 50, "#7fc8d6", 120);
    toast("Sortie atteinte ! R ou Select pour recommencer.", 6000);
  }
}

const particles = [];
function burst(x, y, n, color, speed, ring) {
  for (let i = 0; i < n; i++) {
    const a = ring ? Math.PI * (0.15 + 0.7 * (i / n)) : Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: ring ? Math.abs(Math.sin(a)) * v * 0.6 : Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, color, g: 120 });
  }
}
function dust(x, y, n) {
  for (let i = 0; i < n; i++) particles.push({ x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 30, life: 0.35 + Math.random() * 0.2, max: 0.55, color: "#8a7f74", g: 60 });
}
function updateParticles(dt) {
  updateAmbient(dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]; q.life -= dt;
    if (q.life <= 0) { particles.splice(i, 1); continue; }
    q.vy += q.g * dt; q.x += q.vx * dt; q.vx *= 0.98;
    if (q.wob != null) q.x += Math.sin(time * 2 + q.wob) * 6 * dt;
    q.y += q.vy * dt;
    // Les éclats de pixels rebondissent sur le sol
    if (q.hit && solid(tile(Math.floor(q.x / T), Math.floor(q.y / T)))) {
      q.y -= q.vy * dt;
      if (Math.abs(q.vy) > 30) { q.vy *= -0.35; q.vx *= 0.6; } else { q.vy = 0; q.vx *= 0.8; q.g = 0; }
    }
  }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
}

const cam = { x: 0, y: 0 };
function updateCamera(dt, px, py) {
  const p = player;
  const tx = px + p.w / 2 + p.face * 22 + p.vx * 0.15 - VW / 2;
  const ty = py + p.h / 2 + (p.vy > 200 ? 30 : 0) - VH / 2;
  cam.x += (tx - cam.x) * Math.min(1, dt * 4.5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5.5);
  cam.x = MW * T <= VW ? (MW * T - VW) / 2 : Math.max(0, Math.min(cam.x, MW * T - VW));
  cam.y = MH * T <= VH ? (MH * T - VH) / 2 : Math.max(0, Math.min(cam.y, MH * T - VH));
}
