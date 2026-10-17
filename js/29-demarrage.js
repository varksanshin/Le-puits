"use strict";
// ---------- Démarrage (toujours le dernier fichier chargé) ----------
buildTuner();
buildAtelier();
buildEditor();
resetRun();
applyTuning();
renderControls();
openTitle();
startLoop();
$("tabPlay").addEventListener("click", () => setMode("play"));
$("tabEdit").addEventListener("click", () => setMode("edit"));
connectStorage();
setupTouch();
initFull();
