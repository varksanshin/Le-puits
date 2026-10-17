"use strict";
// ---------- 12. Éditeur ----------
let mode = "play";
const BRUSHES = [
  { group: "Terrain", items: [
    { id: "#", name: "Pierre", color: "#5a5262" },
    { id: "x", name: "Mur fissuré", color: "#6e6474", glyph: "x" },
    { id: "^", name: "Pics", color: "#8d8796", glyph: "^" },
    { id: "-", name: "Planche", color: "#7a5432" },
    { id: "|", name: "Grille (phase)", color: "#5c6166", glyph: "|", text: "#e9e1cf" },
    { id: "H", name: "Herse (cristal)", color: "#3e3a44", glyph: "H", text: "#e9e1cf" },
    { id: "=", name: "Plateforme friable", color: "#6a5a48", glyph: "=", text: "#e9e1cf" },
    { id: "~", name: "Eau", color: "#2a6e8c", glyph: "~", text: "#e9e1cf" },
    { id: "%", name: "Courant d'air", color: "#9ab0a8", glyph: "↑" },
    { id: "g", name: "Mur d'accroche", color: "#4a6a3a", glyph: "g", text: "#e9e1cf" },
    { id: "G", name: "Vanne (levier)", color: "#6b4a2c", glyph: "G", text: "#e9e1cf" },
    { id: "f", name: "Faux mur (secret)", color: "#8a7f74", glyph: "?" },
    { id: "B", name: "Barrière d'arène", color: "#c4413b", glyph: "B", text: "#e9e1cf" },
    { id: "k", name: "Porte à clé", color: "#8a5a30", glyph: "k", text: "#f2d45a" },
    { id: "erase", name: "Gomme", color: "#241e2b", glyph: "·", text: "#e9e1cf" },
  ]},
  { group: "Repères", items: [
    { id: "spawn", name: "Départ du héros", color: "#9c2f2f", glyph: "P", text: "#e9e1cf" },
    { id: "exit", name: "Sortie simple", color: "#7fc8d6", glyph: "E" },
    { id: "campfire", name: "Feu de camp (+15 lumière)", color: "#f2b54a", glyph: "▲" },
    { id: "stele", name: "Stèle corrompue (−15 lumière)", color: "#9d6bc4", glyph: "‡", text: "#e9e1cf" },
  ]},
  { group: "Le Gardien", items: [
    { id: "bossdoor", name: "Porte du Gardien", color: "#4e4854", glyph: "D", text: "#e9e1cf" },
    { id: "arena", name: "Entrée de l'arène", color: "#c4413b", glyph: "A", text: "#e9e1cf" },
    { id: "boss", name: "Le Gardien", color: "#6a6270", glyph: "B", text: "#e9e1cf" },
    { id: "altar", name: "Autel d'objet", color: "#b48ae0", glyph: "?" },
    { id: "anchor", name: "Anneau de grappin", color: "#a9b7b0", glyph: "o" },
    { id: "crystal", name: "Cristal (lève les herses)", color: "#7fc8d6", glyph: "◆" },
    { id: "lever", name: "Levier (ouvre les vannes)", color: "#a07044", glyph: "/", text: "#e9e1cf" },
    { id: "chest", name: "Coffre", color: "#f2d45a", glyph: "▬" },
    { id: "lore", name: "Tablette d'histoire", color: "#7a7180", glyph: "¶", text: "#e9e1cf" },
    { id: "trial", name: "Épreuve (arène qui se ferme)", color: "#c4413b", glyph: "!", text: "#e9e1cf" },
  ]},
  { group: "Butin et salles spéciales", items: [
    { id: "pot", name: "Jarre", color: "#a0623a", glyph: "v", text: "#e9e1cf" },
    { id: "goldchest", name: "Coffre doré (clé)", color: "#c8962c", glyph: "▬" },
    { id: "treasure", name: "Piédestal de trésor", color: "#f2d45a", glyph: "I" },
    { id: "shopitem", name: "Boutique : objet", color: "#7fd6c0", glyph: "$" },
    { id: "shopgood", name: "Boutique : cœur ou clé", color: "#7fd6c0", glyph: "¢" },
    { id: "sacrifice", name: "Autel du sacrifice", color: "#c4413b", glyph: "Z", text: "#e9e1cf" },
    { id: "merchant", name: "Marchand (décor)", color: "#3d2f4a", glyph: "M", text: "#f2d45a" },
  ]},
  { group: "Reliques de skill", items: [
    { id: "relic:doubleJump", name: "Double saut", color: "#e8913a", glyph: "+" },
    { id: "relic:dash", name: "Dash", color: "#f2d45a", glyph: "+" },
    { id: "relic:smash", name: "Frappe chargée", color: "#d06a4a", glyph: "+" },
    { id: "relic:bolt", name: "Projectile magique", color: "#7fc8d6", glyph: "+" },
    { id: "relic:grapple", name: "Grappin", color: "#a9b7b0", glyph: "+" },
    { id: "relic:phase", name: "Phase", color: "#9d6bc4", glyph: "+" },
  ]},
  { group: "Créatures et mécanismes", items: [
    { id: "crawler", name: "Larve", color: "#6f8f4c", glyph: "L" },
    { id: "bat", name: "Chauve-souris", color: "#4a3560", glyph: "C", text: "#e9e1cf" },
    { id: "spitter", name: "Cracheur", color: "#7a4a6a", glyph: "R", text: "#e9e1cf" },
    { id: "golem", name: "Golem de pierre", color: "#6a6270", glyph: "G", text: "#e9e1cf" },
    { id: "wisp", name: "Feu follet", color: "#8ff0d0", glyph: "F" },
    { id: "champi", name: "Champignon sauteur", color: "#c0503c", glyph: "c", text: "#e9e1cf" },
    { id: "squelette", name: "Prisonnier squelette", color: "#e6dcc8", glyph: "S" },
    { id: "rodeur", name: "Rôdeur d'ombre", color: "#1c1424", glyph: "r", text: "#f2d45a" },
    { id: "mimic", name: "Mimique", color: "#6b4a2c", glyph: "m", text: "#f2d45a" },
    { id: "bucket", name: "Seau suspendu", color: "#6b4a2c", glyph: "U", text: "#e9e1cf" },
  ]},
];
const ed = { tool: "brush", brush: "#", camX: 0, camY: 0, zoom: 1, painting: false, panning: false, panFrom: null, rectStart: null, hover: null, undo: [], redo: [] };
const ZOOMS = [0.25, 0.5, 1, 2];
const frameEl = $("frame"), edStatus = $("edStatus");

