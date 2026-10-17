"use strict";
// ---------- 28b. Pause : inventaire, carte du puits, sauvegarde ----------

// ----- Carte : chaque salle visitée se dévoile -----
let mapSeen = new Set();
const cellOf = (x, y) => `${Math.floor((x / T - 1) / CELL_W)},${Math.floor((y / T - 1) / CELL_H)}`;
function updateMapSeen() {
  const p = player; if (!p || p.dead) return;
  mapSeen.add(cellOf(p.x + p.w / 2, p.y + p.h / 2));
  renderMiniMap();
}
// Couleur d'une tuile sur les cartes (grande carte et mini-carte)
function mapColor(t) {
  if (t === "#" || t === "g" || t === "b") return "#3a3444";
  if (t === "~") return "#2a6e8c";
  if (t === "k") return "#f2d45a";
  if (t === "x" || t === "H" || t === "|" || t === "G") return "#8a7f74";
  if (t === "^") return "#c4413b";
  if (t === "-" || t === "=") return "#7a5432";
  return "#1c1822";
}

// ----- Mini-carte : un coin du HUD avec les salles explorées autour du héros -----
let miniMapOn = true;
try { miniMapOn = localStorage.getItem("lepuits.minimap") !== "off"; } catch (e) {}
const MINI = { tw: 4 * CELL_W, th: 3 * CELL_H, px: 2, every: 0.12 };   // 4 salles de large, 3 de haut, 2 px par tuile
let miniT = 0;
function renderMiniMap(force) {
  const cv2 = document.getElementById("miniMap"); if (!cv2) return;
  const show = miniMapOn && screen !== "title" && mode !== "edit" && !bossFight;
  cv2.hidden = !show; if (!show) return;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  if (!force && now - miniT < MINI.every) return;
  miniT = now;
  const p = player; if (!p) return;
  const W = MINI.tw, H = MINI.th, k = MINI.px;
  if (cv2.width !== W * k) { cv2.width = W * k; cv2.height = H * k; }
  const g = cv2.getContext("2d");
  const pc = Math.floor((p.x + p.w / 2) / T), pr = Math.floor((p.y + p.h / 2) / T);
  const x0 = Math.max(0, Math.min(MW - W, pc - (W >> 1))), y0 = Math.max(0, Math.min(MH - H, pr - (H >> 1)));
  g.fillStyle = "#0d0b10"; g.fillRect(0, 0, cv2.width, cv2.height);
  const seen = (c, r) => mapSeen.has(`${Math.floor((c - 1) / CELL_W)},${Math.floor((r - 1) / CELL_H)}`);
  for (let r = y0; r < y0 + H && r < MH; r++) for (let c = x0; c < x0 + W && c < MW; c++) {
    if (!seen(c, r)) continue;
    g.fillStyle = mapColor(grid[r][c]); g.fillRect((c - x0) * k, (r - y0) * k, k, k);
  }
  const mark = (x, y, color, s = 4, force) => {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < x0 || ty < y0 || tx >= x0 + W || ty >= y0 + H || (!seen(tx, ty) && !force)) return;
    g.fillStyle = color; g.fillRect((tx - x0) * k - s / 2 + 1, (ty - y0) * k - s / 2 + 1, s, s);
  };
  for (const f of campfires) mark(f.x + 8, f.y + 8, f.used ? "#6a5a48" : "#f2b54a");
  for (const m of merchants) mark(m.x + 6, m.y + 8, "#7fd6c0");
  const compass = has("boussole");
  for (const r of relics) if (!r.taken && (!r.guarded || compass)) mark(r.x + 4, r.y + 4, RELIC_INFO[r.skill].color, 5, compass);
  if (bossDoor) mark(bossDoor.x + 12, bossDoor.y + 16, "#9d6bc4", 6, compass);
  // le héros : un point qui clignote doucement
  const blink = Math.floor(now * 3) % 2 === 0;
  g.fillStyle = blink ? "#ffffff" : "#c4413b";
  g.fillRect((pc - x0) * k - 2, (pr - y0) * k - 2, 5, 5);
}
const MAP_PX = 4;                                       // pixels par tuile sur la carte
function renderMap() {
  const cv2 = document.getElementById("mapCanvas"); if (!cv2) return;
  const p = player;
  // On ne montre que la partie explorée du puits (avec une marge)
  let c0 = 1e9, c1 = -1, r0 = 1e9, r1 = -1;
  for (const k of mapSeen) { const [c, r] = k.split(",").map(Number); c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
  if (c1 < 0) { c0 = c1 = 0; r0 = r1 = 0; }
  const tx0 = Math.max(0, (c0 - 1) * CELL_W), ty0 = Math.max(0, (r0 - 1) * CELL_H);
  const tx1 = Math.min(MW, (c1 + 2) * CELL_W + 1), ty1 = Math.min(MH, (r1 + 2) * CELL_H + 1);
  cv2.width = (tx1 - tx0) * MAP_PX; cv2.height = (ty1 - ty0) * MAP_PX;
  const g = cv2.getContext("2d");
  g.fillStyle = "#0d0b10"; g.fillRect(0, 0, cv2.width, cv2.height);
  const seen = (c, r) => mapSeen.has(`${Math.floor((c - 1) / CELL_W)},${Math.floor((r - 1) / CELL_H)}`);
  const X = c => (c - tx0) * MAP_PX, Y = r => (r - ty0) * MAP_PX;
  for (let r = ty0; r < ty1; r++) for (let c = tx0; c < tx1; c++) {
    if (!seen(c, r)) continue;
    g.fillStyle = mapColor(grid[r][c]); g.fillRect(X(c), Y(r), MAP_PX, MAP_PX);
  }
  const mark = (x, y, color, size = 7, force) => {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (!seen(tx, ty) && !force) return;
    g.fillStyle = "#0d0b10"; g.fillRect(X(tx) - size / 2 - 1, Y(ty) - size / 2 - 1, size + 2, size + 2);
    g.fillStyle = color; g.fillRect(X(tx) - size / 2, Y(ty) - size / 2, size, size);
  };
  for (const f of campfires) mark(f.x + 8, f.y + 8, f.used ? "#6a5a48" : "#f2b54a");
  for (const m of merchants) mark(m.x + 6, m.y + 8, "#7fd6c0");
  for (const pd of pedestals) if (pd.kind === "treasure" && !pd.taken) mark(pd.x + 6, pd.y + 6, "#f2d45a");
  for (const al of sacrAltars) mark(al.x + 8, al.y + 6, "#c4413b");
  const compass = has("boussole");                       // la Boussole ancienne montre les reliques et la porte, même inexplorées
  for (const r of relics) if (!r.taken) mark(r.x + 4, r.y + 4, RELIC_INFO[r.skill].color, 8, compass);
  if (bossDoor) mark(bossDoor.x + 12, bossDoor.y + 16, "#9d6bc4", 9, compass);
  const px = Math.floor((p.x + p.w / 2) / T), py = Math.floor((p.y + p.h / 2) / T);
  g.fillStyle = "#ffffff"; g.fillRect(X(px) - 6, Y(py) - 6, 12, 12);
  g.fillStyle = "#c4413b"; g.fillRect(X(px) - 4, Y(py) - 4, 8, 8);
  const wrap = document.getElementById("mapWrap");
  if (wrap) requestAnimationFrame(() => {
    const k = wrap.clientWidth / cv2.width;
    wrap.scrollTop = Math.max(0, Y(py) * k - wrap.clientHeight / 2);
  });
  const n = document.getElementById("mapCount");
  if (n) n.textContent = `${mapSeen.size} salle${mapSeen.size > 1 ? "s" : ""} explorée${mapSeen.size > 1 ? "s" : ""}`;
}

// ----- Inventaire : ce que tu portes, sans tout expliquer -----
function itemIconCanvas(id) {
  const [name, recolor] = itemIcon(id);
  return spriteCanvas(name, false, recolor);
}
function renderInventory() {
  const g = document.getElementById("invGrid"); if (!g) return;
  const p = player, owned = [...items];
  const sk = SKILLS.filter(s => skills[s.id]).map(s => `<span class="inv-skill" style="--c:${RELIC_INFO[s.id].color}">${s.name}</span>`).join("") || `<span class="inv-empty">Aucune relique pour l'instant.</span>`;
  g.innerHTML = `
    <div class="inv-stats">
      <span>PV <b>${p.hp} / ${stats.maxHp}</b></span><span>Lumière <b>${Math.ceil(100 - dark - 0.001)} %</b></span>
      <span>Pièces <b>${coins}</b></span><span>Clés <b>${keyCount}</b></span><span>Temps <b>${fmtTime(runClock)}</b></span>
    </div>
    <div class="inv-skills">${sk}</div>
    <div class="inv-items">${owned.length ? owned.map(id => `<div class="inv-item"><canvas width="8" height="10" data-icon="${id}"></canvas><div><b>${ITEM[id].name}</b><i>${ITEM[id].hint}</i></div></div>`).join("")
      : `<span class="inv-empty">Tes poches sont vides.</span>`}</div>`;
  for (const c of g.querySelectorAll("canvas[data-icon]")) { const src = itemIconCanvas(c.dataset.icon); const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0); }
}

