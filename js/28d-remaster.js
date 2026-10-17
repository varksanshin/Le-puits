"use strict";
/* ============================================================================
   29. ÉDITION REMASTER (v0.15) — Parallaxe multi-couches, Cape Verlet,
       Animations procédurales, Smear Frames & Éclairage coloré
   ============================================================================ */

// ----- A. Physique de la cape (6 nœuds Verlet) & Salto aérien -----
const CAPE_LEN = 6;
const capeNodes = Array.from({ length: CAPE_LEN }, () => ({ x: 0, y: 0 }));
let flipAngle = 0, prevAirJumps = 0;

function updateCapeAndAnim(px, py, p, dt) {
  // Déclenchement d'un salto lors du double saut
  if (p === player && p.airJumps < prevAirJumps && !p.onGround) flipAngle = p.face * Math.PI * 2;
  if (p === player) prevAirJumps = p.airJumps;
  if (p.onGround || p.inWater || p.grapple) flipAngle = 0;
  else if (Math.abs(flipAngle) > 0.05) flipAngle = approach(flipAngle, 0, dt * 15);
  else flipAngle = 0;

  // Étincelles de frottement quand on glisse sur un mur d'accroche
  if (p.wallDir && !p.onGround && p.vy > 20 && Math.random() < dt * 25) {
    particles.push({
      x: p.wallDir < 0 ? p.x : p.x + p.w,
      y: p.y + 4 + Math.random() * 8,
      vx: -p.wallDir * (15 + Math.random() * 25),
      vy: -20 - Math.random() * 20,
      life: 0.25, max: 0.25, color: "#a8c67c", g: 90, s: 1
    });
  }

  // Ancrage de l'épaule
  const anchorX = px - p.face * 2.5, anchorY = py - p.h * p.sy * 0.82;
  if (!(Math.hypot(capeNodes[0].x - anchorX, capeNodes[0].y - anchorY) <= 40)) {
    for (let i = 0; i < CAPE_LEN; i++) { capeNodes[i].x = anchorX - i * p.face * 2; capeNodes[i].y = anchorY + i * 1.5; }
  }
  capeNodes[0].x = anchorX;
  capeNodes[0].y = anchorY;

  const windX = -(p.vx || 0) * 0.045 - p.face * (p.gliding ? 18 : 6) + Math.sin(time * 7) * 3;
  const gravY = p.gliding ? 6 : (p.inDraft ? -25 : 28) - Math.max(-40, Math.min(40, (p.vy || 0) * 0.04));
  // contrainte rigide : le tissu ne s'étire jamais (sinon la cape traîne en fil quand la caméra bouge)
  const stepK = 1;

  for (let i = 1; i < CAPE_LEN; i++) {
    const n = capeNodes[i], prev = capeNodes[i - 1];
    n.x += windX * dt * (1 + i * 0.22);
    n.y += (gravY + Math.sin(time * 12 + i * 1.1) * 8) * dt;
    // Contrainte de distance entre les segments de tissu
    const dx = n.x - prev.x, dy = n.y - prev.y, d = Math.hypot(dx, dy) || 1;
    const maxD = p.gliding ? 2.4 : 1.85;
    if (d > maxD) {
      n.x = lerp(n.x, prev.x + (dx / d) * maxD, stepK);
      n.y = lerp(n.y, prev.y + (dy / d) * maxD, stepK);
    }
  }
}

