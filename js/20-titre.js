"use strict";
// ---------- 20. Écran titre et saut dans le puits ----------
/* Au menu : le héros court sans fin dans la forêt, au crépuscule (une boucle en parallaxe).
   Quand on choisit un mode : le puits arrive, le héros saute dedans, l'écran plonge dans le noir,
   puis la partie commence. N'importe quelle touche passe la cinématique. */
const TITLE = { ground: 150, heroX: 205, run: 62, sprint: 150 };
let titleT = 0, titleScroll = 0;
let intro = null;                       // { t, cb, phase, wellX, hx, hy, vy }
const fireflies = [], titleDust = [];

function startIntro(cb) {
  if (REDUCED) { cb(); return; }
  intro = { t: 0, cb, phase: "run", wellX: VW + 120, hx: TITLE.heroX, hy: TITLE.ground, vy: 0, fade: 0 };
  screen = "intro"; menuEl.hidden = true; keys.clear();
}
function skipIntro() {
  if (!intro || intro.t < 0.25) return;
  finishIntro();
}
function finishIntro() {
  const cb = intro.cb; intro = null;
  screen = "title";                     // le rappel ferme le menu et passe en jeu
  cb();
  if (screen === "title") openTitle();  
  else fadeIn = 0.8;  // si la partie n'a pas pu démarrer, on revient au menu
}
addEventListener("keydown", e => { if (screen === "intro") { e.preventDefault(); skipIntro(); } });
addEventListener("pointerdown", () => { if (screen === "intro") skipIntro(); });

