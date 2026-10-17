"use strict";
// ---------- 28. Décor vivant et effets ----------
/* Ce fichier ajoute :
     - des décors au plafond et aux murs selon le biome : racines, chaînes et lanternes de la prison,
       gouttes qui tombent, filaments lumineux, torches murales, ossements, tonneaux
     - des particules d'ambiance : poussière dans la lumière, bulles, spores, braises
     - les morts en éclats de pixels : le sprite du monstre (ou du héros) vole en morceaux qui rebondissent */

// ----- Décors du plafond et des murs -----
function drawDecor(get, ox, oy, vw, vh) {
  const c0 = Math.floor(ox / T) - 1, c1 = Math.ceil((ox + vw) / T) + 1, r0 = Math.floor(oy / T) - 1, r1 = Math.ceil((oy + vh) / T) + 1;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (get(c, r) !== ".") continue;
    const x = c * T - ox, y = r * T - oy, id = biomeAt(c, r), v = hash(c * 3 + 11, r * 5 + 7);
    // Plafond : quelque chose qui pend
    if (solid(get(c, r - 1)) && v < 0.3) {
      if (id === "entree") {                                       // racines
        ctx.fillStyle = "#4a3a24";
        const len = 4 + Math.floor(v * 30);
        ctx.fillRect(x + 5, y, 1, len); ctx.fillRect(x + 6, y + len - 1, 1, 2); ctx.fillRect(x + 10, y, 1, Math.max(2, len - 4));
        if (v < 0.08) { ctx.fillStyle = "#6f9a4a"; ctx.fillRect(x + 4, y + len, 2, 2); }
      } else if (id === "mines") {
        if (v < 0.06) {                                             // lanterne de la prison
          ctx.fillStyle = "#3a3440"; for (let i = 0; i < 6; i += 2) ctx.fillRect(x + 7.5, y + i, 1, 1.5);
          ctx.fillStyle = "#2a2028"; ctx.fillRect(x + 5, y + 6, 6, 7);
          const f = 0.75 + 0.25 * Math.sin(time * 11 + c);
          ctx.fillStyle = `rgba(242,181,74,${f})`; ctx.fillRect(x + 6, y + 7.5, 4, 4);
          ctx.fillStyle = "#fff3d6"; ctx.fillRect(x + 7.5, y + 9, 1, 1.5);
        } else if (v < 0.16) {                                      // chaînes
          ctx.fillStyle = "#4e4854";
          const len = 6 + Math.floor(v * 60) % 14;
          for (let i = 0; i < len; i += 3) ctx.fillRect(x + 8 - (i % 6 ? 0.67 : 0), y + i, 1.33, 2);
          if (v < 0.1) { ctx.fillRect(x + 6, y + len, 5, 1.33); ctx.fillRect(x + 6, y + len, 1.33, 3); }
        }
      } else if (id === "noyee") {                                  // stalactites qui gouttent
        ctx.fillStyle = "#2a3e44";
        ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + 7, y + 6 + v * 10); ctx.lineTo(x + 10, y); ctx.fill();
        const per = 1.6 + v * 3, k = ((time + v * 9) % per) / per;
        if (k < 0.55) { ctx.fillStyle = "rgba(191,230,239,0.8)"; ctx.fillRect(x + 6.5, y + 6 + v * 10 + k * k * 120, 1, 2); }
      } else if (id === "spores") {                                 // filaments lumineux
        const sw = Math.sin(time * 1.5 + c) * 1.5, len = 6 + v * 26;
        ctx.fillStyle = "#2f4a4a"; ctx.fillRect(x + 7 + sw * 0.3, y, 1, len);
        ctx.fillStyle = `rgba(120,240,210,${0.6 + 0.4 * Math.sin(time * 3 + c)})`; ctx.fillRect(x + 6 + sw, y + len, 3, 3);
      } else if (id === "antre") {                                  // chair qui suinte
        ctx.fillStyle = "#4a1020";
        ctx.fillRect(x + 3, y, 10, 2); ctx.fillRect(x + 6, y + 2, 4, 2 + v * 10);
        const per = 2.2 + v * 2, k = ((time + v * 7) % per) / per;
        if (k < 0.5) { ctx.fillStyle = "#9d2a4a"; ctx.fillRect(x + 7.5, y + 4 + v * 10 + k * k * 90, 1, 2); }
      }
      continue;
    }
    // Sol : petits objets (seulement s'il n'y a pas déjà des herbes ou champignons du biome)
    if (solid(get(c, r + 1)) && v > 0.88) {
      if (id === "mines" || id === "entree") {                      // tonneau ou caisse
        if (v > 0.95) {
          ctx.fillStyle = "#3a2414"; ctx.fillRect(x + 3, y + 6, 10, 10);
          ctx.fillStyle = "#6e4426"; ctx.fillRect(x + 4, y + 7, 8, 8);
          ctx.fillStyle = "#4e4854"; ctx.fillRect(x + 3, y + 8, 10, 1); ctx.fillRect(x + 3, y + 13, 10, 1);
        } else {
          ctx.fillStyle = "#3a2414"; ctx.fillRect(x + 2, y + 8, 11, 8);
          ctx.fillStyle = "#7a5432"; ctx.fillRect(x + 3, y + 9, 9, 6);
          ctx.fillStyle = "#3a2414"; ctx.fillRect(x + 3, y + 11.5, 9, 1); ctx.fillRect(x + 7, y + 9, 1, 6);
        }
      } else if (id === "antre" || id === "spores") {               // ossements
        ctx.fillStyle = "#d8cfbf";
        ctx.fillRect(x + 3, y + 13, 3, 3); ctx.fillRect(x + 4, y + 12, 2, 1);
        ctx.fillStyle = "#140e18"; ctx.fillRect(x + 3.67, y + 13.67, 0.67, 0.67); ctx.fillRect(x + 5, y + 13.67, 0.67, 0.67);
        ctx.fillStyle = "#b8ae9c"; ctx.fillRect(x + 8, y + 15, 6, 1); ctx.fillRect(x + 7.5, y + 14.5, 1.33, 1.5); ctx.fillRect(x + 13.5, y + 14.5, 1.33, 1.5);
      } else if (id === "noyee") {                                  // coquillages
        ctx.fillStyle = "#c8b8a0"; ctx.fillRect(x + 5, y + 14, 3, 2); ctx.fillRect(x + 6, y + 13, 1, 1);
      }
      continue;
    }
    // Mur du fond : torches
    if (isTorch(get, c, r, v, id)) {
      ctx.fillStyle = "#3a2414"; ctx.fillRect(x + 7, y + 8, 2, 6); ctx.fillRect(x + 6, y + 13, 4, 1.33);
      const f = Math.sin(time * 17 + c * 3) * 0.8;
      ctx.fillStyle = "#c4413b"; ctx.fillRect(x + 6, y + 4 - f * 0.5, 4, 4 + f * 0.5);
      ctx.fillStyle = "#f2b54a"; ctx.fillRect(x + 6.67, y + 5 - f * 0.3, 2.67, 3);
      ctx.fillStyle = "#fff3d6"; ctx.fillRect(x + 7.33, y + 6.5, 1.33, 1.5);
    }
  }
}
function isTorch(get, c, r, v, id) {
  return (id === "entree" || id === "mines" || id === "antre") && v > 0.3 && v < 0.33 &&
    get(c, r + 1) === "." && solid(get(c, r + 2)) && get(c, r - 1) === ".";
}
function decorLights(hole, ox, oy) {
  const c0 = Math.floor(ox / T) - 2, c1 = Math.ceil((ox + VW) / T) + 2, r0 = Math.floor(oy / T) - 2, r1 = Math.ceil((oy + VH) / T) + 2;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (tile(c, r) !== ".") continue;
    const id = biomeAt(c, r), v = hash(c * 3 + 11, r * 5 + 7);
    if (isTorch(tile, c, r, v, id)) hole(c * T + 8 - ox, r * T + 6 - oy, 52 + Math.sin(time * 9 + c) * 3);
    else if (id === "mines" && v < 0.06 && solid(tile(c, r - 1))) hole(c * T + 8 - ox, r * T + 10 - oy, 40);
  }
}

