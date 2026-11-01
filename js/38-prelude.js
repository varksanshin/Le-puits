"use strict";
// ---------- 38. Prélude : la chute de Valcendre (mode horde, histoire) ----------
/* Avant le Puits : pourquoi le héros finit par y sauter.
   Quatre chapitres du mode horde, à la suite, dans quatre décors :
     1. la cour du château      — 5 vagues  + le Capitaine damné
     2. le village de Valcendre — 10 vagues + le Bélier de guerre
     3. la forêt de Brumesombre — 15 vagues + le Grand Rôdeur
     4. le vieux Puits          — 25 vagues + le Seigneur de la Horde
   On garde ses sorts, ses objets et son niveau d'un chapitre à l'autre. Un texte ouvre et ferme chaque chapitre.
   La partie est sauvegardée au début de chaque chapitre (on peut reprendre plus tard, ou recommencer un chapitre perdu).
   À la fin, le héros saute dans le Puits… et le mode aventure commence.
   Jouable seul, à deux sur le même écran ou en ligne (l'hôte décide, les invités suivent).
   Tout se règle dans PR (difficulté) et PR_CHAPTERS (chapitres). */

const PR = {
  saveKey: "lepuits.prelude", doneKey: "lepuits.prelude.done",
  // difficulté : « dw » = numéro de vague compté depuis le début du prélude (1 à 59)
  hpPerWave: 0.12, hpLate: 0.05, hpLateFrom: 30,        // PV des monstres : × (1 + 0,12 × (dw − 1)) × (1 + 0,05 × (dw − 30) au-delà)
  bossK: [1, 0.55, 1.8, 2.0],                           // PV des boss de chapitre (château, village, forêt, puits), réglés pour ~1 min de combat
  countBase: 6, countPerWave: 3.4, countLateFrom: 40, countLate: 1.5, countLvMax: 1.5,
  bossShare: 0.5,                                       // part des monstres normaux pendant la vague du boss
  heartBase: 100, heartPerCh: 25,                       // PV du cœur à défendre : 100, 125, 150, 175 (+ les Remparts gagnés)
};
let sgMode = "libre";                                   // le menu du Siège : "libre" ou "prelude"
try { if (localStorage.getItem("lepuits.siege.mode") === "prelude") sgMode = "prelude"; } catch (e) {}
let prResume = true;                                    // reprendre la sauvegarde (si elle existe)

// ===== Les boss de chapitre (et leurs couleurs, sur les silhouettes existantes) =====
Object.assign(SG_ENEMIES, {
  capitaine:   { hp: 900,  spd: 20, r: 12, dmg: 2, heart: 10, xp: 60,  sprite: "capitaine", boss: true, lord: true, scale: 2.3, from: 999,
                 name: "Le Capitaine damné", atk: ["fan", "summon", "charge", "fan"], summon: ["squelette", "crawler"], every: 3.2 },
  belierg:     { hp: 2600, spd: 15, r: 16, dmg: 3, heart: 30, xp: 120, sprite: "belierg", boss: true, lord: true, scale: 2.5, from: 999,
                 name: "Le Bélier de guerre", atk: ["charge", "slam", "summon", "charge"], summon: ["golem", "crawler", "bat"], every: 3.4 },
  grandrodeur: { hp: 4200, spd: 30, r: 15, dmg: 2, heart: 20, xp: 180, sprite: "grandrodeur", boss: true, lord: true, scale: 2.6, from: 999,
                 name: "Le Grand Rôdeur", atk: ["charge", "howl", "fan", "summon", "charge"], summon: ["rodeur", "rodeur", "bat"], every: 2.6 },
});
SG_ENEMIES.seigneur.name = "Le Seigneur de la Horde";
try {
  if (SPRITES.squelette0) { SPRITES.capitaine0 = SPRITES.squelette0; SPRITES.capitaine1 = SPRITES.squelette1; SPRITE_PAL.capitaine = { ...(SPRITE_PAL.squelette || {}), w: "#cfc4a0", e: "#7fd6ff", "&": "#4a5a70" }; }
  if (SPRITES.golem0) { SPRITES.belierg0 = SPRITES.golem0; SPRITE_PAL.belierg = { ...(SPRITE_PAL.golem || {}), M: "#6a4a2a", g: "#a8743a", e: "#ffb04a" }; }
  if (SPRITES.rodeur0) { SPRITES.grandrodeur0 = SPRITES.rodeur0; SPRITES.grandrodeur1 = SPRITES.rodeur1; SPRITE_PAL.grandrodeur = { ...(SPRITE_PAL.rodeur || {}), "^": "#3a3a48", y: "#ff4a2a" }; }
} catch (e) {}

// ===== Les chapitres =====
const PR_CHAPTERS = [
  { key: "chateau", theme: "chateau", title: "La cour du château", waves: 5, boss: "capitaine", dw0: 1, heart: "FLAMME DU CHATEAU", heartFull: "la Flamme du château",
    roster: [["crawler", 4], ["bat", 2], ["squelette", 2, 3]] },
  { key: "village", theme: "village", title: "Le village de Valcendre", waves: 10, boss: "belierg", dw0: 7, heart: "COEUR DU VILLAGE", heartFull: "le Cœur du village",
    roster: [["crawler", 3], ["bat", 3], ["squelette", 2], ["wisp", 2, 9], ["golem", 1, 11]] },
  { key: "foret", theme: "foret", title: "La forêt de Brumesombre", waves: 15, boss: "grandrodeur", dw0: 18, heart: "FEU DU CAMPEMENT", heartFull: "le feu du campement",
    roster: [["rodeur", 4], ["bat", 3], ["crawler", 2], ["wisp", 2], ["golem", 1], ["squelette", 1]], minis: true },
  { key: "puits", theme: "puits", title: "Le vieux Puits", waves: 25, boss: "seigneur", dw0: 34, heart: "SCEAU DU PUITS", heartFull: "le Sceau du Puits",
    roster: [["crawler", 3], ["bat", 2], ["squelette", 2], ["golem", 2], ["wisp", 2], ["rodeur", 3]], minis: true },
];
const PR_STORY = {
  intro0: ["Valcendre, la nuit de la Lune noire.", "Des créatures sortent de la forêt par centaines et se jettent sur le château. Au milieu de la cour brûle la Flamme du château : tant qu'elle tient, les remparts tiennent.", "Défends-la."],
  outro0: ["Le Capitaine damné s'effondre dans un fracas d'os et d'acier. Hier encore, il commandait la garde.", "Mais la Flamme vacille et les remparts se fendent : le château est perdu. Tu emportes une braise de la Flamme et tu fuis avec les survivants vers le village."],
  intro1: ["Au village de Valcendre, on rallume le Cœur avec ta braise.", "Les volets se ferment, les fourches se lèvent. La horde a suivi ta trace."],
  outro1: ["Le Bélier de guerre se brise contre la palissade.", "Une vieille femme te prend le bras : « Tout est venu du Puits, au fond de la forêt. Il y a cent ans déjà. Il faut le refermer. »"],
  intro2: ["La forêt de Brumesombre. Vous campez autour d'un feu, la braise à l'abri dans une lanterne.", "Entre les troncs, des yeux s'allument. Les loups ont changé : ils ne dorment plus, ils ne s'arrêtent plus."],
  outro2: ["Le Grand Rôdeur s'écroule dans les fougères.", "Plus loin, entre les arbres morts, monte une lueur violette. Le vieux Puits."],
  intro3: ["Le vieux Puits. Les ruines d'un sanctuaire l'entourent, et le Sceau qui le fermait est fendu.", "Tu poses la braise sur le Sceau. Tant qu'elle brûle, il se referme… lentement. Tout ce qui vit en bas veut l'éteindre."],
  outro3: ["Le Seigneur de la Horde tombe à genoux, puis en poussière.", "Mais du Puits monte encore un souffle froid. Ce qui commande la horde n'est pas là : il est en bas.", "Tu prends la braise. Tu enjambes la margelle."],
};
const prCh = () => PR_CHAPTERS[(siege && siege.camp && siege.camp.ch) || 0];

