"use strict";
// ---------- 3. Entrées ----------
const keys = new Set();
const GAME_KEYS = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","KeyA","KeyD","KeyS","KeyW","KeyC","KeyK","KeyX","KeyJ","KeyR","ShiftLeft","ShiftRight","KeyL","KeyV","KeyI"];
// ----- Touches configurables -----
const ACTIONS = [
  { id: "left", name: "Gauche" }, { id: "right", name: "Droite" }, { id: "up", name: "Haut (viser)" }, { id: "down", name: "Bas" },
  { id: "jump", name: "Sauter", pad: true }, { id: "attack", name: "Frapper", pad: true },
  { id: "dash", name: "Dash", pad: true }, { id: "bolt", name: "Projectile", pad: true },
  { id: "grapple", name: "Grappin", pad: true }, { id: "phase", name: "Phase", pad: true },
  { id: "reset", name: "Recommencer", pad: true },
];
const DEFAULT_KEYS = { left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"], up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS"], jump: ["Space", "KeyC"],
  attack: ["KeyX", "KeyJ"], dash: ["ShiftLeft", "KeyL"], bolt: ["KeyV", "KeyI"], grapple: ["KeyF", "KeyO"], phase: ["KeyE", "KeyU"], reset: ["KeyR", null] };
const DEFAULT_PAD = { jump: 0, attack: 2, dash: 1, bolt: 3, grapple: 5, phase: 4, reset: 8 };
const KEY_NAMES = { Space: "Espace", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", ShiftLeft: "Maj", ShiftRight: "Maj droite",
  ControlLeft: "Ctrl", ControlRight: "Ctrl droite", AltLeft: "Alt", AltRight: "Alt Gr", Enter: "Entrée", NumpadEnter: "Entrée pavé", Tab: "Tab",
  Backspace: "Retour arrière", CapsLock: "Verr. Maj", MetaLeft: "Cmd", MetaRight: "Cmd droite" };
const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Select", "Start", "L3", "R3", "Haut", "Bas", "Gauche", "Droite", "Accueil"];
let binds, padBinds, learned = {}, layoutMap = null;
function loadBinds() {
  binds = clone(DEFAULT_KEYS); padBinds = { ...DEFAULT_PAD };
  try {
    const s = JSON.parse(localStorage.getItem("lepuits.binds"));
    if (s) for (const a of ACTIONS) {
      const k = s.keys && s.keys[a.id];
      if (Array.isArray(k) && k.length === 2) binds[a.id] = k.map(c => typeof c === "string" && c !== "Escape" ? c : null);
      if (a.pad && s.pad && Number.isInteger(s.pad[a.id])) padBinds[a.id] = s.pad[a.id];
    }
    if (s && s.learned) learned = s.learned;
  } catch (e) {}
}
function saveBinds() { try { localStorage.setItem("lepuits.binds", JSON.stringify({ keys: binds, pad: padBinds, learned })); } catch (e) {} }
loadBinds();
// Le nom affiché d'une touche suit la disposition du clavier quand le navigateur la connaît (AZERTY : KeyA s'affiche « Q »)
function keyLabel(c) {
  if (!c) return "—";
  if (KEY_NAMES[c]) return KEY_NAMES[c];
  const m = layoutMap && layoutMap.get(c);
  if (m) return m.toUpperCase();
  if (learned[c]) return learned[c];
  return c.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Pavé ");
}
const padLabel = i => i == null ? "—" : (PAD_NAMES[i] || `Bouton ${i}`);
const keysFor = a => binds[a].filter(Boolean).map(keyLabel).join(" ou ") || "aucune touche";
const bound = a => binds[a].some(c => c && keys.has(c));
const isBoundCode = c => ACTIONS.some(a => binds[a.id].includes(c));
try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { layoutMap = m; renderBinds(); renderControls(); }).catch(() => {}); } catch (e) {}

// Attente d'une nouvelle touche : intercepte le clavier avant tout le reste
let capture = null, ignoreSlotClickUntil = 0;
addEventListener("keydown", e => {
  if (!capture) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat) return;
  if (e.key === "Escape") { cancelCapture(); return; }
  if (capture.slot === "pad") return;
  const { action, slot } = capture;
  if (e.key === "Backspace" || e.key === "Delete") {
    binds[action][slot] = null;
    finishCapture(`${ACTIONS.find(a => a.id === action).name} : touche effacée.`);
    return;
  }
  if (e.key && e.key.length === 1) learned[e.code] = e.key.toUpperCase();
  let msg = `${ACTIONS.find(a => a.id === action).name} : ${keyLabel(e.code)}.`;
  for (const a of ACTIONS) for (let i = 0; i < 2; i++)
    if (binds[a.id][i] === e.code && !(a.id === action && i === slot)) { binds[a.id][i] = null; msg = `${keyLabel(e.code)} servait à ${a.name} : retirée de cette action.`; }
  binds[action][slot] = e.code;
  finishCapture(msg);
}, true);

