"use strict";
// ---------- 33. Synchronisation entre appareils (Supabase) ----------
/* La progression suit le joueur d'un appareil à l'autre, sans compte :
   - au premier lancement, le jeu ouvre un espace de sauvegarde en ligne et reçoit un code de reprise (PUITS-XXXXX-XXXXX) ;
   - sur un autre appareil, menu « Synchroniser » → on tape ce code : les deux appareils partagent la même progression ;
   - le jeu sauvegarde toujours d'abord sur l'appareil (il marche hors ligne), puis envoie en ligne dès qu'il peut,
     et récupère la version en ligne au démarrage ;
   - si deux appareils ont joué chacun de leur côté, on fusionne : on garde le meilleur des deux pour l'Héritage,
     le bestiaire, les fins et les records ; pour la partie en cours, la plus récente.
   Ce qui est synchronisé : partie en cours, Héritage, bestiaire, fins obtenues, records de speedrun.
   Les réglages (touches, son, plein écran…) restent propres à chaque appareil.
   Côté Supabase : tables cloud_saves et cloud_devices, fonctions cloud_create / cloud_push / cloud_pull / cloud_link. */
const CLOUD_KEY = "lepuits.cloud", CLOUD_SYNCED = ["lepuits.heritage", "lepuits.bestiaire", "lepuits.records", "lepuits.pb", "lepuits.partie", "lepuits.partie.gone", "lepuits.daily"];
const CLOUD = { secret: null, code: null, last: 0, status: "", busy: false, pushed: null, every: 20 };
try { Object.assign(CLOUD, JSON.parse(localStorage.getItem(CLOUD_KEY)) || {}); } catch (e) {}
const saveCloud = () => { try { localStorage.setItem(CLOUD_KEY, JSON.stringify({ secret: CLOUD.secret, code: CLOUD.code, last: CLOUD.last, pushed: CLOUD.pushed })); } catch (e) {} };