// ----- Les couches du décor -----
const ridge = (x, seed, amp, base, scale) => {
  // une ligne de crête douce, faite de quelques sinus
  return base - amp * (0.5 + 0.25 * Math.sin(x / scale + seed) + 0.15 * Math.sin(x / (scale * 0.37) + seed * 2) + 0.1 * Math.sin(x / (scale * 0.13) + seed * 3));
};
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, TITLE.ground);
  g.addColorStop(0, "#0d0b1c"); g.addColorStop(0.55, "#2a1e3c"); g.addColorStop(0.85, "#6a3a48"); g.addColorStop(1, "#b0604a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, TITLE.ground + 2);
  for (let i = 0; i < 45; i++) {                                   // étoiles
    const x = hash(i, 3) * VW, y = hash(i, 7) * 80, tw = 0.4 + 0.6 * Math.abs(Math.sin(titleT * (0.6 + hash(i, 9)) + i));
    ctx.fillStyle = `rgba(240,230,255,${tw * (1 - y / 90)})`; ctx.fillRect(snap(x), snap(y), hash(i, 5) < 0.15 ? 1.33 : 0.67, hash(i, 5) < 0.15 ? 1.33 : 0.67);
  }
  ctx.fillStyle = "#f3e6c8"; ctx.beginPath(); ctx.arc(262, 38, 11, 0, Math.PI * 2); ctx.fill();      // la lune
  ctx.fillStyle = "rgba(243,230,200,0.08)"; ctx.beginPath(); ctx.arc(262, 38, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d8c8a8"; ctx.fillRect(257, 34, 3, 2); ctx.fillRect(264, 41, 2, 2);
}
function drawLayer(speed, color, fn) {
  const off = titleScroll * speed;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, VH);
  for (let x = 0; x <= VW; x += 2) ctx.lineTo(x, fn(x + off));
  ctx.lineTo(VW, VH); ctx.fill();
}
function drawPines(speed, spacing, color, base, hMin, hVar, seed) {
  const off = titleScroll * speed, first = Math.floor(off / spacing) - 1;
  ctx.fillStyle = color;
  for (let i = first; i < first + VW / spacing + 3; i++) {
    const x = snap(i * spacing - off + hash(i, seed) * spacing * 0.6), h = hMin + hash(i, seed + 1) * hVar, w = h * 0.42;
    ctx.fillRect(x - 1, base - h * 0.25, 2.67, h * 0.25 + 2);                       // tronc
    for (let k = 0; k < 3; k++) {                                                    // trois étages d'aiguilles
      const ty = base - h * (0.25 + k * 0.24), tw = w * (1 - k * 0.25);
      ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.lineTo(x + 0.33, ty - h * 0.42); ctx.lineTo(x + tw, ty); ctx.fill();
    }
  }
}
function drawGroundStrip() {
  const gy = TITLE.ground, off = titleScroll;
  ctx.fillStyle = "#2a1e18"; ctx.fillRect(0, gy, VW, VH - gy);
  ctx.fillStyle = "#3a2a20";
  for (let i = Math.floor(off / 9) - 1; i < Math.floor(off / 9) + VW / 9 + 2; i++) if (hash(i, 41) < 0.4) ctx.fillRect(snap(i * 9 - off), gy + 6 + hash(i, 42) * 18, 2, 1.33);
  ctx.fillStyle = "#3f6a32"; ctx.fillRect(0, gy, VW, 3);
  ctx.fillStyle = "#5a8a40"; ctx.fillRect(0, gy, VW, 1);
  // brins d'herbe qui ondulent
  for (let i = Math.floor(off / 4) - 1; i < Math.floor(off / 4) + VW / 4 + 2; i++) {
    const v = hash(i, 17); if (v > 0.7) continue;
    const x = snap(i * 4 - off), h = 2 + v * 5, sw = Math.sin(titleT * 2.5 + i * 0.7) * 0.8;
    ctx.fillStyle = v < 0.2 ? "#6f9a4a" : "#4f7a3a";
    ctx.fillRect(x + sw * 0.5, gy - h, 1, h);
    if (v < 0.05) { ctx.fillStyle = hash(i, 18) < 0.5 ? "#f2d45a" : "#e8a0c0"; ctx.fillRect(x + sw - 0.5, gy - h - 1.5, 2, 2); }
  }
}
function drawForegroundTufts() {
  const off = titleScroll * 1.4;
  ctx.fillStyle = "#0e1410";
  for (let i = Math.floor(off / 26) - 1; i < Math.floor(off / 26) + VW / 26 + 2; i++) {
    if (hash(i, 61) > 0.45) continue;
    const x = snap(i * 26 - off), h = 6 + hash(i, 62) * 10;
    for (let k = 0; k < 5; k++) { const sw = Math.sin(titleT * 2 + i + k) * 1.2; ctx.beginPath(); ctx.moveTo(x + k * 2.5, VH); ctx.lineTo(x + k * 2.5 + sw + 1, VH - h * (0.6 + 0.4 * hash(i, k))); ctx.lineTo(x + k * 2.5 + 2, VH); ctx.fill(); }
  }
}
// Le puits, avec son toit et son seau. front = false : le fond et l'ouverture, true : la margelle devant le héros
function drawWell(x, front) {
  const gy = TITLE.ground, w = 40, rimY = gy - 18;
  if (!front) {
    ctx.fillStyle = "#3a2414"; ctx.fillRect(snap(x - w / 2 + 3), gy - 52, 3, 36); ctx.fillRect(snap(x + w / 2 - 6), gy - 52, 3, 36);   // poteaux
    ctx.fillStyle = "#5a2a22"; ctx.beginPath(); ctx.moveTo(x - w / 2 - 6, gy - 46); ctx.lineTo(x, gy - 62); ctx.lineTo(x + w / 2 + 6, gy - 46); ctx.fill();   // toit
    ctx.fillStyle = "#7a3a2a"; ctx.fillRect(snap(x - w / 2 - 6), gy - 47, w + 12, 2);
    ctx.fillStyle = "#4a3428"; ctx.fillRect(snap(x - w / 2 + 3), gy - 42, w - 6, 2);           // treuil
    ctx.fillStyle = "#8a7a5a"; ctx.fillRect(snap(x + 4), gy - 40, 0.67, 12);                    // corde
    ctx.fillStyle = "#6b4a2c"; ctx.fillRect(snap(x + 1), gy - 28, 7, 6);                        // seau
    ctx.fillStyle = "#4e4854"; ctx.fillRect(snap(x + 1), gy - 27, 7, 1);
    ctx.fillStyle = "#07050a"; ctx.beginPath(); ctx.ellipse(x, rimY, w / 2 - 3, 4, 0, 0, Math.PI * 2); ctx.fill();   // l'ouverture noire
    return;
  }
  // la margelle de pierre, devant
  ctx.fillStyle = "#4e4854"; ctx.fillRect(snap(x - w / 2), rimY, w, gy - rimY);
  ctx.fillStyle = "#6a6270";
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) ctx.fillRect(snap(x - w / 2 + 1 + c * 8 + (r % 2) * 4), rimY + 1 + r * 6, 6, 4.67);
  ctx.fillStyle = "#7c7686"; ctx.fillRect(snap(x - w / 2 - 1), rimY - 1, w + 2, 2);
  ctx.fillStyle = "#3f6a32"; ctx.fillRect(snap(x - w / 2 - 2), gy - 2, 5, 2); ctx.fillRect(snap(x + w / 2 - 3), gy - 3, 4, 3);   // un peu de mousse
}
function drawFireflies(dt) {
  if (fireflies.length < 14 && Math.random() < dt * 4) fireflies.push({ x: Math.random() * VW, y: 80 + Math.random() * 65, p: Math.random() * 6, life: 5 + Math.random() * 4 });
  for (let i = fireflies.length - 1; i >= 0; i--) {
    const f = fireflies[i]; f.life -= dt; f.x -= dt * (8 + titleSpeed() * 0.3); f.y += Math.sin(titleT * 1.5 + f.p) * dt * 6;
    if (f.life <= 0 || f.x < -4) { fireflies.splice(i, 1); continue; }
    const a = Math.max(0, Math.sin(titleT * 3 + f.p)) * Math.min(1, f.life);
    ctx.fillStyle = `rgba(220,255,140,${a * 0.25})`; ctx.fillRect(snap(f.x - 1.5), snap(f.y - 1.5), 4, 4);
    ctx.fillStyle = `rgba(240,255,170,${a})`; ctx.fillRect(snap(f.x), snap(f.y), 1, 1);
  }
}
const titleSpeed = () => intro && intro.phase === "run" ? TITLE.sprint : intro ? 0 : TITLE.run;