addEventListener("keydown", e => {
  if (e.key && e.key.length === 1 && !learned[e.code]) learned[e.code] = e.key.toUpperCase();
  if (e.key === "Escape" && mode === "play") {
    e.preventDefault();
    if (screen === "play") openPause();
    else if (menuPanel !== menuRoot) goBack();
    else if (screen === "pause") closeMenu();
    return;
  }
  // M : la carte, Tab ou I : l'inventaire (raccourcis vers le menu pause)
  if (mode === "play" && screen === "play" && ["KeyM", "Tab"].includes(e.code) && !isBoundCode(e.code)) {
    e.preventDefault(); openPause(); showPanel(e.code === "KeyM" ? "map" : "inventory"); return;
  }
  if (e.target.closest && e.target.closest("input,button,textarea,summary,select")) return;
  if (mode === "play" && screen !== "play") {             // menu ouvert : les flèches choisissent une ligne
    if (["ArrowUp", "KeyW"].includes(e.code)) { e.preventDefault(); moveFocus(-1, true); }
    if (["ArrowDown", "KeyS"].includes(e.code)) { e.preventDefault(); moveFocus(1, true); }
    if (e.code === "ArrowLeft") { e.preventDefault(); moveFocus(-1); }
    if (e.code === "ArrowRight") { e.preventDefault(); moveFocus(1); }
    return;
  }
  if (mode === "edit" && editorKey(e)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (GAME_KEYS.includes(e.code) || isBoundCode(e.code)) { e.preventDefault(); keys.add(e.code); }
});
addEventListener("keyup", e => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); if (mode === "play" && screen === "play" && running) openPause(); });

// Certains navigateurs (aperçu dans une app, iframe) interdisent la manette : on joue alors au clavier sans planter
let padBlocked = false;
function findGamepad() {
  if (padBlocked || !navigator.getGamepads) return null;
  try { return [...navigator.getGamepads()].find(g => g && g.connected) || null; }
  catch (e) { padBlocked = true; return null; }
}
const input = { x: 0, up: false, down: false, jump: false, attack: false, jumpPressed: false, attackPressed: false, dashPressed: false, boltPressed: false, grapplePressed: false, phasePressed: false, resetPressed: false, pausePressed: false, pad: false };
const prev = { jump: false, attack: false, dash: false, bolt: false, grapple: false, phase: false, reset: false, pause: false };
function readInput() {
  let x = 0, up = false, down = false, jump = false, attack = false, dash = false, bolt = false, grapple = false, phase = false, reset = false, pause = false, pad = false;
  if (bound("grapple")) grapple = true;
  if (bound("phase")) phase = true;
  if (bound("left")) x -= 1;
  if (bound("right")) x += 1;
  if (bound("down")) down = true;
  if (bound("up")) up = true;
  if (bound("jump")) jump = true;
  if (bound("attack")) attack = true;
  if (bound("dash")) dash = true;
  if (bound("bolt")) bolt = true;
  if (bound("reset")) reset = true;
  // Écran tactile
  if (typeof touchIn !== "undefined") {
    x += touchIn.x; if (touchIn.up) up = true; if (touchIn.down) down = true;
    if (touchIn.jump) jump = true; if (touchIn.attack) attack = true; if (touchIn.dash) dash = true;
    if (touchIn.bolt) bolt = true; if (touchIn.grapple) grapple = true; if (touchIn.phase) phase = true;
  }
  const gp = findGamepad();
  if (gp) {
    pad = true;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, b = i => gp.buttons[i] && gp.buttons[i].pressed;
    if (Math.abs(ax) > 0.2) x += Math.sign(ax) * Math.min(1, (Math.abs(ax) - 0.2) / 0.6);
    if (b(14)) x -= 1; if (b(15)) x += 1;
    if (ay > 0.5 || b(13)) down = true;
    if (ay < -0.5 || b(12)) up = true;
    if (b(padBinds.jump)) jump = true;
    if (b(padBinds.attack)) attack = true;
    if (b(padBinds.dash)) dash = true;
    if (b(padBinds.bolt)) bolt = true;
    if (b(padBinds.reset)) reset = true;
    if (b(padBinds.grapple)) grapple = true;
    if (b(padBinds.phase)) phase = true;
    if (b(9)) pause = true;
  }
  if (grapple && !prev.grapple) input.grapplePressed = true; prev.grapple = grapple;
  if (phase && !prev.phase) input.phasePressed = true; prev.phase = phase;
  input.pausePressed = pause && !prev.pause; prev.pause = pause;
  input.x = Math.max(-1, Math.min(1, x)); input.down = down; input.up = up;
  input.jump = jump; if (jump && !prev.jump) input.jumpPressed = true; prev.jump = jump;
  input.attack = attack; if (attack && !prev.attack) input.attackPressed = true; prev.attack = attack;
  if (dash && !prev.dash) input.dashPressed = true; prev.dash = dash;
  if (bolt && !prev.bolt) input.boltPressed = true; prev.bolt = bolt;
  input.resetPressed = reset && !prev.reset; prev.reset = reset;
  input.pad = pad;
}
