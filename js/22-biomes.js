"use strict";
// ---------- 21. Biomes ----------
/* Chaque biome a ses couleurs, sa lumière et ses décors. La map les déclare comme des rectangles
   (level.biomes : [{ x, y, w, h, id }] en tuiles) ; hors de tout rectangle, c'est le biome « entree ». */
const BIOMES = {
  entree: { name: "L'entrée lumineuse", sub: "Ce qui reste de Puits-Clair",
    stone: [92, 84, 72], top: "#6f9a4a", wall: [44, 38, 34], ambient: 0.15, light: "rgba(255,226,170,0.10)" },
  mines:  { name: "Les mines abandonnées", sub: "La prison oubliée du roi",
    stone: [78, 66, 58], top: "#7a5432", wall: [34, 28, 26], ambient: 0.42, light: "rgba(232,145,58,0.12)" },
  noyee:  { name: "La zone noyée", sub: "Le village englouti de Brume-sous-Terre",
    stone: [58, 74, 78], top: "#4a7a6a", wall: [22, 32, 38], ambient: 0.55, light: "rgba(127,200,214,0.10)" },
  spores: { name: "Les profondeurs organiques", sub: "Le jardin de la Mère-Spore",
    stone: [64, 52, 78], top: "#4ab0a0", wall: [26, 18, 34], ambient: 0.68, light: "rgba(120,240,210,0.10)" },
  antre:  { name: "L'antre corrompu", sub: "Là où le puits a faim",
    stone: [58, 30, 38], top: "#9a2a3a", wall: [20, 8, 14], ambient: 0.78, light: "rgba(200,60,80,0.10)" },
};
const BIOME_IDS = Object.keys(BIOMES);
let biomeGrid = null;
function buildBiomeGrid() {
  biomeGrid = new Uint8Array(MW * MH);
  for (const b of level.biomes || []) {
    const id = Math.max(0, BIOME_IDS.indexOf(b.id));
    for (let r = Math.max(0, b.y); r < Math.min(MH, b.y + b.h); r++)
      for (let c = Math.max(0, b.x); c < Math.min(MW, b.x + b.w); c++) biomeGrid[r * MW + c] = id;
  }
}
function biomeAt(c, r) {
  if (!biomeGrid) return "entree";
  c = Math.max(0, Math.min(MW - 1, c)); r = Math.max(0, Math.min(MH - 1, r));
  return BIOME_IDS[biomeGrid[r * MW + c]];
}
// Arrivée dans un nouveau biome : son nom s'affiche
let biomeShown = null;
function updateBiome(p) {
  const id = biomeAtPx(p.x + p.w / 2, p.y + p.h / 2);
  if (id === biomeShown) return;
  const first = biomeShown === null;
  biomeShown = id;
  if (!first || (level.biomes && level.biomes.length)) showBiomeTitle(id);
}
let biomeTitle = null;
function showBiomeTitle(id) { biomeTitle = { id, t: 3.2 }; }
function drawBiomeTitle(dt) {
  if (!biomeTitle) return;
  biomeTitle.t -= dt;
  if (biomeTitle.t <= 0) { biomeTitle = null; return; }
  const B = BIOMES[biomeTitle.id], a = Math.min(1, biomeTitle.t / 0.6, (3.2 - biomeTitle.t) / 0.5);
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = "center";
  ctx.font = "16px 'IM Fell English SC', Georgia, serif";
  ctx.fillStyle = "rgba(13,11,16,0.85)"; ctx.fillText(B.name, VW / 2 + 0.7, 42.7);
  ctx.fillStyle = "#e9e1cf"; ctx.fillText(B.name, VW / 2, 42);
  ctx.font = "7px 'Alegreya Sans', sans-serif";
  ctx.fillStyle = "#c8bfae"; ctx.fillText(B.sub, VW / 2, 54);
  ctx.textAlign = "start"; ctx.globalAlpha = 1;
}

