"use strict";
// ---------- 41. Les deux royaumes (0.29) : de vrais décors pour le Royaume céleste et le Royaume infernal ----------
/* Céleste : un ciel ouvert au lieu d'un mur (soleil et rayons, bancs de nuages, îles flottantes avec cascades,
   colonnade dorée, plumes et poussières d'or), du marbre veiné d'or pour le sol.
   Infernal : volcans et coulées, mer de lave, forteresse d'obsidienne aux fenêtres rougeoyantes, chaînes géantes,
   roche fendue de veines de magma, braises qui montent et cendres qui tombent, une pénombre rouge. */

BIOMES.ciel.stone = [206, 196, 172]; BIOMES.ciel.top = "#f2c94a"; BIOMES.ciel.wall = [120, 160, 210];
BIOMES.enfer.stone = [64, 26, 24]; BIOMES.enfer.top = "#ff6a1a"; BIOMES.enfer.wall = [40, 8, 6]; BIOMES.enfer.ambient = 0.4;

const realmAt = (ox, oy) => { const b = biomeAtPx(ox + VW / 2, oy + VH / 2); return b === "ciel" || b === "enfer" ? b : null; };
// la pénombre : rouge dans l'infernal, presque rien au ciel (y compris pendant le combat contre le maître du royaume)
function realmTint() { return typeof DIM !== "undefined" && DIM === "enfer" ? "26,4,4" : null; }
function realmAmbient(a) {
  if (typeof DIM === "undefined" || !DIM) return a;
  return DIM === "ciel" ? Math.min(a, bossFight ? 0.12 : 0.06) : Math.min(a, bossFight ? 0.55 : 0.5);
}

