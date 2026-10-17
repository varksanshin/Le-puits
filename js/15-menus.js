"use strict";
// ---------- 14. Menus ----------
// screen : "title" (menu de démarrage), "play" (en jeu) ou "pause"
let screen = "title", menuPanel = "main", menuRoot = "main";
const menuEl = $("menu");
const menuButtons = () => [...menuEl.querySelectorAll(`[data-panel="${menuPanel}"] button:not(:disabled)`)];
let menuPad = {};
function showPanel(name) {
  cancelCapture();
  if (name === "keys") { renderBinds(); $("bindMsg").textContent = "Choisis une case, puis appuie sur la nouvelle touche."; }
  if (name === "controls") renderControls();
  if (name === "bestiary") renderBestiary();
  if (name === "inventory") renderInventory();
  if (name === "map") renderMap();
  if (name === "main") refreshContinue();
  for (const p of menuEl.querySelectorAll("[data-panel]")) p.hidden = p.dataset.panel !== name;
  menuPanel = name; menuEl.hidden = false;
  menuEl.classList.toggle("pause", screen === "pause");
  menuEl.classList.toggle("wide", name === "keys" || name === "end" || name === "bestiary" || name === "inventory" || name === "map");
  menuPad = { up: true, down: true, left: true, right: true, a: true, back: true, start: true };   // il faut relâcher avant de réagir
  const b = menuButtons()[0]; if (b) b.focus({ preventScroll: true });
}
const goBack = () => showPanel(menuPanel === "keys" ? "options" : menuRoot);
// Déplace la sélection. Dans le tableau des touches, haut et bas restent dans la même colonne.
function moveFocus(d, vertical) {
  const list = menuButtons(); if (!list.length) return;
  const el = document.activeElement;
  if (vertical && menuPanel === "keys" && el && el.dataset && el.dataset.bind) {
    const slots = list.filter(b => b.dataset.bind);
    for (let r = ACTIONS.findIndex(a => a.id === el.dataset.bind) + d; r >= 0 && r < ACTIONS.length; r += d) {
      const row = slots.filter(b => b.dataset.bind === ACTIONS[r].id);
      const cand = row.find(b => b.dataset.slot === el.dataset.slot) || row[row.length - 1];
      if (cand) { cand.focus({ preventScroll: true }); return; }
    }
    if (d > 0) { const after = list.find(b => !b.dataset.bind); if (after) { after.focus({ preventScroll: true }); return; } }
  }
  const i = list.indexOf(el);
  list[i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length].focus({ preventScroll: true });
}

