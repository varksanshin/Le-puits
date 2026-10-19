"use strict";
// ---------- 28e. Héritage : la méta-progression entre les runs ----------
/* Chaque run, même perdue, rapporte des Braises selon la profondeur atteinte, les gardiens vaincus et les ennemis tués.
   Au menu principal, « Héritage » permet de les dépenser en améliorations permanentes.
   Rien ne s'obtient pendant une run faite depuis l'atelier de test ou l'éditeur.
   L'héritage peut être coupé dans Options (pour le speedrun ou pour jouer « à l'ancienne »). */

const HERITAGE = [
  { id: "coeur",   name: "Cœur ancestral",     desc: "+1 PV max au départ",                      costs: [30, 60, 100] },
  { id: "bourse",  name: "Bourse héritée",     desc: "+15 pièces au départ",                     costs: [15, 30, 45] },
  { id: "cle",     name: "Clé du gardien",     desc: "+1 clé au départ",                         costs: [20, 40] },
  { id: "flamme",  name: "Flamme tenace",      desc: "La lumière baisse 12 % moins souvent",     costs: [25, 50, 80] },
  { id: "memoire", name: "Mémoire des reliques", desc: "Les gardiens des reliques ont 15 % de PV en moins", costs: [40] },
  { id: "sacoche", name: "Sacoche de l'explorateur", desc: "Tu commences avec un objet passif au hasard", costs: [80] },
];
const META_KEY = "lepuits.heritage";
let meta = { embers: 0, total: 0, lv: {}, off: false, runs: 0 };
try { const m = JSON.parse(localStorage.getItem(META_KEY)); if (m) meta = { ...meta, ...m, lv: { ...(m.lv || {}) } }; } catch (e) {}
const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {} };
const metaLv = id => (meta.off || globalThis.SPEEDRUN || globalThis.DAILY_RUN) ? 0 : (meta.lv[id] || 0);   // coupé aussi en speedrun et sur la graine du jour (tout le monde à égalité)

// Braises gagnées par une run
function embersFor(kind) {
  if (runTainted) return 0;
  const depth = Math.max(0, Math.min(1, maxDepth / Math.max(1, MH)));
  let n = Math.round(depth * 12) + Math.floor(kills / 8) + 3 * (typeof miniBeaten !== "undefined" ? miniBeaten.size : 0);
  if (kind === "win") n += 15;
  return n;
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };

  // ----- Les bonus au départ de chaque run -----
  around("deriveStats", (o, ...a) => { const s = o(...a); s.maxHp += metaLv("coeur"); return s; });
  around("computeStats", (o, ...a) => { const r = o(...a); DARK.tickEvery *= 1 + 0.12 * metaLv("flamme"); return r; });
  around("resetRun", (o, ...a) => {
    const r = o(...a);
    if (typeof loadingSave !== "undefined" && loadingSave) return r;           // une partie reprise garde ce qu'elle avait
    computeStats(); player.hp = stats.maxHp; renderHearts();
    if (metaLv("bourse")) { coins += 15 * metaLv("bourse"); renderPurse(); }
    if (metaLv("cle")) { keyCount += metaLv("cle"); renderPurse(); }
    if (metaLv("sacoche")) {
      const pool = ITEMS.filter(it => it.cat === "passif" && !it.mystery && !it.skill && !items.has(it.id));
      if (pool.length) { items.add(pool[Math.floor(Math.random() * pool.length)].id); computeStats(); renderItems(); }
    }
    return r;
  });
  around("spawnMini", (o, m, ...a) => {
    const r = o(m, ...a);
    if (metaLv("memoire") && m.enemy) { m.enemy.hp *= 0.85; m.enemy.maxHp *= 0.85; }
    return r;
  });

  // ----- Fin de run : on compte les Braises -----
  around("endRun", (o, kind, ...a) => {
    const gained = embersFor(kind);
    const r = o(kind, ...a);
    if (gained > 0) { meta.embers += gained; meta.total += gained; }
    meta.runs++; saveMeta();
    const el = document.getElementById("endStats");
    if (el) el.innerHTML += (`<span class="a">Braises</span><span>${gained > 0 ? `+${gained} · ${meta.embers} à dépenser dans l'Héritage` : "aucune (run de test)"}</span>`);
    return r;
  });

  // ----- Le panneau « Héritage » du menu principal -----
  // (le bouton, le panneau et l'option sont dans index.html)
  const panel = document.getElementById("heritagePanel");
  function renderHeritage() {
    const rows = HERITAGE.map(h => {
      const lv = meta.lv[h.id] || 0, max = h.costs.length, cost = h.costs[lv];
      const pips = "◆".repeat(lv) + "◇".repeat(max - lv);
      const label = lv >= max ? "au maximum" : `${cost} braises${meta.embers < cost ? " · pas assez" : ""}`;
      return `<button class="mi her${lv >= max ? " done" : ""}" data-act="buy:${h.id}"><span class="her-n">${h.name} <span class="her-p">${pips}</span></span><small>${h.desc} · ${label}</small></button>`;
    }).join("");
    panel.innerHTML = `
      <div><span class="kicker">Ce que les anciens te lèguent</span><div class="big small">Héritage</div></div>
      <p class="her-embers"><b>${meta.embers}</b> braises à dépenser <span>· ${meta.total} gagnées en ${meta.runs} run${meta.runs > 1 ? "s" : ""}${meta.off ? " · héritage coupé dans les options" : ""}</span></p>
      <nav class="menu-list">${rows}<button class="mi" data-act="back">Retour</button></nav>`;
  }
  around("showPanel", (o, name, ...a) => { if (name === "heritage") renderHeritage(); return o(name, ...a); });
  around("menuAction", (o, act, ...a) => {
    if (act === "heritage") { showPanel("heritage"); return; }
    if (act === "heritageToggle") { meta.off = !meta.off; saveMeta(); syncOptions(); return; }
    if (act && act.startsWith("buy:")) {
      const h = HERITAGE.find(x => x.id === act.slice(4)); if (!h) return;
      const lv = meta.lv[h.id] || 0;
      if (lv >= h.costs.length) { toast(`${h.name} : déjà au maximum.`, 1600); return; }
      if (meta.embers < h.costs[lv]) { toast(`Il te manque ${h.costs[lv] - meta.embers} braises.`, 1600); return; }
      meta.embers -= h.costs[lv]; meta.lv[h.id] = lv + 1; saveMeta();
      if (typeof SFX !== "undefined") SFX.play("relic");
      toast(`${h.name} : niveau ${lv + 1}.`, 1800);
      const at = act; renderHeritage();
      const b = panel.querySelector(`[data-act="${at}"]`); if (b) b.focus({ preventScroll: true });
      return;
    }
    return o(act, ...a);
  });

  // ----- Option : couper l'héritage -----
  around("syncOptions", (o, ...a) => {
    const r = o(...a), b = document.getElementById("optHer");
    if (b) { b.textContent = meta.off ? "Coupé" : "Actif"; b.setAttribute("aria-pressed", String(!meta.off)); }
    return r;
  });
})();