// ----- outils de dessin -----
function rPuff(x, y, w, h, top, shade) {          // un nuage en pixels : quelques bosses rondes + une ombre dessous
  const bumps = Math.max(3, Math.round(w / 14));
  ctx.fillStyle = shade;
  ctx.beginPath(); ctx.ellipse(snap(x + w / 2), snap(y + h * 0.62), w / 2, h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = top; ctx.beginPath();
  for (let i = 0; i < bumps; i++) {
    const bx = x + (i + 0.5) * w / bumps, r = h * (0.38 + 0.22 * Math.sin(i * 2.3 + w));
    ctx.moveTo(bx + r, y + h * 0.5); ctx.arc(snap(bx), snap(y + h * 0.5), r, 0, Math.PI * 2);
  }
  ctx.ellipse(snap(x + w / 2), snap(y + h * 0.55), w / 2 - 2, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}
const wrapX = (x, span) => ((x % span) + span) % span;

// =============================== LE ROYAUME CÉLESTE ===============================
function drawCelestialBack(ox, oy) {
  const hz = Math.max(VH * 0.45, Math.min(VH * 0.95, VH * 0.72 - oy * 0.04));      // l'horizon descend quand on monte
  // 1. le ciel : bleu en haut, doré à l'horizon
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, "#5f8fd0"); g.addColorStop(Math.max(0.05, hz / VH - 0.35), "#9cc3ea");
  g.addColorStop(Math.min(0.98, hz / VH), "#f6e2b0"); g.addColorStop(1, "#f9edcf");
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // 2. le soleil, son halo et ses rayons qui tournent lentement
  const sx = snap(VW * 0.78 - ox * 0.02), sy = snap(VH * 0.2 - oy * 0.02);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.translate(sx, sy); ctx.rotate(time * 0.04);
  ctx.fillStyle = "rgba(255,244,200,0.07)";
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(VW, -26); ctx.lineTo(VW, 26); ctx.fill(); }
  ctx.restore();
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90);
  halo.addColorStop(0, "rgba(255,252,230,0.9)"); halo.addColorStop(0.25, "rgba(255,240,190,0.45)"); halo.addColorStop(1, "rgba(255,240,190,0)");
  ctx.fillStyle = halo; ctx.fillRect(sx - 90, sy - 90, 180, 180);
  ctx.fillStyle = "#fffbe8"; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
  // 3. un banc de nuages lointains posé sur l'horizon
  const f1 = ox * 0.05 + time * 2;
  for (let i = -1; i < 9; i++) {
    const k = Math.floor(f1 / 70) + i, x = k * 70 - f1, v = hash(k, 5);
    rPuff(x - 20, hz - 30 - v * 22, 90 + v * 40, 34 + v * 10, "rgba(255,255,255,0.85)", "rgba(214,200,226,0.7)");
  }
  // sous l'horizon : des bancs de nuages de plus en plus proches (pas d'aplat, on voit la profondeur)
  for (let band = 1; band <= 3; band++) {
    const fb = ox * (0.05 + band * 0.04) + time * (2 + band), by = hz - 10 + band * 34 - oy * band * 0.02, sp = 80 + band * 20;
    if (by > VH + 30) break;
    for (let i = -1; i < VW / sp + 2; i++) {
      const k = Math.floor(fb / sp) + i, v = hash(k, 5 + band);
      rPuff(k * sp - fb - 20, by - v * 14, sp + 30 + v * 30, 30 + band * 4, `rgba(255,252,242,${0.55 + band * 0.1})`, `rgba(226,206,222,${0.45 + band * 0.1})`);
    }
  }
  // 4. les îles flottantes (avec un petit temple et une cascade)
  const f2x = ox * 0.12, span = 260;
  for (let i = -1; i <= Math.ceil(VW / span) + 1; i++) {
    const k = Math.floor(f2x / span) + i, v = hash(k, 17);
    if (v < 0.25) continue;
    const x = snap(k * span - f2x + v * 80), y = snap(hz - 110 - v * 60 - oy * 0.06 + Math.sin(time * 0.6 + k) * 3), w = 70 + v * 50;
    ctx.fillStyle = "#b9c3dd";                                                       // la roche, en dessous
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.7, y + 18); ctx.lineTo(x + w * 0.52, y + 34 + v * 12); ctx.lineTo(x + w * 0.3, y + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#a3b06f"; ctx.fillRect(x, y - 3, w, 4);                         // l'herbe
    ctx.fillStyle = "rgba(255,255,255,0.65)";                                        // la cascade qui tombe dans le vide
    const cx = snap(x + w * 0.78);
    ctx.fillRect(cx, y + 1, 3, 90); for (let j = 0; j < 6; j++) ctx.fillRect(cx - 1 + (j % 2) * 4, snap(y + 6 + ((time * 40 + j * 15) % 85)), 1, 5);
    if (v > 0.55) {                                                                  // un petit temple
      ctx.fillStyle = "#e9e2d0"; const tx = snap(x + w * 0.25);
      for (let c = 0; c < 4; c++) ctx.fillRect(tx + c * 8, y - 22, 3, 19);
      ctx.fillRect(tx - 3, y - 25, 32, 3);
      ctx.beginPath(); ctx.moveTo(tx - 4, y - 25); ctx.lineTo(tx + 13, y - 34); ctx.lineTo(tx + 30, y - 25); ctx.fill();
      ctx.fillStyle = "#f2c94a"; ctx.fillRect(tx - 3, y - 25, 32, 1);
    }
  }
  // 5. la colonnade dorée, en retrait (pâle, pour ne pas se confondre avec les plateformes)
  const f3x = ox * 0.32, f3y = oy * 0.22, cs = 120;
  for (let i = -1; i <= Math.ceil(VW / cs) + 1; i++) {
    const k = Math.floor(f3x / cs) + i, v = hash(k, 23), x = snap(k * cs - f3x);
    if (v < 0.35) continue;
    const top = snap(30 + v * 30 - (f3y % 400)), h = VH - top;
    ctx.fillStyle = "rgba(244,238,224,0.42)"; ctx.fillRect(x, top + 8, 12, h);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(x + 2, top + 8, 2, h);
    ctx.fillStyle = "rgba(242,201,74,0.55)"; ctx.fillRect(x - 3, top, 18, 4); ctx.fillRect(x - 2, top + 4, 16, 3);
    if (hash(k + 1, 23) >= 0.35) {                                                   // une arche vers la colonne suivante
      ctx.strokeStyle = "rgba(244,238,224,0.35)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x + 6 + cs / 2, top + 4, cs / 2 - 6, Math.PI, 0); ctx.stroke();
    }
  }
  // 6. des rayons de lumière obliques
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const f4 = ox * 0.4;
  for (let i = -1; i < 6; i++) {
    const k = Math.floor(f4 / 150) + i, v = hash(k, 41); if (v < 0.4) continue;
    const x = k * 150 - f4, a = (0.05 + 0.03 * Math.sin(time * 0.9 + k));
    ctx.fillStyle = `rgba(255,246,210,${a})`;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x - 60, VH); ctx.lineTo(x - 100, VH); ctx.fill();
  }
  ctx.restore();
  // 7. des nuages proches qui passent
  const f5 = ox * 0.5 + time * 6;
  for (let i = -1; i < 5; i++) {
    const k = Math.floor(f5 / 220) + i, v = hash(k, 61); if (v < 0.45) continue;
    rPuff(k * 220 - f5, snap(40 + v * (VH - 120) - (oy * 0.3) % 60), 70 + v * 40, 22 + v * 8, "rgba(255,255,255,0.5)", "rgba(220,206,230,0.35)");
  }
  if (bossFight) { ctx.fillStyle = "rgba(50,70,130,0.28)"; ctx.fillRect(0, 0, VW, VH); }   // pendant le combat, le décor recule : le Séraphin se détache
}
function drawCelestialFront(ox, oy) {
  // plumes qui tombent en se balançant, et poussières d'or
  for (let i = 0; i < 6; i++) {
    const v = hash(i, 77), period = 9 + v * 6, t = (time / period + v) % 1;
    const x = snap(wrapX(v * VW * 1.3 - ox * (0.8 + v * 0.4) + Math.sin(time * 1.4 + i) * 12, VW + 40) - 20), y = snap(t * (VH + 30) - 15);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 1.4 + i) * 0.6);
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(-1, -3, 2, 6); ctx.fillRect(-2, -1, 1, 3); ctx.fillRect(1, -2, 1, 3);
    ctx.fillStyle = "rgba(242,201,74,0.8)"; ctx.fillRect(0, 2, 1, 2);
    ctx.restore();
  }
  for (let i = 0; i < 22; i++) {
    const v = hash(i, 91), x = snap(wrapX(v * 997 - ox * 0.9, VW)), y = snap(wrapX(hash(i, 92) * 700 - time * (6 + v * 8) - oy * 0.9, VH));
    ctx.fillStyle = `rgba(255,236,160,${0.35 + 0.35 * Math.sin(time * 3 + i)})`; ctx.fillRect(x, y, 1, 1);
  }
  // un voile de nuage en bas de l'écran
  const f = ox * 1.2 + time * 10;
  for (let i = -1; i < 6; i++) { const k = Math.floor(f / 160) + i, v = hash(k, 13); if (v < 0.5) continue; rPuff(k * 160 - f, VH - 16 - v * 8, 110 + v * 50, 26, "rgba(255,255,255,0.35)", "rgba(230,220,240,0.2)"); }
}