// ===== Difficulté =====
function prHpMult(d, n) {
  const dw = siege.dw || 1;
  let m = (1 + PR.hpPerWave * (dw - 1)) * (1 + PR.hpLate * Math.max(0, dw - PR.hpLateFrom)) * (1 + SG.coopHp * (n - 1));
  if (d.boss) m *= 1 + 0.5 * (n - 1);
  if (d.lord) m *= PR.bossK[(siege.camp && siege.camp.ch) || 0];
  return m;
}
function prRoster() {
  const C = prCh(), dw = siege.dw || 1;
  return C.roster.filter(r => !r[2] || dw >= r[2]).map(r => [r[0], SG_ENEMIES[r[0]], r[1]]);
}
function prStartWave() {
  const S_ = siege, C = prCh();
  S_.wave++; S_.phase = "wave";
  S_.dw = C.dw0 + S_.wave - 1;
  const n = S_.players.length, bossWave = S_.wave > C.waves, dw = S_.dw;
  const base = PR.countBase + PR.countPerWave * Math.min(dw, PR.countLateFrom) + PR.countLate * Math.max(0, dw - PR.countLateFrom);
  S_.toSpawn = Math.round(base * (1 + SG.coopCount * (n - 1)) * Math.min(PR.countLvMax, 1 + 0.02 * (S_.level - 1)) * (bossWave ? PR.bossShare : 1));
  S_.spawnT = 0.5; S_.bossLeft = !bossWave && C.minis && S_.wave % 5 === 0 ? 1 : 0;
  if (bossWave) { sgSpawn(C.boss); S_.bossWave = true; }
  const name = SG_ENEMIES[C.boss].name;
  toast(bossWave ? `<b>${name.toUpperCase()}</b> approche !` : S_.bossLeft ? `<b>Vague ${S_.wave}/${C.waves}</b> · un Bélier approche !` : `<b>Vague ${S_.wave}/${C.waves}</b>`, bossWave ? 3600 : 2200, true);
  if (typeof SFX !== "undefined") SFX.play(bossWave || S_.bossLeft ? "bossEnter" : "warn");
  if (bossWave) shake(4, 0.6);
}
function prWaveText() {
  const S_ = siege, C = prCh(), left = S_.enemies.length + S_.toSpawn;
  if (S_.phase === "done") return "VICTOIRE";
  if (S_.phase === "prep") return S_.wave ? `REPIT ${Math.ceil(S_.phaseT)}` : `VAGUE 1 DANS ${Math.ceil(S_.phaseT)}`;
  return S_.wave > C.waves ? `BOSS  ${left}` : `VAGUE ${S_.wave}/${C.waves}  ${left}`;
}

// ===== Démarrer, reprendre, sauvegarder =====
const prLoad = () => { try { const s = JSON.parse(localStorage.getItem(PR.saveKey)); return s && s.v === 1 ? s : null; } catch (e) { return null; } };
function prSave() {
  const S_ = siege; if (!S_ || !S_.camp || !S_.host) return;
  const data = { v: 1, ch: S_.camp.ch, level: S_.level, xp: S_.xp, kills: S_.kills, time: S_.time, heartBonus: S_.camp.heartBonus || 0, at: Date.now(),
    players: S_.players.map(p => ({ pid: p.pid, name: p.name, spells: { ...p.spells }, items: [...p.items], upg: { ...p.upg }, bonus: { ...(p.bonus || {}) }, phenixUsed: false })) };
  try { localStorage.setItem(PR.saveKey, JSON.stringify(data)); } catch (e) {}
}
// la partie (seul ou à deux) : depuis le chapitre 1, ou depuis la sauvegarde
function prStart(players, o = {}) {
  const save = o.resume ? prLoad() : null, ch = save ? save.ch : 0, C = PR_CHAPTERS[ch];
  siege = null;
  siegeStart({ players, theme: C.theme, camp: { ch, resume: !!save }, seed: o.seed });
  prAfterStart(save);
}
// infos envoyées aux invités en ligne quand l'hôte lance le prélude
function prHostInfo() {
  const save = prResume ? prLoad() : null, ch = save ? save.ch : 0;
  return { theme: PR_CHAPTERS[ch].theme, camp: { ch, resume: !!save } };
}
// après siegeStart (local ou hôte) : la sauvegarde, le cœur, le texte d'ouverture
function prAfterStart(save) {
  const S_ = siege; if (!S_ || !S_.camp) return;
  if (save === undefined) save = S_.camp.resume ? prLoad() : null;
  const ch = S_.camp.ch;
  S_.dw = PR_CHAPTERS[ch].dw0;
  if (save) {
    S_.level = save.level || 1; S_.xp = save.xp || 0; S_.kills = save.kills || 0; S_.time = save.time || 0; S_.camp.heartBonus = save.heartBonus || 0;
    S_.players.forEach((p, i) => {
      const b = save.players.find(q => q.pid === p.pid) || (!S_.net ? save.players[i] : null);
      if (b) { p.spells = { ...b.spells }; p.items = [...b.items]; p.upg = { ...b.upg }; p.bonus = { ...b.bonus }; }
      else { const L = Math.min(10, 1 + 2 * ch); p.spells = { epee: L, tir: L }; }     // un nouveau venu rattrape un peu
      sgRecompute(p); p.hp = p.s.maxHp;
    });
  }
  prSetHeart();
  S_.phaseT = 4;
  prSave();
  prStory("intro" + ch);
}
function prSetHeart() {
  const S_ = siege, ch = S_.camp.ch, max = PR.heartBase + PR.heartPerCh * ch + (S_.camp.heartBonus || 0);
  S_.heart.max = max; S_.heart.hp = max;
  S_.camp.heartBase = PR.heartBase + PR.heartPerCh * ch;
}

