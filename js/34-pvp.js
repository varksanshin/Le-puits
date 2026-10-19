"use strict";
// ---------- 34. Duel en ligne (PvP 1v1) ----------
/* Le déroulé d'un duel :
   1. on choisit un pseudo (une fois) ;
   2. « Partie rapide » cherche un adversaire en ligne, ou « Salon privé » donne un code à partager (DUEL-XXXX) ;
   3. le DRAFT : cinq fois, on choisit un objet parmi trois tirés au hasard (20 s par choix) ;
   4. le COMBAT : les deux héros, avec tous les pouvoirs et leurs 5 objets, dans l'arène. Manches de 90 s,
      le premier à 2 manches gagne. Pas de pause en duel (Échap deux fois = abandonner) ;
   5. le CLASSEMENT : un score Elo (1000 au départ) qui monte ou baisse selon le résultat.
   Réseau : Supabase Realtime (canaux « broadcast » et « presence »), chargé seulement quand on ouvre le mode.
   Chaque joueur décide de ses propres coups : quand MON coup touche l'autre, j'envoie les dégâts, et c'est lui qui
   retire ses PV (et il ignore le coup s'il était invulnérable : esquive, dash, phase).
   Le 2v2 viendra ensuite (même principe, deux équipes). */

const PVP = {
  version: 1, picks: 5, offers: 3, pickTime: 20, rounds: 2, roundTime: 90, hpPerHeart: 10, dmgScale: 6, sendHz: 15,
  phase: "off", me: null, opp: null, match: null, seed: 0, host: false, draft: null, myItems: [], oppItems: null,
  score: [0, 0], round: 0, roundT: 0, countdown: 0, over: 0, hp: 0, maxHp: 0, chan: null, queue: null, status: "",
  prev: null, rival: null, lastSend: 0, lastSeen: 0, escT: 0, result: null,
};
// Objets qui n'ont pas de sens en duel (butin, exploration, ténèbres…)
const PVP_BAN = new Set(["lapin", "trousseau", "bourse", "aimant", "sceau", "carte", "boussole", "fer", "tirelire", "sel", "couronne", "avarice",
  "oeil", "de", "eaubenite", "lanterne", "sablier", "miroir", "phenix", "affamee", "epines"]);
const pvpPool = () => ITEMS.filter(it => !it.soon && !PVP_BAN.has(it.id));
let pvpPseudo = null;
try { pvpPseudo = localStorage.getItem("lepuits.pseudo"); } catch (e) {}

// ----- Le réseau (Supabase Realtime) ; remplaçable pour les tests -----
globalThis.PVP_NET = globalThis.PVP_NET || {
  client: null,
  async ready() {
    if (this.client) return true;
    if (typeof supabase === "undefined" || !supabase.createClient) {
      await new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "js/vendor/supabase.js"; s.onload = ok; s.onerror = () => ko(new Error("bibliothèque introuvable")); document.head.appendChild(s); });
    }
    this.client = supabase.createClient(ONLINE.url, ONLINE.key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 40 } } });
    return true;
  },
  // join(topic, { key, events: [..], onMsg(ev, payload), onSync(members) }) → { send, track, untrack, members, leave }
  async join(topic, o) {
    await this.ready();
    const ch = this.client.channel(topic, { config: { broadcast: { self: false }, presence: { key: o.key } } });
    for (const ev of o.events || []) ch.on("broadcast", { event: ev }, m => o.onMsg && o.onMsg(ev, m.payload));
    const members = () => Object.values(ch.presenceState()).map(list => list[0]).filter(Boolean);
    ch.on("presence", { event: "sync" }, () => o.onSync && o.onSync(members()));
    await new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new Error("délai dépassé")), 10000);
      ch.subscribe(st => { if (st === "SUBSCRIBED") { clearTimeout(t); ok(); } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") { clearTimeout(t); ko(new Error(st)); } });
    });
    return {
      send: (ev, payload) => ch.send({ type: "broadcast", event: ev, payload }),
      track: obj => ch.track(obj), untrack: () => ch.untrack(), members,
      leave: () => { try { this.client.removeChannel(ch); } catch (e) {} },
    };
  },
};
const pvpRpc = (fn, args) => cloudRpc(fn, args);
const pvpId = n => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ----- Pseudo et profil -----
async function pvpProfile() {
  await cloudEnsure();
  const rows = await pvpRpc("pvp_me", { p_secret: CLOUD.secret });
  if (rows && rows[0]) { PVP.me = rows[0]; pvpPseudo = rows[0].pseudo; try { localStorage.setItem("lepuits.pseudo", pvpPseudo); } catch (e) {} }
  else PVP.me = null;
  return PVP.me;
}
async function pvpSetPseudo(name) {
  name = String(name || "").trim();
  if (!/^[A-Za-z0-9_\-àâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ]{3,16}$/.test(name)) { toast("Pseudo : 3 à 16 caractères, lettres, chiffres, - et _.", 2800); return false; }
  try {
    await cloudEnsure();
    const rows = await pvpRpc("pvp_set_pseudo", { p_secret: CLOUD.secret, p_pseudo: name });
    PVP.me = { ...(PVP.me || {}), ...rows[0] }; pvpPseudo = PVP.me.pseudo;
    try { localStorage.setItem("lepuits.pseudo", pvpPseudo); } catch (e) {}
    toast(`Tu t'appelles maintenant <b>${pvpPseudo}</b>.`, 2200, true);
    return true;
  } catch (e) {
    toast(/pris/.test(e.message) ? "Ce pseudo est déjà pris." : /invalide/.test(e.message) ? "Pseudo refusé : 3 à 16 caractères, lettres, chiffres, - et _." : "Impossible de joindre le serveur.", 2600);
    return false;
  }
}

