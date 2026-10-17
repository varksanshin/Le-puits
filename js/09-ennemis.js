"use strict";
// ---------- 8. Ennemis ----------
let enemies = [], kills = 0;
// weight : sensibilité au recul (les lourds en dessous de 0.5 ne sont pas ramenés par le Crochet)
const ENEMY_TYPES = {
  crawler: { w: 14, h: 8,  hp: 3, speed: 28, weight: 1,   damage: 1, name: "Larve" },
  bat:     { w: 10, h: 8,  hp: 2, speed: 58, weight: 1.2, damage: 1, name: "Chauve-souris", fly: true },
  spitter: { w: 12, h: 10, hp: 3, speed: 0,  weight: 0.6, damage: 1, name: "Cracheur" },
  golem:   { w: 20, h: 22, hp: 6, speed: 22, weight: 0.3, damage: 2, name: "Golem de pierre" },
  wisp:    { w: 8,  h: 8,  hp: 1, speed: 38, weight: 1.5, damage: 1, name: "Feu follet", fly: true, ghost: true },
  boss:    { w: 28, h: 28, hp: 40, speed: 34, weight: 0.05, damage: 1, name: "Le Gardien du puits" },
};
function makeEnemy(sp) {
  const d = ENEMY_TYPES[sp.type];
  const x = sp.cx * T + (T - d.w) / 2, y = (sp.cy + 1) * T - d.h - (d.fly ? 4 : 0);
  return { type: sp.type, x, y, prevX: x, prevY: y, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp * (has("couronne") ? 1.5 : 1), speed: d.speed, baseSpeed: d.speed, weight: d.weight, damage: d.damage,
           dir: Math.random() < 0.5 ? -1 : 1, fly: !!d.fly, ghost: !!d.ghost, homeX: x, homeY: y,
           stun: 0, daze: 0, flash: 0, cooldown: 0, burnCd: 0, bleed: 0, bleedT: 0, state: "walk", stateT: 0, shootCd: 1 + Math.random(),
           t: Math.random() * 6, dead: false, onGround: false };
}
function updateEnemies(dt) {
  const p = player;
  for (const e of enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt); if (e.hitFx) e.hitFx = Math.max(0, e.hitFx - dt); e.stun = Math.max(0, e.stun - dt); e.daze = Math.max(0, e.daze - dt);
    e.cooldown = Math.max(0, e.cooldown - dt); e.burnCd = Math.max(0, e.burnCd - dt);
    if (e.type === "crawler") updateCrawler(e, dt);
    else if (e.type === "bat") updateBat(e, dt, p);
    else if (e.type === "spitter") updateSpitter(e, dt, p);
    else if (e.type === "golem") updateGolem(e, dt, p);
    else if (e.type === "wisp") updateWisp(e, dt, p);
    else if (e.type === "boss") updateBoss(e, dt, p);
    else if (ENEMY_AI[e.type]) ENEMY_AI[e.type](e, dt, p);
    if (e.mini) updateMiniExtra(e, dt, p);
    if (!e.boss) e.speed = e.baseSpeed * (1 + 0.5 * corruption());     // les ténèbres accélèrent les monstres
    // Saignement (Ombre du voleur)
    if (e.bleed > 0) {
      e.bleedT -= dt;
      if (e.bleedT <= 0) { e.bleedT = 0.4; e.bleed--; hitEnemy(e, dmgOf(0.7), 0, { power: 0, freeze: 0, stun: 0.05 }); burst(e.x + e.w / 2, e.y + e.h / 2, 4, "#c4413b", 40); if (e.dead) continue; }
    }
    e.spikeCd = Math.max(0, (e.spikeCd || 0) - dt);
    if (!e.fly && e.spikeCd <= 0 && touchingSpikes(e)) { e.spikeCd = 0.5; hitEnemy(e, 1, 0, { power: 0.4, freeze: 0, stun: 0.2 }); if (e.dead) continue; }
    if (e.y > MH * T + 64) { e.dead = true; continue; }
    if (!p.dead && !e.hidden && overlap(p, e)) {
      if (p.phasing) {                                    // en phase, on traverse sans se blesser
        if (!p.phaseHits.has(e)) {
          p.phaseHits.add(e); onPhaseThrough(e);
          if (has("ombre")) { e.bleed = 3; e.bleedT = 0.25; burst(e.x + e.w / 2, e.y + e.h / 2, 8, "#c4413b", 70); }
        }
      } else if (e.daze <= 0) {
        const wasInvuln = p.invuln > 0 || (p.dashTimer > 0 && (has("voile") || has("lamevent")));
        hurtPlayer(e, e.damage);
        if (!wasInvuln && e.type === "bat") { e.state = "idle"; e.cooldown = 1.3; e.vx = -Math.sign(p.x - e.x) * 90; e.vy = -60; }
        if (!wasInvuln && e.type === "wisp" && !e.mini) { e.dead = true; burst(e.x + 4, e.y + 4, 24, "#8ff0d0", 110); continue; }
      }
    }
  }
  enemies = enemies.filter(e => !e.dead);
}
function updateCrawler(e, dt) {
  if (e.stun > 0 || e.daze > 0) e.vx = approach(e.vx, 0, 500 * dt);
  else {
    e.vx = approach(e.vx, e.dir * e.speed, 200 * dt);
    if (e.onGround) {
      const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
      const ground = tile(Math.floor(fx / T), Math.floor((e.y + e.h + 1) / T));
      const wall = tile(Math.floor(fx / T), Math.floor((e.y + e.h - 1) / T));
      if (solid(wall) || wall === "^" || (!solid(ground) && ground !== "-")) { e.dir *= -1; e.vx = 0; }
    }
  }
  e.vy = Math.min(e.vy + 1500 * dt, 430);
  e.hitWall = false;
  moveX(e, e.vx * dt);
  if (e.hitWall && e.stun <= 0) e.dir *= -1;
  moveY(e, e.vy * dt);
}
// Cracheur : plante enracinée qui crache des boules d'acide en cloche
function updateSpitter(e, dt, p) {
  e.vy = Math.min(e.vy + 1500 * dt, 430);
  e.vx = approach(e.vx, 0, 400 * dt);
  moveX(e, e.vx * dt); moveY(e, e.vy * dt);
  if (e.daze > 0 || e.stun > 0) { e.state = "idle"; return; }
  const ex = e.x + e.w / 2, ey = e.y + 2, px = p.x + p.w / 2, py = p.y + p.h / 2;
  const dx = px - ex, dy = py - ey;
  e.dir = Math.sign(dx) || e.dir;
  e.shootCd -= dt;
  if (e.state === "wind") {
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.state = "idle"; e.shootCd = 2.2;
      const tt = Math.max(0.45, Math.min(1.2, Math.abs(dx) / 120)), g = 420;
      shots.push({ x: ex - 2.5, y: ey - 2.5, w: 5, h: 5, vx: dx / tt, vy: (dy - 0.5 * g * tt * tt) / tt, grav: g, life: 3 });
      burst(ex, ey, 5, "#b8d048", 50);
    }
  } else if (!p.dead && e.shootCd <= 0 && Math.abs(dx) < 170 && Math.abs(dy) < 110 && lineClear(ex, ey - 6, px, py)) {
    e.state = "wind"; e.stateT = 0.4;
  }
}
// Golem de pierre : lent, mais charge tête baissée quand il te voit à sa hauteur
function updateGolem(e, dt, p) {
  e.vy = Math.min(e.vy + 1500 * dt, 430);
  const px = p.x + p.w / 2, ex = e.x + e.w / 2;
  if (e.daze > 0) { e.state = "walk"; e.vx = approach(e.vx, 0, 600 * dt); }
  else if (e.state === "wind") {
    e.vx = 0; e.stateT -= dt;
    if (e.stateT <= 0) { e.state = "charge"; e.stateT = 1.6; shake(1.5, 0.1); }
  } else if (e.state === "charge") {
    e.vx = e.dir * 155; e.stateT -= dt;
    if (Math.random() < dt * 30) dust(e.dir > 0 ? e.x : e.x + e.w, e.y + e.h, 1);
    const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
    const ground = tile(Math.floor(fx / T), Math.floor((e.y + e.h + 1) / T));
    if (e.onGround && !solid(ground) && ground !== "-" && ground !== "^") { e.state = "walk"; e.vx = 0; e.cooldown = 1.2; }
    else if (e.stateT <= 0) { e.state = "walk"; e.cooldown = 1.2; }
  } else {
    if (e.stun > 0) e.vx = approach(e.vx, 0, 500 * dt);
    else {
      e.vx = approach(e.vx, e.dir * e.speed, 150 * dt);
      if (e.onGround) {
        const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
        const ground = tile(Math.floor(fx / T), Math.floor((e.y + e.h + 1) / T));
        const wall = tile(Math.floor(fx / T), Math.floor((e.y + e.h - 1) / T));
        if (solidFor(e, wall) || wall === "^" || (!solid(ground) && ground !== "-")) { e.dir *= -1; e.vx = 0; }
      }
    }
    if (!p.dead && e.cooldown <= 0 && e.onGround && Math.abs(px - ex) < 140 && Math.abs((p.y + p.h) - (e.y + e.h)) < 26 && lineClear(ex, e.y + 6, px, p.y + 6)) {
      e.dir = Math.sign(px - ex) || e.dir; e.state = "wind"; e.stateT = 0.55;
    }
  }
  e.hitWall = false;
  moveX(e, e.vx * dt);
  if (e.hitWall) {
    if (e.state === "charge") {                          // il percute le mur et reste sonné
      e.state = "walk"; e.daze = 1.4; e.cooldown = 2; shake(3, 0.2);
      burst(e.dir > 0 ? e.x + e.w : e.x, e.y + e.h / 2, 14, "#7a7180", 100);
    } else if (e.stun <= 0) e.dir *= -1;
  }
  moveY(e, e.vy * dt);
}
// Feu follet : traverse les murs et dérive vers toi, puis explose au contact
function updateWisp(e, dt, p) {
  const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1;
  if (e.stun > 0 || e.daze > 0) { e.vx = approach(e.vx, 0, 160 * dt); e.vy = approach(e.vy, 0, 160 * dt); }
  else if (d < 150 && !p.dead) {
    e.vx = approach(e.vx, dx / d * e.speed + Math.cos(e.t * 3) * 12, 70 * dt);
    e.vy = approach(e.vy, dy / d * e.speed + Math.sin(e.t * 4) * 12, 70 * dt);
  } else {
    e.vx = approach(e.vx, (e.homeX - e.x) * 1.5 + Math.cos(e.t * 2) * 10, 50 * dt);
    e.vy = approach(e.vy, (e.homeY - e.y) * 1.5 + Math.sin(e.t * 3) * 8, 50 * dt);
  }
  e.x += e.vx * dt; e.y += e.vy * dt;
  if (Math.random() < dt * 14) particles.push({ x: e.x + 4 + (Math.random() - 0.5) * 4, y: e.y + 4, vx: -e.vx * 0.2, vy: -10, life: 0.4, max: 0.4, color: "#8ff0d0", g: -10 });
}
// Tirs ennemis
let shots = [];
function updateShots(dt) {
  const p = player;
  for (const s of shots) {
    s.life -= dt; s.vy += s.grav * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (rectSolid(s.x, s.y, s.w, s.h)) { s.life = 0; burst(s.x + 2, s.y + 2, 6, "#b8d048", 50); continue; }
    if (!p.dead && overlap(s, p)) {
      if (p.phasing && has("ether")) continue;          // Pas de l'éther : le tir passe au travers
      if (p.invuln > 0 || (p.dashTimer > 0 && has("voile"))) continue;
      hurtPlayer(s, 1); s.life = 0; burst(s.x + 2, s.y + 2, 8, "#b8d048", 70);
    }
  }
  shots = shots.filter(s => s.life > 0);
}
function updateBat(e, dt, p) {
  const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2), dist = Math.hypot(dx, dy) || 1;
  if (e.daze > 0) {
    e.vx = approach(e.vx, 0, 200 * dt); e.vy = approach(e.vy, 15, 200 * dt);
  } else if (e.stun > 0 || e.cooldown > 0) {
    e.vx = approach(e.vx, 0, 200 * dt); e.vy = approach(e.vy, 0, 200 * dt);
  } else if (dist < 95 && !p.dead) {
    if (e.state !== "chase") {                            // elle te repère, frémit, puis plonge
      if (e.state !== "wind") { e.state = "wind"; e.stateT = 0.4; }
      e.stateT -= dt;
      e.vx = approach(e.vx, 0, 300 * dt); e.vy = approach(e.vy, 0, 300 * dt);
      if (e.stateT <= 0) e.state = "chase";
    } else {
      e.vx = approach(e.vx, dx / dist * e.speed, 210 * dt);
      e.vy = approach(e.vy, dy / dist * e.speed, 210 * dt);
    }
  } else {
    e.state = "idle";
    const hx = e.homeX - e.x, hy = e.homeY + Math.sin(e.t * 2) * 6 - e.y;
    e.vx = approach(e.vx, Math.max(-30, Math.min(30, hx * 2)), 120 * dt);
    e.vy = approach(e.vy, Math.max(-30, Math.min(30, hy * 2)), 120 * dt);
  }
  moveX(e, e.vx * dt);
  moveY(e, e.vy * dt);
}
