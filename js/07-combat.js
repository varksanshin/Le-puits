"use strict";
// ---------- 6. Combat ----------
function dmgOf(base) {
  let d = base * stats.damageMult;
  if (has("berserker")) d *= 1 + (stats.maxHp - player.hp) * 0.25;
  if (has("calice")) d *= 1 + dark / 100;
  return d;
}
// ----- Plongeon (comme dans Dead Cells) : bas + attaque en l'air → on fonce vers le sol, et l'impact frappe autour -----
const DIVE = {
  speed: 470,          // vitesse de chute pendant le plongeon (px/s)
  damage: 1.6,         // dégâts de l'onde de choc (× les dégâts de l'épée), jusqu'à +60 % après une longue chute
  reach: 30,           // portée de l'onde de choc de chaque côté (px), un peu plus après une longue chute
  lag: 0.14,           // petit temps d'arrêt à l'atterrissage : on sent le poids du coup
};
function startDive(p) {
  p.diving = true; p.diveStartY = p.y; p.vx = 0; p.vy = DIVE.speed;
  p.sx = 0.7; p.sy = 1.35; p.jumping = false;
}
function stopDive(p) { p.diving = false; }
function diveSlam() {
  const p = player; p.diving = false;
  const fall = p.y - p.diveStartY, k = Math.max(0, Math.min(1, fall / (7 * T)));
  const cx = p.x + p.w / 2, cy = p.y + p.h, reach = DIVE.reach + 14 * k;
  const box = { x: cx - reach, y: cy - 20, w: reach * 2, h: 22 };
  p.sx = 1.45; p.sy = 0.62; p.diveLag = DIVE.lag; p.vx = 0;
  shake(2 + 2.5 * k, 0.16 + 0.1 * k); freeze = Math.max(freeze, 0.07 + 0.05 * k);
  dust(cx, cy, 10 + Math.round(10 * k));
  for (const d of [-1, 1]) for (let i = 0; i < 8; i++)
    particles.push({ x: cx + d * 4, y: cy - 2, vx: d * (60 + Math.random() * 120) * (0.7 + k * 0.6), vy: -20 - Math.random() * 60, life: 0.35, max: 0.35, color: i % 2 ? "#e9e1cf" : "#a89a86", g: 300 });
  if (typeof hitRings !== "undefined") hitRings.push({ x: cx, y: cy - 4, life: 0.18 });
  hitLevers(box); hitBreakables(box);
  // avec la Frappe chargée, le plongeon fend aussi les sols fissurés
  if (skills.smash) breakWalls({ x: cx - 10, y: cy + 2, w: 20, h: T - 4 });
  for (const e of enemies) {
    if (e.dead || e.hidden || !overlap(box, e)) continue;
    const { d, crit } = swordDamage(DIVE.damage * (1 + 0.6 * k));
    hitEnemy(e, d, Math.sign(e.x + e.w / 2 - cx) || p.face, { power: 1.2 + 0.5 * k, freeze: 0.06 });
    onSwordHit(e, crit);
  }
}

