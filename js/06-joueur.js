"use strict";
// ---------- 5. Joueur ----------
let player;
function resetRun(startAt) {
  if (typeof miniBeaten !== "undefined" && !(typeof loadingSave !== "undefined" && loadingSave)) miniBeaten = new Set();
  loadMap();
  dark = 0; darkLocked = false; darkShown = -1; whisperT = 8; darkTickT = DARK.tickEvery; darkTickFx = 0; floaters.length = 0;
  bossFight = null; bossBarEl.hidden = true;
  startRunClock(!!startAt);
  skills = {}; items = new Set();
  stats = null; computeStats();
  resetPurse();
  const sx = startAt ? startAt.x : spawn.x, sy = startAt ? startAt.y : spawn.y;
  player = {
    x: sx, y: sy, w: 10, h: 14, vx: 0, vy: 0, face: 1, cornerFix: true, plats: true,
    safeX: sx, safeY: sy, onPlat: null,
    onGround: false, coyote: 0, buffer: 0, airJumps: 0, jumping: false, dropTimer: 0, usedAirJump: false,
    sx: 1, sy: 1, lean: 0, cape: 0, fallStartY: sy, anim: 0, gliding: false,
    hp: stats.maxHp, invuln: 0, hurt: 0, dead: false, deadTimer: 0,
    atkTimer: 0, atkCooldown: 0, atkBuffer: 0, atkDir: "side", atkHits: new Set(), charge: 0, chargeArmed: false,
    dashTimer: 0, dashDir: 1, diving: false, diveLag: 0, diveStartY: 0, dashCharges: 0, dashCd: 0, dashRefill: 0, ghostT: 0, fireT: 0,
    boltCd: 0, zone: 0,
    grapple: null, grappleCd: 0, rope: null,
    phaseTimer: 0, phaseCd: 0, phasing: false, phaseDir: 1, phaseStart: null, phaseExtra: 0, phaseHits: new Set(),
  };
  player.prevX = player.x; player.prevY = player.y;
  player.zone = zoneOf(player);
  visited = new Set([player.zone]);
  enemies = enemySpawns.map(makeEnemy); enemies.forEach((e, i) => { e.si = i; });
  if (!loadingSave) mapSeen = new Set();
  projectiles = []; hazards = []; ghosts = []; shots = [];
  kills = 0;
  flags = { finished: false, hintWall: false, hintBucket: false };
  particles.length = 0;
  cam.x = player.x - VW / 2; cam.y = player.y - VH / 2;
  renderSkills(); renderHearts(); renderKills(); renderItems();
  if (!startAt) toast(bossDoor ? "Descends jusqu'au Gardien, au fond du puits." : exitRune ? "Descends jusqu'à la rune de sortie." : "Cette map n'a pas encore de sortie.", 2600);
  renderDark();
}

function computeStats() {
  const oldMax = stats ? stats.maxHp : null;
  stats = deriveStats(tuning);
  for (const id of items) if (ITEM[id].stat) ITEM[id].stat(stats);
  stats.maxHp = Math.max(1, stats.maxHp);
  if (player && oldMax !== null) {
    if (stats.maxHp > oldMax) player.hp += stats.maxHp - oldMax;
    player.hp = Math.min(player.hp, stats.maxHp);
    player.airJumps = Math.min(player.airJumps, skills.doubleJump ? stats.extraJumps : 0);
    player.dashCharges = Math.min(Math.max(player.dashCharges, player.onGround ? stats.dashCharges : 0), stats.dashCharges);
    renderHearts();
  }
}

