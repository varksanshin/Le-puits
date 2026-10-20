"use strict";
// ---------- 32. En ligne : les statistiques des parties (Supabase) ----------
/* À la fin de chaque partie (victoire, mort), un petit résumé est envoyé à la base Supabase du projet « le-puits » :
   mode, profondeur, temps, objets, champions, compagnons, cause de la mort… Rien de personnel :
   chaque navigateur reçoit un identifiant anonyme tiré au hasard.
   Ça sert aux tests d'équilibrage : taux de victoire par profondeur, objets moyens, monstres qui tuent le plus
   (vues « balance_summary » et « death_causes » dans Supabase).
   On peut couper l'envoi dans Options. Sans connexion, le jeu marche exactement pareil. */
const ONLINE = {
  url: "https://zpdrjahecvrghfyiquja.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZHJqYWhlY3ZyZ2hmeWlxdWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxOTcwNzMsImV4cCI6MjEwNzc3MzA3M30.ezziE4gmrc1-i54ydHdb1zGmH_8KWMrdlBUBNvfA5Rk",
  version: "0.25",
  on: true, sent: 0, failed: 0, last: null,
};
try { ONLINE.on = localStorage.getItem("lepuits.online") !== "off"; } catch (e) {}
const onlinePlayer = (() => {
  let id = null;
  try { id = localStorage.getItem("lepuits.joueur"); } catch (e) {}
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
    try { localStorage.setItem("lepuits.joueur", id); } catch (e) {}
  }
  return id;
})();

function sendRun(row) {
  ONLINE.last = row;
  if (!ONLINE.on || typeof fetch !== "function") return Promise.resolve(false);
  return fetch(ONLINE.url + "/rest/v1/runs", {
    method: "POST",
    headers: { apikey: ONLINE.key, Authorization: "Bearer " + ONLINE.key, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row), keepalive: true,
  }).then(r => { if (r.ok) ONLINE.sent++; else ONLINE.failed++; return r.ok; })
    .catch(() => { ONLINE.failed++; return false; });
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  let lastHit = null, champKills = 0, sentThisRun = false;
  around("hurtPlayer", (o, src, dmg, ...a) => {
    const hp = player && player.hp, r = o(src, dmg, ...a);
    if (player && player.hp < hp) lastHit = src && src.type ? (src.mini ? "gardien:" + (src.mini.base || src.type) : src.boss ? "gardien-final" : src.type) : src && src.kind ? "tir:" + src.kind : "piège";
    return r;
  });
  around("onEnemyKilled", (o, e, ...a) => { if (e.champion) champKills++; return o(e, ...a); });
  around("resetRun", (o, ...a) => {
    const entering = typeof dimEntering !== "undefined" && dimEntering;
    const r = o(...a);
    if (!entering && !(typeof loadingSave !== "undefined" && loadingSave)) { lastHit = null; champKills = 0; sentThisRun = false; }
    return r;
  });
  // l'écran de fin : la vraie fin de la partie (une victoire qui ouvre une dimension n'en est pas une)
  around("renderEndPanel", (o, kind, key, ...a) => {
    const r = o(kind, key, ...a);
    if (runOver && !sentThisRun && !(typeof runTainted !== "undefined" && runTainted)) {
      sentThisRun = true;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const presetName = Object.keys(PRESETS).find(n => Object.keys(PRESETS[n]).every(k => PRESETS[n][k] === tuning[k])) || "perso";
      sendRun({
        player: onlinePlayer, version: ONLINE.version, mode: gameMode === "chaos" ? "chaos" : "story",
        seed: gameMode === "chaos" ? chaosSeed : (typeof runSeed !== "undefined" ? runSeed : null),
        result: kind === "win" ? "win" : "death", ending: kind === "win" ? String(key || "normal").slice(0, 20) : null,
        run_time: clamp(+runClock || 0, 0, 359999), depth: clamp(maxDepth / Math.max(1, MH), 0, 1),
        tier: typeof DIM !== "undefined" && DIM ? 5 : clamp(typeof depthTier === "function" && player ? depthTier(player.y) : 0, 0, 4),
        kills: clamp(kills | 0, 0, 100000), items: Math.min(200, items.size), item_list: [...items].slice(0, 200),
        relics: SKILLS.filter(s => skills[s.id]).length, champions: champKills,
        companions: typeof companions !== "undefined" ? companions.length : 0, stole: typeof merchantGone !== "undefined" && merchantGone,
        dark: clamp(Math.round(dark), 0, 100), hp_max: clamp(stats.maxHp, 0, 50),
        damage_mult: clamp(Math.round(dmgOf(1) * 100) / 100, 0, 20),
        death_by: kind === "win" ? null : (lastHit || "inconnu").slice(0, 24), preset: presetName.slice(0, 16),
        speedrun: !!globalThis.SPEEDRUN,
      });
    }
    return r;
  });
  // Option : couper l'envoi
  around("menuAction", (o, act, ...a) => {
    if (act === "online") { ONLINE.on = !ONLINE.on; try { localStorage.setItem("lepuits.online", ONLINE.on ? "on" : "off"); } catch (e) {} syncOptions(); return; }
    return o(act, ...a);
  });
  around("syncOptions", (o, ...a) => {
    const r = o(...a), b = document.getElementById("optOnline");
    if (b) { b.textContent = ONLINE.on ? "Activé" : "Coupé"; b.setAttribute("aria-pressed", String(ONLINE.on)); }
    return r;
  });
})();
