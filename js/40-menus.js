"use strict";
// ---------- 40. Menus : tout au clavier, à la souris… et à la manette ----------
/* Ce module rend tous les menus jouables à la manette :
   - la croix et le stick gauche se déplacent « à l'écran » (haut, bas, gauche, droite), dans les listes, les grilles de cartes et les onglets ;
   - la sélection reste toujours visible (le panneau défile tout seul) ; le stick droit fait défiler les longs textes ;
   - LB / RB changent d'onglet (bestiaire, Prélude / Siège libre) ;
   - A sur un champ de texte ouvre un clavier virtuel (pseudo, mot de passe, codes de salon et de synchronisation) ;
   - B fait le même « Retour » que le bouton à l'écran.
   La barre d'aide en bas montre les touches de l'appareil qu'on utilise (clavier, manette ou tactile). */

let menuInput = "keys";                      // "keys", "pad" ou "touch" : le dernier appareil utilisé dans les menus
const MENU_HINTS = {
  keys: "<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> choisir · <kbd>Entrée</kbd> valider · <kbd>Échap</kbd> retour",
  pad: "<kbd class=\"pad\">✚</kbd> choisir · <kbd class=\"pad a\">A</kbd> valider · <kbd class=\"pad b\">B</kbd> retour · <kbd class=\"pad\">LB</kbd><kbd class=\"pad\">RB</kbd> onglets · <kbd class=\"pad\">stick droit</kbd> défiler",
  touch: "Touche une entrée pour la choisir",
  vkb: "<kbd class=\"pad\">✚</kbd> lettre · <kbd class=\"pad a\">A</kbd> écrire · <kbd class=\"pad b\">B</kbd> effacer · <kbd class=\"pad\">Y</kbd> majuscules · <kbd class=\"pad\">Start</kbd> terminer",
};
function setMenuInput(kind) {
  const same = kind === menuInput;
  menuInput = kind;
  if (same && document.body.dataset.input === kind && !vkb && !setMenuInput.dirty) return;
  setMenuInput.dirty = !!vkb;
  document.body.dataset.input = kind;
  const h = document.getElementById("menuHint"); if (h) h.innerHTML = vkb ? MENU_HINTS.vkb : MENU_HINTS[kind] || MENU_HINTS.keys;
}
addEventListener("keydown", () => setMenuInput("keys"), true);
addEventListener("pointerdown", e => setMenuInput(e.pointerType === "touch" ? "touch" : "keys"), true);

// ----- Le déplacement « à l'écran » -----
// depuis l'élément sélectionné, le plus proche dans la direction voulue (ce qui est bien aligné passe avant)
function menuSpatial(dx, dy, list) {
  const el = document.activeElement;
  if (!list.length) return null;
  if (!el || !list.includes(el)) return list[dy < 0 || dx < 0 ? list.length - 1 : 0];
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = 1e9;
  for (const c of list) {
    if (c === el) continue;
    const q = c.getBoundingClientRect(); if (!q.width && !q.height) continue;
    const qx = q.left + q.width / 2, qy = q.top + q.height / 2;
    // l'écart dans la direction voulue (doit être positif) et l'écart de côté (pénalisé)
    const main = dx ? (qx - cx) * dx : (qy - cy) * dy;
    const edge = dx ? (dx > 0 ? q.left - r.right : r.left - q.right) : (dy > 0 ? q.top - r.bottom : r.top - q.bottom);
    if (main <= 2 || edge < -Math.min(r.width, r.height) * 0.6) continue;
    const side = dx ? Math.max(0, Math.abs(qy - cy) - (r.height + q.height) / 2) : Math.max(0, Math.abs(qx - cx) - (r.width + q.width) / 2);
    const score = Math.max(0, edge) + side * 3 + Math.abs(dx ? qy - cy : qx - cx) * 0.25;
    if (score < bs) { bs = score; best = c; }
  }
  return best;
}
function menuScrollBox() {
  // ce qui défile dans le panneau ouvert : le panneau lui-même, ou une grille (bestiaire, inventaire…)
  const panel = vkb ? null : menuEl.querySelector(`[data-panel="${menuPanel}"]`);
  if (!panel) return null;
  const inner = [...panel.querySelectorAll(".best-grid, .inv, .ctl, .binds, .heritage-list, .pr-story")].find(x => x.scrollHeight > x.clientHeight + 4);
  return inner || (panel.scrollHeight > panel.clientHeight + 4 ? panel : null);
}
function menuReveal(el) {
  if (!el || !el.scrollIntoView) return;
  try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {}
}

