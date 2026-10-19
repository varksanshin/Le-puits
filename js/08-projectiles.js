"use strict";
// ---------- 7. Projectiles et feu ----------
let projectiles = [], hazards = [], ghosts = [];
function fireBolt() {
  const p = player, s = stats, split = has("grimoire");
  const angles = split ? [-0.22, 0, 0.22] : [0];
  const cx = p.x + p.w / 2 + p.face * 6, cy = p.y + 5;
  const big = has("orbe"), w = big ? 12 : 6, h = big ? 10 : 4, sp = s.boltSpeed * (big ? 0.7 : 1);
  // Viser : en haut ou en diagonale, comme l'épée
  const aim = input.up ? (Math.abs(input.x) > 0.3 ? -Math.PI / 4 : -Math.PI / 2) : (!p.onGround && input.down) ? (Math.abs(input.x) > 0.3 ? Math.PI / 4 : Math.PI / 2) : 0;
  for (const a of angles) {
    const ang = aim + a, vx = Math.cos(ang) * p.face * sp, vy = Math.sin(ang) * sp;
    projectiles.push({ kind: "bolt", x: cx - w / 2, y: cy - h / 2, w, h, vx: Math.abs(vx) < 1 ? 0 : vx, vy,
      grav: 0, life: big ? 1.5 : 1.2, bounces: has("ricochet") ? 3 : 0, dmg: dmgOf(1) * (split ? 0.5 : 1) * (big ? 2 : 1), hits: new Set(), pierce: has("percant") });
  }
  if (!p.onGround) p.vx -= p.face * 30;
  burst(cx, cy, 5, "#7fc8d6", 50);
}
function updateProjectiles(dt) {
  for (const q of projectiles) {
    if (!q._mods && typeof modProjectile === "function") modProjectile(q);
    q.life -= dt; q.vy += q.grav * dt;
    steerProjectile(q, dt);
    q.x += q.vx * dt;
    if (!q.ghostWall && rectSolid(q.x, q.y, q.w, q.h)) {
      if (q.bounces > 0) { q.x -= q.vx * dt; q.vx *= -1; q.bounces--; burst(q.x + 3, q.y + 2, 4, "#7fc8d6", 40); }
      else { q.life = 0; burst(q.x + q.w / 2, q.y + q.h / 2, 4, q.kind === "bolt" ? "#7fc8d6" : "#8a7f74", 40); continue; }
    }
    q.y += q.vy * dt;
    if (!q.ghostWall && rectSolid(q.x, q.y, q.w, q.h)) {
      if (q.bounces > 0) { q.y -= q.vy * dt; q.vy *= -1; q.bounces--; }
      else { q.life = 0; continue; }
    }
    if (q.kind === "bolt") for (const k of crystals) if (!k.on && overlap(q, k)) { activateCrystal(k); q.life = 0; }
    if (q.kind === "bolt") for (const lv of levers) if (!lv.on && overlap(q, lv)) { pullLever(lv); q.life = 0; }
    if (q.life <= 0) continue;
    hitBreakables(q);
    for (const e of enemies) {
      if (e.dead || e.hidden || q.hits.has(e) || !overlap(q, e)) continue;
      q.hits.add(e);
      hitEnemy(e, q.dmg, Math.sign(q.vx) || 1, { power: 0.5, freeze: 0.02 });
      if (typeof onProjHit === "function") onProjHit(q, e);
      if (q.kind === "star") burst(q.x + 3, q.y + 3, 12, "#f2d45a", 100);
      if (!q.pierce) { q.life = 0; break; }
    }
  }
  projectiles = projectiles.filter(q => q.life > 0);
  for (const h of hazards) {
    h.life -= dt; h.t += dt;
    for (const e of enemies) if (!e.dead && e.burnCd <= 0 && overlap(h, e)) {
      e.burnCd = 0.45;
      hitEnemy(e, dmgOf(0.5), 0, { power: 0.15, freeze: 0, stun: 0.1 });
    }
    if (Math.random() < dt * 8) particles.push({ x: h.x + Math.random() * 8, y: h.y + 2, vx: 0, vy: -30, life: 0.3, max: 0.3, color: "#f2b54a", g: -20 });
  }
  hazards = hazards.filter(h => h.life > 0);
  for (const g of ghosts) g.life -= dt;
  ghosts = ghosts.filter(g => g.life > 0);
}