function updatePlayer(dt) {
  const p = player, s = stats;
  if (p.dead) {
    p.deadTimer -= dt;
    if (p.deadTimer <= 0 && !runOver) endRun("death");
    return;
  }
  p.coyote = p.onGround ? s.coyote : Math.max(0, p.coyote - dt);
  p.buffer = Math.max(0, p.buffer - dt);
  p.dropTimer = Math.max(0, p.dropTimer - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashRefill = Math.max(0, p.dashRefill - dt);
  p.boltCd = Math.max(0, p.boltCd - dt);
  p.grappleCd = Math.max(0, p.grappleCd - dt);
  p.phaseCd = Math.max(0, p.phaseCd - dt);
  if (p.rope) { p.rope.t -= dt; if (p.rope.t <= 0) p.rope = null; }
  if (input.jumpPressed) p.buffer = s.jumpBuffer;

  // Phase : glissade fantôme à travers les grilles et les ennemis
  if (input.phasePressed && skills.phase && p.phaseCd <= 0 && p.hurt <= 0 && p.phaseTimer <= 0 && p.dashTimer <= 0) {
    p.grapple = null;
    p.phaseDir = input.x ? Math.sign(input.x) : p.face; p.face = p.phaseDir;
    p.phaseTimer = s.phaseTime; p.phaseCd = s.phaseCooldown; p.phasing = true; p.phaseExtra = 0;
    p.phaseStart = { x: p.x, y: p.y }; p.phaseHits = new Set(); p.charge = 0; p.chargeArmed = false; p.jumping = false;
    p.sx = 1.3; p.sy = 0.7;
    burst(p.x + p.w / 2, p.y + p.h / 2, 8, "#9d6bc4", 60);
  }
  // Grappin : vers l'anneau ou l'ennemi visé
  if (input.grapplePressed && skills.grapple && p.grappleCd <= 0 && p.hurt <= 0 && !p.grapple && p.phaseTimer <= 0) {
    p.grappleCd = s.grappleCooldown;
    const tg = grappleTarget();
    if (tg) startGrapple(tg);
    else p.rope = { x: p.x + p.w / 2 + p.face * 70, y: p.y + 2, t: 0.12, miss: true };
  }

  if (input.dashPressed && skills.dash && p.dashCharges > 0 && p.dashCd <= 0 && p.hurt <= 0 && p.dashTimer <= 0 && p.phaseTimer <= 0) {
    p.grapple = null;
    p.dashDir = input.x ? Math.sign(input.x) : p.face; p.face = p.dashDir;
    p.dashTimer = s.dashTime; p.dashCharges--; p.dashCd = 0.12; p.dashRefill = s.dashCooldown;
    p.charge = 0; p.chargeArmed = false; p.jumping = false; p.sx = 1.35; p.sy = 0.75;
    dust(p.x + p.w / 2, p.y + p.h, 4);
  }

  if (p.diveLag > 0) p.diveLag -= dt;
  // le plongeon s'arrête si autre chose prend la main (coup reçu, dash, phase, grappin, eau)
  if (p.diving && (p.hurt > 0 || p.dashTimer > 0 || p.phaseTimer > 0 || p.grapple || p.inWater)) stopDive(p);
  const ix = p.hurt > 0 || p.diveLag > 0 ? 0 : input.x;
  p.gliding = false;
  senseEnvironment(p);
  if (p.phaseTimer > 0) {
    p.phaseTimer -= dt;
    p.vx = p.phaseDir * s.phaseSpeed; p.vy = 0;
    p.ghostT -= dt;
    if (p.ghostT <= 0) { p.ghostT = 0.03; ghosts.push({ x: p.x, y: p.y, face: p.face, life: 0.25, phase: true }); }
    if (p.phaseTimer <= 0) {
      // On ne ressort jamais coincé dans une grille : la glissade continue un peu, sinon retour au départ
      if (bodyStuck(p)) {
        p.phaseExtra += dt;
        if (p.phaseExtra > 0.5) { p.x = p.phaseStart.x; p.y = p.phaseStart.y; p.phasing = false; p.vx = 0; p.prevX = p.x; p.prevY = p.y; }
        else p.phaseTimer = dt;
      } else { p.phasing = false; p.vx = p.phaseDir * s.runSpeed * 0.8; }
    }
  } else if (p.grapple) {
    updateGrapple(dt);
  } else if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashDir * s.dashSpeed; p.vy = 0;
    p.ghostT -= dt;
    if (p.ghostT <= 0) { p.ghostT = 0.025; ghosts.push({ x: p.x, y: p.y, face: p.face, life: 0.2 }); }
    if (has("braise")) { p.fireT -= dt; if (p.fireT <= 0) { p.fireT = 0.03; hazards.push({ x: p.x + p.w / 2 - 4, y: p.y + p.h - 8, w: 8, h: 8, life: 1.1, t: Math.random() * 6 }); } }
    if (p.dashTimer <= 0) p.vx = p.dashDir * s.runSpeed;
  } else {
    if (p.hurt <= 0 && !(p.wallLock > 0)) {
      let target = ix * s.runSpeed;
      if (p.charge > 0.15) target *= 0.55;
      let accel;
      if (ix === 0) accel = p.onGround ? s.groundDecel : s.airDecel;
      else {
        accel = p.onGround ? s.groundAccel : s.airAccel;
        if (Math.sign(ix) !== Math.sign(p.vx) && Math.abs(p.vx) > 1) accel *= s.turnBoost;
        else if (Math.abs(p.vx) > Math.abs(target)) accel = p.onGround ? s.groundDecel : s.airDecel;
      }
      p.vx = approach(p.vx, target, accel * dt);
    }
    if (p.buffer > 0 && p.hurt <= 0) {
      if (p.onGround && input.down && standingOnPlank()) {
        p.dropTimer = 0.25; p.buffer = 0; p.onGround = false; p.y += 1;
      } else if (p.coyote > 0) {
        doJump(false);
      } else if (tryWallJump(p)) {
        // saut mural
      } else if (p.airJumps > 0) {
        p.airJumps--; doJump(true);
      }
    }
    if (p.jumping && !input.jump && p.vy < 0) { p.vy *= 0.45; p.jumping = false; }
    if (p.vy >= 0) p.jumping = false;
    let g = s.gravity;
    if (p.vy > 0) g *= s.fallGravMult;
    if (Math.abs(p.vy) < s.apexBand && input.jump) g *= s.apexGravMult;
    p.vy = Math.min(p.vy + g * dt, s.maxFall);
    if (has("cape") && p.vy > 40 && input.jump && p.hurt <= 0) { p.vy = 40; p.gliding = true; }
    applyEnvironment(p, dt, ix);
    if (p.diving) {
      p.vx = 0; p.vy = DIVE.speed;
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.03; ghosts.push({ x: p.x, y: p.y, face: p.face, life: 0.18 }); }
    }
  }
  if (ix && p.atkTimer <= 0 && p.dashTimer <= 0 && p.phaseTimer <= 0 && !p.grapple) p.face = Math.sign(ix);

  updateAttack(dt);
  if (input.boltPressed && skills.bolt && p.boltCd <= 0 && p.hurt <= 0) { fireBolt(); p.boltCd = s.boltCooldown; }

  const wasGround = p.onGround;
  p.hitWall = false;
  moveX(p, p.vx * dt);
  moveY(p, p.vy * dt);
  if (p.bonk) { p.jumping = false; p.bonk = false; if (p.grapple) endGrapple(true); }
  if (p.hitWall && p.grapple) endGrapple(true);
  stepOnCrumbles(p);

  if (touchingSpikes(p)) {
    if (p.invuln <= 0) { p.hp -= 1; renderHearts(); }
    burst(p.x + p.w / 2, p.y + p.h, 14, "#c4413b", 90);
    if (p.hp <= 0) { die(); return; }
    p.invuln = Math.max(p.invuln, 1); p.x = p.safeX; p.y = p.safeY; p.vx = 0; p.vy = 0; p.dashTimer = 0; p.diving = false;
    p.prevX = p.x; p.prevY = p.y; p.onPlat = null;
    freeze = Math.max(freeze, 0.15); shake(2, 0.12);
    return;
  }
  if (p.onGround && !p.onPlat && p.hurt <= 0 && safeSpot(p)) { p.safeX = p.x; p.safeY = p.y; }
  // Tombé hors de la map : retour au dernier sol sûr
  if (p.y > MH * T + 64) { p.x = p.safeX; p.y = p.safeY; p.vx = p.vy = 0; p.prevX = p.x; p.prevY = p.y; }

  if (!wasGround && p.onGround) land();
  if (p.diving && p.onGround) diveSlam();
  if (wasGround && !p.onGround && p.vy >= 0) p.fallStartY = p.y;
  if (p.onGround) {
    p.airJumps = skills.doubleJump ? s.extraJumps : 0;
    if (p.dashRefill <= 0 && p.dashTimer <= 0) p.dashCharges = s.dashCharges;
  }

  const k = Math.min(1, dt * 14);
  p.sx += (1 - p.sx) * k; p.sy += (1 - p.sy) * k;
  const speedK = Math.max(-1.5, Math.min(1.5, p.vx / s.runSpeed));
  p.lean = lerp(p.lean, p.onGround ? speedK * p.face * 0.14 : speedK * p.face * 0.06, Math.min(1, dt * 10));
  p.cape = lerp(p.cape, Math.min(1, Math.abs(p.vx) / s.runSpeed + Math.max(0, -p.vy) / s.jumpVel * 0.6), Math.min(1, dt * 8));
  p.anim += Math.abs(p.vx) * dt;
}