// ----- Le héros -----
function drawTitleHero(x, y, frame, face = 1) {
  const c = spriteCanvas(frame, false);
  ctx.save(); ctx.translate(snap(x), snap(y)); ctx.scale(face, 1); ctx.imageSmoothingEnabled = false;
  // la cape qui flotte derrière lui
  ctx.fillStyle = "#6e1f24"; const fl = Math.sin(titleT * 16) * 1.5;
  ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-11, -9 + fl); ctx.lineTo(-9, -4 + fl * 0.5); ctx.lineTo(-3, -6); ctx.fill();
  ctx.drawImage(c, -6, -16);
  ctx.restore();
}

function drawTitle(dt) {
  titleT += dt;
  if (!REDUCED) titleScroll += dt * titleSpeed();
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawSky();
  drawLayer(0.08, "#221a34", x => ridge(x, 1, 50, 128, 60));                   // montagnes lointaines
  drawLayer(0.18, "#1c1a2a", x => ridge(x, 4, 30, 140, 40));
  drawPines(0.32, 17, "#18202a", 146, 26, 18, 5);                             // forêt lointaine
  drawPines(0.6, 29, "#121a18", 152, 40, 30, 9);                              // forêt proche
  // une brume basse
  const mist = ctx.createLinearGradient(0, 118, 0, TITLE.ground);
  mist.addColorStop(0, "rgba(176,96,74,0)"); mist.addColorStop(1, "rgba(120,80,90,0.28)");
  ctx.fillStyle = mist; ctx.fillRect(0, 118, VW, TITLE.ground - 118);
  drawGroundStrip();

  let hx = TITLE.heroX, hy = TITLE.ground, frame = ["hero_run0", "hero_run1", "hero_run2", "hero_run1"][Math.abs(Math.floor(titleT * 12)) % 4], hidden = false;
  if (intro) {
    const it = intro; it.t += dt;
    if (it.phase === "run") {
      // le puits arrive de la droite, le héros sprinte
      it.wellX = VW + 120 - (it.t * TITLE.sprint);
      if (it.wellX <= TITLE.heroX + 62) { it.wellX = TITLE.heroX + 62; it.phase = "jump"; it.jt = 0; it.x0 = TITLE.heroX; }
    } else if (it.phase === "jump") {
      it.jt += dt;
      const k = Math.min(1, it.jt / 0.5);
      hx = it.x0 + (it.wellX - it.x0) * k;
      hy = TITLE.ground - Math.sin(k * Math.PI * 0.75) * 34 - k * k * 6;
      frame = k < 0.5 ? "hero_jump" : "hero_fall";
      if (k >= 1) { it.phase = "fall"; it.ft = 0; it.fy = hy; }
    } else if (it.phase === "fall") {
      it.ft += dt;
      hx = it.wellX; hy = it.fy + 300 * it.ft * it.ft + 20 * it.ft; frame = "hero_fall";
      it.fade = Math.min(1, it.ft / 0.7);
      if (it.ft > 0.95) { finishIntro(); return; }
    }
    drawWell(it.wellX, false);
    if (it.phase === "fall" && hy > TITLE.ground + 4) hidden = true;
    if (!hidden) drawTitleHero(hx, hy, frame);
    drawWell(it.wellX, true);
  } else {
    drawTitleHero(hx, hy + Math.round(Math.abs(Math.sin(titleT * 6)) * -1), frame);
    if (Math.random() < dt * 8 && titleDust.length < 40) titleDust.push({ x: hx - 4, y: hy - 1, vx: -30 - Math.random() * 20, vy: -10 - Math.random() * 10, life: 0.4 });
  }
  for (let i = titleDust.length - 1; i >= 0; i--) {
    const d = titleDust[i]; d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 40 * dt;
    if (d.life <= 0) { titleDust.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(138,127,116,${d.life / 0.4 * 0.7})`; ctx.fillRect(snap(d.x), snap(d.y), 1, 1);
  }
  drawFireflies(dt);
  drawForegroundTufts();
  // le soir tombe sur les bords, et l'écran plonge dans le noir pendant la chute
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VW * 0.65);
  vg.addColorStop(0, "rgba(6,4,10,0)"); vg.addColorStop(1, "rgba(6,4,10,0.55)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (intro && intro.fade > 0) {
    ctx.fillStyle = `rgba(6,4,10,${intro.fade})`; ctx.fillRect(0, 0, VW, VH);
  }
}

// À l'arrivée dans le puits, l'écran sort doucement du noir
let fadeIn = 0;
function drawFadeIn() {
  if (fadeIn <= 0) return;
  fadeIn = Math.max(0, fadeIn - frameDt);
  ctx.fillStyle = `rgba(6,4,10,${Math.min(1, fadeIn / 0.8)})`; ctx.fillRect(0, 0, VW, VH);
}