// ===== Le texte entre les chapitres =====
function prStory(key, after) {
  const S_ = siege; if (!S_) return;
  S_.story = { key, after }; S_.paused = true;
  prShowStory();
}
function prShowStory() {
  const S_ = siege, st = S_.story; if (!st) return;
  const key = st.key, ch = +(key.match(/\d/) || [0])[0], C = PR_CHAPTERS[ch], el = document.getElementById("siegePanel");
  const lead = !S_.net || S_.host;
  const isEnd = key === "end";
  screen = "siegemenu"; menuRoot = "siege";
  const pages = isEnd ? ["Le prélude est terminé.", "En bas, le Puits t'attend. Tu peux sauter maintenant et commencer l'aventure, ou revenir au menu et le faire plus tard."] : PR_STORY[key] || [];
  const kicker = isEnd ? "Prélude · fin" : key.startsWith("intro") ? `Prélude · chapitre ${ch + 1} sur 4` : `Chapitre ${ch + 1} terminé`;
  const title = isEnd ? "Le Puits" : key.startsWith("intro") ? C.title : "Victoire";
  const btn = isEnd ? `<button class="mi" data-act="prJump">Sauter dans le Puits<small>commencer l'aventure</small></button><button class="mi" data-act="sgQuit">Revenir au menu</button>`
    : lead ? `<button class="mi" data-act="prNext">${key.startsWith("intro") ? "Défendre " + C.heartFull : ch < 3 ? "En route" : "Continuer"}</button>` : `<p class="pvp-help">En attente de l'hôte…</p>`;
  el.innerHTML = `<div><span class="kicker">${kicker}</span><div class="big small">${title}</div></div>
    <div class="pr-story">${pages.map(t => `<p>${t}</p>`).join("")}</div>
    <nav class="menu-list">${btn}</nav>`;
  showPanel("siege");
  try { const b = el.querySelector(".mi"); if (b) b.focus({ preventScroll: true }); } catch (e) {}
}
function prNext() {
  const S_ = siege; if (!S_ || !S_.story) return;
  if (S_.net && !S_.host) return;
  const key = S_.story.key; S_.story = null; S_.paused = false; sgResume();
  if (key.startsWith("outro")) { const ch = S_.camp.ch; if (ch < 3) prNextChapter(); else prFinal(); }
}
// chapitre suivant : nouveau décor, on garde tout le reste
function prNextChapter() {
  const S_ = siege, ch = ++S_.camp.ch, C = PR_CHAPTERS[ch];
  S_.camp.heartBonus = Math.max(0, S_.heart.max - (S_.camp.heartBase || PR.heartBase));
  S_.map = sgBuildMap(Math.floor(S_.rand() * 1e9), C.theme);
  Object.assign(S_, { wave: 0, phase: "prep", phaseT: 4, toSpawn: 0, enemies: [], shots: [], foeShots: [], zones: [], bossWave: false, bossLoot: false, outroShown: false, dw: C.dw0 });
  S_.xp += S_.gems.reduce((a, g) => a + g.v, 0); S_.gems = [];
  const h = S_.map.heart;
  S_.players.forEach((p, i) => { const a = (i / 4) * Math.PI * 2 + 0.6; p.x = h.x + Math.cos(a) * 34; p.y = h.y + Math.sin(a) * 30; p.vx = p.vy = 0; p.down = false; p.hp = p.s.maxHp; p.iv = 2; p.tx = null; });
  S_.cam.x = h.x - VW / 2; S_.cam.y = h.y - VH / 2;
  prSetHeart();
  prSave();
  prStory("intro" + ch);
}
// le boss du chapitre est tombé : butin, puis le texte de fin de chapitre
function prBossDown(e) {
  const S_ = siege;
  S_.enemies = []; S_.foeShots = []; S_.toSpawn = 0; S_.phase = "done";
  for (const p of S_.players) { p.down = false; p.hp = p.s.maxHp; }
  S_.heart.hp = S_.heart.max;
  if (typeof SFX !== "undefined") SFX.play("relic");
  toast(`<b>${SG_ENEMIES[e.type].name}</b> est vaincu !`, 2600, true);
  S_.fx.push({ kind: "boom", x: e.x, y: e.y, t: 0.6, r: 60, c: "#f2b54a" });
  if (typeof prSeen === "function") prSeen(e.type, true);
  S_.bossLoot = true;
  sgOfferChoice("item");
}
function prFinal() {
  const S_ = siege;
  S_.final = true;
  try { localStorage.setItem(PR.doneKey, String(Date.now())); localStorage.removeItem(PR.saveKey); } catch (e) {}
  prStory("end");
}
// chaque image (hôte ou seul) : enchaîner butin → texte de fin
function prTick() {
  const S_ = siege; if (!S_ || !S_.camp || (S_.net && !S_.host)) return;
  if (S_.phase === "done" && !S_.choice && !S_.story && !S_.outroShown && !S_.final) { S_.outroShown = true; prStory("outro" + S_.camp.ch); }
}
// les invités suivent l'état du prélude envoyé par l'hôte
function prGuestSync(cp) {
  const S_ = siege; if (!S_ || S_.host || !cp) return;
  if (!S_.camp) S_.camp = { ch: cp.ch };
  if (S_.camp.ch !== cp.ch) S_.camp.ch = cp.ch;
  S_.dw = cp.dw;
  if (S_.ending) return;
  const want = cp.st || 0, have = S_.story ? S_.story.key : 0;
  if (want === have) return;
  if (want) { if (want === "end") S_.final = true; S_.story = { key: want }; if (!S_.pickDone) prShowStory(); }
  else { S_.story = null; if (screen === "siegemenu" && !S_.pickDone && !S_.over) sgResume(); }
}

// ===== La fin : le héros marche jusqu'au Puits et saute =====
function prJump() {
  const S_ = siege; if (!S_) return;
  S_.story = null; S_.final = true;
  S_.ending = { t: 0, fade: 0 };
  menuEl.hidden = true; screen = "play"; document.body.classList.remove("pvp-drafting");
  if (S_.net) { try { S_.net.leave(); } catch (e) {} S_.net = null; S_.host = true; }
  S_.enemies = []; S_.foeShots = [];
}
function prEndingUpdate(dt) {
  const S_ = siege, E = S_.ending, h = S_.map.heart;
  E.t += dt;
  let all = true;
  for (const p of S_.local) {
    const dx = h.x - p.x, dy = h.y - 2 - p.y, d = Math.hypot(dx, dy);
    if (d > 3 && p.endK == null) { const sp = Math.min(d, 55 * dt); p.x += dx / d * sp; p.y += dy / d * sp; p.anim += dt * 8; p.input = { mx: dx / d, my: dy / d }; if (Math.abs(dx) > 1) p.face = Math.sign(dx); all = false; }
    else { p.input = { mx: 0, my: 0 }; p.endK = Math.min(1, (p.endK || 0) + dt * 1.1); if (p.endK < 1) all = false; }
  }
  for (const f of S_.fx) f.t -= dt; S_.fx = S_.fx.filter(f => f.t > 0);
  sgCamera(dt);
  if (all) { E.fade = Math.min(1, E.fade + dt * 1.2); if (E.fade >= 1 && !E.done) { E.done = true; prEnterWell(); } }
}
function prDrawOverlay() {
  const S_ = siege; if (!S_ || !S_.camp) return;
  // le chapitre, discret sous la vague
  if (!S_.ending) { const C = prCh(), t = `CHAPITRE ${S_.camp.ch + 1} · ${C.title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`; drawTinyText(VW / 2, VH - 11, t, "#b8b0a0"); }
  if (S_.ending && S_.ending.fade > 0) { ctx.fillStyle = `rgba(6,4,10,${S_.ending.fade})`; ctx.fillRect(0, 0, VW, VH); }
}
// le mode aventure commence (comme après la cinématique du menu, mais on vient d'en haut)
function prEnterWell() {
  siege = null; sgLobbyState = null;
  document.body.classList.remove("siege-on", "pvp-drafting");
  screen = "play"; mode = "play";
  menuAction("story");
  fadeIn = 1.2;
  toast("Le Puits. Tout en bas, quelque chose t'attend.", 3600, true);
}

// ===== Défaite =====
function prShowEnd() {
  const S_ = siege, o = S_.over, C = prCh(), el = document.getElementById("siegePanel");
  screen = "siegemenu"; menuRoot = "siege"; document.body.classList.remove("pvp-drafting");
  const why = S_.heart.hp <= 0 ? `${C.heartFull[0].toUpperCase() + C.heartFull.slice(1)} s'est éteint${/^la /.test(C.heartFull) ? "e" : ""}.` : o.why;
  const lead = !S_.net || S_.host;
  el.innerHTML = `<div><span class="kicker">Prélude · chapitre ${S_.camp.ch + 1} : ${C.title}</span><div class="big small">${why}</div></div>
    <div class="pvp-result lose"><b>${S_.wave > C.waves ? "Au boss" : `Vague ${S_.wave}/${C.waves}`}</b><span>${S_.kills} monstres vaincus · niveau ${S_.level} · ${fmtTime(S_.time)}</span><span>Ta progression est sauvegardée au début du chapitre.</span></div>
    <nav class="menu-list">${lead ? `<button class="mi" data-act="prRetry">Recommencer le chapitre ${S_.camp.ch + 1}<small>avec tes sorts et objets du début du chapitre</small></button>` : `<p class="pvp-help">L'hôte peut relancer le chapitre.</p>`}<button class="mi" data-act="sgQuit">Retour au menu</button></nav>`;
  showPanel("siege");
}
function prRetry() {
  const S_ = siege; if (!S_) return;
  if (S_.net) { prResume = true; sgHostStart(); return; }
  const players = S_.players.map(p => ({ src: p.src, name: p.name, pid: p.pid }));
  prStart(players, { resume: true });
}