// ----- Trouver un adversaire -----
async function pvpSearch(room) {
  if (!PVP.me) { toast("Choisis d'abord un pseudo.", 2000); return; }
  pvpLeaveAll();
  PVP.phase = "search"; PVP.room = room || null;
  PVP.status = room ? `Salon ${room} : en attente d'un adversaire… Donne-lui ce code.` : "Recherche d'un adversaire…";
  renderPvp();
  const me = PVP.me, since = Date.now();
  try {
    PVP.queue = await PVP_NET.join(room ? `pvp:room:${room}` : "pvp:queue", {
      key: me.pid, events: ["invite", "accept"],
      onSync: members => pvpPair(members),
      onMsg: (ev, m) => {
        if (PVP.phase !== "search" || !m || m.to !== me.pid) return;
        if (ev === "invite") { PVP.queue.send("accept", { to: m.from, match: m.match }); pvpStartMatch(m.match, m.seed, m.fromInfo, false); }
        if (ev === "accept" && PVP.inviting && PVP.inviting.match === m.match) pvpStartMatch(m.match, PVP.inviting.seed, PVP.inviting.opp, true);
      },
    });
    await PVP.queue.track({ pid: me.pid, pseudo: me.pseudo, rating: me.rating, since, v: PVP.version });
  } catch (e) { PVP.phase = "lobby"; PVP.status = "Connexion impossible (" + e.message + ")."; renderPvp(); }
}
function pvpPair(members) {
  if (PVP.phase !== "search" || !PVP.queue) return;
  const me = PVP.me;
  const list = members.filter(m => m && m.v === PVP.version).sort((a, b) => a.since - b.since || (a.pid < b.pid ? -1 : 1));
  PVP.status = PVP.room ? (list.length < 2 ? `Salon ${PVP.room} : en attente d'un adversaire… Donne-lui ce code.` : "Adversaire trouvé…")
    : list.length < 2 ? "Recherche d'un adversaire… (personne d'autre en ligne pour l'instant)" : `${list.length - 1} joueur${list.length > 2 ? "s" : ""} en attente…`;
  renderPvp();
  const i = list.findIndex(m => m.pid === me.pid);
  if (i < 0) return;
  const j = i % 2 === 0 ? i + 1 : i - 1, other = list[j];
  if (!other) return;
  if (me.pid < other.pid && (!PVP.inviting || Date.now() - PVP.inviting.at > 5000)) {
    const match = "m-" + pvpId(10), seed = Math.floor(Math.random() * 1e9);
    PVP.inviting = { match, seed, opp: other, at: Date.now() };
    PVP.queue.send("invite", { to: other.pid, from: me.pid, match, seed, fromInfo: { pid: me.pid, pseudo: me.pseudo, rating: me.rating } });
  }
}
function pvpLeaveAll() {
  if (PVP.queue) { try { PVP.queue.untrack(); } catch (e) {} PVP.queue.leave(); PVP.queue = null; }
  if (PVP.chan) { PVP.chan.leave(); PVP.chan = null; }
  PVP.inviting = null;
}

// ----- Le match -----
async function pvpStartMatch(matchId, seed, opp, host) {
  if (PVP.phase !== "search") return;
  if (PVP.queue) { try { PVP.queue.untrack(); } catch (e) {} PVP.queue.leave(); PVP.queue = null; }
  Object.assign(PVP, { phase: "connect", match: matchId, seed, opp: { ...opp }, host, myItems: [], oppItems: null, score: [0, 0], round: 0, result: null, oppReady: false, lastSeen: Date.now() });
  PVP.status = `Adversaire : ${opp.pseudo} (${opp.rating}). Connexion…`; renderPvp();
  try {
    PVP.chan = await PVP_NET.join(`pvp:m:${matchId}`, {
      key: PVP.me.pid, events: ["hello", "hb", "draft", "go", "st", "dmg", "ko", "bye"],
      onMsg: pvpOnMsg, onSync: members => { if (PVP.phase === "fight" && members.length < 2 && Date.now() - PVP.lastSeen > 4000) pvpForfeit(); },
    });
    await PVP.chan.track({ pid: PVP.me.pid });
  } catch (e) { PVP.phase = "lobby"; PVP.status = "Le match n'a pas pu démarrer."; renderPvp(); return; }
  pvpRpc("pvp_start", { p_secret: CLOUD.secret, p_match: matchId, p_opponent: opp.pid }).catch(() => {});
  PVP.helloT = 0; pvpHello();
  pvpStartDraft();
}
function pvpHello() { if (PVP.chan) PVP.chan.send("hello", { pid: PVP.me.pid, pseudo: PVP.me.pseudo, rating: PVP.me.rating }); }
function pvpOnMsg(ev, m) {
  PVP.lastSeen = Date.now();
  if (ev === "hello") { if (!PVP.oppHello) { PVP.oppHello = true; pvpHello(); } return; }
  if (ev === "draft") { PVP.oppItems = m.items; if (PVP.phase === "wait") pvpMaybeGo(); renderPvp(); return; }
  if (ev === "go") { pvpBeginFight(m.items); return; }
  if (ev === "st") { PVP.oppState = m; PVP.oppStateAt = Date.now(); return; }
  if (ev === "dmg") { if (m.r === PVP.round) pvpTakeHit(m); return; }
  if (ev === "ko") {
    if (m.round !== PVP.round || PVP.phase !== "fight") return;
    if (m.loser == null) { PVP.roundT = 20; toast("Égalité : 20 secondes de plus !", 1800); return; }
    pvpRoundOver(m.loser === PVP.me.pid ? 1 : 0); return;
  }
  if (ev === "bye") { if (PVP.phase === "fight" || PVP.phase === "draft" || PVP.phase === "wait") pvpForfeit(); }
}

// ----- Le draft, directement dans l'arène -----
/* Trois piédestaux apparaissent près de toi : marche sur un objet pour le prendre (ou attends : au bout de 20 s,
   le jeu choisit pour toi). Cinq fois de suite. Une ligne en bas de l'écran montre tes 5 emplacements.
   Pendant le draft, on voit l'adversaire bouger, mais personne ne peut toucher personne. */