// Couleurs de la pierre selon le biome
function stoneColor(c, r, v) {
  const B = BIOMES[biomeAt(c, r)];
  return `rgb(${B.stone[0] + v * 10},${B.stone[1] + v * 8},${B.stone[2] + v * 10})`;
}
function biomeTop(c, r) { return BIOMES[biomeAt(c, r)].top; }
function wallColor(c, r) { const w = BIOMES[biomeAt(c, r)].wall; return `rgb(${w[0]},${w[1]},${w[2]})`; }

// Décors posés sur le sol (purement visuels), choisis par tuile pour rester stables
function drawBiomeProps(get, ox, oy, vw, vh) {
  const c0 = Math.floor(ox / T), c1 = Math.ceil((ox + vw) / T), r0 = Math.floor(oy / T), r1 = Math.ceil((oy + vh) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!solid(get(c, r + 1)) || get(c, r) !== ".") continue;
    const v = hash(c * 7, r * 13);
    if (v > 0.32) continue;
    const id = biomeAt(c, r), x = c * T - ox, y = r * T - oy;
    if (id === "entree") {                                // herbes et fleurs
      ctx.fillStyle = "#6f9a4a"; ctx.fillRect(x + 3, y + 12, 1, 4); ctx.fillRect(x + 6, y + 11, 1, 5); ctx.fillRect(x + 10, y + 13, 1, 3);
      if (v < 0.1) { ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 5.5, y + 10, 2, 2); }
    } else if (id === "mines") {                          // étais de bois et rails
      if (v < 0.12) { ctx.fillStyle = "#5a3e22"; ctx.fillRect(x + 6, y, 3, 16); ctx.fillRect(x + 2, y, 11, 2); }
      else { ctx.fillStyle = "#3a3440"; ctx.fillRect(x, y + 14, T, 1); ctx.fillRect(x + 3, y + 15, 2, 1); ctx.fillRect(x + 11, y + 15, 2, 1); }
    } else if (id === "noyee") {                          // algues
      const sw = Math.sin(time * 2 + c) * 1.2;
      ctx.fillStyle = "#2f6a5a"; ctx.fillRect(x + 4 + sw, y + 8, 1.33, 8); ctx.fillRect(x + 9 - sw, y + 10, 1.33, 6);
    } else if (id === "spores") {                         // champignons lumineux
      const g = 0.6 + 0.4 * Math.sin(time * 2 + c);
      ctx.fillStyle = "#3a5a5a"; ctx.fillRect(x + 7, y + 11, 2, 5);
      ctx.fillStyle = `rgba(120,240,210,${g})`; ctx.fillRect(x + 4, y + 9, 8, 3);
    } else if (id === "antre") {                          // veines et épines
      ctx.fillStyle = "#6a1a2a"; ctx.fillRect(x + 2, y + 15, 12, 1);
      ctx.beginPath(); ctx.moveTo(x + 6, y + 16); ctx.lineTo(x + 8, y + 9 + Math.sin(time * 3 + c)); ctx.lineTo(x + 10, y + 16); ctx.fill();
    }
  }
}
// Lumières des biomes : champignons, lanternes des mines
function biomeLights(hole, ox, oy) {
  const c0 = Math.floor(ox / T) - 2, c1 = Math.ceil((ox + VW) / T) + 2, r0 = Math.floor(oy / T) - 2, r1 = Math.ceil((oy + VH) / T) + 2;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!solid(tile(c, r + 1)) || tile(c, r) !== ".") continue;
    const v = hash(c * 7, r * 13), id = biomeAt(c, r);
    if (id === "spores" && v <= 0.32) hole(c * T + 8 - ox, r * T + 10 - oy, 26);
    else if (id === "mines" && v < 0.05) hole(c * T + 8 - ox, r * T + 4 - oy, 34);
  }
}
const biomeAmbient = () => BIOMES[biomeAtPx(cam.x + VW / 2, cam.y + VH / 2)].ambient;
