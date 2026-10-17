"use strict";
// ---------- 28c. Commandes tactiles & Plein écran ----------
const touchIn = { x: 0, up: false, down: false, jump: false, attack: false, dash: false, bolt: false, grapple: false, phase: false, pause: false };
const isTouch = (() => { try { return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window; } catch (e) { return false; } })();

function isFull() { return document.body.classList.contains("full") || !!document.fullscreenElement; }
function toggleFull() {
  const want = !isFull();
  document.body.classList.toggle("full", want);
  try {
    if (want && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    else if (!want && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (_) {}
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && !isTouch) document.body.classList.remove("full");
});

function setupTouch() {
  const pad = document.getElementById("touchpad");
  if (!pad || !isTouch) return;
  pad.hidden = false; document.body.classList.add("touch");
  const dpad = document.getElementById("tpDpad"), knob = document.getElementById("tpKnob");
  let dId = null;
  const dMove = e => {
    const r = dpad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2, k = Math.min(1, Math.hypot(dx, dy) / max), a = Math.atan2(dy, dx);
    knob.style.transform = `translate(${Math.cos(a) * k * max * 0.55}px,${Math.sin(a) * k * max * 0.55}px)`;
    const dead = 0.25;
    touchIn.x = Math.abs(dx) / max > dead ? Math.sign(dx) : 0;
    touchIn.up = dy / max < -0.42; touchIn.down = dy / max > 0.42;
  };
  const dEnd = () => { dId = null; touchIn.x = 0; touchIn.up = touchIn.down = false; knob.style.transform = ""; };
  dpad.addEventListener("pointerdown", e => { e.preventDefault(); dId = e.pointerId; try { dpad.setPointerCapture(e.pointerId); } catch (_) {} dMove(e); });
  dpad.addEventListener("pointermove", e => { if (e.pointerId === dId) dMove(e); });
  for (const ev of ["pointerup", "pointercancel"]) dpad.addEventListener(ev, e => { if (e.pointerId === dId) dEnd(); });
  for (const b of pad.querySelectorAll("[data-tp]")) {
    const k = b.dataset.tp;
    const on = e => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) {}
      if (k === "full") { toggleFull(); return; }
      touchIn[k] = true; b.classList.add("on");
      if (k === "pause" && mode === "play") { if (screen === "play") openPause(); else if (screen === "pause") closeMenu(); }
    };
    const off = () => { touchIn[k] = false; b.classList.remove("on"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off);
    b.addEventListener("contextmenu", e => e.preventDefault());
  }
}

// Sur téléphone, on démarre en plein écran « maison » (la page ne montre que le jeu) ; le choix est retenu
function initFull() {
  let pref = null; try { pref = localStorage.getItem("lepuits.full"); } catch (e) {}
  if (pref === "on" || (pref === null && isTouch)) document.body.classList.add("full");
  if (typeof MutationObserver !== "undefined") new MutationObserver(() => { try { localStorage.setItem("lepuits.full", document.body.classList.contains("full") ? "on" : "off"); } catch (e) {} })
    .observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

// En plein écran, tout l'habillage (menus, HUD) grandit avec l'écran : sur un grand moniteur les menus restaient minuscules
function fitUi() {
  const f = document.getElementById("frame"); if (!f || !f.getBoundingClientRect) return;
  const w = f.getBoundingClientRect().width || 980;
  const k = isFull() ? Math.max(1, Math.min(2.2, w / 980)) : 1;
  f.style.setProperty("--ui", k.toFixed(3));
  document.body.classList.toggle("ui-big", k > 1.02);
}
if (typeof addEventListener === "function") addEventListener("resize", fitUi);
document.addEventListener("fullscreenchange", () => setTimeout(fitUi, 50));
if (typeof MutationObserver !== "undefined") new MutationObserver(() => setTimeout(fitUi, 0)).observe(document.body, { attributes: true, attributeFilter: ["class"] });
setTimeout(fitUi, 0);