function pvpStartDraft() {
  const rand = rng((PVP.seed ^ hashStr(PVP.me.pid)) >>> 0 || 1);
  const pool = pvpPool(), offers = [];
  const used = new Set();
  for (let r = 0; r < PVP.picks; r++) {
    const left = pool.filter(it => !used.has(it.id)), o = [];
    while (o.length < PVP.offers && left.length) { const k = Math.floor(rand() * left.length); o.push(left.splice(k, 1)[0].id); }
    o.forEach(id => used.add(id)); offers.push(o);
  }
  PVP.draft = { offers, step: 0, t: PVP.pickTime };
  PVP.myItems = [];
  pvpEnterArena();
  PVP.phase = "draft";
  pvpPlacePeds();
  toast(`Arène : <b>${PVP.arenaName}</b>. Marche sur un objet pour le prendre.`, 3200, true);
}
// Trois piédestaux sur le sol, de ton côté de l'arène
function pvpPlacePeds() {
  const d = PVP.draft; if (!d || d.step >= PVP.picks) { PVP.peds = []; return; }
  const [sc] = PVP.spawns[PVP.host ? 0 : 1], dir = PVP.host ? 1 : -1;
  PVP.peds = d.offers[d.step].map((id, i) => {
    const c = sc + dir * (3 + i * 3), r = pvpFloorRow(c);
    burst(c * T + 8, r * T + 6, 14, "#f2d45a", 80);
    return { id, x: c * T + 2, y: r * T + 4, w: 12, h: 12, rest: 0, near: false, t: i };
  });
}
// La case libre posée sur le sol d'une colonne (en partant du haut)
function pvpFloorRow(c) {
  for (let r = 1; r < MH - 1; r++) if (tile(c, r) === "." && tile(c, r - 1) === "." && (solid(tile(c, r + 1)) || tile(c, r + 1) === "-") && tile(c, r + 1) !== "-") return r;
  for (let r = 1; r < MH - 1; r++) if (tile(c, r) === "." && solid(tile(c, r + 1))) return r;
  return MH - 3;
}
function pvpPick(id) {
  if (PVP.phase !== "draft") return;
  const d = PVP.draft, offer = d.offers[d.step];
  if (!offer.includes(id)) return;
  PVP.myItems.push(id); d.step++; d.t = PVP.pickTime;
  if (ITEM[id]) { items.add(id); computeStats(); renderItems(); }
  const ped = (PVP.peds || []).find(o => o.id === id);
  if (ped) burst(ped.x + 6, ped.y, 26, "#f2d45a", 120);
  if (typeof SFX !== "undefined") SFX.play("item");
  if (ITEM[id]) toast(`<b>${ITEM[id].name}</b><br><i>${ITEM[id].desc}</i>`, 2600, true);
  if (d.step >= PVP.picks) {
    PVP.peds = [];
    PVP.phase = "wait"; PVP.chan && PVP.chan.send("draft", { items: PVP.myItems });
    pvpMaybeGo();
  } else pvpPlacePeds();
}
function pvpMaybeGo() {
  if (PVP.phase !== "wait" || !PVP.oppItems) return;
  if (PVP.host) { PVP.chan.send("go", { items: PVP.myItems }); pvpBeginFight(PVP.oppItems); }
}
function renderDraft() {}
function pvpUpdateDraft(dt) {
  const d = PVP.draft, p = player;
  if (!d || PVP.phase !== "draft") return;
  d.t -= dt;
  if (d.t <= 0) { pvpPick(pick(d.offers[d.step])); return; }
  for (const o of PVP.peds || []) {
    o.t += dt;
    const near = Math.abs(p.x + p.w / 2 - o.x - 6) < 26 && Math.abs(p.y + p.h - o.y - 12) < 22;
    if (near && !o.near && ITEM[o.id]) toast(`<b>${ITEM[o.id].name}</b> : ${ITEM[o.id].desc}<br><small>Reste dessus pour le prendre.</small>`, 3000, true);
    o.near = near;
    if (overlap(p, o) && p.onGround) { o.rest += dt; if (o.rest > 0.35) { pvpPick(o.id); return; } } else o.rest = 0;
  }
}

// ----- Les arènes : plusieurs cartes, tirées au sort pour chaque match (la même pour les deux joueurs) -----
/* Chaque arène est décrite pour sa moitié gauche (26 colonnes), puis recopiée en miroir : le combat est toujours équitable.
   « - » = planche (on passe à travers par en dessous), bloc = roche. Le sol est en bas (rangées 18 et 19). */