// ----- Écran des touches -----
function renderBinds() {
  const g = $("bindGrid"); if (!g) return;
  g.innerHTML = `<span class="h">Action</span><span class="h">Touche 1</span><span class="h">Touche 2</span><span class="h">Manette</span>` +
    ACTIONS.map(a => `<span class="a">${a.name}</span>` +
      [0, 1].map(i => `<button class="slot${binds[a.id][i] ? "" : " empty"}" data-bind="${a.id}" data-slot="${i}" aria-label="${a.name}, touche ${i + 1} : ${keyLabel(binds[a.id][i])}">${keyLabel(binds[a.id][i])}</button>`).join("") +
      (a.pad ? `<button class="slot" data-bind="${a.id}" data-slot="pad" aria-label="${a.name}, manette : ${padLabel(padBinds[a.id])}">${padLabel(padBinds[a.id])}</button>`
             : `<span class="fixed">${a.id === "down" ? "Stick, bas" : a.id === "up" ? "Stick, haut" : "Stick, croix"}</span>`)).join("");
}
function startCapture(action, slot, el) {
  cancelCapture();
  capture = { action, slot, init: false, prev: [] };
  el.classList.add("wait"); el.textContent = slot === "pad" ? "Bouton…" : "Touche…";
  $("bindMsg").textContent = slot === "pad"
    ? "Appuie sur un bouton de la manette. Start ou Échap pour annuler."
    : "Appuie sur la nouvelle touche. Retour arrière l'efface, Échap annule.";
}
function focusSlot(action, slot) {
  const b = $("bindGrid").querySelector(`[data-bind="${action}"][data-slot="${slot}"]`);
  if (b) b.focus({ preventScroll: true });
}
function cancelCapture() {
  if (!capture) return;
  const c = capture; capture = null;
  renderBinds(); focusSlot(c.action, c.slot);
  $("bindMsg").textContent = "Changement annulé.";
}
function finishCapture(msg) {
  const c = capture; capture = null;
  ignoreSlotClickUntil = performance.now() + 350;          // la touche validée ne relance pas une attente
  saveBinds(); keys.clear();
  renderBinds(); renderControls(); focusSlot(c.action, c.slot);
  $("bindMsg").textContent = msg;
}
function assignPad(i) {
  const action = capture.action, old = padBinds[action];
  let msg = `${ACTIONS.find(a => a.id === action).name} : ${padLabel(i)}.`;
  for (const a of ACTIONS) if (a.pad && a.id !== action && padBinds[a.id] === i) {
    padBinds[a.id] = old; msg = `${padLabel(i)} servait à ${a.name} : les deux actions ont échangé leurs boutons.`;
  }
  padBinds[action] = i;
  finishCapture(msg);
}
function renderControls() {
  const move = [0, 1].map(i => [binds.left[i], binds.right[i]].filter(Boolean).map(keyLabel).join(" ")).filter(Boolean).join(" ou ") || "aucune touche";
  const rows = [
    ["Bouger", move, "Stick gauche, croix"],
    ["Sauter", keysFor("jump"), padLabel(padBinds.jump)],
    ["Frapper", keysFor("attack"), padLabel(padBinds.attack)],
    ["Frappe chargée", "Maintenir Frapper, relâcher", `Maintenir ${padLabel(padBinds.attack)}`],
    ["Plongeon (onde de choc à l'impact)", `${keysFor("down")} + Frapper en l'air`, `Bas + ${padLabel(padBinds.attack)}`],
    ["Dash", keysFor("dash"), padLabel(padBinds.dash)],
    ["Projectile", keysFor("bolt"), padLabel(padBinds.bolt)],
    ["Grappin", keysFor("grapple"), padLabel(padBinds.grapple)],
    ["Phase", keysFor("phase"), padLabel(padBinds.phase)],
    ["Traverser une planche", `${keysFor("down")} + Sauter`, `Bas + ${padLabel(padBinds.jump)}`],
    ["Recommencer la run", keysFor("reset"), padLabel(padBinds.reset)],
    ["Pause", "Échap", "Start"],
  ];
  const mc = $("menuControls");
  if (mc) mc.innerHTML = `<span class="h">Action</span><span class="h">Clavier</span><span class="h">Manette</span>` +
    rows.filter(r => r[0] !== "Frappe plongeante" && r[0] !== "Traverser une planche").map(r => `<span class="a">${r[0]}</span><span>${r[1]}</span><span>${r[2]}</span>`).join("");
  const pc = $("pageControls");
  if (pc) pc.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("");
}
function openTitle() { screen = "title"; menuRoot = "main"; $("hud").hidden = true; showPanel("main"); }
function openPause() {
  if (mode !== "play" || screen !== "play" || !player || player.dead) return;
  screen = "pause"; menuRoot = "pause"; keys.clear(); showPanel("pause");
}
function closeMenu() {
  menuEl.hidden = true; screen = "play"; $("hud").hidden = false; keys.clear();
  // un bouton encore enfoncé ne doit pas déclencher d'action en jeu
  Object.assign(prev, { jump: true, attack: true, dash: true, bolt: true, grapple: true, phase: true, pause: true });
  Object.assign(input, { jumpPressed: false, attackPressed: false, dashPressed: false, boltPressed: false, grapplePressed: false, phasePressed: false });
  cv.focus({ preventScroll: true });
}
function menuAction(act) {
  if (act === "story") {
    const go = () => { backToStory(); resetRun(); closeMenu(); };
    if (screen === "title") startIntro(go); else go();
  }
  else if (act === "restart") { resetRun(); closeMenu(); }
  else if (act === "chaos") { if (screen === "title") startIntro(startChaos); else startChaos(); }
  else if (act === "resume") closeMenu();
  else if (act === "controls") showPanel("controls");
  else if (act === "bestiary") showPanel("bestiary");
  else if (act === "inventory") showPanel("inventory");
  else if (act === "map") showPanel("map");
  else if (act === "escape") escapeToFire();
  else if (act === "minimap") { miniMapOn = !miniMapOn; try { localStorage.setItem("lepuits.minimap", miniMapOn ? "on" : "off"); } catch (e) {} renderMiniMap(true); syncOptions(); }
  else if (act === "sfx") { SFX.toggle(); syncOptions(); }
  else if (act === "music") { MUSIC.toggleMute(); syncOptions(); }
  else if (act === "savequit") { if (saveGame()) openTitle(); }
  else if (act === "continue") { if (!loadGame()) { refreshContinue(); toast("Pas de partie à reprendre.", 2000); } }
  else if (act === "options") { syncOptions(); showPanel("options"); }
  else if (act === "back") goBack();
  else if (act === "keys") showPanel("keys");
  else if (act === "again") { if (gameMode === "chaos") startChaos(); else { resetRun(); closeMenu(); } }
  else if (act === "clock") {
    clockOn = !clockOn; try { localStorage.setItem("lepuits.clock", clockOn ? "on" : "off"); } catch (e) {}
    clockShown = null; renderClock(); syncOptions();
  }
  else if (act === "resetBinds") {
    binds = clone(DEFAULT_KEYS); padBinds = { ...DEFAULT_PAD }; saveBinds();
    renderBinds(); renderControls();
    $("bindMsg").textContent = "Touches par défaut rétablies.";
  }
  else if (act === "title") openTitle();
  else if (act === "editor") { menuEl.hidden = true; backToStory(); setMode("edit"); }
  else if (act === "fullscreen") { toggleFull(); setTimeout(syncOptions, 150); }
  else if (act === "shake") {
    shakeOn = !shakeOn; try { localStorage.setItem("lepuits.shake", shakeOn ? "on" : "off"); } catch (e) {}
    syncOptions();
  } else if (act.startsWith("preset:")) {
    tuning = { ...PRESETS[act.slice(7)] }; syncSliders(); applyTuning(); syncOptions();
  }
}
function syncOptions() {
  const box = $("optPresets");
  if (!box.children.length) box.innerHTML = Object.keys(PRESETS).map(n => `<button class="mi" data-act="preset:${n}">${n}</button>`).join("");
  for (const b of box.children) b.classList.toggle("on", Object.keys(PRESETS[b.dataset.act.slice(7)]).every(k => PRESETS[b.dataset.act.slice(7)][k] === tuning[k]));
  $("optShake").textContent = shakeOn ? "Activés" : "Désactivés";
  $("optFull").textContent = isFull() ? "Activé" : "Désactivé"; $("optFull").setAttribute("aria-pressed", String(isFull()));
  $("optClock").textContent = clockOn ? "Affiché" : "Masqué";
  $("optClock").setAttribute("aria-pressed", String(clockOn));
  $("optShake").setAttribute("aria-pressed", String(shakeOn));
  $("optMini").textContent = miniMapOn ? "Affichée" : "Masquée"; $("optMini").setAttribute("aria-pressed", String(miniMapOn));
  if (typeof SFX !== "undefined") { $("optSfx").textContent = SFX.isOn() ? "Activés" : "Coupés"; $("optSfx").setAttribute("aria-pressed", String(SFX.isOn())); }
  if (typeof MUSIC !== "undefined") { $("optMusic").textContent = MUSIC.isOn() ? "Activée" : "Coupée"; $("optMusic").setAttribute("aria-pressed", String(MUSIC.isOn())); }
}
menuEl.addEventListener("click", e => {
  const s = e.target.closest("[data-bind]");
  if (s) {
    if (performance.now() < ignoreSlotClickUntil) return;
    startCapture(s.dataset.bind, s.dataset.slot === "pad" ? "pad" : +s.dataset.slot, s);
    return;
  }
  const b = e.target.closest("button[data-act]"); if (b && !b.disabled) menuAction(b.dataset.act);
});
menuEl.addEventListener("keydown", e => {
  if (capture) return;
  if (["ArrowUp", "KeyW"].includes(e.code)) { e.preventDefault(); moveFocus(-1, true); }
  if (["ArrowDown", "KeyS"].includes(e.code)) { e.preventDefault(); moveFocus(1, true); }
  if (["ArrowLeft", "KeyA"].includes(e.code)) { e.preventDefault(); moveFocus(-1); }
  if (["ArrowRight", "KeyD"].includes(e.code)) { e.preventDefault(); moveFocus(1); }
});
// Manette dans les menus
function pollMenuPad() {
  const gp = findGamepad();
  if (!gp) return;
  if (screen === "intro") { if (gp.buttons.some(x => x && x.pressed)) skipIntro(); return; }
  const b = i => gp.buttons[i] && gp.buttons[i].pressed, ay = gp.axes[1] || 0, ax = gp.axes[0] || 0;
  // Attente d'un bouton de manette pour une action
  if (capture && capture.slot === "pad") {
    const pressed = gp.buttons.map(x => !!(x && x.pressed));
    if (!capture.init) { capture.prev = pressed; capture.init = true; return; }
    for (let i = 0; i < pressed.length; i++) if (pressed[i] && !capture.prev[i]) {
      menuPad = { up: true, down: true, left: true, right: true, a: true, back: true, start: true };
      if (i === 9) cancelCapture(); else assignPad(i);
      return;
    }
    capture.prev = pressed; return;
  }
  if (capture) return;
  const st = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, a: b(0), back: b(1), start: b(9) };
  const edge = k => st[k] && !menuPad[k];
  if (edge("up")) moveFocus(-1, true);
  if (edge("down")) moveFocus(1, true);
  if (edge("left")) moveFocus(-1);
  if (edge("right")) moveFocus(1);
  if (edge("a")) {
    // pas encore de bouton choisi (souris ou tactile avant) : A choisit le premier, puis valide
    if (menuEl.contains(document.activeElement) && document.activeElement.matches("button, [data-act]")) document.activeElement.click();
    else moveFocus(1, true);
  }
  else if (edge("back")) { if (menuPanel !== menuRoot) goBack(); else if (screen === "pause") closeMenu(); }
  else if (edge("start") && screen === "pause") closeMenu();
  menuPad = st;
}

// Le fond animé du menu et la cinématique du saut dans le puits sont dans js/20-titre.js