// ----- Grappin -----
// Cible : l'anneau ou l'ennemi le plus proche, devant le héros, à portée et en vue
function grappleTarget() {
  const p = player, cx = p.x + p.w / 2, cy = p.y + 4, range = stats.grappleRange;
  const dirX = input.x ? Math.sign(input.x) : p.face;
  let best = null, bestScore = Infinity;
  const consider = (kind, ref, tx, ty, weight) => {
    const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
    if (d > range || d < 28) return;                     // trop près : c'est l'anneau qu'on vient d'atteindre
    if (dx * dirX < -10) return;                         // pas derrière soi
    if (!lineClear(cx, cy, tx, ty)) return;
    const score = d * weight;
    if (score < bestScore) { bestScore = score; best = { kind, ref, x: tx, y: ty }; }
  };
  for (const a of anchors) consider("anchor", a, a.x, a.y, 0.85);
  for (const e of enemies) if (!e.dead && !e.ghost) consider("enemy", e, e.x + e.w / 2, e.y + e.h / 2, 1);
  return best;
}
function startGrapple(tg) {
  const p = player;
  p.charge = 0; p.chargeArmed = false; p.dashTimer = 0; p.jumping = false;
  // Crochet d'acier nain : les petits ennemis sont ramenés vers le héros
  if (tg.kind === "enemy" && has("crochet") && tg.ref.weight >= 0.5) {
    const e = tg.ref, dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1;
    hitEnemy(e, dmgOf(0.5), -Math.sign(dx) || p.face, { power: 0, freeze: 0.06, stun: 0.6 });
    e.vx = dx / d * 300; e.vy = dy / d * 300 - 60; e.daze = Math.max(e.daze, 0.7);
    if (has("chaine")) vampire();
    p.rope = { x: tg.x, y: tg.y, t: 0.14 };
    return;
  }
  p.grapple = { ...tg, t: 0 };
  p.vy = 0;
  burst(tg.x, tg.y, 6, "#a9b7b0", 50);
}
function grapplePoint() {
  const g = player.grapple;
  if (g.kind === "enemy") return { x: g.ref.x + g.ref.w / 2, y: g.ref.y + g.ref.h / 2 };
  return { x: g.ref.x, y: g.ref.y + 12 };                // on finit suspendu sous l'anneau
}
function updateGrapple(dt) {
  const p = player, g = p.grapple;
  if (g.kind === "enemy" && g.ref.dead) { endGrapple(true); return; }
  g.t += dt;
  const t = grapplePoint(), dx = t.x - (p.x + p.w / 2), dy = t.y - (p.y + p.h / 2), d = Math.hypot(dx, dy) || 1;
  if (input.jumpPressed) { endGrapple(true); p.buffer = 0; p.vy = -stats.jumpVel * 0.85; p.jumping = true; return; }
  if (d < 9 || g.t > 0.75) { arriveGrapple(dx / d, dy / d); return; }
  p.vx = dx / d * stats.grappleSpeed; p.vy = dy / d * stats.grappleSpeed;
}
function arriveGrapple(nx, ny) {
  const p = player, g = p.grapple, s = stats;
  p.grapple = null;
  p.airJumps = skills.doubleJump ? s.extraJumps : 0; p.dashCharges = s.dashCharges; p.usedAirJump = false;
  if (g.kind === "enemy") {
    hitEnemy(g.ref, dmgOf(has("harpon") ? 3 : 1), Math.sign(nx) || p.face, { power: 0.9 });
    if (has("harpon") && !g.ref.dead) { g.ref.bleed = 3; g.ref.bleedT = 0.3; }
    if (has("chaine")) vampire();
    p.vx = -nx * 90; p.vy = -210;
  } else {
    p.vx = nx * 140; p.vy = -170;
    p.sx = 0.8; p.sy = 1.2;
  }
}
function endGrapple(soft) {
  const p = player; if (!p.grapple) return;
  p.grapple = null;
  if (soft) { p.vx *= 0.5; p.vy = Math.min(p.vy * 0.5, 0); }
}
// Chaîne vampirique : 1 PV volé, au plus une fois par seconde
function vampire() {
  const p = player;
  if (time - (p.lastLeech || -9) < 1 || p.hp >= stats.maxHp) return;
  p.lastLeech = time; p.hp += 1; renderHearts();
  burst(p.x + p.w / 2, p.y + 4, 10, "#c4413b", 60);
}