const PVP_ARENAS = [
  { name: "La Fosse", biome: "antre", planks: [[6, 12, 13], [20, 25, 10], [3, 7, 7], [22, 25, 5]], blocks: [[16, 17, 15, 17]] },
  { name: "Les Piliers", biome: "mines", planks: [[2, 8, 12], [11, 18, 8], [21, 25, 14], [16, 25, 4]], blocks: [[9, 10, 9, 17], [19, 20, 12, 17]] },
  { name: "La Tour", biome: "entree", planks: [[3, 9, 14], [12, 18, 11], [4, 10, 8], [14, 25, 6], [18, 25, 15], [1, 4, 4]], blocks: [] },
  { name: "Les Ruines", biome: "spores", planks: [[8, 13, 11], [18, 25, 10], [2, 6, 7], [15, 20, 5]], blocks: [[1, 6, 16, 17], [12, 15, 16, 17], [22, 25, 15, 17]] },
  { name: "La Grotte noyée", biome: "noyee", planks: [[2, 8, 13], [13, 20, 13], [4, 9, 9], [18, 25, 8]], blocks: [[10, 15, 1, 5], [24, 25, 1, 7], [17, 18, 16, 17]] },
];
function pvpArena(seed) {
  const A = PVP_ARENAS[(seed >>> 0) % PVP_ARENAS.length], W = 52, H = 20, half = W / 2;
  const g = Array.from({ length: H }, (_, r) => Array.from({ length: half }, (_, c) => (r === 0 || r >= H - 2 || c === 0) ? "#" : "."));
  for (const [c0, c1, r] of A.planks) for (let c = c0; c <= c1; c++) if (g[r][c] === ".") g[r][c] = "-";
  for (const [c0, c1, r0, r1] of A.blocks) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = "#";
  const rows = g.map(r => r.join("") + [...r].reverse().join(""));
  return { v: 1, base: "pvp-arene", name: A.name, w: W, h: H, rows, ents: [{ t: "spawn", x: 4, y: H - 3 }], biomes: [{ x: 0, y: 0, w: W, h: H, id: A.biome }] };
}
function pvpEnterArena() {
  if (!PVP.saved) PVP.saved = { level, gameMode, metaOff: meta.off };
  level = pvpArena(PVP.seed); gameMode = "pvp"; PVP.arenaName = level.name;
  meta.off = true;
  try { resetRun(); } finally { meta.off = PVP.saved.metaOff; }
  for (const s of SKILLS) grantSkill(s.id);
  items = new Set(); computeStats(); renderItems();
  dark = 10; darkLocked = true; darkShown = -1; renderDark();
  PVP.spawns = [4, MW - 5].map(c => [c, pvpFloorRow(c)]);
  PVP.round = 0; PVP.score = [0, 0]; PVP.lastSeen = Date.now(); PVP.countdown = 0; PVP.over = 0;
  pvpPlaceFighters();
  closeMenu(); document.body.classList.add("pvp-on");
}
function pvpPlaceFighters() {
  const side = PVP.host ? 0 : 1, [c, r] = PVP.spawns[side], [oc, or] = PVP.spawns[1 - side];
  enemies = []; projectiles = []; shots = []; hazards = [];
  const p = player;
  p.x = c * T + 3; p.y = (r + 1) * T - p.h; p.vx = p.vy = 0; p.prevX = p.x; p.prevY = p.y; p.face = side ? -1 : 1;
  p.dead = false; p.invuln = 0; p.dashTimer = 0; p.diving = false; p.grapple = null; p.phasing = false;
  PVP.maxHp = stats.maxHp * PVP.hpPerHeart; PVP.hp = PVP.maxHp; PVP.shield = has("bouclier");
  p.hp = stats.maxHp;                                         // les cœurs suivent les PV du duel (Fiole de berserker…)
  const e = makeEnemy({ type: "rival", cx: oc, cy: or });
  e.rival = true; e.scaled = true; e.hp = 1e9; e.damage = 0; e.dir = side ? 1 : -1;
  enemies.push(e); PVP.rival = e; PVP.oppState = null;
  cam.x = p.x - VW / 2; cam.y = p.y - VH / 2;
}
function pvpBeginFight(oppItems) {
  if (PVP.phase === "fight") return;
  PVP.oppItems = oppItems;
  if (gameMode !== "pvp") pvpEnterArena();                 // (au cas où le draft n'est pas passé par l'arène)
  for (const id of PVP.myItems) if (ITEM[id]) items.add(id);
  computeStats(); renderItems();
  PVP.phase = "fight"; PVP.round = 0; PVP.score = [0, 0]; PVP.lastSeen = Date.now(); PVP.peds = [];
  pvpStartRound();
  toast(`Build de ${PVP.opp.pseudo} : ${(oppItems || []).map(id => ITEM[id] ? ITEM[id].name : id).join(", ")}`, 4000, true);
}
function pvpStartRound() {
  PVP.round++;
  pvpPlaceFighters();
  PVP.countdown = 3; PVP.roundT = PVP.roundTime; PVP.over = 0;
  renderHearts();
}
function pvpTakeHit(m) {
  const p = player;
  if (PVP.phase !== "fight" || PVP.countdown > 0 || PVP.over > 0 || p.invuln > 0 || p.phasing || (p.dashTimer > 0 && (has("voile") || has("lamevent")))) return;
  if (PVP.shield) {                                          // Bouclier de lumière : un coup bloqué par manche
    PVP.shield = false; p.invuln = 0.5; burst(p.x + p.w / 2, p.y + p.h / 2, 16, "#fff6c8", 90); popText(p.x + p.w / 2, p.y - 4, "BLOQUE", "#fff6c8"); return;
  }
  const d = Math.max(1, Math.round((+m.d || 0) * PVP.dmgScale));
  PVP.hp = Math.max(0, PVP.hp - d);
  p.hp = Math.max(1, Math.ceil(PVP.hp / PVP.hpPerHeart));
  const dir = Math.sign(m.dir) || -p.face, kt = stats.knockTaken;
  p.vx = dir * 170 * kt; p.vy = m.down ? 120 : m.up ? -280 : -200 * Math.max(0.5, kt); p.hurt = 0.2 * Math.max(0.4, kt);
  p.invuln = 0.35; p.jumping = false; p.dashTimer = 0; p.charge = 0; p.chargeArmed = false; p.grapple = null;
  freeze = Math.max(freeze, 0.06); shake(2, 0.12);
  burst(p.x + p.w / 2, p.y + p.h / 2, 12, "#c4413b", 100);
  popText(p.x + p.w / 2, p.y - 4, "-" + d, "#ff8a80");
  if (typeof SFX !== "undefined") SFX.play("hurt");
  if (PVP.hp <= 0) { PVP.chan.send("ko", { round: PVP.round, loser: PVP.me.pid }); pvpRoundOver(1); }
}
// loser : 1 = c'est moi qui ai perdu la manche, 0 = l'adversaire
function pvpRoundOver(loser) {
  if (PVP.over > 0) return;
  PVP.score[loser ? 1 : 0]++;
  PVP.over = 2.6;
  const won = !loser;
  toast(won ? "Manche gagnée !" : "Manche perdue…", 2000);
  if (typeof SFX !== "undefined") SFX.play(won ? "miniBeat" : "death");
  if (PVP.score[0] >= PVP.rounds || PVP.score[1] >= PVP.rounds) PVP.final = true;
}
function pvpForfeit() {
  if (PVP.phase === "result" || PVP.phase === "off" || PVP.phase === "lobby") return;
  toast(`${PVP.opp ? PVP.opp.pseudo : "Ton adversaire"} a quitté le duel. Victoire par abandon.`, 3000);
  pvpFinish(true, true);
}
async function pvpFinish(won, forfeit) {
  PVP.phase = "result"; PVP.final = false;
  PVP.result = { won, forfeit, rating: null, delta: null };
  pvpExitArena();
  openTitle(); showPanel("pvp"); renderPvp();
  try {
    const rows = await pvpRpc("pvp_report", { p_secret: CLOUD.secret, p_match: PVP.match, p_winner: won ? PVP.me.pid : PVP.opp.pid, p_forfeit: !!forfeit });
    if (rows && rows[0]) { PVP.result.rating = rows[0].rating; PVP.result.delta = rows[0].delta; PVP.me.rating = rows[0].rating; PVP.me.wins = rows[0].wins; PVP.me.losses = rows[0].losses; }
  } catch (e) {}
  if (PVP.chan) { PVP.chan.leave(); PVP.chan = null; }
  renderPvp();
}
function pvpAbandon() {
  if (PVP.chan) PVP.chan.send("bye", {});
  if (PVP.phase === "fight" || PVP.phase === "draft" || PVP.phase === "wait") pvpFinish(false, false);
  else { pvpLeaveAll(); PVP.phase = "lobby"; renderPvp(); }
}
function pvpExitArena() {
  if (PVP.saved) { level = PVP.saved.level; gameMode = PVP.saved.gameMode; PVP.saved = null; darkLocked = false; }
  enemies = []; PVP.rival = null;
  if (screen === "play") { screen = "title"; menuRoot = "main"; }
}

