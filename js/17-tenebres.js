"use strict";
// ---------- 16. Jauge de ténèbres ----------
/* À l'écran, c'est une jauge de LUMIÈRE : 100 % en arrivant de dehors, elle baisse quand les ténèbres montent.
   En interne, « dark » compte les ténèbres (lumière = 100 − dark). Elle décide de la fin :
     5 % ou moins devant le Gardien  → combat enragé, « Fin de la Lumière »
     95 % ou plus                    → combat corrompu, « Fin des Abysses »
     entre les deux                  → fin classique
   Elle monte : chaque nouvelle profondeur, le temps passé dans le puits, les objets maudits, les stèles corrompues.
   Elle baisse : les feux de camp, l'Eau bénite, et la Lanterne bénie freine sa montée. */
const DARK = {
  pure: 5, abyss: 95,           // seuils des sous-fins
  perZone: 3,                   // chaque nouvelle profondeur atteinte
  tickEvery: 25,                // toutes les 25 secondes, le puits grignote de la lumière :
  tickBase: 1,                  // 1 % en haut du puits…
  tickDepth: 1,                 // … jusqu'à 2 % tout au fond
  campfire: -15,                // repos à un feu de camp (une fois par feu)
  stele: 15,                    // stèle corrompue absorbée (une fois par stèle)
  restTime: 0.9,                // secondes immobile au contact pour se reposer ou absorber
};
let dark = 0, darkLocked = false, darkShown = -1, whisperT = 8, darkTickT = DARK.tickEvery, darkTickFx = 0;

function addDark(n, why) {
  if (darkLocked || !n) return;
  if (n > 0 && has("lanterne")) n *= 0.5;
  const before = dark;
  dark = Math.max(0, Math.min(100, dark + n));
  if (before > DARK.pure && dark <= DARK.pure) toast("Ta flamme brûle pure. Le Gardien ne te fera aucun cadeau.", 3000);
  if (before < DARK.abyss && dark >= DARK.abyss) toast("Les ténèbres t'ont presque englouti. Les Abysses t'appellent…", 3200);
  // affiché en lumière : les ténèbres qui montent font perdre de la lumière
  if (why && Math.abs(n) >= 1) floatText(`${n > 0 ? "−" : "+"}${Math.round(Math.abs(n))} lumière`, n > 0 ? "#b48ae0" : "#f2d45a");
}
const darkTier = () => dark <= DARK.pure ? "pure" : dark >= DARK.abyss ? "abyss" : "normal";
// Rayon de la torche : il rétrécit quand les ténèbres montent
function lightRadius() {
  let r = (92 - 44 * (dark / 100)) * (1 - 0.18 * darkTickFx);     // la torche vacille à chaque perte de lumière
  if (has("oeil")) r *= 1.9;
  if (has("lanterne")) r *= 1.2;
  return r;
}
// Les ennemis se corrompent au-delà de 40 % : plus rapides
const corruption = () => Math.max(0, (dark - 40) / 60);

// Petits textes qui s'envolent au-dessus du héros (+4 ténèbres, −15…)
const floaters = [];
function floatText(text, color) {
  const stack = floaters.filter(f => f.life > 0.9).length;          // empilés, pas superposés
  floaters.push({ text, color, x: player.x + player.w / 2, y: player.y - 6 - stack * 8, life: 1.4 });
}

const WHISPERS = [
  "… descends …", "… il t'attend …", "… plus profond …", "… tu nous appartiens déjà …",
  "… la lumière ment …", "… laisse-toi tomber …",
];
function updateDark(dt) {
  const p = player;
  if (p.dead || darkLocked) return;
  // Par à-coups : la flamme vacille, et un peu de lumière s'en va
  darkTickFx = Math.max(0, darkTickFx - dt * 2.5);
  darkTickT -= dt;
  if (darkTickT <= 0) {
    darkTickT = DARK.tickEvery;
    const depth = Math.min(1, Math.max(0, (p.y + p.h) / (MH * T)));
    addDark(Math.round(DARK.tickBase + DARK.tickDepth * depth), true);
    darkTickFx = 1;
    darkBarEl.classList.remove("tick"); void darkBarEl.offsetWidth; darkBarEl.classList.add("tick");
  }
  // Feux de camp et stèles : rester immobile au contact pour s'en servir
  const still = Math.abs(p.vx) < 12 && p.onGround;
  for (const f of campfires) {
    f.t += dt;
    if (f.used) continue;
    if (overlap(p, f) && still) {
      f.rest += dt;
      if (f.rest >= DARK.restTime) {
        f.used = true; f.usedAt = runClock;
        addDark(DARK.campfire, true);
        if (p.hp < stats.maxHp) { p.hp += 1; renderHearts(); }
        burst(f.x + 8, f.y + 8, 24, "#f2b54a", 80);
        campfireSave();
      }
    } else f.rest = Math.max(0, f.rest - dt * 2);
  }
  for (const s of steles) {
    s.t += dt;
    if (s.used) continue;
    if (overlap(p, s) && still) {
      s.rest += dt;
      if (s.rest >= DARK.restTime) {
        s.used = true;
        addDark(DARK.stele, true);
        if (p.hp < stats.maxHp) { p.hp += 1; renderHearts(); }
        burst(s.x + 5, s.y + 8, 30, "#9d6bc4", 90);
        shake(2, 0.2);
        toast("La stèle se vide dans tes veines. Tu te sens plus fort… et plus sombre.", 3000);
      }
    } else s.rest = Math.max(0, s.rest - dt * 2);
  }
  // Au-delà de 80 %, le puits murmure
  if (dark >= 80) {
    whisperT -= dt;
    if (whisperT <= 0) { whisperT = 9 + Math.random() * 8; floatText(pick(WHISPERS), "#9d6bc4"); }
  }
}
function updateFloaters(dt) {
  for (const f of floaters) { f.life -= dt; f.y -= 14 * dt; }
  for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);
}

