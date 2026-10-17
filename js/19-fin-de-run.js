"use strict";
// ---------- 18. Chrono, fin de run et records ----------
/* Le chrono tourne pendant la partie (pas dans les menus). Chaque relique et la porte du Gardien
   enregistrent un temps intermédiaire. Une run où l'on a utilisé l'atelier de test, ou lancée depuis
   l'éditeur, n'enregistre pas de record. */
const ENDINGS = {
  normal: { name: "La menace scellée", color: "#e8913a",
    text: "Le Gardien s'effondre et la fissure se referme sous lui. Le pays respire… pour un temps." },
  pure:   { name: "Fin de la Lumière", color: "#fff6c8",
    text: "Sans une once de ténèbres, tu as vaincu le Gardien dans toute sa fureur. Ta flamme remonte le puits et rallume le pays." },
  abyss:  { name: "Fin des Abysses", color: "#c88aff",
    text: "Le Gardien dévoré s'effondre… et le sol s'ouvre sous tes pieds. Plus bas, quelque chose t'attendait depuis toujours.",
    note: "Les Abysses, l'étage caché sous le fond du puits, arriveront dans une prochaine version." },
};
let runClock = 0, runOver = false, runTainted = false, splits = [], maxDepth = 0;
let clockOn = true;
try { clockOn = localStorage.getItem("lepuits.clock") !== "off"; } catch (e) {}
const clockEl = document.getElementById("clock");

function loadRecords() {
  try { return JSON.parse(localStorage.getItem("lepuits.records")) || {}; } catch (e) { return {}; }
}
function saveRecords(r) { try { localStorage.setItem("lepuits.records", JSON.stringify(r)); } catch (e) {} }

function startRunClock(tainted) {
  runClock = 0; runOver = false; runTainted = !!tainted; splits = []; maxDepth = 0;
}
function recordSplit(label) { splits.push({ label, t: runClock }); }
function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
function updateRunClock(dt) {
  if (runOver || !player || player.dead) return;
  runClock += dt;
  maxDepth = Math.max(maxDepth, Math.floor((player.y + player.h) / T));
}
let clockShown = "";
function renderClock() {
  const txt = clockOn ? fmtTime(runClock) + (runTainted ? " · test" : "") : "";
  if (txt !== clockShown) { clockShown = txt; clockEl.textContent = txt; clockEl.hidden = !clockOn; }
}

// Fin de run : victoire (une des trois fins) ou mort
function endRun(kind, tier) {
  if (runOver) return;
  runOver = true;
  clearSave();
  const rec = loadRecords();
  rec.endings = rec.endings || {};
  let newRecord = false, best = null;
  const recKey = gameMode === "chaos" ? "chaos-" + tier : tier;
  if (kind === "win" && !runTainted) {
    const r = rec.endings[recKey] || { count: 0, best: null };
    r.count++;
    if (r.best === null || runClock < r.best) { newRecord = true; r.best = runClock; }
    best = r.best;
    rec.endings[recKey] = r;
  } else if (kind === "win") best = rec.endings[recKey] ? rec.endings[recKey].best : null;
  if (kind === "death" && !runTainted) rec.deaths = (rec.deaths || 0) + 1;
  saveRecords(rec);
  renderEndPanel(kind, tier, rec, newRecord, best);
  screen = "end"; menuRoot = "end"; keys.clear();
  $("hud").hidden = true; bossBarEl.hidden = true;
  showPanel("end");
}
function renderEndPanel(kind, tier, rec, newRecord, best) {
  const E = kind === "win" ? ENDINGS[tier] : { name: "Englouti par le puits", color: "#c4413b", text: "Le puits garde ton corps. Tes objets sont perdus, mais tu sais maintenant ce qui t'attend plus bas." };
  $("endTitle").textContent = E.name;
  $("endTitle").style.color = E.color;
  $("endText").textContent = E.text;
  $("endNote").textContent = E.note || "";
  $("endNote").hidden = !E.note;
  const rows = [
    ["Temps", fmtTime(runClock) + (newRecord && kind === "win" ? "  · nouveau record" : "")],
    kind === "win" && best !== null ? ["Record pour cette fin", fmtTime(best)] : null,
    ["Lumière restante", `${Math.ceil(100 - dark - 0.001)} %`],
    ["Profondeur", `${Math.min(maxDepth, 131)} / 131 tuiles`],
    ["Ennemis vaincus", String(kills)],
    ["Objets", String(items.size)],
  ].filter(Boolean);
  if (gameMode === "chaos") rows.unshift(["Mode", `chaos · graine ${chaosSeed}`]);
  if (runTainted) rows.push(["Record", "non enregistré (atelier de test ou départ depuis l'éditeur)"]);
  $("endStats").innerHTML = rows.map(([k, v]) => `<span class="a">${k}</span><span>${v}</span>`).join("");
  $("endSplits").innerHTML = splits.length
    ? splits.map(s => `<span class="a">${s.label}</span><span>${fmtTime(s.t)}</span>`).join("")
    : `<span class="a">Aucune relique</span><span>—</span>`;
  const got = ["normal", "pure", "abyss"].filter(t => rec.endings && rec.endings[t]);
  let unlock = `Fins obtenues : ${got.length} / 3`;
  if (rec.endings && rec.endings.pure && rec.endings.abyss) unlock += " · Tu as connu la Lumière et les Abysses. Une troisième voie s'est ouverte au fond du puits… (vraie fin, prochaine version)";
  $("endUnlock").textContent = unlock;
}