// ----- À chaque image du duel -----
function pvpUpdate(dt) {
  if (PVP.phase === "draft") pvpUpdateDraft(dt);
  // un petit signe de vie pendant le draft, et l'abandon si l'autre a disparu
  if ((PVP.phase === "draft" || PVP.phase === "wait") && PVP.chan) {
    PVP.hbT = (PVP.hbT || 0) - dt;
    if (PVP.hbT <= 0) { PVP.hbT = 3; PVP.chan.send("hb", {}); }
    if (Date.now() - PVP.lastSeen > 20000) { pvpForfeit(); return; }
  }
  if (PVP.phase !== "fight" && PVP.phase !== "draft" && PVP.phase !== "wait") return;
  if (PVP.phase !== "fight") { pvpSendState(); PVP.escT = Math.max(0, PVP.escT - dt); return; }
  if (PVP.countdown > 0) PVP.countdown -= dt;
  else if (PVP.over > 0) {
    PVP.over -= dt;
    if (PVP.over <= 0) { if (PVP.final) pvpFinish(PVP.score[0] > PVP.score[1], false); else pvpStartRound(); return; }
  } else {
    PVP.roundT -= dt;
    if (PVP.roundT <= 0 && PVP.host) {
      // temps écoulé : le plus de PV (en %) gagne ; égalité → 20 s de plus. C'est l'hôte qui tranche, pour les deux.
      const mine = PVP.hp / PVP.maxHp, theirs = PVP.oppState ? PVP.oppState.hp / Math.max(1, PVP.oppState.mx) : 1;
      if (Math.abs(mine - theirs) < 0.001) { PVP.roundT = 20; PVP.chan.send("ko", { round: PVP.round, loser: null }); toast("Égalité : 20 secondes de plus !", 1800); }
      else { const loser = mine < theirs ? PVP.me.pid : PVP.opp.pid; PVP.chan.send("ko", { round: PVP.round, loser }); pvpRoundOver(loser === PVP.me.pid ? 1 : 0); }
    }
  }
  pvpSendState();
  // l'adversaire quitte sans prévenir
  if (Date.now() - PVP.lastSeen > 12000) pvpForfeit();
  PVP.escT = Math.max(0, PVP.escT - dt);
}
// envoyer mon état (position, attaque, PV), 15 fois par seconde
function pvpSendState() {
  const p = player, now = Date.now();
  if (!p || !PVP.chan || now - PVP.lastSend < 1000 / PVP.sendHz) return;
  PVP.lastSend = now;
  PVP.chan.send("st", { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, vx: Math.round(p.vx), vy: Math.round(p.vy), f: p.face, g: p.onGround ? 1 : 0,
    a: p.atkTimer > 0 ? p.atkDir : 0, ch: p.charge > 0.2 ? 1 : 0, d: p.dashTimer > 0 ? 1 : 0, ph: p.phasing ? 1 : 0, dv: p.diving ? 1 : 0, hp: PVP.hp, mx: PVP.maxHp, r: PVP.round });
}