function buildEditor() {
  $("palette").innerHTML = BRUSHES.map(g => `
    <div class="group"><h3>${g.group}</h3>
      ${g.items.map(b => `<button class="btn brush${b.id === ed.brush ? " on" : ""}" data-brush="${b.id}">
        <span class="sw" style="background:${b.color};color:${b.text || "#0d0b10"}">${b.glyph || ""}</span>${b.name}</button>`).join("")}
    </div>`).join("");
  $("palette").addEventListener("click", e => {
    const b = e.target.closest("[data-brush]"); if (!b) return;
    ed.brush = b.dataset.brush;
    if (ed.tool === "hand") setTool("brush");
    for (const x of $("palette").querySelectorAll("[data-brush]")) x.classList.toggle("on", x === b);
    b.blur();
  });
  for (const b of document.querySelectorAll("[data-tool]")) b.addEventListener("click", () => { setTool(b.dataset.tool); b.blur(); });
  $("undo").addEventListener("click", undo); $("redo").addEventListener("click", redo);
  $("undoBig").addEventListener("click", undo); $("redoBig").addEventListener("click", redo);
  $("zoomIn").addEventListener("click", () => zoomBy(1)); $("zoomOut").addEventListener("click", () => zoomBy(-1));
  $("testLevel").addEventListener("click", () => setMode("play"));
  $("saveNow").addEventListener("click", () => { clearTimeout(saveTimer); saveLevel(); });
  $("resize").addEventListener("click", resizeLevel);
  $("copyLevel").addEventListener("click", e => { refreshLevelText(); copyText($("levelText").value, e.currentTarget, "Copier le niveau", $("levelText")); });
  $("importLevel").addEventListener("click", importLevel);
  $("resetLevel").addEventListener("click", e => {
    const b = e.currentTarget;
    if (b.dataset.armed) { delete b.dataset.armed; b.textContent = "Revenir au niveau d'origine"; pushUndo(); level = clone(DEFAULT_LEVEL); afterEdit(true); toast("Niveau d'origine restauré. Ctrl+Z pour annuler.", 2400); }
    else { b.dataset.armed = "1"; b.textContent = "Confirmer : tout remplacer ?"; setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = "Revenir au niveau d'origine"; } }, 4000); }
  });
  $("levelText").closest("details").addEventListener("toggle", refreshLevelText);

  cv.addEventListener("pointerdown", onPointerDown);
  cv.addEventListener("pointermove", onPointerMove);
  cv.addEventListener("pointerup", onPointerUp);
  cv.addEventListener("pointercancel", onPointerUp);
  cv.addEventListener("pointerleave", () => { ed.hover = null; });
  cv.addEventListener("contextmenu", e => { if (mode === "edit") e.preventDefault(); });
  cv.addEventListener("wheel", e => {
    if (mode !== "edit") return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1 : -1, toWorld(e));
  }, { passive: false });
}
function setTool(t) {
  ed.tool = t;
  for (const b of document.querySelectorAll("[data-tool]")) b.classList.toggle("on", b.dataset.tool === t);
}
function setMode(m) {
  if (m === mode) return;
  mode = m;
  const edit = m === "edit";
  $("tabPlay").setAttribute("aria-selected", String(!edit));
  $("tabEdit").setAttribute("aria-selected", String(edit));
  $("editorPanel").hidden = !edit; $("atelierPanel").hidden = edit;
  $("hud").hidden = edit; edStatus.hidden = !edit; $("edFloat").hidden = !edit; renderUndo();
  frameEl.classList.toggle("edit", edit);
  keys.clear();
  if (edit) {
    menuEl.hidden = true;
    backToStory(); loadMap();
    ed.camX = (player ? player.x : spawn.x) - VW / 2; ed.camY = (player ? player.y : spawn.y) - VH / 2;
    syncSizeInputs();
    startLoop();
  } else {
    resetRun(ed.testFrom || null); ed.testFrom = null;
    closeMenu();
    startLoop();
  }
}
function syncSizeInputs() { $("mapW").value = level.w; $("mapH").value = level.h; }

const entAt = (x, y) => level.ents.findIndex(e => e.x === x && e.y === y);
function setTerrain(x, y, c) {
  const row = level.rows[y];
  if (row[x] === c) return false;
  level.rows[y] = row.slice(0, x) + c + row.slice(x + 1);
  return true;
}
// Pose le pinceau courant sur une case. Renvoie true si quelque chose a changé.
function applyBrush(x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  const b = ed.brush;
  // Le départ du héros ne s'efface jamais : on ne peint pas sur sa case, il se déplace seulement avec le pinceau « Départ »
  const here = entAt(x, y);
  if (here >= 0 && level.ents[here].t === "spawn" && b !== "spawn") {
    if (!ed.spawnWarned) { ed.spawnWarned = true; flashEdStatus("Le départ du héros est protégé : déplace-le avec le pinceau « Départ du héros »."); }
    return false;
  }
  if (["#", "x", "^", "-", "|", "H", "=", "~", "%", "g", "G", "f", "B", "k"].includes(b)) {
    let ch = setTerrain(x, y, b);
    const i = entAt(x, y); if (i >= 0) { level.ents.splice(i, 1); ch = true; }
    return ch;
  }
  if (b === "erase") {
    let ch = setTerrain(x, y, ".");
    const i = entAt(x, y); if (i >= 0) { level.ents.splice(i, 1); ch = true; }
    return ch;
  }
  // Entités : une seule par case, un seul départ et une seule sortie
  const i = entAt(x, y);
  const want = b.startsWith("relic:") ? { t: "relic", x, y, s: b.slice(6) } : b === "bucket" ? { t: "bucket", x, y, d: bucketDrop() } : b === "lore" ? { t: "lore", x, y, s: "secret" } : b === "trial" ? { t: "trial", x, y, w: 18, h: 12 } : { t: b, x, y };
  if (i >= 0) {
    const cur = level.ents[i];
    if (cur.t === want.t && cur.s === want.s && cur.d === want.d) return false;
    level.ents.splice(i, 1);
  }
  if (["spawn", "exit", "bossdoor", "arena", "boss"].includes(want.t)) level.ents = level.ents.filter(e => e.t !== want.t);
  setTerrain(x, y, ".");
  level.ents.push(want);
  return true;
}
const bucketDrop = () => Math.max(1, Math.min(30, Math.round(+$("bucketDrop").value || 5)));

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  const lx = (e.clientX - r.left) / r.width * VW, ly = (e.clientY - r.top) / r.height * VH;
  return { x: ed.camX + lx / ed.zoom, y: ed.camY + ly / ed.zoom, lx, ly };
}
function onPointerDown(e) {
  if (mode !== "edit") return;
  cv.setPointerCapture(e.pointerId);
  const w = toWorld(e);
  if (e.button === 1 || e.button === 2 || ed.tool === "hand") {
    ed.panning = true; ed.panFrom = { lx: w.lx, ly: w.ly, camX: ed.camX, camY: ed.camY };
    frameEl.classList.add("panning");
    return;
  }
  if (e.button !== 0) return;
  const cx = Math.floor(w.x / T), cy = Math.floor(w.y / T);
  pushUndo();
  if (ed.tool === "rect") { ed.rectStart = { x: cx, y: cy }; ed.hover = { x: cx, y: cy }; return; }
  ed.painting = true; ed.changed = applyBrush(cx, cy); ed.last = { x: cx, y: cy };
  if (ed.changed) afterEdit();
}
function onPointerMove(e) {
  if (mode !== "edit") return;
  const w = toWorld(e);
  ed.hover = { x: Math.floor(w.x / T), y: Math.floor(w.y / T) };
  if (ed.panning) {
    ed.camX = ed.panFrom.camX - (w.lx - ed.panFrom.lx) / ed.zoom;
    ed.camY = ed.panFrom.camY - (w.ly - ed.panFrom.ly) / ed.zoom;
    return;
  }
  if (ed.painting) {
    // Trace une ligne de cases entre deux mouvements pour ne pas laisser de trous
    const { x: x0, y: y0 } = ed.last, x1 = ed.hover.x, y1 = ed.hover.y;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    let ch = false;
    for (let i = 1; i <= n; i++) ch = applyBrush(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)) || ch;
    ed.last = { x: x1, y: y1 };
    if (ch) { ed.changed = true; afterEdit(); }
  }
}
function onPointerUp(e) {
  if (mode !== "edit") return;
  if (ed.panning) { ed.panning = false; frameEl.classList.remove("panning"); return; }
  if (ed.rectStart && ed.hover) {
    const x0 = Math.min(ed.rectStart.x, ed.hover.x), x1 = Math.max(ed.rectStart.x, ed.hover.x);
    const y0 = Math.min(ed.rectStart.y, ed.hover.y), y1 = Math.max(ed.rectStart.y, ed.hover.y);
    let ch = false;
    const terrainBrush = ["#", "x", "^", "-", "|", "H", "=", "~", "%", "g", "G", "f", "B", "k", "erase"].includes(ed.brush);
    if (terrainBrush) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ch = applyBrush(x, y) || ch; }
    else ch = applyBrush(ed.hover.x, ed.hover.y);
    ed.rectStart = null;
    if (ch) afterEdit(); else ed.undo.pop();
    return;
  }
  if (ed.painting) { ed.painting = false; if (!ed.changed) ed.undo.pop(); }
}
function pushUndo() {
  ed.undo.push(JSON.stringify(level));
  if (ed.undo.length > 80) ed.undo.shift();
  ed.redo = [];
}
function undo() {
  if (!ed.undo.length) return;
  ed.redo.push(JSON.stringify(level));
  level = JSON.parse(ed.undo.pop()); afterEdit(true);
}
function redo() {
  if (!ed.redo.length) return;
  ed.undo.push(JSON.stringify(level));
  level = JSON.parse(ed.redo.pop()); afterEdit(true);
}
// Après chaque modification : le moteur relit la map, et la sauvegarde part après une courte pause
function afterEdit(structural) {
  loadMap();
  if (structural) syncSizeInputs();
  markDirty();
  renderUndo();
}
// Les boutons Annuler / Rétablir montrent combien de pas on peut défaire
function renderUndo() {
  const u = ed.undo.length, r = ed.redo.length;
  for (const [id, n, label] of [["undoBig", u, "↶ Annuler"], ["redoBig", r, "↷ Rétablir"], ["undo", u, "↶ Annuler"], ["redo", r, "↷ Rétablir"]]) {
    const b = $(id); if (!b) continue;
    b.disabled = !n; b.innerHTML = n ? `${label}<b>${n}</b>` : label;
  }
}
function zoomBy(dir, around) {
  const i = ZOOMS.indexOf(ed.zoom), ni = Math.max(0, Math.min(ZOOMS.length - 1, i + dir));
  if (ni === i) return;
  const old = ed.zoom, nz = ZOOMS[ni];
  const fx = around ? around.lx : VW / 2, fy = around ? around.ly : VH / 2;
  const wx = ed.camX + fx / old, wy = ed.camY + fy / old;
  ed.zoom = nz; ed.camX = wx - fx / nz; ed.camY = wy - fy / nz;
  $("zoomLabel").textContent = `${Math.round(nz * 100)} %`;
}
function resizeLevel() {
  const w = Math.max(8, Math.min(256, Math.round(+$("mapW").value || level.w)));
  const h = Math.max(8, Math.min(256, Math.round(+$("mapH").value || level.h)));
  if (w === level.w && h === level.h) return;
  pushUndo();
  const rows = [];
  for (let y = 0; y < h; y++) {
    const old = level.rows[y] || "";
    rows.push((old + ".".repeat(Math.max(0, w))).slice(0, w));
  }
  level = { v: 1, base: level.base, w, h, rows, ents: level.ents.filter(e => e.x < w && e.y < h), biomes: level.biomes || [] };
  afterEdit(true);
  toast(`Map redimensionnée : ${w} × ${h} tuiles.`, 1800);
}
function refreshLevelText() { $("levelText").value = JSON.stringify(level); }
function importLevel() {
  try {
    const l = JSON.parse($("levelText").value);
    if (!validLevel(l)) throw new Error("bad");
    pushUndo(); level = normalizeLevel(l); afterEdit(true);
    toast("Niveau importé.", 1800);
  } catch (e) {
    toast("Ce texte n'est pas un niveau valide : colle le texte complet copié depuis l'éditeur.", 3400);
  }
}
function editorKey(e) {
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return true; }
  if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); return true; }
  if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); clearTimeout(saveTimer); saveLevel(); return true; }
  if (!e.ctrlKey && !e.metaKey && k === "t" && ed.hover) {
    e.preventDefault();
    ed.testFrom = { x: ed.hover.x * T + 3, y: ed.hover.y * T + 2 };
    setMode("play"); return true;
  }
  return false;
}
function updateEditor(dt) {
  const sp = 260 / ed.zoom * dt;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) ed.camX -= sp;
  if (keys.has("ArrowRight") || keys.has("KeyD")) ed.camX += sp;
  if (keys.has("ArrowUp") || keys.has("KeyW")) ed.camY -= sp;
  if (keys.has("ArrowDown") || keys.has("KeyS")) ed.camY += sp;
  const vw = VW / ed.zoom, vh = VH / ed.zoom;
  ed.camX = Math.max(-vw * 0.75, Math.min(ed.camX, MW * T - vw * 0.25));
  ed.camY = Math.max(-vh * 0.75, Math.min(ed.camY, MH * T - vh * 0.25));
}
const edTile = (c, r) => (c < 0 || r < 0 || c >= level.w || r >= level.h) ? "." : level.rows[r][c];
let lastStatus = "";
function drawEditor() {
  const z = ed.zoom, vw = VW / z, vh = VH / z;
  const ox = Math.round(ed.camX * S * z) / (S * z), oy = Math.round(ed.camY * S * z) / (S * z);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#08060b"; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(S * z, 0, 0, S * z, 0, 0);
  ctx.fillStyle = "#2a2331"; ctx.fillRect(-ox, -oy, level.w * T, level.h * T);
  drawTiles(edTile, ox, oy, vw, vh, true);
  drawWater(edTile, ox, oy, vw, vh);
  // Faux murs et barrières bien visibles dans l'éditeur
  for (let r = Math.max(0, Math.floor(oy / T)); r <= Math.min(level.h - 1, Math.ceil((oy + vh) / T)); r++)
    for (let c = Math.max(0, Math.floor(ox / T)); c <= Math.min(level.w - 1, Math.ceil((ox + vw) / T)); c++) {
      const t = edTile(c, r);
      if (t === "f") { ctx.fillStyle = "rgba(242,212,90,0.35)"; ctx.fillRect(c * T - ox + 2, r * T - oy + 2, T - 4, T - 4); }
      else if (t === "B") { ctx.fillStyle = "rgba(196,65,59,0.45)"; ctx.fillRect(c * T - ox + 6, r * T - oy, 4, T); }
    }
  // Noms des biomes
  ctx.font = `${Math.max(6, 8 / z)}px 'JetBrains Mono', monospace`;
  const named = new Set();                                 // un seul nom par biome, à son premier rectangle
  for (const b of level.biomes || []) {
    if (named.has(b.id)) continue;
    named.add(b.id);
    ctx.fillStyle = "rgba(13,11,16,0.7)"; ctx.fillRect(b.x * T - ox + 2, b.y * T - oy + 2, 150 / z, 14 / z);
    ctx.fillStyle = "rgba(127,200,214,0.95)"; ctx.fillText(BIOMES[b.id] ? BIOMES[b.id].name : b.id, b.x * T - ox + 6, b.y * T - oy + 12 / z);
  }
  // Grille
  if (z >= 0.5) {
    ctx.fillStyle = "rgba(233,225,207,0.07)";
    const lw = 1 / (S * z);
    const c0 = Math.max(0, Math.floor(ox / T)), c1 = Math.min(level.w, Math.ceil((ox + vw) / T));
    const r0 = Math.max(0, Math.floor(oy / T)), r1 = Math.min(level.h, Math.ceil((oy + vh) / T));
    for (let c = c0; c <= c1; c++) ctx.fillRect(c * T - ox, r0 * T - oy, lw, (r1 - r0) * T);
    for (let r = r0; r <= r1; r++) ctx.fillRect(c0 * T - ox, r * T - oy, (c1 - c0) * T, lw);
  }
  // Entités
  for (const e of level.ents) {
    const x = e.x * T - ox, y = e.y * T - oy;
    if (x < -40 || y < -200 || x > vw + 40 || y > vh + 200) continue;
    if (e.t === "spawn") {
      drawHero(x + 8, y + 16, { w: 10, h: 14, sx: 1, sy: 1, face: 1, lean: 0, cape: 0, vx: 0, onGround: true, dashTimer: 0, gliding: false, hurt: 0, charge: 0, atkTimer: 0, anim: 0 });
    } else if (e.t === "exit") drawExitAt(x, y - 8);
    else if (e.t === "campfire") drawCampfireAt(x, y, false, 0, time);
    else if (e.t === "stele") drawSteleAt(x + 3, y - 6, false, 0, time);
    else if (e.t === "bossdoor") { const keep = bossDoor; bossDoor = { x: e.x * T - 4, y: e.y * T - 16, w: 24, h: 32, hold: 0 }; drawBossDoor(ox, oy); bossDoor = keep; }
    else if (e.t === "arena") { ctx.strokeStyle = "#c4413b"; ctx.lineWidth = 1 / (S * z) * 2; ctx.strokeRect(x + 2, y + 2, 12, 14); ctx.fillStyle = "#c4413b"; ctx.fillRect(x + 6, y + 6, 4, 6); }
    else if (e.t === "boss") drawBoss({ variant: "normal", state: "idle", dir: -1 }, x - 6, y - 12, false);
    else if (e.t === "relic") drawRelicAt(x + 4, y + 4, e.s);
    else if (e.t === "altar") drawPickupAt(x + 3, y + 3);
    else if (e.t === "anchor") drawAnchorAt(x + 8, y + 6);
    else if (e.t === "lever") drawLeverAt(x + 4, y + 4, false);
    else if (e.t === "chest") drawChestAt(x + 1, y + 6, false, e.s === "secret");
    else if (e.t === "lore") drawLoreAt(x + 2, y + 2, false);
    else if (e.t === "pot") drawPotAt(x + 3, y + 5, 0);
    else if (e.t === "goldchest") drawGoldChestAt(x + 1, y + 6, false);
    else if (e.t === "treasure" || e.t === "shopitem" || e.t === "shopgood") drawPedestalAt({ x: e.x * T + 2, y: e.y * T + 4, t: 0, kind: e.t, item: null, good: e.t === "shopgood" ? "key" : null }, ox, oy);
    else if (e.t === "sacrifice") drawSacrificeAt({ x: e.x * T, y: e.y * T + 2, uses: 0 }, ox, oy);
    else if (e.t === "merchant") drawMerchantAt({ x: e.x * T + 2, y: e.y * T, t: 0 }, ox, oy);
    else if (e.t === "trial") { drawTrialMark(x, y, "idle"); ctx.strokeStyle = "rgba(196,65,59,0.35)"; ctx.lineWidth = 1 / (S * z); ctx.strokeRect(x - Math.floor((e.w || 18) / 2) * T, y - ((e.h || 12) - 1) * T, (e.w || 18) * T, (e.h || 12) * T); }
    else if (e.t === "crystal") {
      drawCrystalAt(x + 3, y + 2, false);
      ctx.strokeStyle = "rgba(127,200,214,0.25)"; ctx.lineWidth = 1 / (S * z);     // portée de 16 tuiles
      ctx.strokeRect(x - 16 * T, y - 16 * T, 33 * T, 33 * T);
    }
    else if (ENEMY_TYPES[e.t]) {
      const d = ENEMY_TYPES[e.t];
      const fake = { type: e.t, x: e.x * T + (T - d.w) / 2, y: (e.y + 1) * T - d.h - (d.fly ? 4 : 0), w: d.w, h: d.h, t: time, flash: 0, daze: 0, dir: 1, state: "walk", stateT: 0 };
      drawEnemy(fake, ox, oy, 1); drawEnemyOverlay(fake, ox, oy, 1);
    } else if (e.t === "bucket") {
      let r = e.y - 1; while (r >= 0 && !solid(edTile(e.x, r))) r--;
      drawBucketAt(x - 2, y, 20, (r + 1) * T - oy);
      ctx.fillStyle = "rgba(232,145,58,0.55)";                 // course du seau
      for (let yy = y + 12; yy < y + (e.d || 4) * T; yy += 3) ctx.fillRect(x + 7.5, yy, 1, 1.5);
      ctx.fillRect(x + 2, y + (e.d || 4) * T, 12, 1);
    }
  }
  // Bord de la map
  ctx.strokeStyle = "rgba(232,145,58,0.6)"; ctx.lineWidth = 1 / (S * z) * 2;
  ctx.strokeRect(-ox, -oy, level.w * T, level.h * T);
  // Case survolée et rectangle
  if (ed.hover) {
    let x0 = ed.hover.x, y0 = ed.hover.y, x1 = x0, y1 = y0;
    if (ed.rectStart) { x0 = Math.min(ed.rectStart.x, ed.hover.x); x1 = Math.max(ed.rectStart.x, ed.hover.x); y0 = Math.min(ed.rectStart.y, ed.hover.y); y1 = Math.max(ed.rectStart.y, ed.hover.y); }
    ctx.fillStyle = "rgba(232,145,58,0.18)"; ctx.fillRect(x0 * T - ox, y0 * T - oy, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    ctx.strokeStyle = "#e8913a"; ctx.strokeRect(x0 * T - ox, y0 * T - oy, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
  }
  // Barre d'état
  const n = t => level.ents.filter(e => e.t === t).length;
  const warns = [];
  if (!n("spawn")) warns.push("Pas de départ");
  if (!n("exit") && !n("bossdoor")) warns.push("Pas de sortie ni de porte du Gardien");
  if (n("bossdoor") && (!n("arena") || !n("boss"))) warns.push("La porte du Gardien a besoin d'une entrée d'arène et du Gardien");
  const parts = [
    ed.hover ? `Case ${ed.hover.x}, ${ed.hover.y}` : "Survole la map",
    `Map ${level.w} × ${level.h}`,
    `${level.ents.filter(e => ENEMY_TYPES[e.t] && e.t !== "boss").length} créatures · ${n("altar")} autels · ${n("relic")} reliques · ${n("anchor")} anneaux`,
  ];
  if (edFlash) warns.unshift(edFlash);
  const html = parts.map(p => `<span>${p}</span>`).join("") + warns.map(w => `<span class="warn">${w}</span>`).join("");
  if (html !== lastStatus) { edStatus.innerHTML = html; lastStatus = html; }
}

// Petit message temporaire dans la barre d'état de l'éditeur
let edFlash = null, edFlashT = 0;
function flashEdStatus(msg) {
  edFlash = msg; clearTimeout(edFlashT);
  edFlashT = setTimeout(() => { edFlash = null; ed.spawnWarned = false; }, 3000);
}
