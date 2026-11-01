"use strict";
// ---------- 42. La bande-son : écouter tous les thèmes depuis le menu (0.29) ----------
const OST = [
  ["Aventure", [
    ["title", "Crépuscule sur le puits", "écran titre"],
    ["entree", "Les ruines de Puits-Clair", "l'Entrée"],
    ["mines", "La prison du Roi", "les Mines"],
    ["noyee", "Brume-sous-Terre", "la Zone noyée"],
    ["spores", "Le jardin de la Mère-Spore", "les Profondeurs"],
    ["antre", "Là où le puits a faim", "l'Antre"],
    ["miniboss", "Les gardiens des reliques", "gardiens de zone"],
    ["boss", "Le Gardien du Puits", "boss final"],
    ["ciel", "Au-delà de toute lumière", "le Royaume céleste"],
    ["enfer", "Le trône des abysses", "le Royaume infernal"]]],
  ["Mode horde", [
    ["h_chateau", "La cour du château", "Prélude, chapitre 1"],
    ["h_village", "Valcendre", "Prélude, chapitre 2 · Siège libre"],
    ["h_foret", "La forêt de Brumesombre", "Prélude, chapitre 3"],
    ["h_puits", "Le vieux Puits", "Prélude, chapitre 4"],
    ["h_boss", "Les seigneurs de la horde", "boss de la horde"]]]
];
const ostName = id => { for (const [, l] of OST) for (const t of l) if (t[0] === id) return t; return null; };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let ostTimer = 0;
function renderOst() {
  const list = document.getElementById("ostList"); if (!list) return;
  const on = MUSIC.playing && MUSIC.playing();
  list.innerHTML = OST.map(([g, l]) => `<p class="menu-sec">${g}</p><nav class="menu-list tiles ost-list">` + l.map(([id, name, where]) =>
    `<button class="mi tile${on === id ? " on" : ""}" data-act="ost:${id}"><i class="ico">${on === id ? "■" : "▶"}</i>${name}<small>${where} · ${mmss(MUSIC._length(id))}</small></button>`).join("") + `</nav>`).join("");
  ostNowTick();
}
function ostNowTick() {
  const el = document.getElementById("ostNow"); if (!el) return;
  const id = MUSIC.playing && MUSIC.playing(), t = id && ostName(id), p = id && MUSIC.pos();
  if (!t) { el.innerHTML = `<span class="ost-hint">Choisis un thème pour l'écouter en entier.${MUSIC.isOn() ? "" : " (La musique du jeu est coupée dans Options, mais la bande-son joue quand même.)"}</span>`; return; }
  const k = p && MUSIC.track() === id ? Math.min(1, p.t / p.len) : 0;
  el.innerHTML = `<b>♫ ${t[1]}</b><small>${t[2]}</small><div class="ost-bar"><i style="width:${(k * 100).toFixed(1)}%"></i></div><small class="ost-time">${p && MUSIC.track() === id ? mmss(p.t) : "0:00"} / ${mmss(MUSIC._length(id))}</small>`;
}
(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  around("showPanel", (o, name, ...a) => {
    if (name !== "soundtrack" && menuPanel === "soundtrack") { MUSIC.stop(); clearInterval(ostTimer); ostTimer = 0; }
    const r = o(name, ...a);
    if (name === "soundtrack") { renderOst(); if (!ostTimer) ostTimer = setInterval(() => { if (menuPanel === "soundtrack" && !menuEl.hidden) ostNowTick(); }, 250); }
    return r;
  });
  around("menuAction", (o, act, ...a) => {
    if (act === "soundtrack") { showPanel("soundtrack"); return; }
    if (act && act.startsWith("ost:")) {
      const id = act.slice(4), focusId = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.act;
      if (MUSIC.playing() === id) MUSIC.stop(); else MUSIC.play(id);
      renderOst();
      const b = focusId && menuEl.querySelector(`[data-panel="soundtrack"] [data-act="${focusId}"]`); if (b) b.focus({ preventScroll: true });
      return;
    }
    return o(act, ...a);
  });
})();
