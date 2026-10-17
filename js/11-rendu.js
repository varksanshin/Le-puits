"use strict";
// ---------- 10. Rendu ----------
const cv = document.getElementById("game"), ctx = cv.getContext("2d");
const light = document.createElement("canvas"); light.width = VW * S; light.height = VH * S;
const lctx = light.getContext("2d");
const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };
const at = (b, a) => ({ x: lerp(b.prevX ?? b.x, b.x, a), y: lerp(b.prevY ?? b.y, b.y, a) });

// Dessine le terrain visible. get(c, r) donne la tuile ; inside = ne dessiner que l'intérieur de la map (éditeur)
function drawTiles(get, ox, oy, vw, vh, inside) {
  let c0 = Math.floor(ox / T), c1 = Math.ceil((ox + vw) / T), r0 = Math.floor(oy / T), r1 = Math.ceil((oy + vh) / T);
  if (inside) { c0 = Math.max(0, c0); r0 = Math.max(0, r0); c1 = Math.min(MW - 1, c1); r1 = Math.min(MH - 1, r1); }
  const H = Math.max(1, MH);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const t = get(c, r), x = c * T - ox, y = r * T - oy;
    if (t === "H") {                                      // herse de fer
      ctx.fillStyle = "rgba(10,8,14,0.55)"; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#3e3a44";
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 1 + i * 4, y, 2.33, T);
      ctx.fillRect(x, y + 4, T, 2); ctx.fillRect(x, y + 11, T, 2);
      ctx.fillStyle = "#7c7686"; for (let i = 0; i < 4; i++) ctx.fillRect(x + 1 + i * 4, y, 0.67, T);
      if (get(c, r + 1) !== "H") { ctx.fillStyle = "#7c7686"; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 1 + i * 4, y + 14); ctx.lineTo(x + 2.2 + i * 4, y + 16); ctx.lineTo(x + 3.3 + i * 4, y + 14); ctx.fill(); } }
      continue;
    }
    if (t === "=") {                                      // plateforme friable : planches fendues
      const shake = crumbling.has(r * MW + c) ? (Math.random() - 0.5) * 1.2 : 0;
      ctx.fillStyle = "#6a5a48"; ctx.fillRect(x + shake, y, T, 6);
      ctx.fillStyle = "#8a7a62"; ctx.fillRect(x + shake, y, T, 1.33);
      ctx.fillStyle = "#2a2028"; ctx.fillRect(x + 5 + shake, y + 1, 1, 5); ctx.fillRect(x + 11 + shake, y + 2, 1, 4);
      continue;
    }
    if (t === "%") {                                      // courant d'air : traits qui montent
      for (let i = 0; i < 3; i++) {
        const yy = ((time * 60 + i * 37 + c * 11) % T);
        ctx.fillStyle = "rgba(216,232,224,0.22)"; ctx.fillRect(x + 3 + i * 5, y + T - yy, 1, 4);
      }
      continue;
    }
    if (t === "k") { drawKeyDoorTile(x, y, c, r, get); continue; }
    if (t === "b") {                                      // issue fermée pendant le combat contre un gardien
      ctx.fillStyle = "rgba(120,20,30,0.55)"; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = `rgba(232,60,50,${0.7 + 0.3 * Math.sin(time * 8 + r)})`;
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * 5, y, 1.5, T);
      ctx.fillRect(x, y + 7, T, 1.5);
      continue;
    }
    if (t === "G") {                                      // vanne en bois cerclée de fer
      ctx.fillStyle = "#4a321e"; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#6b4a2c"; for (let i = 0; i < 3; i++) ctx.fillRect(x + 1 + i * 5, y, 4, T);
      ctx.fillStyle = "#3e3a44"; ctx.fillRect(x, y + 3, T, 1.5); ctx.fillRect(x, y + 11, T, 1.5);
      continue;
    }
    if (t === "B") {                                      // barrière d'arène
      if (barriersUp) {
        ctx.fillStyle = "rgba(196,65,59,0.25)"; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = "#c4413b"; for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * 5, y, 1.5, T);
      }
      continue;
    }
    if (solid(t) || t === "f") {
      const v = hash(c, r);
      if (t === "f" && revealed.has(r * MW + c)) ctx.globalAlpha = 0.3;
      ctx.fillStyle = stoneColor(c, r, v);
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(x, y + 7, T, 1); ctx.fillRect(x + (r % 2 ? 4 : 11), y, 1, 7); ctx.fillRect(x + (r % 2 ? 11 : 4), y + 8, 1, 8);
      const above = get(c, r - 1);
      if (!solid(above) && above !== "f") { ctx.fillStyle = biomeTop(c, r); ctx.fillRect(x, y, T, 2); }
      if (t === "g") {                                    // mur d'accroche : racines et prises
        ctx.fillStyle = "#4a6a3a";
        ctx.fillRect(x + 2, y, 1.5, T); ctx.fillRect(x + 12, y, 1.5, T);
        ctx.fillRect(x + 2, y + 4, 4, 1.5); ctx.fillRect(x + 9, y + 11, 4, 1.5);
      }
      ctx.globalAlpha = 1;
      if (t === "x") {
        ctx.strokeStyle = "rgba(15,10,16,0.85)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x + 5, y + 9); ctx.lineTo(x + 10, y + 13); ctx.lineTo(x + 9, y + 16);
        ctx.moveTo(x + 7, y + 5); ctx.lineTo(x + 13, y + 4); ctx.stroke();
        ctx.fillStyle = "rgba(233,225,207,0.18)"; ctx.fillRect(x + 8, y + 6, 1, 1); ctx.fillRect(x + 11, y + 12, 1, 1);
      }
    } else if (t === "^") {
      ctx.fillStyle = "#2e2a33"; ctx.fillRect(x, y + 14, T, 2);
      for (let i = 0; i < 4; i++) {
        const sx = x + i * 4;
        ctx.fillStyle = "#8d8796"; ctx.beginPath(); ctx.moveTo(sx, y + 14); ctx.lineTo(sx + 2, y + 6); ctx.lineTo(sx + 4, y + 14); ctx.fill();
        ctx.fillStyle = "#cfc7d6"; ctx.fillRect(sx + 1.67, y + 7, 0.67, 3);
      }
    } else if (t === "|") {                               // grille de fer envahie de racines
      ctx.fillStyle = "rgba(10,8,14,0.45)"; ctx.fillRect(x, y, T, T);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#454a4f"; ctx.fillRect(x + 1.33 + i * 4, y, 2, T);
        ctx.fillStyle = "#80888d"; ctx.fillRect(x + 1.33 + i * 4, y, 0.67, T);
      }
      if (get(c, r - 1) !== "|") { ctx.fillStyle = "#5c6166"; ctx.fillRect(x, y, T, 2); }
      const v = hash(c, r);
      ctx.fillStyle = "#5a4630"; ctx.fillRect(x + v * 8, y + 3 + v * 6, 7, 1.33); ctx.fillRect(x + 2 + v * 4, y + 9, 1.33, 5);
    } else if (t === "-") {
      ctx.fillStyle = "#7a5432"; ctx.fillRect(x, y, T, 4);
      ctx.fillStyle = "#a07044"; ctx.fillRect(x, y, T, 1);
      ctx.fillStyle = "#4a321e"; ctx.fillRect(x + 7, y + 1, 1, 3);
    }
  }
}
function drawExitAt(x, y) {
  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.fillStyle = "#0b1418"; ctx.fillRect(x + 2, y + 2, 12, 22);
  ctx.fillStyle = `rgba(127,200,214,${0.5 + 0.5 * pulse})`;
  ctx.fillRect(x + 7, y + 6, 2, 12); ctx.fillRect(x + 4, y + 9, 8, 2); ctx.fillRect(x + 5, y + 15, 6, 1);
  ctx.strokeStyle = "rgba(127,200,214,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, 13, 23);
}
function drawRelicAt(x, y, skill) {
  const info = RELIC_INFO[skill] || RELIC_INFO.doubleJump;
  ctx.fillStyle = info.color; ctx.fillRect(x + 2, y, 4, 8); ctx.fillRect(x, y + 2, 8, 4);
  ctx.fillStyle = info.light; ctx.fillRect(x + 3, y + 2, 2, 4);
}
function drawPickupAt(x, y) {
  ctx.fillStyle = "#3a2550"; ctx.fillRect(x, y, 10, 10);
  ctx.fillStyle = "#b48ae0"; ctx.fillRect(x + 1, y + 1, 8, 8);
  ctx.fillStyle = "#2a1838";
  ctx.fillRect(x + 3, y + 2, 4, 1); ctx.fillRect(x + 6, y + 3, 1, 2); ctx.fillRect(x + 4, y + 5, 2, 1);
  ctx.fillRect(x + 4, y + 6, 1, 1); ctx.fillRect(x + 4, y + 8, 1, 1);
}
function drawBucketAt(bx, by, w, anchorY) {
  const cx = bx + w / 2;
  ctx.fillStyle = "#5b5560";
  for (let y = Math.max(anchorY, -4); y < by - 8; y += 4) ctx.fillRect(cx - (Math.round(y / 4) % 2 ? 0.67 : 0), y, 1.33, 3);
  ctx.strokeStyle = "#7a7380"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, by, w / 2 - 2, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = "#6b4a2c";
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + w, by); ctx.lineTo(bx + w - 3, by + 11); ctx.lineTo(bx + 3, by + 11); ctx.fill();
  ctx.fillStyle = "#4d4650"; ctx.fillRect(bx + 1, by + 3, w - 2, 1); ctx.fillRect(bx + 2.33, by + 8, w - 4.67, 1);
  ctx.fillStyle = "#a07044"; ctx.fillRect(bx, by, w, 1.33);
}
function drawEnemy(e, ox, oy, a) {
  const q = at(e, a), x = snap(q.x - ox), y = snap(q.y - oy), white = e.flash > 0;
  if (typeof drawEnemySprite === "function" && drawEnemySprite(e, x, y, white)) return;
  if (e.type === "crawler") {
    const wob = e.daze > 0 ? 0 : Math.sin(e.t * 9) * 0.7;
    ctx.fillStyle = white ? "#fff" : "#4f6b3a"; ctx.fillRect(x, y + 2, e.w, e.h - 2);
    ctx.fillStyle = white ? "#fff" : "#6f8f4c"; ctx.fillRect(x + 1, y + 1 + wob, e.w - 2, 3);
    ctx.fillStyle = white ? "#fff" : "#384a2a";
    for (let i = 2; i < e.w - 1; i += 4) ctx.fillRect(x + i, y + e.h - 1, 2, 1);
  } else if (e.type === "bat") {
    const flap = e.daze > 0 ? -0.5 : Math.sin(e.t * (e.state === "wind" ? 40 : 22));
    const warn = e.state === "wind" && Math.floor(time * 14) % 2 === 0;
    ctx.fillStyle = white || warn ? "#fff" : "#4a3560";
    ctx.fillRect(x + 3, y + 2, 4, 5);
    const wy = y + 2 - flap * 2;
    ctx.fillRect(x - 2, wy, 5, 2.5); ctx.fillRect(x + 7, wy, 5, 2.5);
  } else if (e.type === "spitter") {
    const k = e.state === "wind" ? 1 - e.stateT / 0.4 : 0, sw = snap(Math.sin(e.t * 2) * 0.5);
    ctx.fillStyle = white ? "#fff" : "#4a3a2a"; ctx.fillRect(x + 4, y + 6, 4, 4);
    ctx.fillStyle = white ? "#fff" : "#7a4a6a"; ctx.fillRect(x + 1 + sw, y + 1 - k, 10, 6 + k);
    ctx.fillStyle = white ? "#fff" : "#a05a8a"; ctx.fillRect(x + 2 + sw, y - k, 8, 2);
    ctx.fillStyle = white ? "#fff" : "#c88ab0"; ctx.fillRect(x + 3 + sw, y + 2, 1, 1); ctx.fillRect(x + 8 + sw, y + 5, 1, 1);
    ctx.fillStyle = "#1a0f18"; ctx.fillRect(x + (e.dir > 0 ? 7 : 2) + sw, y + 3, 3, 1 + k * 2);
  } else if (e.type === "golem") {
    const gx = e.state === "wind" ? x + snap((Math.random() - 0.5) * 1.4) : x, lean = e.state === "charge" ? e.dir * 1.67 : 0;
    ctx.fillStyle = white ? "#fff" : "#4e4854"; ctx.fillRect(gx + 2, y + 15, 6, 7); ctx.fillRect(gx + 12, y + 15, 6, 7);
    ctx.fillStyle = white ? "#fff" : "#585060"; ctx.fillRect(gx - 2 + lean, y + 6, 4, 9); ctx.fillRect(gx + 18 + lean, y + 6, 4, 9);
    ctx.fillStyle = white ? "#fff" : "#6a6270"; ctx.fillRect(gx + 1 + lean, y + 4, 18, 12);
    ctx.fillStyle = white ? "#fff" : "#5a7a4a"; ctx.fillRect(gx + 2 + lean, y + 4, 9, 2);
    ctx.fillStyle = white ? "#fff" : "#7a7180"; ctx.fillRect(gx + 5 + lean * 1.5, y, 10, 6);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(gx + 4 + lean, y + 9, 12, 1); ctx.fillRect(gx + 9 + lean, y + 5, 1, 10);
  } else if (e.type === "boss") drawBoss(e, x, y, white);
}
function drawCrystalAt(x, y, on) {
  const k = on ? 1 : 0.55 + 0.15 * Math.sin(time * 3);
  ctx.fillStyle = on ? "#e6fbff" : "#3d6f7c";
  ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + 10, y + 5); ctx.lineTo(x + 7, y + 12); ctx.lineTo(x + 3, y + 12); ctx.lineTo(x, y + 5); ctx.fill();
  ctx.fillStyle = `rgba(127,200,214,${k})`;
  ctx.beginPath(); ctx.moveTo(x + 5, y + 1.5); ctx.lineTo(x + 8.5, y + 5); ctx.lineTo(x + 6.3, y + 11); ctx.lineTo(x + 5, y + 11); ctx.fill();
  ctx.fillStyle = "#2a2430"; ctx.fillRect(x + 1, y + 12, 8, 2);
}
function drawAnchorAt(x, y) {
  ctx.fillStyle = "#3a3640"; ctx.fillRect(x - 2, y - 7, 4, 2);
  ctx.fillStyle = "#6d7378"; ctx.fillRect(x - 0.67, y - 5, 1.33, 2);
  ctx.strokeStyle = "#a9b7b0"; ctx.lineWidth = 1.33;
  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.stroke();
}
function drawChain(x0, y0, x1, y1) {
  const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 3));
  ctx.fillStyle = "#a9b7b0";
  for (let i = 0; i <= n; i++) ctx.fillRect(snap(lerp(x0, x1, i / n)) - 0.67, snap(lerp(y0, y1, i / n)) - 0.67, 1.33, 1.33);
}
function drawEnemyOverlay(e, ox, oy, a) {
  if (e.hidden) return;
  const q = at(e, a), x = snap(q.x - ox), y = snap(q.y - oy);
  if (e.type === "wisp") {                                 // le feu follet est sa propre lumière
    const f = 0.75 + Math.sin(e.t * 12) * 0.25;
    ctx.fillStyle = `rgba(143,240,208,${0.3 * f})`; ctx.fillRect(x - 1, y - 1, 10, 10);
    ctx.fillStyle = e.flash > 0 ? "#fff" : `rgba(200,255,236,${f})`; ctx.fillRect(x + 2, y + 2, 4, 4);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 3, y + 3, 2, 2);
  }
  if (e.type === "boss") { drawBossOverlay(e, x, y); return; }
  if (!e.ghost && corruption() > 0.3) {                    // les monstres corrompus suintent des ténèbres
    ctx.fillStyle = `rgba(157,107,196,${0.25 + 0.2 * Math.sin(time * 5 + e.t)})`;
    ctx.fillRect(x - 1, y + e.h - 2, e.w + 2, 2);
  }
  if (e.daze > 0 && e.state !== "sleep") {
    ctx.fillStyle = "#f2d45a";
    for (let i = 0; i < 3; i++) { const an = time * 6 + i * 2.1; ctx.fillRect(snap(x + e.w / 2 + Math.cos(an) * 6), snap(y - 4 + Math.sin(an) * 2), 1, 1); }
    return;
  }
  if (e.daze <= 0 && typeof drawEnemyEyes === "function" && drawEnemyEyes(e, x, y)) return;
  if (e.type === "crawler") {
    ctx.fillStyle = "#d8f070";
    const ex = e.dir > 0 ? x + e.w - 4 : x + 2;
    ctx.fillRect(ex, y + 3, 1, 1); ctx.fillRect(ex + 2, y + 3, 1, 1);
  } else if (e.type === "bat") {
    ctx.fillStyle = "#ff5a4a"; ctx.fillRect(x + 3, y + 3, 1, 1); ctx.fillRect(x + 6, y + 3, 1, 1);
  } else if (e.type === "spitter") {
    ctx.fillStyle = e.state === "wind" ? "#fff07a" : "#d8c040"; ctx.fillRect(x + 5 + snap(Math.sin(e.t * 2) * 0.5), y + 2, 2, 1);
  } else if (e.type === "golem") {
    ctx.fillStyle = e.state === "idle" || e.state === "walk" ? "#c4413b" : "#ff7a3a";
    const lx = x + (e.state === "charge" ? e.dir * 2.33 : 0);
    ctx.fillRect(lx + 7, y + 2, 2, 1); ctx.fillRect(lx + 11, y + 2, 2, 1);
  }
}
// drawBackWall, drawHero et drawSlash : voir js/28d-remaster.js
const SLASH_ANGLE = { side: 0, up: -Math.PI / 2, diagUp: -Math.PI / 4, down: Math.PI / 2, diagDown: Math.PI / 4, heavy: 0 };