// La ligne des 5 objets en bas de l'écran (et ceux de l'adversaire pendant le combat)
function pvpDrawSlots() {
  const row = (ids, x0, label, col, n) => {
    ctx.fillStyle = "rgba(10,8,14,0.7)"; ctx.fillRect(x0 - 3, VH - 22, n * 15 + 4, 18);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 15, y = VH - 20, id = ids[i];
      ctx.fillStyle = id ? "rgba(242,212,90,0.14)" : "rgba(233,225,207,0.06)"; ctx.fillRect(x, y, 13, 14);
      ctx.strokeStyle = id ? col : "rgba(233,225,207,0.22)"; ctx.lineWidth = 0.67; ctx.strokeRect(x + 0.33, y + 0.33, 12.33, 13.33);
      if (id && ITEM[id]) drawItemIcon(id, x + 2.5, y + 2);
    }
    if (label) drawTinyText(x0 + n * 7.5 - 1, VH - 29, label, col);
  };
  row(PVP.myItems, 8, "TON BUILD", "#f2d45a", PVP.picks);
  if (PVP.phase === "fight" && PVP.oppItems) row(PVP.oppItems, VW - 8 - PVP.picks * 15 + 1, (PVP.opp.pseudo || "").slice(0, 12).toUpperCase(), "#9fd0ff", PVP.picks);
}
(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  // Le rival : un « monstre » piloté par le réseau, que tous nos coups peuvent toucher
  ENEMY_TYPES.rival = { w: 10, h: 14, hp: 1e9, speed: 0, weight: 0, damage: 0, name: "Rival", fly: true };
  for (const [k, src] of [["rival0", "hero_idle0"], ["rival1", "hero_run0"], ["rival2", "hero_run2"], ["rival_jump", "hero_jump"], ["rival_fall", "hero_fall"]]) if (SPRITES[src]) SPRITES[k] = SPRITES[src];
  SPRITE_PAL.rival = { h: "#1e3a5a", H: "#12243a", r: "#3a6ea8", R: "#24466e", b: "#7fd6c0", B: "#2a3440", l: "#1c2430" };
  ENEMY_AI.rival = (e, dt) => {
    const s = PVP.oppState;
    if (!s || s.r !== PVP.round) return;
    const k = Math.min(1, dt * 18), lead = Math.min(0.12, (Date.now() - PVP.oppStateAt) / 1000);
    const tx = s.x + s.vx * lead, ty = s.y + s.vy * lead * 0.5;
    if (Math.abs(tx - e.x) > 64 || Math.abs(ty - e.y) > 64) { e.x = tx; e.y = ty; } else { e.x += (tx - e.x) * k; e.y += (ty - e.y) * k; }
    e.vx = s.vx; e.vy = s.vy; e.dir = s.f; e.onGround = !!s.g; e.atk = s.a; e.phasing = !!s.ph;
    e.hidden = !!s.ph;
  };
  around("enemyFrame", (o, e) => {
    if (e.type !== "rival") return o(e);
    if (!e.onGround) return e.vy < -20 ? "rival_jump" : "rival_fall";
    return Math.abs(e.vx) > 15 ? (Math.floor(time * 10) % 2 ? "rival1" : "rival2") : "rival0";
  });
  // Mes coups sur le rival : j'envoie les dégâts, c'est lui qui retire ses PV
  around("hitEnemy", (o, e, dmg, dirX, opt = {}, ...a) => {
    if (!e || !e.rival) return o(e, dmg, dirX, opt, ...a);
    if (PVP.phase !== "fight" || PVP.countdown > 0 || PVP.over > 0 || e.hidden) return;
    PVP.chan && PVP.chan.send("dmg", { d: Math.round(dmg * 100) / 100, dir: dirX || Math.sign(e.x - player.x) || 1, up: !!opt.up, down: !!opt.down, r: PVP.round });
    e.flash = 0.12; e.hitFx = 0.16;
    if (typeof hitSparks === "function" && opt.freeze !== 0) hitSparks(e, dirX, opt);
    freeze = Math.max(freeze, opt.freeze ?? 0.05);
    burst(e.x + e.w / 2, e.y + e.h / 2, 6, "#e9e1cf", 90);
  });
  around("hurtPlayer", (o, src, ...a) => { if (src && src.rival) return; return o(src, ...a); });
  around("updateBestiary", (o, ...a) => { if (gameMode === "pvp") return; return o(...a); });
  around("showBiomeTitle", (o, ...a) => { if (gameMode === "pvp") return; return o(...a); });
  // le HUD habituel (lumière, pièces, carte…) laisse la place aux barres du duel
  around("closeMenu", (o, ...a) => { const r = o(...a); document.body.classList.toggle("pvp-on", gameMode === "pvp"); return r; });
  around("openTitle", (o, ...a) => { document.body.classList.remove("pvp-on"); return o(...a); });
  around("renderHearts", (o, ...a) => { if (gameMode === "pvp") { if (typeof heartsEl !== "undefined") heartsEl.innerHTML = ""; return; } return o(...a); });
  around("saveGame", (o, quiet, ...a) => { if (gameMode === "pvp") return false; return o(quiet, ...a); });
  around("endRun", (o, ...a) => { if (gameMode === "pvp") return; return o(...a); });
  // Pas de pause en duel : Échap deux fois de suite = abandonner
  around("openPause", (o, ...a) => {
    if (gameMode !== "pvp") return o(...a);
    if (PVP.escT > 0) { pvpAbandon(); return; }
    PVP.escT = 2; toast("Pas de pause en duel. Appuie encore pour abandonner.", 1800);
  });
  // Pendant le compte à rebours et entre les manches, on ne bouge pas
  around("readInput", (o, ...a) => {
    const r = o(...a);
    if (gameMode === "pvp" && (PVP.countdown > 0 || PVP.over > 0)) Object.assign(input, { x: 0, up: false, down: false, jump: false, attack: false, jumpPressed: false, attackPressed: false, dashPressed: false, boltPressed: false, grapplePressed: false, phasePressed: false });
    return r;
  });
  around("updateWorld", (o, dt, ...a) => { const r = o(dt, ...a); if (gameMode === "pvp") pvpUpdate(dt); return r; });
  // le draft et l'attente tournent aussi dans les menus
  let lastT = 0;
  around("pollMenuPad", (o, ...a) => {
    const r = o(...a), now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0; lastT = now;
    if (gameMode !== "pvp" && PVP.phase !== "off") pvpUpdate(dt);
    return r;
  });

  // ----- L'affichage du duel -----
  around("draw", (o, a, ...rest) => {
    const r = o(a, ...rest);
    if (gameMode !== "pvp" || !["draft", "wait", "fight"].includes(PVP.phase)) return r;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const e = PVP.rival, ox = snap(cam.x), oy = snap(cam.y);
    // les piédestaux du draft
    for (const o2 of PVP.peds || []) {
      const x = snap(o2.x - ox), y = snap(o2.y - oy), bob = Math.sin(o2.t * 2.4) * 1.5;
      ctx.fillStyle = "rgba(242,212,90,0.18)"; ctx.fillRect(x - 3, y - 10, 18, 22);
      ctx.fillStyle = "#3a3440"; ctx.fillRect(x - 1, y + 7, 14, 5);
      ctx.fillStyle = "#6a6270"; ctx.fillRect(x, y + 7, 12, 1.33); ctx.fillRect(x + 2, y + 9, 8, 3);
      drawItemIcon(o2.id, x + 2, snap(y - 6 + bob));
      if (o2.rest > 0) { ctx.fillStyle = "#f2d45a"; ctx.fillRect(x, y + 13, 12 * Math.min(1, o2.rest / 0.35), 1.34); }
    }
    pvpDrawSlots();
    if (PVP.phase !== "fight") {
      const msg = PVP.phase === "draft" ? `CHOIX ${PVP.draft.step + 1} SUR ${PVP.picks}  -  ${Math.max(0, Math.ceil(PVP.draft.t))} S` : `PRET - ON ATTEND ${PVP.opp.pseudo}`;
      drawTinyText(VW / 2, 8, msg.slice(0, 40), "#f2d45a");
      if (e && !e.hidden) { const q = at(e, a); drawTinyText(q.x - ox + e.w / 2, q.y - oy - 16, PVP.opp.pseudo.slice(0, 12), "#9fd0ff"); }
      return r;
    }
    // le nom et la barre de vie au-dessus du rival
    if (e && !e.hidden) {
      const q = at(e, a), x = q.x - ox + e.w / 2, y = q.y - oy - 9;
      drawTinyText(x, y - 7, PVP.opp.pseudo.slice(0, 12), "#9fd0ff");
      if (e.atk) { ctx.fillStyle = "rgba(200,225,255,0.55)"; const f = e.dir || 1; ctx.fillRect(x + f * 6 - (f < 0 ? 14 : 0), q.y - oy + 1, 14, 10); }
    }
    // les deux barres de vie en haut
    const bar = (x, w, frac, col, name, right, wins) => {
      ctx.fillStyle = "rgba(10,8,14,0.75)"; ctx.fillRect(x - 1, 5, w + 2, 7);
      ctx.fillStyle = "#3a2a2a"; ctx.fillRect(x, 6, w, 5);
      ctx.fillStyle = col; const fw = Math.max(0, w * frac); ctx.fillRect(right ? x + w - fw : x, 6, fw, 5);
      drawTinyText(right ? x + w - name.length * 2 : x + name.length * 2, 14, name, "#e9e1cf");
      for (let i = 0; i < PVP.rounds; i++) { ctx.fillStyle = i < wins ? "#f2d45a" : "rgba(233,225,207,0.25)"; ctx.fillRect(right ? x - 6 - i * 4 : x + w + 3 + i * 4, 7, 3, 3); }
    };
    const os = PVP.oppState;
    bar(8, 110, PVP.hp / PVP.maxHp, "#e0453c", (pvpPseudo || "Toi").slice(0, 12), false, PVP.score[0]);
    bar(VW - 118, 110, os ? os.hp / Math.max(1, os.mx) : 1, "#5aa0e0", PVP.opp.pseudo.slice(0, 12), true, PVP.score[1]);
    drawTinyText(VW / 2, 6, String(Math.max(0, Math.ceil(PVP.roundT))), "#e9e1cf");
    if (PVP.countdown > 0) {
      const n = Math.ceil(PVP.countdown);
      ctx.font = "bold 28px serif"; ctx.textAlign = "center"; ctx.fillStyle = "#f2d45a";
      ctx.fillText(n > 0 ? String(n) : "", VW / 2, VH / 2);
      ctx.font = "8px serif"; ctx.fillStyle = "#e9e1cf"; ctx.fillText(`Manche ${PVP.round}`, VW / 2, VH / 2 + 14); ctx.textAlign = "left";
    } else if (PVP.countdown > -0.8 && PVP.over <= 0 && PVP.roundT > PVP.roundTime - 0.8) {
      ctx.font = "bold 22px serif"; ctx.textAlign = "center"; ctx.fillStyle = "#f2d45a"; ctx.fillText("COMBAT !", VW / 2, VH / 2); ctx.textAlign = "left";
    }
    return r;
  });

  // ----- Les menus -----
  around("showPanel", (o, name, ...a) => {
    const r = o(name, ...a);
    if (name === "pvp") { renderPvp(); if (!PVP.me && PVP.phase === "off") { PVP.phase = "lobby"; pvpProfile().then(renderPvp, () => { PVP.status = "Hors ligne : le duel demande une connexion."; renderPvp(); }); } }
    if (name === "pvpRank") renderRank();
    return r;
  });
  around("menuAction", (o, act, ...a) => {
    if (act === "pvp") { if (PVP.phase === "off" || PVP.phase === "result") PVP.phase = "lobby"; showPanel("pvp"); return; }
    if (act === "pvpPseudo") { const inp = document.getElementById("pvpPseudoInput"); pvpSetPseudo(inp ? inp.value : "").then(renderPvp); return; }
    if (act === "pvpQuick") { pvpSearch(null); return; }
    if (act === "pvpRoom") { pvpSearch("DUEL-" + pvpId(4)); return; }
    if (act === "pvpJoin") { const inp = document.getElementById("pvpRoomInput"), v = (inp ? inp.value : "").toUpperCase().replace(/\s+/g, ""); if (!/^DUEL-[A-Z0-9]{4}$/.test(v)) { toast("Le code ressemble à DUEL-XXXX.", 2000); return; } pvpSearch(v); return; }
    if (act === "pvpCancel") { pvpLeaveAll(); PVP.phase = "lobby"; PVP.status = ""; renderPvp(); return; }
    if (act === "pvpRank") { showPanel("pvpRank"); return; }
    if (act === "pvpAgain") { PVP.phase = "lobby"; PVP.result = null; pvpSearch(null); return; }
    if (act && act.startsWith("pvpPick:")) { pvpPick(act.slice(8)); return; }
    if (act === "back" && (menuPanel === "pvp") && (PVP.phase === "search" || PVP.phase === "connect")) { pvpLeaveAll(); PVP.phase = "lobby"; }
    if (act === "back" && menuPanel === "pvpDraft") { pvpAbandon(); showPanel("pvp"); return; }
    return o(act, ...a);
  });
  try { addEventListener("pagehide", () => { if (PVP.chan) PVP.chan.send("bye", {}); }); } catch (e) {}
})();