// ----- Particules d'ambiance -----
const AMBIENT = {
  entree: { rate: 5, color: "rgba(242,226,190,0.55)", vy: -4, vx: 3, life: 4 },
  mines:  { rate: 4, color: "rgba(180,170,160,0.45)", vy: 6, vx: 2, life: 4 },
  noyee:  { rate: 4, color: "rgba(191,230,239,0.6)", vy: -14, vx: 0, life: 3, wobble: true },
  spores: { rate: 7, color: "rgba(120,240,210,0.7)", vy: -6, vx: 4, life: 4, wobble: true },
  antre:  { rate: 6, color: "rgba(232,100,70,0.7)", vy: -18, vx: 2, life: 2.5 },
};
let runDustT = 0;
function updateAmbient(dt) {
  // Petits nuages de poussière quand le héros court ou freine
  const p = player;
  if (p && !p.dead && p.onGround && Math.abs(p.vx) > 70) {
    runDustT -= dt;
    if (runDustT <= 0) { runDustT = 0.16; particles.push({ x: p.x + p.w / 2 - Math.sign(p.vx) * 4, y: p.y + p.h - 1, vx: -p.vx * 0.15, vy: -12 - Math.random() * 10, life: 0.3, max: 0.3, color: "#8a7f74", g: 20, s: 1 }); }
  }
  if (REDUCED) return;
  const id = biomeAt(Math.floor((cam.x + VW / 2) / T), Math.floor((cam.y + VH / 2) / T)), a = AMBIENT[id];
  if (!a || Math.random() > a.rate * dt) return;
  const x = cam.x + Math.random() * VW, y = cam.y + Math.random() * VH;
  if (tile(Math.floor(x / T), Math.floor(y / T)) !== ".") return;
  particles.push({ x, y, vx: (Math.random() - 0.5) * a.vx * 2, vy: a.vy * (0.5 + Math.random()), life: a.life, max: a.life, color: a.color, g: 0, s: 1, wob: a.wobble ? Math.random() * 6 : null, amb: true });
}

