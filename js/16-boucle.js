"use strict";
// ---------- 15. Boucle ----------
let acc = 0, last = 0, running = false, lastPad = null, frameDt = 0;
function updateBuckets(dt) {
  for (const bk of buckets) {
    const occ = player.onPlat === bk && !player.dead;
    bk.vy = approach(bk.vy, occ ? 38 : -24, (occ ? 160 : 60) * dt);
    const ny = Math.max(bk.y0, Math.min(bk.yMax, bk.y + bk.vy * dt));
    if ((ny === bk.yMax && bk.vy > 0) || (ny === bk.y0 && bk.vy < 0)) bk.vy = 0;
    const dy = ny - bk.y; bk.y = ny;
    if (occ) player.y += dy;
  }
}
function stepAll() {
  player.prevX = player.x; player.prevY = player.y;
  for (const e of enemies) { e.prevX = e.x; e.prevY = e.y; }
  for (const bk of buckets) bk.prevY = bk.y;
  updateBuckets(STEP);
  updatePlayer(STEP); updateEnemies(STEP); updateFloaters(STEP); updateProjectiles(STEP); updateShots(STEP); updateWorld(STEP); updateParticles(STEP);
  input.jumpPressed = false; input.attackPressed = false; input.dashPressed = false; input.boltPressed = false; input.grapplePressed = false; input.phasePressed = false;
}
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000 || 0)); last = now; frameDt = dt;
  time += dt;
  if (mode === "edit") {
    updateEditor(dt); drawEditor();
    requestAnimationFrame(frame); return;
  }
  if (screen !== "play") {
    pollMenuPad();
    if (screen === "outro" && typeof drawOutro === "function") drawOutro(dt);          // scène de fin
    else if (screen === "title" || screen === "intro") drawTitle(dt); else draw(1);
    requestAnimationFrame(frame); return;
  }
  readInput();
  if (input.pad !== lastPad) { lastPad = input.pad; padEl.textContent = input.pad ? "Manette connectée" : "Clavier"; padWrap.classList.toggle("on", input.pad); }
  if (input.pausePressed) { openPause(); requestAnimationFrame(frame); return; }
  if (input.resetPressed) resetRun();
  updateRunClock(dt);
  renderDark(); renderClock();
  shakeT = Math.max(0, shakeT - dt); if (shakeT <= 0) shakeM = 0;
  if (freeze > 0) freeze -= dt;
  else {
    acc += dt;
    while (acc >= STEP) {
      stepAll();
      acc -= STEP;
      if (freeze > 0) { acc = 0; break; }
    }
  }
  const a = freeze > 0 ? 1 : acc / STEP;
  const pi = at(player, a);
  updateCamera(dt, pi.x, pi.y);
  draw(a);
  requestAnimationFrame(frame);
}
function startLoop() {
  if (running) return;
  running = true; last = performance.now(); requestAnimationFrame(frame);
}