// ----- B. Parallaxe souterraine multi-plans par biome -----
function drawBackWall(ox, oy, depth) {
  const bId = biomeAtPx(ox + VW / 2, oy + VH / 2);
  const B = BIOMES[bId] || BIOMES.entree;
  const w = B.wall;

  // 1. Ciel de caverne profond (dégradé vertical subtil)
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, `rgb(${Math.max(4, w[0] - 14)},${Math.max(4, w[1] - 12)},${Math.max(6, w[2] - 10)})`);
  bg.addColorStop(1, `rgb(${Math.max(2, w[0] - 22)},${Math.max(2, w[1] - 20)},${Math.max(4, w[2] - 18)})`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  // 2. Plan lointain (0.18x) : Grandes silhouettes architecturales / géologiques
  const p1x = ox * 0.18, p1y = oy * 0.12;
  ctx.fillStyle = `rgb(${Math.max(6, w[0] - 8)},${Math.max(5, w[1] - 7)},${Math.max(8, w[2] - 6)})`;
  const colSpan = 56, i0 = Math.floor(p1x / colSpan) - 1, i1 = i0 + Math.ceil(VW / colSpan) + 3;
  for (let i = i0; i <= i1; i++) {
    const x = snap(i * colSpan - p1x), v = hash(i, 31);
    if (bId === "entree") {
      // Piliers de temple ancien + racines lointaines
      ctx.fillRect(x, 0, 14, VH);
      ctx.fillRect(x - 3, snap(28 - (p1y % 60)), 20, 4);
      ctx.beginPath(); ctx.arc(x + 7 + colSpan / 2, snap(18 - (p1y % 60)), colSpan / 2 - 7, Math.PI, 0); ctx.fill();
    } else if (bId === "mines") {
      // Grandes charpentes de mine et poutres croisées
      ctx.fillRect(x, 0, 10, VH);
      ctx.fillRect(0, snap(40 - (p1y % 50)), VW, 5);
      ctx.beginPath(); ctx.moveTo(x + 10, 0); ctx.lineTo(x + colSpan, 45); ctx.lineTo(x + colSpan, 50); ctx.lineTo(x + 10, 5); ctx.fill();
    } else if (bId === "noyee") {
      // Aqueducs engloutis et reflets d'eau
      ctx.fillRect(x, 0, 12, VH);
      ctx.beginPath(); ctx.arc(x + colSpan / 2, 55, colSpan / 2 - 6, Math.PI, 0); ctx.fill();
    } else if (bId === "spores") {
      // Chapeaux de champignons géants en arrière-plan
      const cy = snap(60 + v * 50 - (p1y % 80));
      ctx.fillRect(x + 14, cy, 8, VH - cy);
      ctx.beginPath(); ctx.ellipse(x + 18, cy, 24, 9, 0, Math.PI, 0); ctx.fill();
    } else if (bId === "antre") {
      // Côtes osseuses géantes qui s'arquent vers le centre
      const pulse = Math.sin(time * 2 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 22 + pulse, VH * 0.5, x + 4, VH);
      ctx.lineTo(x + 12, VH); ctx.quadraticCurveTo(x + 30 + pulse, VH * 0.5, x + 8, 0);
      ctx.fill();
    }
  }

  // 3. Plan intermédiaire (0.38x) : Détails animés (chaînes, lianes, spores, rayons de soleil)
  const p2x = ox * 0.38, p2y = oy * 0.32;
  const span2 = 38, j0 = Math.floor(p2x / span2) - 1, j1 = j0 + Math.ceil(VW / span2) + 3;
  for (let j = j0; j <= j1; j++) {
    const x = snap(j * span2 - p2x), v = hash(j, 73);
    if (bId === "entree" && v < 0.45) {
      // Rayons de lumière céleste obliques (God rays)
      ctx.save();
      const alpha = (0.04 + 0.02 * Math.sin(time * 1.3 + j)) * (1 - depth * 0.8);
      ctx.fillStyle = `rgba(255,232,175,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x - 28, VH); ctx.lineTo(x - 48, VH);
      ctx.fill();
      ctx.restore();
    } else if (bId === "mines" && v < 0.5) {
      // Chaînes suspendues qui oscillent doucement
      const sw = Math.sin(time * 1.6 + j) * 2.5;
      ctx.fillStyle = "rgba(18,14,22,0.65)";
      for (let y = -10; y < 90 + v * 60; y += 4) {
        ctx.fillRect(snap(x + sw * (y / 90)), snap(y - (p2y % 40)), 2, 3);
      }
      if (v < 0.2) { // Cage suspendue au bout
        const cy = snap(80 + v * 40 - (p2y % 40));
        ctx.fillRect(snap(x + sw - 5), cy, 12, 16);
        ctx.fillStyle = "rgba(40,32,38,0.5)"; ctx.fillRect(snap(x + sw - 3), cy + 2, 8, 12);
      }
    } else if (bId === "noyee") {
      // Caustiques aquatiques ondulantes
      const wy = snap(((j * 29 - p2y) % VH + VH) % VH);
      ctx.fillStyle = "rgba(127,200,214,0.045)";
      ctx.fillRect(snap(x + Math.sin(time * 2 + j) * 6), wy, 22, 2);
    } else if (bId === "spores" && v < 0.55) {
      // Lianes bioluminescentes au second plan
      const sw = Math.sin(time * 2 + j) * 2;
      ctx.fillStyle = "rgba(45,95,90,0.45)";
      ctx.fillRect(snap(x + sw), 0, 1.5, 70 + v * 80);
      ctx.fillStyle = `rgba(120,240,210,${0.25 + 0.15 * Math.sin(time * 3 + j)})`;
      ctx.fillRect(snap(x + sw - 1), snap(68 + v * 80), 3.5, 3.5);
    } else if (bId === "antre" && v < 0.6) {
      // Veines organiques qui pulsent dans l'ombre
      const pulse = 0.12 + 0.08 * Math.sin(time * 4 + j);
      ctx.fillStyle = `rgba(170,35,55,${pulse})`;
      ctx.fillRect(snap(x), 0, 1.5, VH);
    }
  }

  // 4. Plan de maçonnerie (0.6x) : Pierres de taille avec relief
  const bx = snap(ox * 0.6), by = snap(oy * 0.6);
  const sx0 = -(((bx % 24) + 24) % 24) - 24, sy0 = -(((by % 12) + 12) % 12) - 12;
  for (let y = sy0; y < VH; y += 12) {
    const row = Math.round((y + by) / 12);
    for (let x = sx0 + (((row % 2) + 2) % 2) * 12; x < VW; x += 24) {
      const col = Math.round((x + bx) / 24), hv = hash(col, row);
      if (hv < 0.28) {
        ctx.fillStyle = "rgba(255,255,255,0.025)";
        ctx.fillRect(x + 1, y + 1, 22, 10);
      } else if (hv > 0.82) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x + 1, y + 1, 22, 10);
      }
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fillRect(x, y, 23, 1);
      ctx.fillRect(x, y, 1, 12);
    }
  }
}

// 5. Premier plan en parallaxe rapide (1.28x) devant la caméra
function drawForegroundParallax(ox, oy) {
  const fx = ox * 1.28, fy = oy * 1.15;
  const span = 180, k0 = Math.floor(fx / span) - 1, k1 = k0 + Math.ceil(VW / span) + 2;
  ctx.fillStyle = "rgba(6,4,10,0.55)";
  for (let k = k0; k <= k1; k++) {
    if (hash(k, 99) > 0.45) continue;
    const x = snap(k * span - fx), h = 22 + hash(k, 101) * 28;
    // Stalactite / racine sombre en amorce en haut de l'écran
    ctx.beginPath();
    ctx.moveTo(x - 10, 0); ctx.lineTo(x + 2, snap(h - (fy % 16))); ctx.lineTo(x + 14, 0);
    ctx.fill();
  }
}

// ----- C. Héros : Cape Verlet, Respiration, Anticipation & Arc d'épée texturé -----
function drawHero(px, py, p) {
  updateCapeAndAnim(px, py, p, frameDt || STEP);

  // 1. Dessin de la cape physique en coordonnées locales (avant la rotation du corps)
  ctx.save();
  if (p.dashTimer > 0 && has("voile")) ctx.globalAlpha = 0.55;
  if (p.phasing) ctx.globalAlpha = 0.4;

  // Ombre sous les pieds quand il est au sol
  if (p.onGround) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(px, py - 0.5, 5.5 * Math.max(0.1, Math.abs(p.sx || 1)), 1.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Ruban de la cape (couleur principale + doublure claire sur le bord supérieur)
  ctx.fillStyle = p.phasing ? "#7a4ba3" : "#6e1f24";
  ctx.beginPath();
  for (let i = 0; i < CAPE_LEN; i++) {
    const n = capeNodes[i];
    if (i === 0) ctx.moveTo(n.x, n.y - 1);
    else ctx.lineTo(n.x, n.y - (1 - i * 0.12));
  }
  for (let i = CAPE_LEN - 1; i >= 0; i--) {
    const n = capeNodes[i];
    ctx.lineTo(n.x, n.y + 2.2 + i * 0.45);
  }
  ctx.closePath();
  ctx.fill();

  // Reflet sur l'épaule de la cape
  ctx.strokeStyle = p.phasing ? "#b48ae0" : "#9c2f2f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(capeNodes[0].x, capeNodes[0].y);
  ctx.lineTo(capeNodes[2].x, capeNodes[2].y);
  ctx.stroke();

  // 2. Corps du héros avec respiration, anticipation de frappe chargée et salto
  const running = p.onGround && Math.abs(p.vx) > 15 && p.dashTimer <= 0;
  const bob = running ? -Math.abs(Math.sin(p.anim * 0.38)) * 1.4 : 0;
  const breathe = (p.onGround && !running && p.charge <= 0) ? Math.sin(time * 3.4) * 0.045 : 0;
  const crouch = p.charge > 0.05 ? Math.min(1, p.charge / stats.chargeTime) * 0.18 : 0;
  const sx = p.sx * (1 - breathe + crouch * 0.8), sy = p.sy * (1 + breathe - crouch);

  ctx.translate(px, py + bob);
  ctx.scale(p.face, 1);
  ctx.rotate(p.lean + flipAngle * p.face);

  // Écharpe / planeur déployé
  if (p.gliding) {
    ctx.fillStyle = "#9c2f2f";
    const fl = Math.sin(time * 20) * 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, -12); ctx.quadraticCurveTo(-13, -15 + fl, -15, -8 - fl);
    ctx.lineTo(13, -8 + fl); ctx.quadraticCurveTo(11, -15 - fl, 4, -12);
    ctx.fill();
  }

  ctx.save();
  ctx.scale(sx, sy);
  const f = heroFrame(p), c = spriteCanvas(f, p.hurt > 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, -6, -16);

  // Foulard animé sur la nuque
  if (running || !p.onGround) {
    ctx.fillStyle = "#e8913a";
    ctx.fillRect(-4, -10 + Math.sin(time * 18) * 0.6, 3, 1.5);
  }
  ctx.restore();

  // 3. Lame de l'épée au fourreau ou en main
  const ph = p.h * sy, pw = p.w * sx;
  const charged = p.charge >= stats.chargeTime;
  const fireBlade = has("lamebraise"), ghostBlade = has("spectrale");
  ctx.fillStyle = charged ? (Math.floor(time * 18) % 2 ? "#f2b54a" : "#ffffff")
    : fireBlade ? "#ff8a3a" : ghostBlade ? "#bfe6ef" : p.charge > 0.15 ? "#e8c9a0" : "#d8d1c2";

  if (p.atkTimer > 0) {
    // Pendant le coup, la lame suit la fin de l'arc
    const k = 1 - p.atkTimer / (p.atkDir === "heavy" ? 0.16 : stats.attackTime);
    const ang = (SLASH_ANGLE[p.atkDir] ?? 0) + (k - 0.5) * 1.6;
    ctx.save();
    ctx.translate(0, -ph * 0.55);
    ctx.rotate(ang);
    ctx.fillRect(3, -1, p.atkDir === "heavy" ? 15 : 11, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(5, -0.5, p.atkDir === "heavy" ? 12 : 8, 0.8);
    ctx.restore();
  } else if (p.charge > 0.1) {
    const tremor = charged ? (Math.random() - 0.5) * 1.2 : 0;
    ctx.fillRect(-pw / 2 - 7 + tremor, -ph * 0.72, 9, 2.2);
  } else {
    ctx.fillRect(pw / 2 - 1, -ph * 0.55, 2, 7.5);
  }
  ctx.restore();
}

// Smear Frame en croissant effilé pour l'attaque
function drawSlash(px, py) {
  const p = player; if (p.atkTimer <= 0) return;
  const heavy = p.atkDir === "heavy";
  const dur = heavy ? 0.16 : stats.attackTime;
  const k = 1 - p.atkTimer / dur;
  const cy = py - p.h / 2;
  const r = (heavy ? 24 : 16) * (stats.attackRange / 20);
  const fire = has("lamebraise"), spec = has("spectrale");

  const drawCrescent = (face, alpha) => {
    let baseA = SLASH_ANGLE[p.atkDir] ?? 0;
    if (face < 0) baseA = Math.PI - baseA;
    const cx = px + Math.cos(baseA) * 5, cyy = cy + Math.sin(baseA) * 5;
    const spread = Math.PI * (heavy ? 0.62 : 0.52);
    const a0 = baseA - spread * (face > 0 ? 1 - k * 0.45 : 1);
    const a1 = baseA + spread * (face > 0 ? 1 : 1 - k * 0.45);

    const fade = (1 - k * 0.75) * alpha;
    const outerCol = heavy ? `rgba(242,181,74,${0.95 * fade})`
      : fire ? `rgba(232,105,42,${0.92 * fade})`
      : spec ? `rgba(127,200,214,${0.92 * fade})`
      : `rgba(215,225,240,${0.88 * fade})`;

    // Croissant extérieur plein (entre deux rayons décalés)
    ctx.fillStyle = outerCol;
    ctx.beginPath();
    ctx.arc(cx, cyy, r, a0, a1);
    ctx.arc(cx - Math.cos(baseA) * 3.5, cyy - Math.sin(baseA) * 3.5, Math.max(2, r - (heavy ? 7 : 4.5)), a1, a0, true);
    ctx.closePath();
    ctx.fill();

    // Fil incandescent au bord d'attaque
    ctx.strokeStyle = `rgba(255,252,240,${0.95 * fade})`;
    ctx.lineWidth = heavy ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.arc(cx, cyy, r - 0.5, a0 + 0.12, a1 - 0.12);
    ctx.stroke();
  };

  ctx.save();
  drawCrescent(p.face, 1);
  if (has("revers") && !heavy) drawCrescent(-p.face, 0.75);
  ctx.restore();
}

// ----- D. Animations dynamiques des ennemis (Squash & Stretch + Respiration) -----
function drawEnemySprite(e, x, y, white) {
  if (e.mini) return drawMiniSprite(e, x, y, white);
  const pl = spritePlace(e, x, y);
  if (!pl) return false;

  if (e.type === "rodeur") {
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    ctx.globalAlpha = e.state === "lunge" || e.state === "wind" ? 1 : Math.max(0.2, Math.min(1, 1.3 - d / 90));
  }

  const w = spriteW(pl.f), h = spriteH(pl.f);
  // Déformation élastique selon la vitesse verticale, l'état ou l'impact reçu
  let sx = 1, sy = 1, rot = 0;
  if (e.hitFx > 0) {
    const k = e.hitFx / 0.16;
    sx = 1 + 0.32 * k; sy = 1 - 0.25 * k;
  } else if (!e.fly && Math.abs(e.vy) > 25) {
    const stretch = Math.max(-0.22, Math.min(0.28, -e.vy / 700));
    sx = 1 - stretch * 0.65; sy = 1 + stretch;
  } else if (e.state === "crouch" || e.state === "wind") {
    sx = 1.18 + Math.sin(time * 35) * 0.05; sy = 0.82;
  } else {
    const br = Math.sin(e.t * 4.5) * 0.04;
    sx = 1 + br; sy = 1 - br;
  }
  if (e.type === "bat" && e.state === "chase") rot = Math.atan2(e.vy, Math.abs(e.vx) + 10) * 0.35 * (pl.flip ? -1 : 1);

  // Petite ombre portée sous les ennemis au sol
  if (!e.fly && e.onGround) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + e.h, e.w * 0.45, 1.3, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save();
  ctx.translate(snap(pl.sx + w / 2), snap(pl.sy + h));
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  drawSprite(pl.f, -w / 2, -h, pl.flip, white);
  ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

// ----- E. Halos lumineux colorés (Bloom additif sur le monde) -----
function drawColoredGlows(ox, oy, px, py) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = (x, y, r, rgb, a) => {
    if (x < -r || x > VW + r || y < -r || y > VH + r) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // Halo de la torche du héros
  if (!player.dead) {
    const fl = Math.sin(time * 11) * 3;
    const tier = darkTier();
    const col = tier === "pure" ? "255,244,210" : tier === "abyss" ? "175,110,230" : "232,145,58";
    glow(px, py - 8, 56 + fl, col, 0.14);
  }
  // Feux de camp et stèles
  for (const f of campfires) if (!f.used) glow(f.x + 8 - ox, f.y + 8 - oy, 52 + Math.sin(f.t * 10) * 3, "242,165,65", 0.18);
  for (const s of steles) if (!s.used) glow(s.x + 5 - ox, s.y + 10 - oy, 30, "165,105,220", 0.16);
  // Reliques, autels, cristaux et feux follets
  for (const r of relics) if (!r.taken && !r.guarded) glow(r.x + 4 - ox, r.y + 4 - oy, 34, "242,190,90", 0.18);
  for (const pk of pickups) glow(pk.x + 5 - ox, pk.y + 5 - oy, 28, "180,138,224", 0.16);
  for (const k of crystals) glow(k.x + 5 - ox, k.y + 6 - oy, k.on ? 44 : 24, "127,200,214", k.on ? 0.22 : 0.12);
  for (const e of enemies) if (e.type === "wisp") glow(e.x + 4 - ox, e.y + 4 - oy, 28, "143,240,208", 0.18);
  for (const q of projectiles) if (q.kind === "bolt" || q.kind === "blade") glow(q.x + 3 - ox, q.y + 2 - oy, 22, "127,200,214", 0.18);
  ctx.restore();
}