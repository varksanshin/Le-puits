"use strict";
// ---------- 28g. Mode speedrun ----------
/* Activé dans Options. Pendant la run, sous le chrono :
   - chaque temps intermédiaire (relique, porte du Gardien) est comparé à ton record : en vert si tu es en avance, en rouge sinon,
     en doré si c'est ton meilleur segment jamais fait ;
   - à la fin, un nouveau record remplace l'ancien.
   Les records sont rangés par catégorie : le mode histoire (toujours la même map) et chaque graine du mode chaos.
   « Chaos · graine du jour » donne la même map à tout le monde, le même jour : pratique pour comparer ses temps.
   En mode speedrun, l'héritage est coupé (tout le monde part à égalité). R ou Select recommence instantanément. */

const SR_KEY = "lepuits.speedrun", PB_KEY = "lepuits.pb";
globalThis.SPEEDRUN = false;
try { SPEEDRUN = localStorage.getItem(SR_KEY) === "on"; } catch (e) {}
let pbs = {};
try { pbs = JSON.parse(localStorage.getItem(PB_KEY)) || {}; } catch (e) {}
const savePbs = () => { try { localStorage.setItem(PB_KEY, JSON.stringify(pbs)); } catch (e) {} };
const srCategory = () => gameMode === "chaos" ? `chaos-${chaosSeed}` : "histoire";
let srLive = [];                                    // les temps intermédiaires de la run en cours, avec leur écart

// La graine du jour : la même pour tout le monde, le même jour
function dailySeed(d = new Date()) {
  const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1e9;
}
function startChaosSeed(seed) {
  if (gameMode === "story") storyLevel = level;
  const lv = buildChaosLevel(seed);
  if (!lv) { toast("Le puits refuse de se former… réessaie.", 2400); return false; }
  gameMode = "chaos"; level = lv; chaosSeed = lv.seed;
  resetRun(); closeMenu();
  toast(`Graine du jour · ${chaosSeed}${SPEEDRUN ? " · mode speedrun" : ""}`, 3200);
  return true;
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  const hud = document.getElementById("srHud");
  const sign = d => (d < 0 ? "−" : "+") + Math.abs(d).toFixed(2);
  function renderSr() {
    if (!hud) return;
    hud.hidden = !SPEEDRUN || screen === "title";
    if (hud.hidden) return;
    const pb = pbs[srCategory()];
    const rows = srLive.slice(-3).map(s => `<span class="sr-row ${s.gold ? "gold" : s.delta == null ? "" : s.delta < 0 ? "ahead" : "behind"}"><i>${s.label}</i><b>${s.delta == null ? fmtTime(s.t) : sign(s.delta)}</b></span>`).join("");
    hud.innerHTML = `<span class="sr-pb">${pb ? "Record " + fmtTime(pb.total) : "Pas encore de record"}</span>${rows}`;
  }

  around("resetRun", (o, ...a) => { const r = o(...a); srLive = []; renderSr(); return r; });
  // Chaque temps intermédiaire : écart avec le record, et meilleur segment
  around("recordSplit", (o, label, ...a) => {
    const r = o(label, ...a);
    if (!SPEEDRUN || runTainted) return r;
    const i = splits.length - 1, t = splits[i].t, prev = i > 0 ? splits[i - 1].t : 0, seg = t - prev;
    const cat = srCategory(), pb = pbs[cat] || (pbs[cat] = { total: null, splits: [], golds: [] });
    const ref = pb.splits[i] && pb.splits[i].label === label ? pb.splits[i].t : null;
    const old = pb.golds[i], beat = old == null || seg < old;
    if (beat) { pb.golds[i] = seg; savePbs(); }
    srLive.push({ label, t, delta: ref == null ? null : t - ref, gold: old != null && seg < old });
    renderSr();
    return r;
  });
  // Fin de run : nouveau record ?
  around("endRun", (o, kind, ...a) => {
    const r = o(kind, ...a);
    if (!SPEEDRUN) return r;
    const el = document.getElementById("endStats"), cat = srCategory();
    let line = "";
    if (runTainted) line = "non comptée (atelier de test)";
    else if (kind === "win") {
      const pb = pbs[cat] || (pbs[cat] = { total: null, splits: [], golds: [] });
      if (pb.total == null || runClock < pb.total) {
        line = pb.total == null ? "premier record !" : `nouveau record ! (${sign(runClock - pb.total)})`;
        pb.total = runClock; pb.splits = splits.map(s => ({ label: s.label, t: s.t })); savePbs();
      } else line = `${sign(runClock - pb.total)} par rapport au record (${fmtTime(pb.total)})`;
      const sob = pb.golds.length ? pb.golds.reduce((s, x) => s + x, 0) : null;
      if (sob != null && splits.length === pb.golds.length) line += ` · somme des meilleurs segments ${fmtTime(sob)}`;
    } else line = "run perdue";
    if (el) el.innerHTML += `<span class="a">Speedrun</span><span>${cat === "histoire" ? "histoire" : "chaos · graine " + chaosSeed} · ${line}</span>`;
    return r;
  });
  // (l'héritage est coupé en speedrun : voir metaLv dans 28e-heritage.js)

  // Menus : graine du jour, option speedrun
  around("menuAction", (o, act, ...a) => {
    if (act === "daily") { const go = () => startChaosSeed(dailySeed()); if (screen === "title") startIntro(go); else go(); return; }
    if (act === "speedrun") {
      SPEEDRUN = !SPEEDRUN;
      try { localStorage.setItem(SR_KEY, SPEEDRUN ? "on" : "off"); } catch (e) {}
      if (SPEEDRUN) { clockOn = true; try { localStorage.setItem("lepuits.clock", "on"); } catch (e) {} clockShown = null; renderClock(); }
      syncOptions(); renderSr(); return;
    }
    return o(act, ...a);
  });
  around("syncOptions", (o, ...a) => {
    const r = o(...a), b = document.getElementById("optSr");
    if (b) { b.textContent = SPEEDRUN ? "Activé" : "Désactivé"; b.setAttribute("aria-pressed", String(SPEEDRUN)); }
    return r;
  });
  around("closeMenu", (o, ...a) => { const r = o(...a); renderSr(); return r; });
  around("openTitle", (o, ...a) => { const r = o(...a); renderSr(); return r; });
})();