// ----- Le clavier virtuel (manette) -----
let vkb = null;    // { input, el, caps }
const VKB_ROWS = [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"], ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["W", "X", "C", "V", "B", "N", "-", "_", "é", "è"], ["⇧", "ESPACE", "⌫", "OK"]];
function vkbOpen(input) {
  vkbClose(false);
  const el = document.createElement("div");
  el.className = "vkb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Clavier");
  const label = input.getAttribute("aria-label") || input.placeholder || "Texte";
  el.innerHTML = `<div class="vkb-top"><span class="vkb-label">${label}</span><span class="vkb-field"></span></div>` +
    VKB_ROWS.map(r => `<div class="vkb-row">${r.map(k => `<button type="button" class="vkb-k${k.length > 1 ? " wide" : ""}" data-k="${k}">${k === "ESPACE" ? "espace" : k}</button>`).join("")}</div>`).join("");
  menuEl.appendChild(el);
  vkb = { input, el, caps: true };
  el.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) vkbKey(b.dataset.k); });
  vkbRender();
  const first = el.querySelector('[data-k="A"]'); if (first) first.focus({ preventScroll: true });
  setMenuInput(menuInput);
}
function vkbRender() {
  if (!vkb) return;
  const v = vkb.input.value, pw = vkb.input.type === "password";
  vkb.el.querySelector(".vkb-field").textContent = (pw ? "•".repeat(v.length) : v) + "▏";
  for (const b of vkb.el.querySelectorAll("[data-k]")) { const k = b.dataset.k; if (k.length === 1 && /[a-zéè]/i.test(k)) b.textContent = vkb.caps ? k.toUpperCase() : k.toLowerCase(); }
  vkb.el.querySelector('[data-k="⇧"]').classList.toggle("on", vkb.caps);
}
function vkbKey(k) {
  if (!vkb) return;
  const inp = vkb.input, max = +inp.maxLength > 0 ? +inp.maxLength : 64;
  if (k === "OK") { vkbClose(true); return; }
  if (k === "⇧") vkb.caps = !vkb.caps;
  else if (k === "⌫") inp.value = inp.value.slice(0, -1);
  else if (inp.value.length < max) inp.value += k === "ESPACE" ? " " : vkb.caps ? k.toUpperCase() : k.toLowerCase();
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  if (typeof SFX !== "undefined") try { SFX.play("coin"); } catch (e) {}
  vkbRender();
}
function vkbClose(next) {
  if (!vkb) return;
  const inp = vkb.input; vkb.el.remove(); vkb = null;
  setMenuInput(menuInput);
  inp.focus({ preventScroll: true });
  if (next) moveFocus(1, true);     // champ suivant (mot de passe…) ou bouton de validation
}

// ----- La manette dans les menus (appelé par pollMenuPad, js/15-menus.js) -----
let menuScrollT = 0;
function menuPadHook(gp, st, edge) {
  if (Object.keys(st).some(k => edge(k)) || Math.abs(gp.axes[3] || 0) > 0.4) setMenuInput("pad");
  // le stick droit fait défiler (bestiaire, commandes, héritage, histoire…)
  const ry = gp.axes[3] || 0;
  if (Math.abs(ry) > 0.25) { const box = menuScrollBox(); if (box) box.scrollTop += ry * 9; }
  if (vkb) {
    // le clavier virtuel garde la main : croix, A, B (effacer), Y (majuscules), Start (terminer)
    const keys = [...vkb.el.querySelectorAll("[data-k]")];
    const go = (dx, dy) => { const n = menuSpatial(dx, dy, keys); if (n) n.focus({ preventScroll: true }); };
    if (edge("up")) go(0, -1); if (edge("down")) go(0, 1); if (edge("left")) go(-1, 0); if (edge("right")) go(1, 0);
    if (edge("a")) { const f = document.activeElement; if (f && f.dataset && f.dataset.k) vkbKey(f.dataset.k); else keys[0].focus(); }
    if (edge("back")) vkbKey("⌫");
    if (edge("y")) vkbKey("⇧");
    if (edge("start")) vkbKey("OK");
    return true;
  }
  // LB / RB : onglet précédent / suivant
  if (edge("lb") || edge("rb")) {
    const panel = menuEl.querySelector(`[data-panel="${menuPanel}"]`);
    const tabs = panel ? [...panel.querySelectorAll(".best-tabs .mi, .sg-modes .mi, #optPresets .mi")] : [];
    if (tabs.length) {
      const i = Math.max(0, tabs.findIndex(t => t.classList.contains("on") || t.getAttribute("aria-pressed") === "true"));
      const t = tabs[(i + (edge("rb") ? 1 : -1) + tabs.length) % tabs.length]; t.click();
      const again = menuEl.querySelector(`[data-panel="${menuPanel}"] [data-act="${t.dataset.act}"]`); if (again) { again.focus({ preventScroll: true }); menuReveal(again); }
    }
    return true;
  }
  // A sur un champ de texte : le clavier virtuel
  if (edge("a") && document.activeElement && document.activeElement.tagName === "INPUT" && menuEl.contains(document.activeElement)) { vkbOpen(document.activeElement); return true; }
  return false;
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  // déplacement : « à l'écran » partout (sauf le tableau des touches, qui a déjà son propre déplacement en colonnes)
  around("moveFocus", (o, d, vertical, ...a) => {
    if (menuPanel === "keys") { const r = o(d, vertical, ...a); menuReveal(document.activeElement); return r; }
    const list = menuButtons();
    const next = menuSpatial(vertical ? 0 : d, vertical ? d : 0, list);
    if (next) { next.focus({ preventScroll: true }); menuReveal(next); return; }
    // plus rien dans cette direction : on fait défiler ce qui dépasse, sinon on boucle (haut ↔ bas)
    const box = menuScrollBox();
    if (vertical && box && (d > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 2 : box.scrollTop > 2)) { box.scrollTop += d * 60; return; }
    if (vertical && list.length) { const t = list[d > 0 ? 0 : list.length - 1]; t.focus({ preventScroll: true }); menuReveal(t); }
  });
  // un panneau qui s'ouvre : on remonte en haut, et le premier choix est bien visible
  around("showPanel", (o, name, ...a) => {
    if (vkb) vkbClose(false);
    const r = o(name, ...a);
    const panel = menuEl.querySelector(`[data-panel="${name}"]`); if (panel) panel.scrollTop = 0;
    return r;
  });
  // les fiches du bestiaire se sélectionnent (pour les parcourir à la manette)
  around("renderBestiary", (o, ...a) => {
    const r = o(...a);
    for (const c of menuEl.querySelectorAll("#bestGrid .best")) c.setAttribute("tabindex", "0");
    return r;
  });
  // Échap ferme le clavier virtuel
  addEventListener("keydown", e => { if (vkb && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); vkbClose(false); } }, true);
  menuInput = ""; setMenuInput("keys");
})();