function draw(a) {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  let ox = snap(cam.x), oy = snap(cam.y);
  if (shakeT > 0) { ox = snap(ox + (Math.random() - 0.5) * shakeM * 2); oy = snap(oy + (Math.random() - 0.5) * shakeM * 2); }
  const depth = Math.min(1, Math.max(0, (cam.y + VH / 2) / (MH * T)));

  drawBackWall(ox, oy, depth);
  drawTiles(tile, ox, oy, VW, VH, false);

  if (exitRune) drawExitAt(exitRune.x - ox, exitRune.y - oy);
  drawBiomeProps(tile, ox, oy, VW, VH);
  drawDecor(tile, ox, oy, VW, VH);
  drawBossDoor(ox, oy);
  drawDarkWorld(ox, oy);
  drawElements(ox, oy);
  drawLoot(ox, oy);
  for (const r of relics) if (!r.taken && !r.guarded) drawRelicAt(r.x - ox, snap(r.y - oy + Math.sin(time * 2.5) * 2), r.skill);
  for (const pk of pickups) drawPickupAt(snap(pk.x - ox), snap(pk.y - oy + Math.sin(pk.t * 2.2) * 2));
  for (const bk of buckets) drawBucketAt(snap(bk.x - ox), snap(lerp(bk.prevY ?? bk.y, bk.y, a) - oy), bk.w, bk.anchorY - oy);
  for (const an of anchors) drawAnchorAt(an.x - ox, an.y - oy);
  for (const k of crystals) drawCrystalAt(k.x - ox, k.y - oy, k.on);

  for (const h of hazards) {
    const k = Math.min(1, h.life / 0.4), fl = Math.sin(h.t * 25) * 1.2;
    ctx.fillStyle = `rgba(196,65,59,${0.8 * k})`; ctx.fillRect(snap(h.x + 1 - ox), snap(h.y + 3 - oy - fl), 6, 5 + fl);
    ctx.fillStyle = `rgba(242,181,74,${0.9 * k})`; ctx.fillRect(snap(h.x + 2.5 - ox), snap(h.y + 5 - oy - fl * 0.6), 3, 3 + fl * 0.6);
  }
  for (const e of enemies) drawEnemy(e, ox, oy, a);
  drawLootTop(ox, oy);
  drawHitRings(ox, oy, frameDt);
  drawMiniFx(ox, oy);
  for (const g of ghosts) {
    if (g.echo) { ctx.fillStyle = `rgba(190,215,255,${g.life / 0.15 * 0.35})`; ctx.fillRect(snap(g.x - ox), snap(g.y - oy), g.w, g.h); continue; }
    ctx.fillStyle = `rgba(${g.phase ? "157,107,196" : has("voile") ? "180,200,230" : "156,47,47"},${Math.min(1, g.life / 0.2) * 0.45})`;
    ctx.fillRect(snap(g.x - ox), snap(g.y - oy), player.w, player.h);
  }

  const p = player, pi = at(p, a);
  const px = snap(pi.x + p.w / 2 - ox), py = snap(pi.y + p.h - oy);
  const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
  if (!p.dead && !blink) {
    drawHero(px, py, p);
    if (p.charge > 0.15) {
      const k = Math.min(1, p.charge / stats.chargeTime), charged = p.charge >= stats.chargeTime;
      ctx.strokeStyle = `rgba(242,181,74,${charged ? 0.5 + 0.3 * Math.sin(time * 20) : 0.35 * k})`;
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py - p.h / 2, 6 + 6 * k, 0, Math.PI * 2); ctx.stroke();
    }
  }
  drawSlash(px, py);

  // Chaîne du grappin, et repère de la cible visée
  if (!p.dead) {
    if (p.grapple) {
      const g = p.grapple, tx = g.kind === "anchor" ? g.ref.x : g.ref.x + g.ref.w / 2, ty = g.kind === "anchor" ? g.ref.y : g.ref.y + g.ref.h / 2;
      drawChain(px + p.face * 3, py - 9, tx - ox, ty - oy);
    } else if (p.rope) drawChain(px + p.face * 3, py - 9, p.rope.x - ox, p.rope.y - oy);
    if (skills.grapple && !p.grapple && p.phaseTimer <= 0) {
      const tg = grappleTarget();
      if (tg) {
        const k = 0.6 + 0.4 * Math.sin(time * 8), tx = snap(tg.x - ox), ty = snap(tg.y - oy - (tg.kind === "anchor" ? 8 : tg.ref.h / 2 + 5));
        ctx.fillStyle = `rgba(232,145,58,${k})`;
        ctx.beginPath(); ctx.moveTo(tx, ty - 2); ctx.lineTo(tx + 2, ty); ctx.lineTo(tx, ty + 2); ctx.lineTo(tx - 2, ty); ctx.fill();
      }
    }
  }

  for (const s of shots) {
    const x = snap(s.x - ox), y = snap(s.y - oy);
    if (s.kind === "bone") { drawBone(s, x, y); continue; }
    if (s.kind === "rock") { drawRock(s, x, y); continue; }
    if (s.kind === "wave") {                                  // onde de choc du Gardien
      const h = 6 + Math.sin(time * 30 + s.x) * 1.5;
      ctx.fillStyle = "rgba(232,145,58,0.85)"; ctx.fillRect(x, y + s.h - h, s.w, h);
      ctx.fillStyle = "#fff3d6"; ctx.fillRect(x + 2, y + s.h - h + 1, s.w - 4, 1.33);
      continue;
    }
    // couleurs : vide (violet), lumière céleste (or), braise infernale (rouge), acide (vert)
    const P = s.kind === "void" ? ["#24142e", "#9d6bc4", "#eedcff"] : s.kind === "holy" ? ["#8a7a3a", "#f2d45a", "#fffbe6"]
      : s.kind === "hell" ? ["#3a0a06", "#e0401a", "#ffd08a"] : ["#4a5a18", "#b8d048", "#eaf7a0"];
    ctx.fillStyle = P[0]; ctx.fillRect(x - 0.67, y - 0.67, s.w + 1.33, s.h + 1.33);
    ctx.fillStyle = P[1]; ctx.fillRect(x, y, s.w, s.h);
    ctx.fillStyle = P[2]; ctx.fillRect(x + 1, y + 1, 1.67, 1.67);
  }

  for (const q of projectiles) {
    const x = snap(q.x - ox), y = snap(q.y - oy);
    if (q.kind === "bolt") {
      ctx.fillStyle = "rgba(127,200,214,0.35)"; ctx.fillRect(x - Math.sign(q.vx) * 5, y + 1, 6, 2);
      ctx.fillStyle = "#7fc8d6"; ctx.fillRect(x, y, q.w, q.h);
      ctx.fillStyle = "#e6fbff"; ctx.fillRect(x + 1.5, y + 1, 3, 2);
    } else drawProjectileExtra(q, x, y);
  }
  for (const q of particles) {
    ctx.globalAlpha = q.amb ? Math.min(1, q.life, (q.max - q.life) * 2) : Math.max(0, Math.min(1, q.life / q.max * (q.hit ? 2 : 1))); ctx.fillStyle = q.color;
    const sz = q.s || 2;
    ctx.fillRect(snap(q.x - ox), snap(q.y - oy), sz, sz);
  }
  ctx.globalAlpha = 1;
  drawWater(tile, ox, oy, VW, VH);
  if (typeof drawForegroundParallax === "function") drawForegroundParallax(ox, oy);

  lctx.setTransform(S, 0, 0, S, 0, 0);
  lctx.globalCompositeOperation = "source-over";
  lctx.clearRect(0, 0, VW, VH);
  const ambient = bossFight ? 0.62 + 0.25 * dark / 100 : Math.min(0.95, biomeAmbient() + 0.1 * depth + 0.15 * dark / 100);   // l'arène reste lisible
  lctx.fillStyle = `rgba(6,4,10,${ambient})`; lctx.fillRect(0, 0, VW, VH);
  lctx.globalCompositeOperation = "destination-out";
  const hole = (x, y, r) => { const g = lctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2); };
  if (!p.dead) hole(px, py - 8, lightRadius() + Math.sin(time * 9) * 2);
  darkLights(hole, ox, oy);
  elementLights(hole, ox, oy);
  lootLights(hole, ox, oy);
  biomeLights(hole, ox, oy);
  decorLights(hole, ox, oy);
  if (bossDoor) hole(bossDoor.x + 12 - ox, bossDoor.y + 16 - oy, darkTier() === "pure" ? 70 : 50);
  for (const e of enemies) if (e.boss) hole(e.x + e.w / 2 - ox, e.y + 6 - oy, 70);
  for (const r of relics) if (!r.taken && !r.guarded) hole(r.x + 4 - ox, r.y + 4 - oy, 40);
  for (const pk of pickups) hole(pk.x + 5 - ox, pk.y + 5 - oy, 34);
  for (const h of hazards) hole(h.x + 4 - ox, h.y + 4 - oy, 22);
  for (const q of projectiles) if (q.kind === "bolt") hole(q.x + 3 - ox, q.y + 2 - oy, 26);
  for (const s of shots) hole(s.x + 2.5 - ox, s.y + 2.5 - oy, 16);
  for (const k of crystals) hole(k.x + 5 - ox, k.y + 6 - oy, k.on ? 50 : 28);
  for (const e of enemies) if (e.type === "wisp") hole(e.x + 4 - ox, e.y + 4 - oy, 34);
  if (exitRune) hole(exitRune.x + 8 - ox, exitRune.y + 12 - oy, 46);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(light, 0, 0);
  ctx.setTransform(S, 0, 0, S, 0, 0);
  for (const e of enemies) drawEnemyOverlay(e, ox, oy, a);
  drawDarkOverlay(ox, oy);
  drawBiomeTitle(frameDt);
  // Halos colorés (torche, feux de camp, stèles, reliques, cristaux…) : voir js/28d-remaster.js
  drawColoredGlows(ox, oy, px, py);
  if (typeof drawFadeIn === "function") drawFadeIn();
}