// ----- Morts en éclats de pixels -----
function shatterSprite(name, sx, sy, flip, power, white) {
  if (!SPRITES[name]) return;
  const rows = SPRITES[name], w = rows[0].length, cx = w / 2, cy = rows.length / 2;
  const fam = name.replace(/[0-9]+$|_.*$/, "");
  const pal = { ...PAL, ...(SPRITE_PAL[fam] || {}), ...(SPRITE_PAL[name] || {}) };
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === "." || ch === " " || Math.random() < 0.35) continue;
      const px = flip ? w - 1 - x : x;
      const dx = px - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
      const sp = power * (0.5 + Math.random());
      particles.push({ x: sx + px, y: sy + y, vx: dx / d * sp + (Math.random() - 0.5) * 40, vy: dy / d * sp - 60 - Math.random() * 60,
        life: 0.9 + Math.random() * 0.8, max: 1.7, color: white ? "#ffffff" : (pal[ch] || "#fff"), g: 420, s: 1, hit: true });
    }
  });
}
function enemyDeathFx(e) {
  if (typeof spritePlace !== "function") return;
  const pl = spritePlace(e, e.x, e.y);
  if (pl) shatterSprite(pl.f, pl.sx, pl.sy, pl.flip, e.type === "golem" ? 110 : 90);
}
function heroDeathFx() {
  const p = player;
  shatterSprite(heroFrame(p), p.x + p.w / 2 - 6, p.y + p.h - 16, p.face < 0, 120);
}

// ----- Ressenti des coups : étincelles et traits dans la direction du coup -----
function hitSparks(e, dirX, o) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, d = dirX || (Math.random() < 0.5 ? -1 : 1);
  const up = o && o.up, down = o && o.down;
  for (let i = 0; i < 7; i++) {
    const a = (up ? -Math.PI / 2 : down ? Math.PI / 2 : (d > 0 ? 0 : Math.PI)) + (Math.random() - 0.5) * 1.3;
    const v = 140 + Math.random() * 120;
    particles.push({ x: cx - d * e.w * 0.3, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.18 + Math.random() * 0.12, max: 0.3, color: i < 2 ? "#ffffff" : "#f2d45a", g: 0, s: 1 });
  }
  hitRings.push({ x: cx, y: cy, life: 0.14 });
}
const hitRings = [];
function drawHitRings(ox, oy, dt) {
  for (let i = hitRings.length - 1; i >= 0; i--) {
    const h = hitRings[i]; h.life -= dt;
    if (h.life <= 0) { hitRings.splice(i, 1); continue; }
    const k = 1 - h.life / 0.14;
    ctx.strokeStyle = `rgba(255,248,230,${0.8 * (1 - k)})`; ctx.lineWidth = 1.5 - k;
    ctx.beginPath(); ctx.arc(h.x - ox, h.y - oy, 3 + k * 9, 0, Math.PI * 2); ctx.stroke();
  }
}