function doJump(air) {
  const p = player;
  p.diving = false;                                   // un saut (double saut) annule le plongeon
  p.vy = -stats.jumpVel; p.buffer = 0; p.coyote = 0; p.jumping = true; p.onGround = false;
  p.fallStartY = p.y; p.sx = 0.75; p.sy = 1.3;
  if (air) { p.usedAirJump = true; burst(p.x + p.w / 2, p.y + p.h, 10, "#7fc8d6", 70, true); onAirJump(p); }
  else dust(p.x + p.w / 2, p.y + p.h, 4);
}
function land() {
  const p = player, fall = p.y - p.fallStartY;
  const k = Math.max(0, Math.min(1, fall / 120));
  p.sx = 1 + 0.35 * k; p.sy = 1 - 0.3 * k;
  if (p.onPlat) p.onPlat.vy = 40 + 40 * k;
  if (fall > 20) dust(p.x + p.w / 2, p.y + p.h, 3 + Math.round(6 * k));
  if (p.usedAirJump && has("colosse")) {
    const cx = p.x + p.w / 2, by = p.y + p.h;
    for (const e of enemies) {
      const ex = e.x + e.w / 2;
      if (Math.abs(ex - cx) < 38 && Math.abs((e.y + e.h) - by) < 22) hitEnemy(e, dmgOf(1), Math.sign(ex - cx) || 1, { up: true, freeze: 0.04 });
    }
    for (const d of [-1, 1]) for (let i = 0; i < 8; i++) particles.push({ x: cx, y: by - 1, vx: d * (60 + i * 18), vy: -10 - Math.random() * 20, life: 0.35, max: 0.35, color: "#e8913a", g: 80 });
    shake(2.5, 0.15);
  }
  p.usedAirJump = false;
}
function standingOnPlank() {
  const p = player, cy = Math.floor((p.y + p.h + 1) / T);
  if (p.onPlat) return true;
  const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 0.01) / T);
  let plank = false;
  for (let cx = c0; cx <= c1; cx++) { const t = tile(cx, cy); if (solid(t)) return false; if (t === "-") plank = true; }
  return plank;
}
// Un endroit sûr où réapparaître après les pics : un vrai sol (pas une plateforme friable),
// assez large (3 cases), et sans pics juste à côté. Ainsi on revient toujours « devant » les pics.
function safeSpot(p) {
  const r = Math.floor((p.y + p.h - 1) / T), rb = r + 1;
  const c0 = Math.floor((p.x + p.w / 2) / T);
  for (let c = c0 - 2; c <= c0 + 2; c++) if (tile(c, r) === "^" || tile(c, rb) === "^") return false;
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    const t = tile(c, rb);
    if (!solid(t) || t === "=" || t === "b") return false;
    if (solid(tile(c, r))) return false;
  }
  return true;
}
function breakWalls(box) {
  const stack = [];
  for (let r = Math.floor(box.y / T); r <= Math.floor((box.y + box.h) / T); r++)
    for (let c = Math.floor(box.x / T); c <= Math.floor((box.x + box.w) / T); c++) if (tile(c, r) === "x") stack.push([c, r]);
  if (!stack.length) return;
  while (stack.length) {
    const [c, r] = stack.pop();
    if (tile(c, r) !== "x") continue;
    grid[r][c] = ".";
    for (let i = 0; i < 10; i++) particles.push({ x: c * T + Math.random() * T, y: r * T + Math.random() * T, vx: (Math.random() - 0.3) * 140 * player.face, vy: -40 - Math.random() * 120, life: 0.6 + Math.random() * 0.5, max: 1.1, color: Math.random() < 0.5 ? "#5e5664" : "#7a7180", g: 500 });
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tile(c + dc, r + dr) === "x") stack.push([c + dc, r + dr]);
  }
  shake(4, 0.3); freeze = Math.max(freeze, 0.12);
  toast("Le mur s'effondre !", 1800);
}