function updateAttack(dt) {
  const p = player, s = stats;
  p.atkCooldown = Math.max(0, p.atkCooldown - dt);
  p.atkBuffer = Math.max(0, p.atkBuffer - dt);
  if (input.attackPressed) { p.atkBuffer = s.attackBuffer; p.charge = 0; p.chargeArmed = true; }
  if (p.atkBuffer > 0 && p.atkCooldown <= 0 && p.hurt <= 0 && p.dashTimer <= 0 && !p.diving && !(p.diveLag > 0)) {
    p.atkBuffer = 0;
    // Huit directions : côté, haut, diagonale haute, et en l'air : bas (rebond) ou diagonale basse
    const ix = Math.abs(input.x) > 0.3;
    if (input.up && !input.down) p.atkDir = ix ? "diagUp" : "up";
    else if (!p.onGround && input.down) p.atkDir = ix ? "diagDown" : "down";
    else p.atkDir = "side";
    if (ix && p.hurt <= 0) p.face = Math.sign(input.x);
    p.atkTimer = s.attackTime; p.atkCooldown = s.attackCooldown; p.atkHits = new Set();
    if (p.atkDir === "down" && !p.grapple && p.phaseTimer <= 0 && !p.inWater) startDive(p);
    onSwing(p);
  }
  if (skills.smash && p.chargeArmed) {
    if (input.attack && p.hurt <= 0 && p.dashTimer <= 0) {
      const before = p.charge; p.charge += dt;
      if (before < s.chargeTime && p.charge >= s.chargeTime) { p.sx = 1.15; p.sy = 0.9; burst(p.x + p.w / 2, p.y + 4, 8, "#e8913a", 50); }
    } else {
      if (p.charge >= s.chargeTime) heavyStrike();
      p.charge = 0; p.chargeArmed = false;
    }
  } else p.charge = 0;

  // pendant le plongeon, la lame reste tendue vers le bas
  if (p.diving) { p.atkDir = "down"; p.atkTimer = Math.max(p.atkTimer, 0.03); }
  if (p.atkTimer <= 0) return;
  p.atkTimer -= dt;
  const box = attackBox(p.x, p.y);
  const boxes = [box];
  // Double tranchant : un second coup derrière soi
  if (has("revers") && p.atkDir !== "heavy") { const f = p.face; p.face = -f; boxes.push(attackBox(p.x, p.y)); p.face = f; }
  for (const b of boxes) { hitLevers(b); hitBreakables(b); }
  for (const sh of shots) if (sh.life > 0 && sh.kind !== "wave" && overlap(box, sh)) { sh.life = 0; burst(sh.x + 2, sh.y + 2, 8, "#b8d048", 70); }   // l'épée renvoie les crachats
  for (const e of enemies) {
    if (e.dead || e.hidden || p.atkHits.has(e) || !boxes.some(b => overlap(b, e))) continue;
    p.atkHits.add(e);
    const behind = !overlap(box, e), dir = behind ? -p.face : p.face;
    if (p.atkDir === "heavy") {
      hitEnemy(e, dmgOf(s.heavyDamage), p.face, { power: 1.7, freeze: 0.1, daze: has("marteau") ? 1.8 : 0 });
      continue;
    }
    const { d, crit } = swordDamage(1);
    if ((p.atkDir === "down" || p.atkDir === "diagDown") && !behind) {
      hitEnemy(e, d, p.atkDir === "down" ? (Math.sign(e.x - p.x) || p.face) : p.face, { down: true });
      if (p.diving) { stopDive(p); p.atkTimer = Math.min(p.atkTimer, 0.05); }            // un ennemi sur la route : on rebondit dessus
      p.vy = -s.jumpVel * s.pogoMult; p.jumping = false; p.usedAirJump = false;
      p.airJumps = skills.doubleJump ? s.extraJumps : 0;
    } else if ((p.atkDir === "up" || p.atkDir === "diagUp") && !behind) {
      hitEnemy(e, d, p.atkDir === "up" ? (Math.sign(e.x - p.x) || p.face) : p.face, { up: true });
    } else {
      hitEnemy(e, d, dir, {});
      if (p.onGround && !behind) p.vx -= p.face * 50;
    }
    onSwordHit(e, crit);
  }
}
function heavyStrike() {
  const p = player;
  p.atkDir = "heavy"; p.atkTimer = 0.16; p.atkCooldown = 0.3; p.atkHits = new Set();
  p.sx = 1.3; p.sy = 0.8; p.vx += p.face * 60;
  shake(3, 0.18);
  const b = attackBox(p.x, p.y), ix = p.face > 0 ? b.x + b.w - 4 : b.x + 4, iy = b.y + b.h / 2;
  burst(ix, iy, 14, "#e9e1cf", 110);
  breakWalls(b); hitBreakables(b); onHeavyStrike(p);
  if (has("gantelet")) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * (0.15 + 0.7 * i / 6);
      projectiles.push({ kind: "shard", x: ix - 1.5, y: iy - 1.5, w: 3, h: 3, vx: Math.cos(a) * 150 + p.face * 50, vy: Math.sin(a) * 170, grav: 650, life: 1.2, bounces: 0, dmg: dmgOf(1), hits: new Set() });
    }
  }
}
function attackBox(x, y) {
  const p = player, r = stats.attackRange;
  if (p.atkDir === "down") return { x: x - 4, y: y + p.h - 2, w: p.w + 8, h: 18 * r / 20 };
  if (p.atkDir === "up") return { x: x - 4, y: y - r + 2, w: p.w + 8, h: r };
  const dg = r * 0.85;
  if (p.atkDir === "diagUp") return { x: p.face > 0 ? x + p.w - 6 : x - dg + 6, y: y - dg + 6, w: dg, h: dg };
  if (p.atkDir === "diagDown") return { x: p.face > 0 ? x + p.w - 6 : x - dg + 6, y: y + p.h - 6, w: dg, h: dg };
  if (p.atkDir === "heavy") return { x: p.face > 0 ? x + p.w - 2 : x - 30 + 2, y: y - 8, w: 30, h: p.h + 14 };
  return { x: p.face > 0 ? x + p.w - 2 : x - r + 2, y: y - 3, w: r, h: p.h + 6 };
}
function hitEnemy(e, dmg, dirX, o) {
  if (e.dead || e.hidden) return;
  e.hp -= dmg; e.flash = 0.12; e.hitFx = 0.16;
  if (o.freeze !== 0 && typeof hitSparks === "function") hitSparks(e, dirX, o);
  if (e.boss) {                                    // le Gardien encaisse sans reculer
    if (o.daze) e.daze = Math.max(e.daze, 0.6);
    burst(e.x + e.w / 2, e.y + e.h / 2, 6, "#e9e1cf", 90);
    freeze = Math.max(freeze, o.freeze ?? 0.04);
    if (e.hp <= 0) { e.dead = true; kills++; renderKills(); onEnemyKilled(e); onBossDeath(e); }
    return;
  }
  e.stun = Math.max(e.stun, o.stun ?? 0.28);
  if (o.daze) e.daze = o.daze;
  const kb = stats.knockback * e.weight * (o.power ?? 1);
  if (o.down) { e.vy = kb * 0.6; e.vx = dirX * kb * 0.3; }
  else if (o.up) { e.vy = -kb * 0.9; e.vx = dirX * kb * 0.4; }
  else { e.vx = dirX * kb; e.vy = e.type === "bat" ? -kb * 0.3 : -80 * (o.power ?? 1); }
  freeze = Math.max(freeze, o.freeze ?? 0.05);
  burst(e.x + e.w / 2, e.y + e.h / 2, 6, "#e9e1cf", 90);
  if (e.hp <= 0) {
    e.dead = true; kills++; renderKills();
    freeze = Math.max(freeze, 0.08);
    burst(e.x + e.w / 2, e.y + e.h / 2, e.type === "golem" ? 40 : 22, { bat: "#9d6bc4", spitter: "#a05a8a", golem: "#7a7180", wisp: "#8ff0d0" }[e.type] || "#8fae5a", 120);
    if (e.type === "golem") shake(3, 0.25);
    onEnemyKilled(e);
    if (has("couronne") && Math.random() < 0.3) {
      pickups.push(makePickup(e.x + e.w / 2 - 5, Math.min(e.y, e.y + e.h - 14)));
      toast("La Couronne maudite fait apparaître un autel…", 1800);
    }
  }
}
function hurtPlayer(src, dmg) {
  const p = player;
  if (p.invuln > 0 || p.dead) return;
  if (p.dashTimer > 0 && (has("voile") || has("lamevent"))) return;
  p.hp -= dmg; renderHearts(); onPlayerHurt();
  const dir = Math.sign((p.x + p.w / 2) - (src.x + src.w / 2)) || -p.face;
  const kt = stats.knockTaken;
  p.vx = dir * 170 * kt; p.vy = -230 * Math.max(0.5, kt); p.hurt = 0.25 * Math.max(0.4, kt);
  p.invuln = stats.invulnTime; p.jumping = false; p.dashTimer = 0; p.charge = 0; p.chargeArmed = false; p.grapple = null;
  freeze = 0.09;
  burst(p.x + p.w / 2, p.y + p.h / 2, 12, "#c4413b", 100);
  if (p.hp <= 0) die();
}
function die() {
  const p = player;
  p.dead = true; p.deadTimer = 1.6;
  burst(p.x + p.w / 2, p.y + p.h / 2, 20, "#c4413b", 150);
  if (typeof heroDeathFx === "function") heroDeathFx();
  shake(4, 0.35); freeze = Math.max(freeze, 0.2);
  toast("Le puits t'a englouti. La run recommence, les objets sont perdus…", 1800);
}