// =============================== LE ROYAUME INFERNAL ===============================
function drawInfernalBack(ox, oy) {
  const hz = Math.max(VH * 0.62, Math.min(VH * 0.98, VH * 0.88 - oy * 0.03));
  // 1. un ciel de braise
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, "#0e0306"); g.addColorStop(Math.max(0.05, hz / VH - 0.4), "#2c0709");
  g.addColorStop(Math.min(0.98, hz / VH), "#8a2408"); g.addColorStop(1, "#c0400c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // 2. volcans au loin, avec coulées et lueur des cratères
  const f1 = ox * 0.06, span = 230;
  for (let i = -1; i <= Math.ceil(VW / span) + 1; i++) {
    const k = Math.floor(f1 / span) + i, v = hash(k, 7), x = snap(k * span - f1), h = 38 + v * 46, w = 120 + v * 80;
    ctx.fillStyle = "#1a0507";
    ctx.beginPath(); ctx.moveTo(x - w / 2, hz + 2); ctx.lineTo(x - 14, hz - h); ctx.lineTo(x + 14, hz - h); ctx.lineTo(x + w / 2, hz + 2); ctx.fill();
    ctx.strokeStyle = "rgba(120,30,20,0.6)"; ctx.lineWidth = 1;                         // arêtes éclairées par en dessous
    ctx.beginPath(); ctx.moveTo(x - 14, hz - h); ctx.lineTo(x - w / 2, hz + 2); ctx.moveTo(x + 4, hz - h); ctx.lineTo(x + w * 0.18, hz); ctx.moveTo(x - 6, hz - h); ctx.lineTo(x - w * 0.22, hz); ctx.stroke();
    ctx.fillStyle = `rgba(255,${110 + 50 * Math.sin(time * 2 + k)},30,0.8)`; ctx.fillRect(x - 13, hz - h, 26, 2);   // le bord du cratère rougeoie
    if (v > 0.35) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.6 + k);
      const cg = ctx.createRadialGradient(x, hz - h, 0, x, hz - h, 46);
      cg.addColorStop(0, `rgba(255,140,40,${0.55 + 0.25 * pulse})`); cg.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = cg; ctx.fillRect(x - 46, hz - h - 46, 92, 92);
      ctx.fillStyle = `rgba(255,${110 + 40 * pulse},30,0.85)`;                           // deux coulées sur les flancs
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 6, hz - h); ctx.quadraticCurveTo(x + s * 22, hz - h * 0.5, x + s * (30 + v * 20), hz); ctx.lineTo(x + s * (27 + v * 20), hz); ctx.quadraticCurveTo(x + s * 18, hz - h * 0.5, x + s * 4, hz - h); ctx.fill(); }
      ctx.fillStyle = "rgba(60,30,30,0.5)";                                               // panache de fumée
      for (let j = 0; j < 5; j++) { const t = (time * 0.25 + j / 5 + v) % 1; ctx.beginPath(); ctx.arc(snap(x + Math.sin(t * 4 + k) * 8 + t * 20), snap(hz - h - t * 90), 6 + t * 16, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // 3. la forteresse d'obsidienne et ses tours, fenêtres qui rougeoient
  const f2 = ox * 0.14, f2y = oy * 0.05, ts = 140;
  for (let i = -1; i <= Math.ceil(VW / ts) + 1; i++) {
    const k = Math.floor(f2 / ts) + i, v = hash(k, 29); if (v < 0.3) continue;
    const x = snap(k * ts - f2 + v * 40), w = 18 + v * 16, h = 90 + v * 110, top = snap(hz - h - f2y);
    ctx.fillStyle = "#120306"; ctx.fillRect(x, top, w, hz - top + 4);
    ctx.beginPath(); ctx.moveTo(x - 3, top); ctx.lineTo(x + w / 2, top - 22 - v * 18); ctx.lineTo(x + w + 3, top); ctx.fill();       // flèche
    for (let c = 0; c < 3; c++) ctx.fillRect(x - 3 + c * (w + 6) / 3, top - 4, (w + 6) / 6, 4);                                  // créneaux
    for (let y = top + 10; y < hz - 10; y += 16) for (let c = 0; c < 2; c++) {
      const on = hash(k * 13 + c, Math.floor(y / 16) + Math.floor(time * 0.5 + c)) > 0.45; if (!on) continue;
      ctx.fillStyle = `rgba(255,${120 + 60 * hash(k, y)},40,${0.6 + 0.3 * Math.sin(time * 5 + y)})`;
      ctx.fillRect(snap(x + 4 + c * (w - 10)), snap(y), 2, 4);
    }
  }
  // 4. la mer de lave à l'horizon, qui ondule et bouillonne
  const lt = snap(hz);
  const lg = ctx.createLinearGradient(0, lt, 0, VH); lg.addColorStop(0, "#d8701e"); lg.addColorStop(0.12, "#9a3010"); lg.addColorStop(1, "#4a0a06");
  ctx.fillStyle = lg; ctx.fillRect(0, lt, VW, VH - lt);
  ctx.fillStyle = "rgba(255,200,110,0.45)";
  for (let x = -wrapX(ox * 0.2, 18); x < VW; x += 18) ctx.fillRect(snap(x + Math.sin(time * 2 + x * 0.1) * 3), snap(lt + 3 + Math.sin(time * 1.5 + x * 0.05) * 1.5), 8, 1);
  for (let i = 0; i < 6; i++) { const v = hash(i, 51), t = (time * 0.7 + v) % 1; ctx.fillStyle = `rgba(255,200,90,${1 - t})`; ctx.beginPath(); ctx.arc(snap(wrapX(v * 900 - ox * 0.2, VW)), lt + 4, 1 + t * 4, Math.PI, 0); ctx.fill(); }
  // 5. chaînes géantes qui pendent du plafond invisible
  const f3 = ox * 0.3, f3y = oy * 0.25, cs = 90;
  for (let i = -1; i <= Math.ceil(VW / cs) + 1; i++) {
    const k = Math.floor(f3 / cs) + i, v = hash(k, 37); if (v < 0.55) continue;
    const x = k * cs - f3, len = 60 + v * 150, sw = Math.sin(time * 0.8 + k) * 4;
    for (let y = -((f3y % 12) + 12); y < len; y += 6) {
      const xx = snap(x + sw * (y / len)); ctx.fillStyle = (y / 6) % 2 ? "#2a0b0c" : "#3c1414";
      if ((y / 6) % 2) ctx.fillRect(xx - 1, snap(y), 3, 7); else { ctx.fillRect(xx - 2, snap(y), 5, 2); ctx.fillRect(xx - 2, snap(y + 5), 5, 2); }
    }
    if (v > 0.8) { const hy = snap(len); ctx.fillStyle = "#3c1414"; ctx.fillRect(snap(x + sw) - 1, hy, 3, 8); ctx.fillRect(snap(x + sw) + 1, hy + 6, 5, 2); ctx.fillRect(snap(x + sw) + 5, hy + 2, 2, 5); }
  }
  // 6. roche fendue au plus près : des fissures de magma qui palpitent
  const bx = ox * 0.6, by = oy * 0.6, gs = 48;
  for (let gy = -1; gy <= Math.ceil(VH / gs) + 1; gy++) for (let gx = -1; gx <= Math.ceil(VW / gs) + 1; gx++) {
    const c = Math.floor(bx / gs) + gx, r = Math.floor(by / gs) + gy, v = hash(c, r * 3 + 1); if (v > 0.22) continue;
    const x = c * gs - bx + v * 20, y = r * gs - by + hash(c, r) * 20, a = 0.08 + 0.07 * Math.sin(time * 2.2 + c + r);
    ctx.strokeStyle = `rgba(255,90,30,${a})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(snap(x), snap(y)); ctx.lineTo(snap(x + 7), snap(y + 5)); ctx.lineTo(snap(x + 5), snap(y + 12)); ctx.lineTo(snap(x + 13), snap(y + 18)); ctx.moveTo(snap(x + 7), snap(y + 5)); ctx.lineTo(snap(x + 16), snap(y + 3)); ctx.stroke();
  }
}
function drawInfernalFront(ox, oy) {
  // braises qui montent, cendres qui tombent
  for (let i = 0; i < 26; i++) {
    const v = hash(i, 71), period = 4 + v * 5, t = (time / period + v) % 1;
    const x = snap(wrapX(v * 1200 - ox * (0.9 + v * 0.3) + Math.sin(time * 2 + i) * 6, VW)), y = snap(VH + 10 - t * (VH + 20));
    ctx.fillStyle = `rgba(255,${130 + 90 * v},40,${0.9 * (1 - t)})`; ctx.fillRect(x, y, v > 0.7 ? 2 : 1, v > 0.7 ? 2 : 1);
  }
  for (let i = 0; i < 14; i++) {
    const v = hash(i, 83), t = (time / (12 + v * 6) + v) % 1;
    ctx.fillStyle = "rgba(120,110,110,0.45)"; ctx.fillRect(snap(wrapX(v * 800 - ox + Math.sin(time + i) * 10, VW)), snap(t * VH), 1, 1);
  }
  // pics d'obsidienne en amorce, bordés de rouge
  const fx = ox * 1.28, span = 170;
  for (let k = Math.floor(fx / span) - 1; k <= Math.floor(fx / span) + Math.ceil(VW / span) + 1; k++) {
    if (hash(k, 99) > 0.5) continue;
    const x = snap(k * span - fx), h = 26 + hash(k, 101) * 34, bot = hash(k, 103) > 0.5;
    ctx.fillStyle = "rgba(10,2,4,0.85)"; ctx.beginPath();
    if (bot) { ctx.moveTo(x - 12, VH); ctx.lineTo(x + 2, VH - h); ctx.lineTo(x + 16, VH); } else { ctx.moveTo(x - 12, 0); ctx.lineTo(x + 2, h); ctx.lineTo(x + 16, 0); }
    ctx.fill();
    ctx.strokeStyle = "rgba(255,80,30,0.45)"; ctx.lineWidth = 1; ctx.beginPath();
    if (bot) { ctx.moveTo(x - 12, VH); ctx.lineTo(x + 2, VH - h); } else { ctx.moveTo(x - 12, 0); ctx.lineTo(x + 2, h); }
    ctx.stroke();
  }
}

// ----- le sol des royaumes : marbre veiné d'or / basalte fendu de magma, et leurs petits décors -----
function drawRealmTiles(get, ox, oy, vw, vh) {
  const c0 = Math.floor(ox / T), c1 = Math.ceil((ox + vw) / T), r0 = Math.floor(oy / T), r1 = Math.ceil((oy + vh) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const t = get(c, r), id = biomeAt(c, r); if (id !== "ciel" && id !== "enfer") continue;
    const x = c * T - ox, y = r * T - oy, v = hash(c * 3, r * 5);
    if (solid(t)) {
      const above = get(c, r - 1), open = !solid(above) && above !== "f";
      if (id === "ciel") {
        if (v < 0.35) { ctx.fillStyle = "rgba(170,150,110,0.35)"; ctx.fillRect(x + 2 + v * 8, y + 3, 1, 4); ctx.fillRect(x + 3 + v * 8, y + 6, 4, 1); }
        if (v > 0.8) { ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x + 1, y + 9, 5, 1); }
        if (open) { ctx.fillStyle = "#c79a2a"; ctx.fillRect(x, y + 2, T, 1); ctx.fillStyle = "#fff3c0"; ctx.fillRect(x, y, T, 1); }
      } else {
        if (v < 0.3) { const a = 0.45 + 0.35 * Math.sin(time * 2.4 + c * 0.7 + r); ctx.strokeStyle = `rgba(255,100,30,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x + 6, y + 11); ctx.lineTo(x + 11, y + 15); ctx.stroke(); }
        if (open) { ctx.fillStyle = `rgba(255,${140 + 50 * Math.sin(time * 3 + c)},40,0.9)`; ctx.fillRect(x, y, T, 1); ctx.fillStyle = "#2a0a08"; ctx.fillRect(x, y + 2, T, 1); }
      }
    } else if (t === "." && solid(get(c, r + 1)) && v < 0.3) {
      if (id === "ciel") {
        if (v < 0.1) {                                       // un lys de lumière
          ctx.fillStyle = "#8fae6a"; ctx.fillRect(x + 7, y + 10, 1, 6);
          ctx.fillStyle = `rgba(255,248,210,${0.8 + 0.2 * Math.sin(time * 2 + c)})`; ctx.fillRect(x + 5, y + 8, 5, 3); ctx.fillStyle = "#f2c94a"; ctx.fillRect(x + 7, y + 9, 1, 1);
        } else if (v < 0.2) {                                // une touffe d'herbe dorée
          ctx.fillStyle = "#c9b45a"; ctx.fillRect(x + 3, y + 13, 1, 3); ctx.fillRect(x + 5, y + 12, 1, 4); ctx.fillRect(x + 9, y + 13, 1, 3);
        } else rPuff(x - 2, y + 9, 20, 9, "rgba(255,255,255,0.6)", "rgba(220,210,235,0.4)");   // un petit nuage au ras du sol
      } else {
        if (v < 0.12) {                                      // une flammèche
          const f = Math.sin(time * 12 + c) * 1;
          ctx.fillStyle = "#ff7a1a"; ctx.beginPath(); ctx.moveTo(x + 5, y + 16); ctx.lineTo(x + 8 + f, y + 8); ctx.lineTo(x + 11, y + 16); ctx.fill();
          ctx.fillStyle = "#ffd060"; ctx.fillRect(x + 7, y + 12, 2, 4);
        } else if (v < 0.22) {                               // un crâne
          ctx.fillStyle = "#c8b8a0"; ctx.fillRect(x + 5, y + 11, 6, 4); ctx.fillRect(x + 6, y + 15, 4, 1);
          ctx.fillStyle = "#1a0606"; ctx.fillRect(x + 6, y + 12, 1, 1); ctx.fillRect(x + 9, y + 12, 1, 1);
        } else {                                             // des pics d'obsidienne
          ctx.fillStyle = "#1c0809"; ctx.beginPath(); ctx.moveTo(x + 2, y + 16); ctx.lineTo(x + 5, y + 9); ctx.lineTo(x + 8, y + 16); ctx.lineTo(x + 10, y + 11); ctx.lineTo(x + 13, y + 16); ctx.fill();
          ctx.fillStyle = "rgba(255,90,30,0.6)"; ctx.fillRect(x + 5, y + 10, 1, 2);
        }
      }
    }
  }
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  around("drawBackWall", (o, ox, oy, depth) => {
    const R = realmAt(ox, oy);
    if (R === "ciel") return drawCelestialBack(ox, oy);
    if (R === "enfer") return drawInfernalBack(ox, oy);
    return o(ox, oy, depth);
  });
  around("drawBiomeProps", (o, get, ox, oy, vw, vh) => { const r = o(get, ox, oy, vw, vh); if (typeof DIM !== "undefined" && DIM) drawRealmTiles(get, ox, oy, vw, vh); return r; });
  around("drawForegroundParallax", (o, ox, oy) => {
    const R = realmAt(ox, oy);
    if (R === "ciel") return drawCelestialFront(ox, oy);
    if (R === "enfer") return drawInfernalFront(ox, oy);
    return o(ox, oy);
  });
})();
