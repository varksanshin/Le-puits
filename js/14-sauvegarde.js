"use strict";
// ---------- 13. Sauvegarde ----------
// La map est enregistrée avec la page (stockage de l'artefact), et en secours dans ce navigateur.
let levelRef = null, saveTimer = null, saving = false, savePending = false, editSeq = 0;
const saveEl = $("saveStatus");
function setSave(state, text) { saveEl.dataset.s = state; saveEl.textContent = text; }
function markDirty() {
  editSeq++;
  try { localStorage.setItem("lepuits.level", JSON.stringify(level)); } catch (e) {}
  setSave("dirty", "Modifications en attente");
  clearTimeout(saveTimer); saveTimer = setTimeout(saveLevel, 1500);
}
async function saveLevel() {
  if (saving) { savePending = true; return; }
  const seq = editSeq;
  try { localStorage.setItem("lepuits.level", JSON.stringify(level)); } catch (e) {}
  if (!levelRef) { setSave("local", "Enregistré dans ce navigateur"); return; }
  saving = true; setSave("saving", "Enregistrement…");
  try {
    await levelRef.set({ level: clone(level), updatedAt: new Date().toISOString() });
    setSave(seq === editSeq ? "saved" : "dirty", seq === editSeq ? "Map enregistrée" : "Modifications en attente");
  } catch (e) {
    if (e && e.code === "quota_exceeded") setSave("error", "Stockage plein : copie ta map en texte");
    else setSave("error", "Échec de l'enregistrement : la map reste dans ce navigateur");
  }
  saving = false;
  if (savePending) { savePending = false; saveLevel(); }
}
async function connectStorage() {
  let db = null;
  try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (e) { db = null; }
  if (!db) { setSave("local", levelSource === "local" ? "Brouillon de ce navigateur" : levelSource === "updated" ? "Nouvelle map d'origine (ton ancien brouillon est gardé de côté)" : "Niveau d'origine"); return; }
  levelRef = db.doc("levels/main");
  try {
    const snap = await levelRef.get();
    let saved = snap.exists ? snap.data().level : null;
    // Map enregistrée à partir d'une ancienne map d'origine : on la met de côté et on repart de la nouvelle
    if (saved && saved.base !== DEFAULT_LEVEL.base) {
      try { await db.doc("levels/archive-" + new Date().toISOString().slice(0, 10)).set({ level: saved, note: "Map remplacée par une nouvelle map d'origine" }); } catch (e) {}
      saved = null;
      setSave("saved", "Nouvelle map d'origine (l'ancienne est archivée)");
    }
    if (saved && validLevel(saved) && editSeq === 0) {
      level = normalizeLevel(saved); levelSource = "db";
      if (mode === "edit") afterEditSilent(); else if (screen !== "play") resetRun();
      setSave("saved", "Map enregistrée");
    } else if (editSeq > 0) saveLevel();
    else if (saved) setSave("saved", levelSource === "local" ? "Brouillon de ce navigateur" : "Niveau d'origine");
  } catch (e) { setSave("error", "Map en ligne indisponible : brouillon local"); }
}
function afterEditSilent() { loadMap(); syncSizeInputs(); }