// ===== Le menu du Siège : choisir le mode =====
function prMenuHtml() {
  const save = prLoad(), pre = sgMode === "prelude";
  let h = `<nav class="menu-list sg-modes"><button class="mi${pre ? " on" : ""}" data-act="sgMode:prelude">Prélude : la chute de Valcendre<small>l'histoire, 4 chapitres${(() => { try { return localStorage.getItem(PR.doneKey) ? " · terminé" : ""; } catch (e) { return ""; } })()}</small></button>
    <button class="mi${pre ? "" : " on"}" data-act="sgMode:libre">Siège libre<small>vagues sans fin, pour le record</small></button></nav>`;
  if (pre && save) h += `<nav class="menu-list"><button class="mi" data-act="prToggleResume">${prResume ? `Départ : reprendre au chapitre ${save.ch + 1}` : "Départ : nouveau prélude (chapitre 1)"}<small>${prResume ? `${PR_CHAPTERS[save.ch].title} · niveau ${save.level} · change pour recommencer depuis le début` : "la sauvegarde sera remplacée"}</small></button></nav>`;
  return h;
}

// ===== Le décor des chapitres =====
/* Chaque thème construit sa carte (mêmes règles que le village : « W » mur, « # » bord, tout ce qui n'est pas « . » bloque),
   peint son sol, liste ses éléments en relief et dessine le cœur à défendre. */