function cloudSecret() {
  const b = new Uint8Array(32);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else for (let i = 0; i < 32; i++) b[i] = Math.random() * 256 | 0;
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function cloudRpc(fn, args) {
  if (typeof fetch !== "function" || typeof ONLINE === "undefined") throw new Error("hors ligne");
  const r = await fetch(`${ONLINE.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ONLINE.key, Authorization: "Bearer " + ONLINE.key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const txt = await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = txt; }
  if (!r.ok) throw new Error((body && body.message) || "erreur " + r.status);
  return body;
}

// ----- Lire et fusionner -----
const jparse = s => { try { return s == null ? null : JSON.parse(s); } catch (e) { return null; } };
function cloudSnapshot() {
  const keys = {};
  for (const k of CLOUD_SYNCED) { let v = null; try { v = localStorage.getItem(k); } catch (e) {} if (v != null) keys[k] = v; }
  return { v: 1, at: Date.now(), keys };
}
// a et b : { clé: texte } ; renvoie la fusion
function cloudMerge(a, b) {
  const out = { ...b, ...a };
  const A = k => jparse(a[k]), B = k => jparse(b[k]);
  // Héritage : celui qui a gagné le plus de braises
  { const x = A("lepuits.heritage"), y = B("lepuits.heritage");
    if (x && y) out["lepuits.heritage"] = JSON.stringify((y.total || 0) > (x.total || 0) || ((y.total || 0) === (x.total || 0) && (y.runs || 0) > (x.runs || 0)) ? y : x); }
  // Bestiaire : le plus grand de chaque compteur
  { const x = A("lepuits.bestiaire"), y = B("lepuits.bestiaire");
    if (x && y) {
      const m = { ...y, ...x };
      for (const t of new Set([...Object.keys(x), ...Object.keys(y)])) {
        const p = x[t] || {}, q = y[t] || {}, r = {};
        for (const f of new Set([...Object.keys(p), ...Object.keys(q)])) r[f] = Math.max(+p[f] || 0, +q[f] || 0);
        m[t] = r;
      }
      out["lepuits.bestiaire"] = JSON.stringify(m);
    } }
  // Fins obtenues : le plus de fois, le meilleur temps
  { const x = A("lepuits.records"), y = B("lepuits.records");
    if (x && y) {
      const m = { ...y, ...x, endings: {} };
      for (const e of new Set([...Object.keys(x.endings || {}), ...Object.keys(y.endings || {})])) {
        const p = (x.endings || {})[e] || { count: 0, best: null }, q = (y.endings || {})[e] || { count: 0, best: null };
        const bests = [p.best, q.best].filter(v => v != null);
        m.endings[e] = { ...q, ...p, count: Math.max(p.count || 0, q.count || 0), best: bests.length ? Math.min(...bests) : null };
      }
      m.deaths = Math.max(x.deaths || 0, y.deaths || 0);
      out["lepuits.records"] = JSON.stringify(m);
    } }
  // Records de speedrun : le meilleur temps de chaque catégorie, les meilleurs segments
  { const x = A("lepuits.pb"), y = B("lepuits.pb");
    if (x && y) {
      const m = {};
      for (const c of new Set([...Object.keys(x), ...Object.keys(y)])) {
        const p = x[c], q = y[c];
        if (!p || !q) { m[c] = p || q; continue; }
        const best = q.total != null && (p.total == null || q.total < p.total) ? q : p;
        const golds = [];
        for (let i = 0; i < Math.max((p.golds || []).length, (q.golds || []).length); i++) {
          const g = [(p.golds || [])[i], (q.golds || [])[i]].filter(v => v != null);
          golds[i] = g.length ? Math.min(...g) : null;
        }
        m[c] = { ...best, golds };
      }
      out["lepuits.pb"] = JSON.stringify(m);
    } }
  // Graine du jour : l'essai le plus récent (un essai par jour, sur tous les appareils)
  { const x = A("lepuits.daily"), y = B("lepuits.daily");
    if (x && y) out["lepuits.daily"] = JSON.stringify((y.at || 0) > (x.at || 0) ? y : x); }
  // Partie en cours : la plus récente (une partie terminée ou effacée compte aussi comme « récente »)
  { const ta = Math.max((A("lepuits.partie") || {}).at || 0, +a["lepuits.partie.gone"] || 0);
    const tb = Math.max((B("lepuits.partie") || {}).at || 0, +b["lepuits.partie.gone"] || 0);
    const src = tb > ta ? b : a;
    if (src["lepuits.partie"] != null && (jparse(src["lepuits.partie"]) || {}).at >= (+src["lepuits.partie.gone"] || 0)) out["lepuits.partie"] = src["lepuits.partie"];
    else delete out["lepuits.partie"];
    const gone = Math.max(+a["lepuits.partie.gone"] || 0, +b["lepuits.partie.gone"] || 0);
    if (gone) out["lepuits.partie.gone"] = String(gone);
  }
  return out;
}
// Écrit la fusion sur l'appareil et met à jour le jeu en mémoire
function cloudApply(keys) {
  let changed = false;
  for (const k of CLOUD_SYNCED) {
    let cur = null; try { cur = localStorage.getItem(k); } catch (e) {}
    const nv = keys[k] ?? null;
    if (cur === nv) continue;
    if (k === "lepuits.partie" && typeof player !== "undefined" && player && typeof screen !== "undefined" && (screen === "play" || screen === "pause")) continue; // pas pendant une partie
    changed = true;
    try { if (nv == null) localStorage.removeItem(k); else localStorage.setItem(k, nv); } catch (e) {}
  }
  if (!changed) return false;
  const h = jparse(keys["lepuits.heritage"]); if (h && typeof meta !== "undefined") meta = { ...meta, ...h, lv: { ...(h.lv || {}) } };
  const b = jparse(keys["lepuits.bestiaire"]); if (b && typeof bestiary !== "undefined") bestiary = b;
  const p = jparse(keys["lepuits.pb"]); if (p && typeof pbs !== "undefined") pbs = p;
  if (typeof refreshContinue === "function") refreshContinue();
  return true;
}

// ----- Synchroniser -----
async function cloudEnsure() {
  if (CLOUD.secret && CLOUD.code) return true;
  const secret = CLOUD.secret || cloudSecret();
  const code = await cloudRpc("cloud_create", { p_secret: secret });
  CLOUD.secret = secret; CLOUD.code = code; saveCloud();
  return true;
}
async function cloudSync(force) {
  if (CLOUD.busy || (typeof ONLINE !== "undefined" && !ONLINE.on && !force)) return false;
  CLOUD.busy = true;
  try {
    await cloudEnsure();
    const rows = await cloudRpc("cloud_pull", { p_secret: CLOUD.secret });
    const remote = rows && rows[0] && rows[0].data && rows[0].data.keys ? rows[0].data.keys : {};
    const merged = cloudMerge(cloudSnapshot().keys, remote);
    cloudApply(merged);
    const snap = cloudSnapshot(), fp = JSON.stringify(snap.keys);
    if (fp !== JSON.stringify(remote)) await cloudRpc("cloud_push", { p_secret: CLOUD.secret, p_data: snap });
    CLOUD.pushed = fp; CLOUD.last = Date.now(); CLOUD.status = "ok"; saveCloud();
    return true;
  } catch (e) { CLOUD.status = "erreur : " + e.message; return false; }
  finally { CLOUD.busy = false; if (typeof menuPanel !== "undefined" && menuPanel === "sync") renderSync(); }
}
async function cloudLink(code) {
  code = String(code || "").toUpperCase().replace(/\s+/g, "");
  if (!/^PUITS-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) { toast("Le code ressemble à PUITS-XXXXX-XXXXX.", 2400); return false; }
  if (code === CLOUD.code) { toast("C'est déjà le code de cet appareil.", 2000); return false; }
  CLOUD.busy = true;
  try {
    const secret = cloudSecret();
    const rows = await cloudRpc("cloud_link", { p_code: code, p_new_secret: secret });
    const remote = rows && rows[0] && rows[0].data && rows[0].data.keys ? rows[0].data.keys : {};
    cloudApply(cloudMerge(cloudSnapshot().keys, remote));
    CLOUD.secret = secret; CLOUD.code = rows[0].code; saveCloud();
    const snap = cloudSnapshot();
    await cloudRpc("cloud_push", { p_secret: CLOUD.secret, p_data: snap });
    CLOUD.pushed = JSON.stringify(snap.keys); CLOUD.last = Date.now(); CLOUD.status = "ok"; saveCloud();
    toast("Appareil lié ! Ta progression est la même partout.", 3000);
    if (typeof SFX !== "undefined") SFX.play("relic");
    return true;
  } catch (e) {
    toast(/code inconnu/.test(e.message) ? "Ce code n'existe pas. Vérifie-le sur ton autre appareil." : "Impossible de joindre le serveur. Réessaie plus tard.", 3000);
    return false;
  } finally { CLOUD.busy = false; if (typeof menuPanel !== "undefined" && menuPanel === "sync") renderSync(); }
}
// Envoi rapide quand on quitte la page (sans attendre la réponse)
function cloudFlush() {
  if (!CLOUD.secret || (typeof ONLINE !== "undefined" && !ONLINE.on) || typeof fetch !== "function") return;
  const snap = cloudSnapshot(), fp = JSON.stringify(snap.keys);
  if (fp === CLOUD.pushed) return;
  try {
    fetch(`${ONLINE.url}/rest/v1/rpc/cloud_push`, { method: "POST", keepalive: true,
      headers: { apikey: ONLINE.key, Authorization: "Bearer " + ONLINE.key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: CLOUD.secret, p_data: snap }) }).catch(() => {});
    CLOUD.pushed = fp; saveCloud();
  } catch (e) {}
}

// ----- Le panneau « Synchroniser » -----
function renderSync() {
  const panel = document.getElementById("syncPanel"); if (!panel) return;
  const ago = CLOUD.last ? Math.max(0, Math.round((Date.now() - CLOUD.last) / 60000)) : null;
  const state = typeof ONLINE !== "undefined" && !ONLINE.on ? "Coupée (Options → Statistiques en ligne)"
    : CLOUD.busy ? "Synchronisation…" : /^erreur/.test(CLOUD.status) ? "Hors ligne pour l'instant : tout reste sauvegardé sur cet appareil"
    : ago == null ? "Pas encore synchronisé" : ago < 1 ? "Synchronisé à l'instant" : `Synchronisé il y a ${ago} min`;
  panel.innerHTML = `
    <div><span class="kicker">Ta progression sur tous tes appareils</span><div class="big small">Synchroniser</div></div>
    <p class="sync-code"><small>Ton code de reprise</small><b>${CLOUD.code || "…"}</b></p>
    <p class="sync-help">Sur ton autre appareil (PC, téléphone…), ouvre ce menu et entre ce code : la partie en cours, l'Héritage,
      le bestiaire, les fins et les records seront les mêmes partout. Garde ce code pour toi.</p>
    <p class="sync-state">${state}</p>
    <div class="sync-link"><input id="syncInput" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="PUITS-XXXXX-XXXXX" aria-label="Code d'un autre appareil" maxlength="24"></div>
    <nav class="menu-list">
      <button class="mi" data-act="syncLink">Lier cet appareil<small>avec le code d'un autre appareil</small></button>
      <button class="mi" data-act="syncCopy">Copier mon code</button>
      <button class="mi" data-act="syncNow">Synchroniser maintenant</button>
      <button class="mi" data-act="back">Retour</button>
    </nav>`;
  const inp = panel.querySelector("#syncInput");
  if (inp) {
    // les touches tapées dans le champ ne doivent pas piloter le jeu ni le menu
    for (const ev of ["keydown", "keyup", "keypress"]) inp.addEventListener(ev, e => { e.stopPropagation(); if (ev === "keydown" && e.key === "Enter") menuAction("syncLink"); });
  }
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  around("showPanel", (o, name, ...a) => { const r = o(name, ...a); if (name === "sync") { renderSync(); cloudSync(); } return r; });
  around("menuAction", (o, act, ...a) => {
    if (act === "sync") { showPanel("sync"); return; }
    if (act === "syncNow") { cloudSync(true); renderSync(); return; }
    if (act === "syncCopy") {
      if (!CLOUD.code) { toast("Pas encore de code : connecte-toi à internet.", 2200); return; }
      try { navigator.clipboard.writeText(CLOUD.code).then(() => toast("Code copié.", 1400), () => toast(CLOUD.code, 4000)); } catch (e) { toast(CLOUD.code, 4000); }
      return;
    }
    if (act === "syncLink") { const inp = document.getElementById("syncInput"); cloudLink(inp ? inp.value : ""); return; }
    return o(act, ...a);
  });
  // une partie effacée (finie, morte, recommencée) : on s'en souvient pour ne pas la ressusciter depuis un autre appareil
  around("clearSave", (o, ...a) => { const r = o(...a); try { localStorage.setItem("lepuits.partie.gone", String(Date.now())); } catch (e) {} return r; });
  // fin de partie et sauvegarde : on synchronise un peu après
  const soon = () => setTimeout(() => cloudSync(), 1500);
  around("saveGame", (o, ...a) => { const r = o(...a); if (r) soon(); return r; });
  around("renderEndPanel", (o, ...a) => { const r = o(...a); soon(); return r; });
  // au démarrage, puis toutes les 20 s si quelque chose a changé (seulement dans un vrai navigateur)
  if (typeof window === "undefined") return;
  setTimeout(() => cloudSync(), 1200);
  setInterval(() => { if (JSON.stringify(cloudSnapshot().keys) !== CLOUD.pushed) cloudSync(); }, CLOUD.every * 1000);
  try {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") cloudFlush(); else cloudSync(); });
    addEventListener("pagehide", cloudFlush);
  } catch (e) {}
})();