// ----- Sauvegarde de la partie -----
const SAVE_KEY = "lepuits.partie";
let loadingSave = false;
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} refreshContinue(); }
function refreshContinue() {
  const b = menuEl.querySelector('[data-act="continue"]');
  if (b) b.hidden = !hasSave();
}
function saveGame(quiet) {
  const p = player;
  if (!p || p.dead || runOver || bossFight) return false;
  const idx = (arr, f) => arr.map((o, i) => f(o) ? i : -1).filter(i => i >= 0);
  const data = {
    v: 1, at: Date.now(), mode: gameMode, seed: chaosSeed, base: level.base, w: MW, h: MH,
    rows: grid.map(r => r.join("")),
    p: { x: p.x, y: p.y, hp: p.hp, face: p.face },
    skills: Object.keys(skills).filter(k => skills[k]), items: [...items], coins, keyCount, dark, runClock, runTainted,
    visited: [...visited], mapSeen: [...mapSeen], miniBeaten: [...miniBeaten],
    relics: idx(relics, r => r.taken), chests: idx(chests, c => c.open), gold: idx(goldChests, c => c.open), pots: idx(pots, o => o.broken),
    pedestals: pedestals.map(pd => ({ taken: pd.taken, item: pd.item, good: pd.good })), altars: sacrAltars.map(a => a.uses),
    fires: idx(campfires, f => f.used), fireAt: campfires.map(f => f.usedAt || 0), steles: idx(steles, s => s.used), levers: idx(levers, l => l.on), crystals: idx(crystals, k => k.on),
    alive: enemies.filter(e => e.si != null && !e.dead).map(e => e.si), kills, secretsFound, revealed: [...revealed],
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { if (!quiet) toast("Impossible de sauvegarder dans ce navigateur.", 2400); return false; }
  if (!quiet) toast("Partie sauvegardée.", 1600);
  refreshContinue();
  return true;
}
function loadGame() {
  let s;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
  if (!s) return false;
  // Remettre la bonne map
  if (s.mode === "chaos") {
    if (gameMode === "story") storyLevel = level;
    const lv = buildChaosLevel(s.seed);
    if (!lv) return false;
    level = lv; gameMode = "chaos"; chaosSeed = lv.seed;
  } else {
    backToStory();
    if (level.base !== s.base) { toast("Cette sauvegarde vient d'une ancienne version de la map.", 3000); clearSave(); return false; }
  }
  if (level.w !== s.w || level.h !== s.h) { clearSave(); return false; }
  loadingSave = true; miniBeaten = new Set(s.miniBeaten || []);
  resetRun({ x: s.p.x, y: s.p.y });
  loadingSave = false;
  grid = s.rows.map(r => r.split(""));
  for (const id of s.skills) grantSkill(id);
  for (const id of s.items) { items.add(id); }
  computeStats(); renderItems();
  const p = player; p.hp = Math.min(s.p.hp, stats.maxHp); p.face = s.p.face || 1; renderHearts();
  coins = s.coins; keyCount = s.keyCount; renderPurse();
  dark = s.dark; darkShown = -1; renderDark();
  runClock = s.runClock || 0; runTainted = !!s.runTainted;
  visited = new Set(s.visited); mapSeen = new Set(s.mapSeen || []);
  for (const i of s.relics) if (relics[i]) relics[i].taken = true;
  for (const i of s.chests) if (chests[i]) chests[i].open = true;
  for (const i of s.gold) if (goldChests[i]) goldChests[i].open = true;
  for (const i of s.pots) if (pots[i]) pots[i].broken = true;
  (s.pedestals || []).forEach((o, i) => { if (pedestals[i]) Object.assign(pedestals[i], o); });
  (s.altars || []).forEach((u, i) => { if (sacrAltars[i]) sacrAltars[i].uses = u; });
  for (const i of s.fires) if (campfires[i]) campfires[i].used = true;
  (s.fireAt || []).forEach((t, i) => { if (campfires[i]) campfires[i].usedAt = t; });
  for (const i of s.steles) if (steles[i]) steles[i].used = true;
  for (const i of s.levers) if (levers[i]) levers[i].on = true;
  for (const i of s.crystals) if (crystals[i]) crystals[i].on = true;
  const alive = new Set(s.alive);
  enemies = enemies.filter(e => e.si == null || alive.has(e.si));
  kills = s.kills || 0; renderKills();
  secretsFound = s.secretsFound || 0; revealed = new Set(s.revealed || []);
  for (const m of minis) if (miniBeaten.has(m.key)) { m.state = "done"; m.relic.guarded = false; }
  p.zone = zoneOf(p);
  cam.x = p.x - VW / 2; cam.y = p.y - VH / 2;
  closeMenu(); fadeIn = 0.8;
  toast("Partie reprise.", 1800);
  return true;
}
// Chaque feu de camp sauvegarde la partie, comme un banc
function campfireSave() { saveGame(true); toast("Tu te réchauffes au feu de camp. La partie est sauvegardée.", 2600); }

// ----- Sortie de secours : on n'est jamais bloqué -----
/* Depuis la pause : retour au dernier feu de camp allumé (ou au départ), contre un peu de lumière.
   Depuis là, avec les pouvoirs que tu as, il y a toujours un chemin vers la suite. */
const ESCAPE_COST = 8;
function lastFire() {
  let best = null;
  for (const f of campfires) if (f.used && (!best || (f.usedAt || 0) >= (best.usedAt || 0))) best = f;
  return best;
}
function escapeToFire() {
  const p = player;
  if (!p || p.dead || runOver) return false;
  if (bossFight || miniActive) { toast("Impossible de fuir pendant un combat de gardien.", 2200); return false; }
  const f = lastFire();
  const to = freeSpawn(f ? { x: f.x + 3, y: f.y + 2 } : { ...spawn });
  p.x = p.prevX = to.x; p.y = p.prevY = to.y; p.vx = p.vy = 0;
  p.safeX = to.x; p.safeY = to.y; p.fallStartY = to.y;
  p.grapple = null; p.rope = null; p.phasing = false;
  addDark(ESCAPE_COST, true);
  p.zone = zoneOf(p);
  cam.x = p.x - VW / 2; cam.y = p.y - VH / 2;
  closeMenu(); fadeIn = 0.8;
  toast(f ? "Tu retrouves le dernier feu de camp." : "Tu remontes au point de départ.", 2400);
  return true;
}