const prGrid = (W, H) => Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (r === 0 || c === 0 || r === H - 1 || c === W - 1) ? "#" : "."));
const prCanvas = m => { const cv2 = document.createElement("canvas"); cv2.width = m.W * T; cv2.height = m.H * T; return cv2; };
function prPaintGrass(g, x, y, c, r, base, dark, light, blades) {
  g.fillStyle = base; g.fillRect(x, y, T, T);
  const blot = (sgHash(Math.floor(c / 3), Math.floor(r / 3), 11) + sgHash(Math.floor((c + 1) / 2), Math.floor((r + 1) / 2), 12)) / 2;
  if (blot > 0.62) { g.fillStyle = light; g.globalAlpha = 0.25; g.fillRect(x, y, T, T); g.globalAlpha = 1; } else if (blot < 0.3) { g.fillStyle = dark; g.globalAlpha = 0.35; g.fillRect(x, y, T, T); g.globalAlpha = 1; }
  for (let k = 0; k < 12; k++) { const bx = x + Math.floor(sgHash(c, r, k) * 16), by = y + Math.floor(sgHash(r, c, k + 3) * 15), v = sgHash(c, r, k + 7); g.fillStyle = v < 0.4 ? blades[0] : v < 0.75 ? blades[1] : blades[2]; g.fillRect(bx, by, 1, v < 0.4 ? 2 : 1); }
}
function prPaintCobble(g, x, y, c, r, cols) {
  g.fillStyle = cols[0]; g.fillRect(x, y, T, T);
  for (let k = 0; k < 4; k++) { const bx = x + (k % 2) * 8 + ((r % 2) * 4) % 8, by = y + Math.floor(k / 2) * 8; g.fillStyle = sgHash(c, r, k) < 0.5 ? cols[1] : cols[2]; g.fillRect(bx + 0.5, by + 0.5, 7, 7); g.fillStyle = cols[3]; g.fillRect(bx + 0.5, by + 0.5, 7, 1); }
}
function prPaintDirt(g, x, y, c, r, base, specks) {
  g.fillStyle = base; g.fillRect(x, y, T, T);
  for (let k = 0; k < 14; k++) { const v = sgHash(c, r, k + 9); g.fillStyle = specks[Math.floor(v * specks.length)]; g.fillRect(x + Math.floor(sgHash(c, r, k) * 16), y + Math.floor(sgHash(r, c, k) * 16), v < 0.6 ? 2 : 1, 1); }
}
const prEdgeShade = (g, m) => { const grd = g.createLinearGradient(0, 0, 0, 3 * T); grd.addColorStop(0, "rgba(0,0,0,0.5)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(0, T, m.W * T, 3 * T); };

const PR_THEMES = {
  // --- 1. Le château : une cour pavée entre quatre remparts, un donjon, une caserne ---
  chateau: {
    build(seed) {
      const rand = rng(seed || 7), W = SG.W, H = SG.H, cx = Math.floor(W / 2), cy = Math.floor(H / 2), g = prGrid(W, H);
      const x0 = cx - 13, x1 = cx + 13, y0 = cy - 9, y1 = cy + 9;
      for (let c = x0; c <= x1; c++) for (const r of [y0, y1]) if (Math.abs(c - cx) > 1) g[r][c] = "W";
      for (let r = y0; r <= y1; r++) for (const c of [x0, x1]) if (Math.abs(r - cy) > 1) g[r][c] = "W";
      for (const [c, r] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) for (const [dc, dr] of [[0, 0], [c === x0 ? 1 : -1, 0], [0, r === y0 ? 1 : -1], [c === x0 ? 1 : -1, r === y0 ? 1 : -1]]) g[r + dr][c + dc] = "W";
      const towers = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([c, r]) => ({ c: Math.min(c, c + (c === x0 ? 1 : -1)), r: Math.min(r, r + (r === y0 ? 1 : -1)) }));
      // le donjon (au nord-ouest) et la caserne (au nord-est), à l'écart des allées
      const keep = { c: x0 + 2, r: y0 + 2, w: 7, h: 4 }, barracks = { c: x1 - 7, r: y0 + 2, w: 5, h: 2 };
      for (const b of [keep, barracks]) for (let r = b.r; r < b.r + b.h; r++) for (let c = b.c; c < b.c + b.w; c++) g[r][c] = "H";
      // caisses et tonneaux dans la cour
      const crates = [];
      for (let k = 0; k < 40 && crates.length < 9; k++) {
        const c = x0 + 2 + Math.floor(rand() * 23), r = y0 + 2 + Math.floor(rand() * 15);
        if (Math.abs(c - cx) < 3 || Math.abs(r - cy) < 3 || g[r][c] !== "." || g[r][c + 1] !== "." || g[r + 1][c] !== ".") continue;
        g[r][c] = "B"; crates.push({ c, r, barrel: rand() < 0.5 });
      }
      // dehors : la plaine, quelques arbres et rochers, une route vers le sud
      for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
        if (c >= x0 - 3 && c <= x1 + 3 && r >= y0 - 3 && r <= y1 + 3) continue;
        if (Math.abs(c + 0.5 - cx - 0.5) < 3 || Math.abs(r + 0.5 - cy - 0.5) < 3) continue;
        if (rand() < 0.03) g[r][c] = rand() < 0.75 ? "T" : "R";
      }
      const inside = (x, y, mg) => x > x0 * T - mg && x < (x1 + 1) * T + mg && y > y0 * T - mg && y < (y1 + 1) * T + mg;
      const gates = [[(cx + 0.5) * T, (y0 + 0.5) * T], [(x1 + 0.5) * T, (cy + 0.5) * T], [(cx + 0.5) * T, (y1 + 0.5) * T], [(x0 + 0.5) * T, (cy + 0.5) * T]];
      const lights = [...gates.map(([x, y]) => ({ x, y: y - 10, r: 34, a: 0.6 })), { x: (keep.c + 2) * T, y: (keep.r + keep.h) * T - 8, r: 22, a: 0.5 }, { x: (keep.c + 5) * T, y: (keep.r + keep.h) * T - 8, r: 22, a: 0.5 }];
      return { g, W, H, houses: [], heart: { x: (cx + 0.5) * T, y: (cy + 0.5) * T }, ring: true, inside, gates, box: { x0, x1, y0, y1 }, keep, barracks, towers, crates, lights,
        heartName: "FLAMME DU CHATEAU", night: "rgba(12,10,30,0.5)" };
    },
    ground(m) {
      const cv2 = prCanvas(m), g = cv2.getContext("2d"); if (!g) return null;
      const { x0, x1, y0, y1 } = m.box, cx = Math.floor(m.W / 2), cy = Math.floor(m.H / 2);
      for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
        const x = c * T, y = r * T, t = m.g[r][c];
        if (t === "#") { g.fillStyle = "#141c10"; g.fillRect(x, y, T, T); continue; }
        if (c > x0 && c < x1 && r > y0 && r < y1) {
          // la cour : de gros pavés gris, une allée claire en croix
          const lane = Math.abs(c - cx) <= 1 || Math.abs(r - cy) <= 1;
          prPaintCobble(g, x, y, c, r, lane ? ["#6e6a62", "#7e786e", "#88827a", "#9a948a"] : ["#5a5852", "#66625a", "#6e6a60", "#7c776c"]);
          if (!lane && sgHash(c, r, 4) > 0.9) { g.fillStyle = "#3f5a2c"; g.fillRect(x + 7, y + 7, 2, 1); }
          continue;
        }
        const road = Math.abs(c - cx) <= 1 && r > y1;
        if (road || (Math.abs(c - cx) <= 1 && r < y0) || (Math.abs(r - cy) <= 1 && (c < x0 || c > x1))) { prPaintDirt(g, x, y, c, r, "#5c4e33", ["#655638", "#55472f", "#7d6a4a", "#4a3d28"]); continue; }
        prPaintGrass(g, x, y, c, r, "#34462b", "#1a2612", "#5a8248", ["#456238", "#2a3b21", "#3c5530"]);
      }
      // l'ombre des remparts sur l'herbe, au pied des murs
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect((x0 - 1) * T, (y1 + 1) * T, (x1 - x0 + 3) * T, 6);
      prEdgeShade(g, m);
      return cv2;
    },
    props(m) {
      const out = [], { x0, x1, y0, y1 } = m.box;
      const towerTile = (c, r) => m.towers.some(t => c >= t.c && c <= t.c + 1 && r >= t.r && r <= t.r + 1);
      for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
        const t = m.g[r][c];
        if (t === "W" && !towerTile(c, r)) out.push({ kind: "swall", x: c * T + 8, y: r * T + 15, v: sgHash(c, r, 7), side: r === y0 || r === y1 ? "h" : "v" });
        else if (t === "T") out.push({ kind: "tree", x: c * T + 8, y: r * T + 14, v: sgHash(c, r, 5) });
        else if (t === "R") out.push({ kind: "rock", x: c * T + 8, y: r * T + 13, v: sgHash(c, r, 6) });
      }
      for (const tw of m.towers) out.push({ kind: "tower", x: tw.c * T + T, y: (tw.r + 2) * T, v: sgHash(tw.c, tw.r) });
      out.push({ kind: "keep", x: m.keep.c * T, y: (m.keep.r + m.keep.h) * T, b: m.keep, v: 0.3 });
      out.push({ kind: "house", x: m.barracks.c * T, y: (m.barracks.r + m.barracks.h) * T, hs: m.barracks, v: 0.6 });
      for (const k of m.crates) out.push({ kind: k.barrel ? "barrel" : "crate", x: k.c * T + 8, y: k.r * T + 14, v: sgHash(k.c, k.r) });
      for (const [gx, gy] of m.gates) out.push({ kind: "torch", x: gx + (gx === m.heart.x ? 22 : 0), y: gy + (gy === m.heart.y ? 18 : 6), v: gx * 0.01 });
      return out;
    },
    heart(hx, hy, hit, k) {
      // la Flamme du château : un grand brasero de fer sur une estrade à trois marches
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(hx, hy + 7, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      for (const [w2, y2, col] of [[30, 6, "#4a4652"], [24, 2, "#5a5664"], [18, -2, "#6a6672"]]) { ctx.fillStyle = col; ctx.fillRect(hx - w2 / 2, hy + y2 - 3, w2, 4); ctx.fillStyle = "#7f7a8c"; ctx.fillRect(hx - w2 / 2, hy + y2 - 3, w2, 1); }
      ctx.fillStyle = "#2a2430"; ctx.fillRect(hx - 6, hy - 8, 12, 5); ctx.fillStyle = "#4a4250"; ctx.fillRect(hx - 7, hy - 9, 14, 2);
      prFlame(hx, hy - 9, hit, k, 1.2);
      // deux bannières rouges de part et d'autre
      for (const s2 of [-1, 1]) { const bx = hx + s2 * 19; ctx.fillStyle = "#3a2414"; ctx.fillRect(bx - 0.5, hy - 20, 1.5, 26); ctx.fillStyle = "#8a1a2a"; ctx.fillRect(bx + (s2 < 0 ? -6 : 1), hy - 19, 6, 9 + Math.sin(time * 2 + s2) * 0.8); ctx.fillStyle = "#f2b54a"; ctx.fillRect(bx + (s2 < 0 ? -4 : 3), hy - 16, 2, 2); }
    },
  },
  // --- 2. Le village (la carte du Siège libre) ---
  // --- 3. La forêt : une clairière, un feu de camp et des tentes ; pas de palissade, des arbres serrés ---
  foret: {
    build(seed) {
      const rand = rng(seed || 11), W = SG.W, H = SG.H, cx = W / 2, cy = H / 2, g = prGrid(W, H);
      // quatre sentiers sinueux qui mènent à la clairière (les monstres les empruntent)
      const path = (c, r) => {
        const dx = c + 0.5 - cx, dy = r + 0.5 - cy;
        const w1 = Math.abs(dy - Math.sin(dx * 0.22) * 2.2) < 1.6, w2 = Math.abs(dx - Math.sin(dy * 0.3) * 2) < 1.6;
        const w3 = Math.abs(dy - dx * 0.62 - Math.sin(dx * 0.2) * 1.5) < 1.3, w4 = Math.abs(dy + dx * 0.62 + Math.sin(dx * 0.25) * 1.5) < 1.3;
        return w1 || w2 || w3 || w4;
      };
      const tents = [];
      for (let k = 0; k < 30 && tents.length < 3; k++) {
        const a = rand() * Math.PI * 2, d = 4 + rand() * 1.5, c0 = Math.round(cx + Math.cos(a) * d - 1), r0 = Math.round(cy + Math.sin(a) * d / 1.15 - 1);
        if (Math.abs(c0 + 1 - cx) < 2.5 && Math.abs(r0 + 1 - cy) < 2.5) continue;
        let ok = true; for (let r = r0 - 1; r <= r0 + 2 && ok; r++) for (let c = c0 - 1; c <= c0 + 2 && ok; c++) if (g[r][c] !== "." || path(c, r)) ok = false;
        if (!ok) continue;
        for (let r = r0; r < r0 + 2; r++) for (let c = c0; c < c0 + 2; c++) g[r][c] = "H";
        tents.push({ c: c0, r: r0, v: rand() });
      }
      for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
        if (g[r][c] !== ".") continue;
        const d = Math.hypot(c + 0.5 - cx, (r + 0.5 - cy) * 1.15);
        if (d < 7.5 || path(c, r)) continue;
        const dens = d < 10 ? 0.05 : 0.08 + 0.05 * sgHash(Math.floor(c / 4), Math.floor(r / 4), 3);
        if (rand() < dens) g[r][c] = rand() < 0.55 ? "P" : rand() < 0.8 ? "T" : "R";
        else if (rand() < 0.012 && g[r][c + 1] === "." && !path(c + 1, r)) { g[r][c] = "L"; g[r][c + 1] = "L"; }
      }
      return { g, W, H, houses: [], tents, heart: { x: cx * T, y: cy * T }, ring: false, thick: true, path, heartName: "FEU DU CAMPEMENT", night: "rgba(4,10,16,0.62)",
        lights: tents.map(t => ({ x: (t.c + 1) * T, y: (t.r + 2) * T - 4, r: 16, a: 0.4 })) };
    },
    ground(m) {
      const cv2 = prCanvas(m), g = cv2.getContext("2d"); if (!g) return null;
      const cx = m.W / 2, cy = m.H / 2;
      for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
        const x = c * T, y = r * T, t = m.g[r][c], d = Math.hypot(c + 0.5 - cx, (r + 0.5 - cy) * 1.15);
        if (t === "#") { g.fillStyle = "#0c140c"; g.fillRect(x, y, T, T); continue; }
        if (d < 2.4) { prPaintDirt(g, x, y, c, r, "#4a3e2c", ["#55472f", "#3e3424", "#5c4e33", "#2e2618"]); continue; }
        if (m.path(c, r) || d < 7.5) { prPaintDirt(g, x, y, c, r, d < 7.5 ? "#3e4a2a" : "#4a4230", d < 7.5 ? ["#4a5a32", "#34401f", "#57663a", "#2c361c"] : ["#56492f", "#3e3424", "#5f5038", "#33402a"]); continue; }
        // sous-bois : mousse sombre, feuilles mortes, champignons
        prPaintGrass(g, x, y, c, r, "#22321e", "#0c140a", "#3a5a30", ["#2f4628", "#18241a", "#3a4a26"]);
        const n = sgHash(c, r, 21);
        if (n > 0.9) { g.fillStyle = ["#8a5a30", "#a86a2a", "#6a4a2a"][Math.floor(sgHash(r, c, 3) * 3)]; g.fillRect(x + 4, y + 9, 2, 1); g.fillRect(x + 11, y + 4, 1, 1); }
        if (n < 0.03) { g.fillStyle = "#e9e1cf"; g.fillRect(x + 6, y + 10, 1, 2); g.fillStyle = "#c4413b"; g.fillRect(x + 5, y + 9, 3, 1); }
      }
      prEdgeShade(g, m);
      return cv2;
    },
    props(m) {
      const out = [];
      for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
        const t = m.g[r][c];
        if (t === "P") out.push({ kind: "pine", x: c * T + 8, y: r * T + 15, v: sgHash(c, r, 5) });
        else if (t === "T") out.push({ kind: "tree", x: c * T + 8, y: r * T + 14, v: sgHash(c, r, 5) });
        else if (t === "R") out.push({ kind: "rock", x: c * T + 8, y: r * T + 13, v: sgHash(c, r, 6) });
        else if (t === "L" && m.g[r][c - 1] !== "L") out.push({ kind: "log", x: c * T + 16, y: r * T + 13, v: sgHash(c, r, 7) });
      }
      for (const tn of m.tents) out.push({ kind: "tent", x: tn.c * T + T, y: (tn.r + 2) * T, v: tn.v });
      return out;
    },
    heart(hx, hy, hit, k) {
      // le feu du campement : un cercle de pierres, des bûches croisées
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(hx, hy + 4, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ctx.fillStyle = i % 2 ? "#5a5664" : "#6a6672"; ctx.fillRect(hx + Math.cos(a) * 10 - 2, hy + Math.sin(a) * 5 - 1, 4, 3); }
      ctx.save(); ctx.translate(hx, hy); for (const a of [0.5, -0.5]) { ctx.save(); ctx.rotate(a); ctx.fillStyle = "#4a2e18"; ctx.fillRect(-8, -1.5, 16, 3); ctx.fillStyle = "#6a4426"; ctx.fillRect(-8, -1.5, 16, 1); ctx.restore(); } ctx.restore();
      prFlame(hx, hy - 1, hit, k, 1);
    },
  },
  // --- 4. Le vieux Puits : des ruines, des arbres morts, la lueur violette ---
  puits: {
    build(seed) {
      const rand = rng(seed || 13), W = SG.W, H = SG.H, cx = W / 2, cy = H / 2, g = prGrid(W, H);
      // le cercle du sanctuaire : des colonnes brisées, de grands trous entre elles
      const pillars = [];
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2 + 0.1; if (i % 4 === 0) continue;
        const c = Math.round(cx + Math.cos(a) * 9 - 0.5), r = Math.round(cy + Math.sin(a) * 9 / 1.15 - 0.5);
        if (g[r][c] === ".") { g[r][c] = "C"; pillars.push({ c, r, h: 0.4 + rand() * 0.6 }); }
      }
      // la margelle du puits est le « cœur » (on peut marcher autour)
      for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
        if (g[r][c] !== ".") continue;
        const d = Math.hypot(c + 0.5 - cx, (r + 0.5 - cy) * 1.15);
        if (d < 11.5 || Math.abs(c + 0.5 - cx) < 2 || Math.abs(r + 0.5 - cy) < 2) continue;
        const v = rand();
        if (v < 0.04) g[r][c] = "D"; else if (v < 0.065) g[r][c] = "R"; else if (v < 0.075) g[r][c] = "C";
      }
      const extra = [];
      for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (g[r][c] === "C" && !pillars.some(p => p.c === c && p.r === r)) extra.push({ c, r, h: 0.2 + rand() * 0.5 });
      return { g, W, H, houses: [], pillars: pillars.concat(extra), heart: { x: cx * T, y: cy * T }, ring: false, heartName: "SCEAU DU PUITS", night: "rgba(16,6,26,0.58)",
        lights: [] };
    },
    ground(m) {
      const cv2 = prCanvas(m), g = cv2.getContext("2d"); if (!g) return null;
      const cx = m.W / 2, cy = m.H / 2;
      for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
        const x = c * T, y = r * T, t = m.g[r][c], d = Math.hypot(c + 0.5 - cx, (r + 0.5 - cy) * 1.15);
        if (t === "#") { g.fillStyle = "#120c16"; g.fillRect(x, y, T, T); continue; }
        if (d < 9.6) {
          // le dallage du sanctuaire, fendu, avec des veines violettes vers le centre
          prPaintCobble(g, x, y, c, r, ["#3e3844", "#4a4450", "#524a58", "#5e5666"]);
          if (sgHash(c, r, 8) > 0.82) { g.fillStyle = "rgba(170,100,230,0.55)"; g.fillRect(x + Math.floor(sgHash(c, r, 9) * 12), y + 7, 4, 1); }
          continue;
        }
        // la lande morte : cendre, herbe sèche, fissures luisantes
        prPaintGrass(g, x, y, c, r, "#2e2a24", "#14100c", "#4a4436", ["#4a4232", "#1e1a14", "#3a3428"]);
        if (sgHash(c, r, 14) > 0.95) { g.fillStyle = "rgba(160,90,220,0.45)"; g.fillRect(x + 3, y + 8, 6, 1); g.fillRect(x + 8, y + 7, 1, 1); }
      }
      // les rayons violets qui partent du Puits
      g.globalAlpha = 0.18; g.strokeStyle = "#a86ae0"; g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; g.beginPath(); g.moveTo(m.heart.x, m.heart.y); g.lineTo(m.heart.x + Math.cos(a) * 9 * T, m.heart.y + Math.sin(a) * 7.5 * T); g.stroke(); }
      g.globalAlpha = 1; g.lineWidth = 1;
      prEdgeShade(g, m);
      return cv2;
    },
    props(m) {
      const out = [];
      for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
        const t = m.g[r][c];
        if (t === "D") out.push({ kind: "deadtree", x: c * T + 8, y: r * T + 15, v: sgHash(c, r, 5) });
        else if (t === "R") out.push({ kind: "rock", x: c * T + 8, y: r * T + 13, v: sgHash(c, r, 6) });
      }
      for (const p of m.pillars) out.push({ kind: "pillar", x: p.c * T + 8, y: p.r * T + 15, h: p.h, v: sgHash(p.c, p.r, 4) });
      return out;
    },
    heart(hx, hy, hit, k) {
      // le vieux Puits : une margelle de pierre, un trou noir qui luit, la braise posée sur le Sceau
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(hx, hy + 6, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3e3a46"; ctx.beginPath(); ctx.ellipse(hx, hy + 1, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5a5664"; ctx.beginPath(); ctx.ellipse(hx, hy - 1, 15, 7.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#08040e"; ctx.beginPath(); ctx.ellipse(hx, hy - 1, 10.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      const glow = 0.35 + 0.25 * Math.sin(time * 2.2);
      ctx.fillStyle = `rgba(160,90,230,${glow})`; ctx.beginPath(); ctx.ellipse(hx, hy - 1, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.fillStyle = i % 2 ? "#6a6672" : "#77738a"; ctx.fillRect(hx + Math.cos(a) * 13 - 1.5, hy - 1 + Math.sin(a) * 6.3 - 1, 3, 2); }
      // les volutes qui montent du Puits
      for (let j = 0; j < 5; j++) { const ph = (time * 0.5 + j / 5) % 1; ctx.fillStyle = `rgba(170,110,230,${0.4 * (1 - ph)})`; ctx.fillRect(hx - 6 + j * 3 + Math.sin(ph * 6 + j) * 2, hy - 3 - ph * 26, 2, 2); }
      // le Sceau et sa braise, sur une pierre au bord
      ctx.fillStyle = "#4a4652"; ctx.fillRect(hx + 9, hy - 9, 8, 5); ctx.fillStyle = "#c8a83a"; ctx.fillRect(hx + 10, hy - 9, 6, 1);
      prFlame(hx + 13, hy - 10, hit, k, 0.7);
    },
  },
};
// une flamme qui danse (cœurs de chapitre)
function prFlame(x, y, hit, k, sc) {
  for (let j = 0; j < 7; j++) { const ph = (time * 1.6 + j / 7) % 1, fx = x + Math.sin(j * 2.3 + time * 3) * (4 - ph * 3) * sc, fy = y - ph * 16 * sc; ctx.fillStyle = hit ? "#ffffff" : ph < 0.35 ? "#fff3b8" : ph < 0.7 ? "#f2b54a" : "#e8613a"; const sz = ((1 - ph) * 4.5 + 1) * sc; ctx.fillRect(fx - sz / 2, fy - sz / 2, sz, sz); }
  ctx.fillStyle = hit ? "#ffffff" : "#e8913a"; ctx.fillRect(x - 3.5 * sc, y - (8 + k * 2) * sc, 7 * sc, (6 + k * 2) * sc);
  ctx.fillStyle = "#f2d45a"; ctx.fillRect(x - 2 * sc, y - (6 + k * 2) * sc, 4 * sc, (4 + k * 2) * sc);
}
// les éléments du décor propres au prélude (dessin et encombrement)
const prShadow = (x, y, w, h) => { ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); };
const PR_PROPS = {
  swall: {
    box: o => [o.x - 8, o.y - 26, o.x + 8, o.y],
    draw(o, x, y) {
      // un pan de rempart : pierres, créneaux en haut
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x - 8, y - 1, 17, 4);
      ctx.fillStyle = "#4a4652"; ctx.fillRect(x - 8, y - 22, 16, 22);
      for (let rr = 0; rr < 5; rr++) for (let cc = 0; cc < 2; cc++) { ctx.fillStyle = sgHash(Math.floor(o.x), rr * 3 + cc, 2) < 0.5 ? "#5a5664" : "#625e6e"; ctx.fillRect(x - 8 + cc * 8 + (rr % 2) * 4 - (rr % 2 && cc ? 8 : 0), y - 21 + rr * 4.2, 7, 3.5); }
      ctx.fillStyle = "#6a6672"; ctx.fillRect(x - 8, y - 24, 4, 3); ctx.fillRect(x - 1, y - 24, 4, 3); ctx.fillRect(x + 5, y - 24, 3, 3);
      ctx.fillStyle = "#8a8698"; ctx.fillRect(x - 8, y - 24, 4, 1); ctx.fillRect(x - 1, y - 24, 4, 1); ctx.fillRect(x + 5, y - 24, 3, 1);
      if (o.v > 0.86) { ctx.fillStyle = "#3f5a2c"; ctx.fillRect(x - 6, y - 6, 3, 4); }
    },
  },
  tower: {
    box: o => [o.x - 17, o.y - 44, o.x + 17, o.y],
    draw(o, x, y) {
      prShadow(x, y, 18, 4);
      ctx.fillStyle = "#3e3a46"; ctx.fillRect(x - 15, y - 34, 30, 34);
      ctx.fillStyle = "#4e4a58"; ctx.fillRect(x - 15, y - 34, 12, 34);
      for (let rr = 0; rr < 8; rr++) { ctx.fillStyle = "#34303c"; ctx.fillRect(x - 15, y - 33 + rr * 4.2, 30, 0.7); }
      ctx.fillStyle = "#5a5664"; ctx.fillRect(x - 17, y - 38, 34, 4);
      for (let k = 0; k < 5; k++) { ctx.fillStyle = "#6a6672"; ctx.fillRect(x - 17 + k * 7.5, y - 42, 4, 4); ctx.fillStyle = "#8a8698"; ctx.fillRect(x - 17 + k * 7.5, y - 42, 4, 1); }
      ctx.fillStyle = "#1a1418"; ctx.fillRect(x - 1.5, y - 26, 3, 7);
      const fl = 0.6 + 0.4 * Math.sin(time * 5 + o.v * 7); ctx.fillStyle = `rgba(242,180,80,${fl})`; ctx.fillRect(x - 1, y - 25, 2, 5);
      // une bannière au sommet
      ctx.fillStyle = "#3a2414"; ctx.fillRect(x - 0.5, y - 54, 1, 13); ctx.fillStyle = "#8a1a2a"; ctx.fillRect(x + 0.5, y - 53, 7 + Math.sin(time * 3 + o.v * 5), 4);
    },
  },
  keep: {
    box: o => [o.x - 2, o.y - o.b.h * T - 22, o.x + o.b.w * T + 2, o.y],
    draw(o, x, y) {
      const w = o.b.w * T, hh = o.b.h * T + 18;
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + 3, y - 2, w + 2, 5);
      ctx.fillStyle = "#3e3a46"; ctx.fillRect(x, y - hh, w, hh);
      ctx.fillStyle = "#4e4a58"; ctx.fillRect(x, y - hh, w, 3);
      for (let rr = 0; rr < hh; rr += 4.5) { ctx.fillStyle = "#34303c"; ctx.fillRect(x, y - hh + rr, w, 0.7); }
      for (let k = 0; k < w / 8; k++) { ctx.fillStyle = "#5a5664"; ctx.fillRect(x + k * 8, y - hh - 4, 5, 4); ctx.fillStyle = "#77738a"; ctx.fillRect(x + k * 8, y - hh - 4, 5, 1); }
      // la grande porte et les fenêtres éclairées
      ctx.fillStyle = "#24161a"; ctx.fillRect(x + w / 2 - 5, y - 13, 10, 13); ctx.fillStyle = "#4a2e18"; ctx.fillRect(x + w / 2 - 4, y - 12, 8, 12); ctx.fillStyle = "#2a1a10"; ctx.fillRect(x + w / 2 - 0.5, y - 12, 1, 12);
      const fl = 0.8 + 0.2 * Math.sin(time * 6);
      for (const wx of [x + 10, x + w - 14]) { ctx.fillStyle = `rgba(242,${170 + 30 * fl | 0},80,1)`; ctx.fillRect(wx, y - hh + 10, 4, 6); ctx.fillStyle = "#24161a"; ctx.fillRect(wx + 1.5, y - hh + 10, 1, 6); }
      ctx.fillStyle = "#8a1a2a"; ctx.fillRect(x + w / 2 - 4, y - hh + 4, 8, 12); ctx.fillStyle = "#f2b54a"; ctx.fillRect(x + w / 2 - 1, y - hh + 8, 2, 3);
    },
  },
  crate: {
    box: o => [o.x - 7, o.y - 12, o.x + 7, o.y],
    draw(o, x, y) { prShadow(x, y, 8, 2.5); ctx.fillStyle = "#6a4a2a"; ctx.fillRect(x - 6, y - 11, 12, 11); ctx.fillStyle = "#8a6438"; ctx.fillRect(x - 6, y - 11, 12, 2); ctx.fillStyle = "#4a3018"; ctx.fillRect(x - 6, y - 6, 12, 1); ctx.fillRect(x - 0.5, y - 11, 1, 11); },
  },
  barrel: {
    box: o => [o.x - 6, o.y - 12, o.x + 6, o.y],
    draw(o, x, y) { prShadow(x, y, 7, 2.5); ctx.fillStyle = "#5a3a20"; ctx.fillRect(x - 5, y - 11, 10, 11); ctx.fillStyle = "#7a5230"; ctx.fillRect(x - 4, y - 11, 4, 11); ctx.fillStyle = "#3a3a42"; ctx.fillRect(x - 5, y - 9, 10, 1); ctx.fillRect(x - 5, y - 3, 10, 1); ctx.fillStyle = "#8a6438"; ctx.fillRect(x - 5, y - 12, 10, 1.5); },
  },
  torch: {
    box: o => [o.x - 2, o.y - 14, o.x + 2, o.y],
    draw(o, x, y) { ctx.fillStyle = "#3a2414"; ctx.fillRect(x - 0.75, y - 10, 1.5, 10); prFlame(x, y - 10, false, 0.5 + 0.5 * Math.sin(time * 6 + o.v), 0.45); },
  },
  pine: {
    box: o => [o.x - 9, o.y - 36, o.x + 9, o.y],
    draw(o, x, y) {
      prShadow(x, y, 9, 3);
      ctx.fillStyle = "#3a2414"; ctx.fillRect(x - 1, y - 6, 2, 6);
      const sway = Math.sin(time * 1.1 + o.v * 6) * 0.5, big = 0.9 + o.v * 0.3;
      for (const [w2, top, col] of [[9, 14, "#14241a"], [7.5, 22, "#1c3022"], [6, 29, "#24402a"], [4, 35, "#2e5034"]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w2 * big + sway, y - top * big + 10 * big); ctx.lineTo(x + w2 * big + sway, y - top * big + 10 * big); ctx.lineTo(x + sway * 1.5, y - top * big - 2); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "rgba(160,200,170,0.15)"; ctx.fillRect(x - 3 + sway, y - 28 * big, 2, 6);
    },
  },
  log: {
    box: o => [o.x - 15, o.y - 8, o.x + 15, o.y],
    draw(o, x, y) { prShadow(x, y, 15, 2.5); ctx.fillStyle = "#4a2e18"; ctx.fillRect(x - 14, y - 7, 28, 6); ctx.fillStyle = "#6a4426"; ctx.fillRect(x - 14, y - 7, 28, 2); ctx.fillStyle = "#8a6a48"; ctx.fillRect(x - 15, y - 7, 3, 6); ctx.fillStyle = "#5a3a20"; ctx.fillRect(x - 14.5, y - 5, 1.5, 2); ctx.fillStyle = "#3f5a2c"; ctx.fillRect(x + 4, y - 8, 5, 1.5); },
  },
  tent: {
    box: o => [o.x - 16, o.y - 22, o.x + 16, o.y],
    draw(o, x, y) {
      prShadow(x, y, 17, 3.5);
      const col = o.v > 0.5 ? ["#7a6a48", "#9a8a62", "#5a4a30"] : ["#6a4a3a", "#8a6450", "#4a3024"];
      ctx.fillStyle = col[0]; ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x, y - 21); ctx.lineTo(x + 15, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col[1]; ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x, y - 21); ctx.lineTo(x - 2, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col[2]; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 1, y - 10); ctx.lineTo(x + 5, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a2414"; ctx.fillRect(x - 0.5, y - 24, 1, 4);
    },
  },
  deadtree: {
    box: o => [o.x - 10, o.y - 30, o.x + 10, o.y],
    draw(o, x, y) {
      prShadow(x, y, 7, 2.5);
      ctx.strokeStyle = "#2a2028"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 20); ctx.stroke();
      ctx.lineWidth = 1.5;
      const s2 = o.v > 0.5 ? 1 : -1;
      for (const [x1, y1, x2, y2] of [[x + 1, y - 14, x + 8 * s2, y - 22], [x + 1, y - 18, x - 6 * s2, y - 27], [x + 4 * s2, y - 18, x + 9 * s2, y - 17], [x + 1, y - 20, x + 2, y - 29]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#3a2e38"; ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x, y - 19); ctx.stroke();
    },
  },
  pillar: {
    box: o => [o.x - 6, o.y - 8 - 26 * o.h, o.x + 6, o.y],
    draw(o, x, y) {
      prShadow(x, y, 7, 2.5);
      const hh = 8 + 26 * o.h;
      ctx.fillStyle = "#4a4652"; ctx.fillRect(x - 5, y - hh, 10, hh); ctx.fillStyle = "#5e5a6a"; ctx.fillRect(x - 5, y - hh, 4, hh);
      ctx.fillStyle = "#34303c"; for (let k = 2; k < 10; k += 3) ctx.fillRect(x - 5 + k, y - hh + 2, 0.7, hh - 3);
      ctx.fillStyle = "#6a6672"; ctx.fillRect(x - 6, y - 3, 12, 3);
      // le sommet brisé
      ctx.fillStyle = "#5e5a6a"; ctx.beginPath(); ctx.moveTo(x - 5, y - hh); ctx.lineTo(x - 2, y - hh - 3 - o.v * 3); ctx.lineTo(x + 1, y - hh - 1); ctx.lineTo(x + 5, y - hh - 4 * o.v); ctx.lineTo(x + 5, y - hh); ctx.closePath(); ctx.fill();
      if (o.v > 0.7) { ctx.fillStyle = "rgba(170,110,230,0.6)"; ctx.fillRect(x - 1, y - hh * 0.6, 2, 2); }
    },
  },
};

// ===== Branchements =====
(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  // la fin (cinématique), puis l'enchaînement butin → texte
  around("siegeUpdate", (o, dt, ...a) => {
    if (siege && siege.ending) { prEndingUpdate(dt); return; }
    const r = o(dt, ...a);
    prTick();
    return r;
  });
  // pas de pause pendant un texte ou la fin
  around("openPause", (o, ...a) => { if (siege && (siege.story || siege.ending)) return; return o(...a); });
  around("menuAction", (o, act, ...a) => {
    if (act && act.startsWith("sgMode:")) { sgMode = act.slice(7); try { localStorage.setItem("lepuits.siege.mode", sgMode); } catch (e) {} renderSiegeLobby(); return; }
    if (act === "prToggleResume") { prResume = !prResume; renderSiegeLobby(); return; }
    if (act === "prNext") { prNext(); return; }
    if (act === "prJump") { prJump(); return; }
    if (act === "prRetry") { prRetry(); return; }
    if (siege && siege.story && act === "back") return;                 // Échap ne saute pas l'histoire
    if (sgMode === "prelude" && !sgLobbyState && (act === "sgSolo" || act === "sgLocal")) {
      if (act === "sgSolo") { prStart([{ src: "auto", name: pvpPseudo || "Toi" }], { resume: prResume }); return; }
      const pads = sgPads().length;
      if (!pads) { toast("Branche une manette pour le joueur 2 (le joueur 1 joue au clavier et à la souris).", 3000); return; }
      prStart(pads >= 2 ? [{ src: "pad:0", name: "Joueur 1" }, { src: "pad:1", name: "Joueur 2" }] : [{ src: "kbm", name: "Joueur 1" }, { src: "pad:0", name: "Joueur 2" }], { resume: prResume });
      return;
    }
    return o(act, ...a);
  });
  // un invité qui rejoint une partie du prélude : il prend l'état de l'hôte
  around("siegeStart", (o, opts = {}, ...a) => {
    const r = o(opts, ...a);
    if (siege && siege.camp && !siege.host) { siege.dw = PR_CHAPTERS[siege.camp.ch || 0].dw0; }
    return r;
  });
})();
