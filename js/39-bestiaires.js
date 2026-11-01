"use strict";
// ---------- 39. Bestiaires : les Gardiens (mode normal) et la Horde (Siège et Prélude) ----------
/* Le carnet des créatures gagne deux onglets :
     Créatures — les monstres du puits (comme avant) ;
     Gardiens  — les 8 gardiens de zone et les 6 visages du Gardien final (rencontres et victoires) ;
     Horde     — les monstres du Siège et les 4 boss du Prélude.
   Les compteurs vivent dans le même carnet (« lepuits.bestiaire ») sous des clés g:…, b:… et h:…,
   pour être synchronisés entre appareils comme le reste. */

const BEST_GUARDIANS = [
  ["doubleJump", "Entrée", "Elle pond des larves et crache de l'acide. Frappe-la quand elle sort de terre."],
  ["dash", "Mines", "Il fait pleuvoir des rochers et frappe le sol. Saute au bon moment."],
  ["grapple", "Mines", "Pluie d'os et salves en éventail. Reste en mouvement."],
  ["gorgone", "Zone noyée", "Quand ses yeux s'ouvrent, tourne-lui le dos. Elle trace un huit au-dessus de la salle."],
  ["bolt", "Profondeurs", "Ses spores empoisonnent l'air et il fait trembler le sol."],
  ["smash", "Profondeurs", "Elle fonce en traînée de feu et lâche des orbes brûlants."],
  ["phase", "Antre", "Elle disparaît et laisse des leurres. La vraie ombre a des yeux."],
  ["templier", "Antre", "Bouclier de face : frappe-le de dos ou d'en haut."],
];
const BEST_FINALS = [
  ["normal", "Le fond du puits", "Le Gardien. Il t'attend derrière la grande porte."],
  ["pure", "Le fond du puits", "Si ta lumière est restée pure : plus rapide, plus violent."],
  ["abyss", "Le fond du puits", "Si tu as sombré : il dévore tout ce qui l'entoure."],
  ["true", "Le fond du puits", "La vraie fin : toutes les reliques posées sur l'autel. Plus fort que jamais."],
  ["seraphin", "Le Royaume céleste", "Le juge de la lumière. Ses salves tombent du ciel."],
  ["demon", "Le Royaume infernal", "Le maître des abysses. Il appelle ses démons sans fin."],
];
const BEST_HORDE = [
  ["crawler", "Partout", "Elles arrivent en masse et rongent le cœur à défendre."],
  ["bat", "Partout", "Rapides, elles survolent murs et palissades."],
  ["squelette", "Château, village, puits", "Il s'arrête à distance pour tirer… s'il voit sa cible. Sinon il avance."],
  ["golem", "Village, forêt, puits", "Lent et très résistant. Quand il atteint le cœur, il frappe fort."],
  ["wisp", "Village, forêt, puits", "Il traverse tout et explose au contact."],
  ["rodeur", "Forêt, puits", "Il bondit sur toi dès que tu approches."],
  ["belier", "Siège libre, forêt, puits", "Un golem bélier qui enfonce les portes, toutes les 5 vagues."],
  ["capitaine", "Prélude · chapitre 1", "Le capitaine de la garde, revenu d'entre les morts. Salves d'os en éventail, soldats rappelés, charges."],
  ["belierg", "Prélude · chapitre 2", "Il charge, frappe le sol et sonne la horde."],
  ["grandrodeur", "Prélude · chapitre 3", "Très rapide : il charge, hurle pour lancer la meute, mord."],
  ["seigneur", "Prélude · chapitre 4, Siège libre (vague 25)", "Onde de choc, invocations, charges ; il enrage à mi-vie."],
];
let bestTab = "creatures", bestFrom = null, bestSavedAt = 0;
// marquer une rencontre ou une victoire ; renvoie vrai la première fois qu'on la voit
function bestMark(key, field) {
  const b = bestEntry(key); let first = false;
  if (field === "seen") { if (!b.seen) { b.seen = 1; first = true; } else return false; }
  else { b.seen = 1; b.kills = (b.kills || 0) + 1; }
  bestiaryDirty = true;
  if (Date.now() - bestSavedAt > 1500) bestFlush();
  else if (!bestFlushT) bestFlushT = setTimeout(bestFlush, 1600);       // jamais rien de perdu : on écrit un peu plus tard
  return first;
}
let bestFlushT = 0;
function bestFlush() {
  bestFlushT = 0; bestSavedAt = Date.now(); bestiaryDirty = false;
  try { localStorage.setItem("lepuits.bestiaire", JSON.stringify(bestiary)); } catch (e) {}
}
try { addEventListener("pagehide", () => { if (bestiaryDirty) bestFlush(); }); } catch (e) {}
const bestHordeName = t => t === "belier" ? "Le Bélier" : (SG_ENEMIES[t] && SG_ENEMIES[t].name) || (ENEMY_TYPES[t] && ENEMY_TYPES[t].name) || t;
const bestHordeSprite = t => ({ belier: "golem0", seigneur: "seigneur0", capitaine: "capitaine0", belierg: "belierg0", grandrodeur: "grandrodeur0" })[t] || BEST_SPRITE[t];
function bestCard(key, seen, name, sub, text, sprite) {
  return `<div class="best${seen ? "" : " unknown"}"><canvas width="44" height="44" data-bsprite="${sprite || ""}" data-bseen="${seen ? 1 : 0}"></canvas>
    <div><b>${seen ? name : "???"}</b><small>${seen ? sub : "Pas encore rencontré"}</small>${seen ? `<span>${text}</span>` : ""}</div></div>`;
}
function bestTabs() {
  const t = (id, label) => `<button class="mi${bestTab === id ? " on" : ""}" data-act="bestTab:${id}">${label}</button>`;
  return `<nav class="best-tabs">${t("creatures", "Créatures")}${t("gardiens", "Gardiens")}${t("horde", "Horde")}</nav>`;
}
function bestDrawSprites(g) {
  for (const cv of g.querySelectorAll("canvas[data-bsprite]")) {
    const name = cv.dataset.bsprite, seen = cv.dataset.bseen === "1", c2 = cv.getContext("2d"); if (!c2) continue;
    c2.imageSmoothingEnabled = false;
    if (!name || !SPRITES[name]) { c2.fillStyle = seen ? "#c4413b" : "rgba(196,65,59,0.25)"; c2.font = "28px serif"; c2.textAlign = "center"; c2.fillText("☠", 22, 32); continue; }
    const src = spriteCanvas(name, !seen), k = Math.max(1, Math.floor(40 / Math.max(src.width, src.height)));
    if (!seen) c2.globalAlpha = 0.18;
    c2.drawImage(src, Math.round(22 - src.width * k / 2), Math.round(42 - src.height * k), src.width * k, src.height * k);
  }
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  // ----- le carnet, avec ses onglets -----
  around("renderBestiary", (o, ...a) => {
    const g = document.getElementById("bestGrid"); if (!g) return o(...a);
    if (bestTab === "creatures") { const r = o(...a); g.innerHTML = bestTabs() + g.innerHTML; return r; }
    let html = "", known = 0, total = 0;
    if (bestTab === "gardiens") {
      const list = BEST_GUARDIANS.filter(([k]) => MINI_BOSSES[k]);
      const all = list.length + BEST_FINALS.filter(([k]) => BOSS_VARIANTS[k]).length;
      html += `<p class="best-head">Les gardiens de zone</p>`;
      for (const [k, where, text] of list) {
        const d = MINI_BOSSES[k], b = bestiary["g:" + k] || {}; total++; if (b.seen) known++;
        html += bestCard("g:" + k, b.seen, d.name, `${where} · vaincu ${b.kills || 0} fois`, text, BEST_SPRITE[d.base] || d.base + "0");
      }
      html += `<p class="best-head">Le Gardien du fond</p>`;
      for (const [k, where, text] of BEST_FINALS) {
        const d = BOSS_VARIANTS[k]; if (!d) continue;
        const b = bestiary["b:" + k] || {}; total++; if (b.seen) known++;
        html += bestCard("b:" + k, b.seen, d.name, `${where} · vaincu ${b.kills || 0} fois`, text, "boss_idle");
      }
      g.innerHTML = bestTabs() + `<p class="best-sum">${known} / ${all} gardiens rencontrés</p>` + html;
    } else {
      for (const [k, where, text] of BEST_HORDE) {
        if (k !== "belier" && !SG_ENEMIES[k]) continue;
        const b = bestiary["h:" + k] || {}; total++; if (b.seen) known++;
        const boss = SG_ENEMIES[k] && SG_ENEMIES[k].lord;
        if (k === "capitaine") html += `<p class="best-head">Les boss du Prélude</p>`;
        html += bestCard("h:" + k, b.seen, bestHordeName(k), `${where} · vaincu ${b.kills || 0} fois`, text, bestHordeSprite(k));
      }
      g.innerHTML = bestTabs() + `<p class="best-sum">${known} / ${total} créatures de la horde rencontrées</p><p class="best-head">Les monstres de la horde</p>` + html;
    }
    bestDrawSprites(g);
  });
  // ----- ce qu'on rencontre et ce qu'on bat -----
  const miniKey = m => Object.keys(MINI_BOSSES).find(k => MINI_BOSSES[k] === m.def);
  around("spawnMini", (o, m, ...a) => {
    const r = o(m, ...a), k = m && m.enemy && m.state === "fight" ? miniKey(m) : null;
    if (k && bestMark("g:" + k, "seen")) toast(`Nouveau gardien dans le bestiaire : <b>${m.def.name}</b>`, 2400, true);
    return r;
  });
  around("beatMini", (o, m, ...a) => { const k = miniKey(m); if (k) bestMark("g:" + k, "kills"); return o(m, ...a); });
  around("updateBossFight", (o, dt, ...a) => {
    const f = bossFight, e = f && f.boss;
    if (e) {
      const v = e.variant || f.tier;
      if (v && BOSS_VARIANTS[v]) { bestMark("b:" + v, "seen"); if (e.dead && !e._bestK) { e._bestK = 1; bestMark("b:" + v, "kills"); } }
    }
    return o(dt, ...a);
  });
  around("sgSpawn", (o, ...a) => {
    const before = siege ? siege.enemies.length : 0, r = o(...a), e = siege && siege.enemies[before];
    if (e && bestMark("h:" + e.type, "seen") && SG_ENEMIES[e.type] && SG_ENEMIES[e.type].boss) toast(`Nouveau dans le bestiaire de la horde : <b>${bestHordeName(e.type)}</b>`, 2400, true);
    return r;
  });
  around("sgKill", (o, e, ...a) => { if (e && siege && siege.host) bestMark("h:" + e.type, "kills"); return o(e, ...a); });
  around("sgApplySnap", (o, m, ...a) => { const r = o(m, ...a); if (siege) for (const e of siege.enemies) if (!(bestiary["h:" + e.type] || {}).seen) bestMark("h:" + e.type, "seen"); return r; });
  // ----- depuis le menu du Siège : le bestiaire s'ouvre sur la Horde, « Retour » revient au Siège -----
  around("prMenuHtml", (o, ...a) => o(...a) + `<nav class="menu-list"><button class="mi" data-act="sgBestiary">Bestiaire de la horde<small>monstres et boss rencontrés</small></button></nav>`);
  around("menuAction", (o, act, ...a) => {
    if (act && act.startsWith("bestTab:")) { bestTab = act.slice(8); renderBestiary(); return; }
    if (act === "sgBestiary") { bestFrom = "siege"; bestTab = "horde"; showPanel("bestiary"); return; }
    if (act === "back" && bestFrom && menuPanel === "bestiary") { bestFrom = null; showPanel("siege"); menuPanel = "siege"; if (typeof renderSiegeLobby === "function") renderSiegeLobby(); return; }
    return o(act, ...a);
  });
})();