function renderPvp() {
  const el = document.getElementById("pvpPanel"); if (!el) return;
  const me = PVP.me, R = PVP.result;
  let body = "";
  if (PVP.phase === "result" && R) {
    body = `<div class="pvp-result ${R.won ? "win" : "lose"}"><b>${R.won ? "Victoire" : "Défaite"}</b>
        <span>${R.forfeit ? "par abandon" : `${PVP.score[0]} – ${PVP.score[1]}`} contre ${PVP.opp ? PVP.opp.pseudo : "?"}</span>
        <span>${R.rating != null ? `Classement : ${R.rating} (${R.delta >= 0 ? "+" : ""}${R.delta})` : "Classement en cours de mise à jour…"}</span></div>
      <nav class="menu-list"><button class="mi" data-act="pvpAgain">Rejouer</button><button class="mi" data-act="pvpRank">Classement</button><button class="mi" data-act="back">Retour</button></nav>`;
  } else if (!me) {
    body = `<p class="pvp-help">Choisis un pseudo pour jouer en ligne et apparaître au classement.</p>
      <div class="sync-link"><input id="pvpPseudoInput" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Ton pseudo" value="${(pvpPseudo || "").replace(/"/g, "")}" aria-label="Pseudo"></div>
      <p class="pvp-status">${PVP.status || ""}</p>
      <nav class="menu-list"><button class="mi" data-act="pvpPseudo">Valider le pseudo</button><button class="mi" data-act="pvpRank">Classement</button><button class="mi" data-act="back">Retour</button></nav>`;
  } else if (PVP.phase === "search" || PVP.phase === "connect") {
    body = `<p class="pvp-me"><b>${me.pseudo}</b> · ${me.rating}</p>
      ${PVP.room ? `<p class="sync-code"><small>Code du salon</small><b>${PVP.room}</b></p>` : ""}
      <p class="pvp-status searching">${PVP.status}</p>
      <nav class="menu-list"><button class="mi" data-act="pvpCancel">Annuler</button></nav>`;
  } else {
    body = `<p class="pvp-me"><b>${me.pseudo}</b> · ${me.rating} <span>${me.wins || 0} V · ${me.losses || 0} D</span></p>
      <p class="pvp-help">Draft de 5 objets (un parmi trois à chaque fois), puis duel avec tous les pouvoirs. Deux manches gagnantes.</p>
      <p class="pvp-status">${PVP.status || ""}</p>
      <nav class="menu-list">
        <button class="mi" data-act="pvpQuick">Partie rapide · 1 contre 1<small>contre un joueur en ligne</small></button>
        <button class="mi" data-act="pvpRoom">Créer un salon privé<small>donne le code à un ami</small></button>
        <div class="sync-link"><input id="pvpRoomInput" type="text" maxlength="9" autocomplete="off" spellcheck="false" placeholder="DUEL-XXXX" aria-label="Code d'un salon"></div>
        <button class="mi" data-act="pvpJoin">Rejoindre un salon</button>
        <button class="mi" disabled>2 contre 2<small>bientôt</small></button>
        <button class="mi" data-act="pvpRank">Classement</button>
        <div class="sync-link"><input id="pvpPseudoInput" type="text" maxlength="16" autocomplete="off" spellcheck="false" value="${me.pseudo}" aria-label="Pseudo"></div>
        <button class="mi" data-act="pvpPseudo">Changer de pseudo</button>
        <button class="mi" data-act="back">Retour</button>
      </nav>`;
  }
  el.innerHTML = `<div><span class="kicker">En ligne</span><div class="big small">Duel</div></div>${body}`;
  for (const inp of el.querySelectorAll("input")) for (const ev of ["keydown", "keyup", "keypress"]) inp.addEventListener(ev, e => {
    e.stopPropagation();
    if (ev === "keydown" && e.key === "Enter") menuAction(inp.id === "pvpRoomInput" ? "pvpJoin" : "pvpPseudo");
  });
}
async function renderRank() {
  const el = document.getElementById("pvpRankPanel"); if (!el) return;
  el.innerHTML = `<div><span class="kicker">Duel en ligne</span><div class="big small">Classement</div></div><p class="pvp-status">Chargement…</p><nav class="menu-list"><button class="mi" data-act="back">Retour</button></nav>`;
  try {
    const rows = await pvpRpc("pvp_leaderboard", { p_limit: 50 });
    const me = PVP.me && PVP.me.pseudo;
    const list = (rows || []).map(r => `<tr class="${r.pseudo === me ? "me" : ""}"><td>${r.rank}</td><td>${r.pseudo}</td><td>${r.rating}</td><td>${r.wins} – ${r.losses}</td></tr>`).join("");
    el.innerHTML = `<div><span class="kicker">Duel en ligne</span><div class="big small">Classement</div></div>
      ${list ? `<table class="pvp-rank"><thead><tr><th>#</th><th>Joueur</th><th>Score</th><th>V – D</th></tr></thead><tbody>${list}</tbody></table>` : `<p class="pvp-help">Personne n'a encore joué de duel. À toi l'honneur !</p>`}
      <nav class="menu-list"><button class="mi" data-act="back">Retour</button></nav>`;
  } catch (e) {
    el.querySelector(".pvp-status").textContent = "Classement indisponible (hors ligne).";
  }
}