// ----- Dessin -----
function drawCampfireAt(x, y, used, k, t) {
  ctx.fillStyle = "#4a321e"; ctx.fillRect(x + 2, y + 13, 12, 2); ctx.fillRect(x + 4, y + 11, 8, 2);
  ctx.fillStyle = "#2a2430";
  for (let i = 0; i < 5; i++) ctx.fillRect(x + 1 + i * 3, y + 15, 2, 1);
  if (used) { ctx.fillStyle = "#3a3440"; ctx.fillRect(x + 6, y + 9, 4, 2); return; }
  const fl = Math.sin(t * 14) * 0.8;
  ctx.fillStyle = "#c4413b"; ctx.beginPath(); ctx.moveTo(x + 4, y + 11); ctx.lineTo(x + 8, y + 2 - fl); ctx.lineTo(x + 12, y + 11); ctx.fill();
  ctx.fillStyle = "#f2b54a"; ctx.beginPath(); ctx.moveTo(x + 6, y + 11); ctx.lineTo(x + 8, y + 5 + fl); ctx.lineTo(x + 10, y + 11); ctx.fill();
  if (k > 0) { ctx.fillStyle = "rgba(242,181,74,0.9)"; ctx.fillRect(x, y - 4, 16 * k, 1.33); }
}
function drawSteleAt(x, y, used, k, t) {
  ctx.fillStyle = "#241c2c"; ctx.fillRect(x, y + 4, 10, 18);
  ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + 5, y); ctx.lineTo(x + 10, y + 4); ctx.fill();
  ctx.fillStyle = "#3a2c48"; ctx.fillRect(x + 1, y + 5, 2, 16);
  const g = used ? 0.15 : 0.55 + 0.35 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(157,107,196,${g})`;
  ctx.fillRect(x + 4, y + 7, 2, 2); ctx.fillRect(x + 3, y + 11, 4, 1.33); ctx.fillRect(x + 4.33, y + 14, 1.33, 4);
  if (k > 0) { ctx.fillStyle = "rgba(180,138,224,0.9)"; ctx.fillRect(x - 3, y - 4, 16 * k, 1.33); }
}
function drawDarkWorld(ox, oy) {
  for (const f of campfires) drawCampfireAt(f.x - ox, f.y - oy, f.used, f.rest / DARK.restTime, f.t);
  for (const s of steles) drawSteleAt(s.x - ox, s.y - oy, s.used, s.rest / DARK.restTime, s.t);
}
function darkLights(hole, ox, oy) {
  for (const f of campfires) if (!f.used) hole(f.x + 8 - ox, f.y + 8 - oy, 70 + Math.sin(f.t * 9) * 3);
  for (const s of steles) if (!s.used) hole(s.x + 5 - ox, s.y + 10 - oy, 30);
}
// Après l'obscurité : textes flottants et vignette des murmures
function drawDarkOverlay(ox, oy) {
  ctx.font = "6px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 0.5);
    ctx.fillStyle = "#0d0b10"; ctx.fillText(f.text, snap(f.x - ox) + 0.5, snap(f.y - oy) + 0.5);
    ctx.fillStyle = f.color; ctx.fillText(f.text, snap(f.x - ox), snap(f.y - oy));
  }
  ctx.globalAlpha = 1; ctx.textAlign = "start";
  if (dark >= 80) {
    const k = (dark - 80) / 20 * (0.55 + 0.25 * Math.sin(time * 1.7));
    const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
    g.addColorStop(0, "rgba(40,10,50,0)"); g.addColorStop(1, `rgba(40,10,50,${0.6 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
}

// ----- HUD -----
const darkBarEl = document.getElementById("darkBar"), darkFillEl = document.getElementById("darkFill"), darkValEl = document.getElementById("darkVal");
function renderDark() {
  const v = Math.round(dark * 10) / 10;
  if (v === darkShown) return;
  darkShown = v;
  const light = 100 - dark;
  darkFillEl.style.width = `${light}%`;
  darkValEl.textContent = `${Math.ceil(light - 0.001)} %`;
  darkBarEl.dataset.tier = darkTier();
}
