"use strict";
// ---------- 27. Bestiaire : nouveaux monstres et carnet des créatures ----------
/* Quatre nouvelles créatures :
     champi     Champignon sauteur (profondeurs) : il se ramasse, puis bondit vers toi
     squelette  Prisonnier squelette (mines, antre) : il garde ses distances et lance des os en cloche
     rodeur     Rôdeur d'ombre (antre) : presque invisible dans le noir, il frémit puis bondit. Plus de ténèbres = plus rapide
     mimic      Mimique : un coffre qui dort… jusqu'à ce que tu t'approches
   Le carnet retient chaque créature vue et le nombre de victoires (gardé d'une partie à l'autre). */
Object.assign(ENEMY_TYPES, {
  champi:    { w: 12, h: 10, hp: 3, speed: 0,  weight: 0.9, damage: 1, name: "Champignon sauteur" },
  squelette: { w: 8,  h: 14, hp: 4, speed: 24, weight: 0.8, damage: 1, name: "Prisonnier squelette" },
  rodeur:    { w: 14, h: 7,  hp: 3, speed: 30, weight: 0.9, damage: 1, name: "Rôdeur d'ombre" },
  mimic:     { w: 14, h: 10, hp: 6, speed: 0,  weight: 0.5, damage: 1, name: "Mimique" },
});
const BESTIARY_INFO = {
  crawler:   { where: "Partout", text: "Une larve aveugle qui fait des allers-retours. Elle fait demi-tour au bord du vide." },
  bat:       { where: "Entrée, mines, profondeurs", text: "Elle frémit en blanc avant de plonger sur toi. Recule quand elle frémit, frappe quand elle arrive." },
  spitter:   { where: "Profondeurs, antre", text: "Une plante enracinée qui crache de l'acide en cloche. L'épée renvoie ses crachats." },
  golem:     { where: "Mines, antre", text: "Lent, mais il charge tête baissée quand il te voit à sa hauteur. S'il percute un mur, il reste sonné." },
  wisp:      { where: "Zone noyée, profondeurs", text: "Un feu follet qui traverse les murs et explose à ton contact." },
  champi:    { where: "Profondeurs", text: "Il se ramasse sur lui-même, puis bondit vers toi. Frappe-le pendant qu'il atterrit." },
  squelette: { where: "Mines, antre", text: "Un ancien prisonnier du roi. Il garde ses distances et te lance ses os." },
  rodeur:    { where: "Antre", text: "On ne voit que ses yeux. Plus les ténèbres montent, plus il bondit vite." },
  mimic:     { where: "N'importe où", text: "Un coffre un peu trop rond. Il dort jusqu'à ce que tu t'approches, puis il mord. Riche butin." },
  boss:      { where: "Le fond du puits", text: "Le Gardien. Ses attaques changent selon tes ténèbres : enragé si ton âme est pure, il dévore si tu as sombré." },
};
const BESTIARY_ORDER = ["crawler", "bat", "spitter", "golem", "wisp", "champi", "squelette", "rodeur", "mimic", "boss"];
// ----- Intelligence des nouveaux monstres -----
function edgeAhead(e) {
  const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
  const ground = tile(Math.floor(fx / T), Math.floor((e.y + e.h + 1) / T));
  const wall = tile(Math.floor(fx / T), Math.floor((e.y + e.h - 1) / T));
  return solidFor(e, wall) || wall === "^" || (!solid(ground) && ground !== "-");
}
function hopper(e, dt, p, o) {
  e.vy = Math.min(e.vy + 1100 * dt, 430);
  const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h) - (e.y + e.h);
  if (e.onGround) {
    e.vx = approach(e.vx, 0, 600 * dt);
    if (e.state === "air") { e.state = "idle"; e.cooldown = o.rest; dust(e.x + e.w / 2, e.y + e.h, 3); }
    if (e.state === "crouch") {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = "air"; e.vy = -o.jump; e.vx = e.dir * o.run; }
    } else if (e.daze <= 0 && e.stun <= 0 && e.cooldown <= 0 && !p.dead && Math.abs(dx) < o.range && Math.abs(dy) < 70) {
      e.dir = Math.sign(dx) || e.dir; e.state = "crouch"; e.stateT = o.crouch;
    }
  }
  e.hitWall = false;
  moveX(e, e.vx * dt);
  if (e.hitWall) e.vx = 0;
  moveY(e, e.vy * dt);
}
const ENEMY_AI = {
  champi(e, dt, p) { hopper(e, dt, p, { jump: 250, run: 80, range: 110, crouch: 0.4, rest: 0.8 }); },
  mimic(e, dt, p) {
    if (e.state === "sleep" || e.state === "walk") {
      e.state = "sleep"; e.daze = Math.max(e.daze, 0.1);                 // endormi : il ne mord pas
      e.vy = Math.min(e.vy + 1100 * dt, 430); moveY(e, e.vy * dt);
      const d = Math.hypot((p.x + p.w / 2) - (e.x + e.w / 2), (p.y + p.h) - (e.y + e.h));
      if ((d < 30 && !p.dead) || e.hp < ENEMY_TYPES.mimic.hp * (has("couronne") ? 1.5 : 1)) {
        e.state = "idle"; e.daze = 0; e.cooldown = 0.25; shake(2, 0.15);
        burst(e.x + e.w / 2, e.y, 12, "#f2d45a", 80);
        toast("Ce coffre a des dents !", 1600);
      }
      return;
    }
    hopper(e, dt, p, { jump: 210, run: 110, range: 160, crouch: 0.22, rest: 0.35 });
  },
  squelette(e, dt, p) {
    e.vy = Math.min(e.vy + 1500 * dt, 430);
    const ex = e.x + e.w / 2, px = p.x + p.w / 2, dx = px - ex, dy = (p.y + p.h / 2) - (e.y + 4);
    const sees = !p.dead && Math.abs(dx) < 160 && Math.abs(dy) < 90 && lineClear(ex, e.y + 3, px, p.y + 6);
    e.shootCd -= dt;
    if (e.state === "throw") {
      e.vx = approach(e.vx, 0, 400 * dt); e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = "walk"; e.shootCd = 2.1;
        const tt = Math.max(0.5, Math.min(1.1, Math.abs(dx) / 110)), g = 480;
        shots.push({ kind: "bone", x: ex - 3, y: e.y, w: 6, h: 6, vx: dx / tt, vy: (dy - 0.5 * g * tt * tt) / tt, grav: g, life: 3, spin: 0 });
      }
    } else if (e.daze > 0 || e.stun > 0) e.vx = approach(e.vx, 0, 500 * dt);
    else {
      let want = e.dir;
      if (sees) {
        e.dir = Math.sign(dx) || e.dir;
        want = Math.abs(dx) < 56 ? -e.dir : Math.abs(dx) > 110 ? e.dir : 0;       // il garde ses distances
        if (e.shootCd <= 0) { e.state = "throw"; e.stateT = 0.4; }
      }
      const look = e.dir; e.dir = want || e.dir;
      const blocked = e.onGround && want && edgeAhead(e);
      e.dir = look;
      e.vx = approach(e.vx, blocked ? 0 : want * e.speed, 200 * dt);
      if (!sees && e.onGround && edgeAhead(e)) { e.dir *= -1; e.vx = 0; }
      else if (!sees && !want) e.vx = approach(e.vx, e.dir * e.speed, 200 * dt);
    }
    e.hitWall = false; moveX(e, e.vx * dt);
    if (e.hitWall && !sees) e.dir *= -1;
    moveY(e, e.vy * dt);
  },
  rodeur(e, dt, p) {
    e.vy = Math.min(e.vy + 1500 * dt, 430);
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h) - (e.y + e.h);
    if (e.state === "wind") {
      e.vx = 0; e.stateT -= dt;
      if (e.stateT <= 0) { e.state = "lunge"; e.stateT = 0.32; }
    } else if (e.state === "lunge") {
      e.vx = e.dir * 230 * (1 + dark / 200); e.stateT -= dt;
      if (Math.random() < dt * 30) particles.push({ x: e.x + e.w / 2, y: e.y + 3, vx: -e.vx * 0.1, vy: -10, life: 0.3, max: 0.3, color: "#3a2a48", g: 0 });
      if (e.stateT <= 0) { e.state = "walk"; e.cooldown = 1.4 - dark / 200; }
    } else if (e.daze > 0 || e.stun > 0) e.vx = approach(e.vx, 0, 500 * dt);
    else {
      if (!p.dead && e.cooldown <= 0 && Math.abs(dx) < 90 && Math.abs(dy) < 24 && e.onGround) {
        e.dir = Math.sign(dx) || e.dir; e.state = "wind"; e.stateT = 0.45;
      } else {
        if (!p.dead && Math.abs(dx) < 160 && Math.abs(dy) < 40) e.dir = Math.sign(dx) || e.dir;   // il se rapproche en silence
        e.vx = approach(e.vx, e.dir * e.speed, 200 * dt);
        if (e.onGround && edgeAhead(e)) { e.dir *= -1; e.vx = 0; }
      }
    }
    e.hitWall = false; moveX(e, e.vx * dt);
    if (e.hitWall) { if (e.state === "lunge") { e.state = "walk"; e.daze = 0.6; e.cooldown = 1.2; } else e.dir *= -1; }
    moveY(e, e.vy * dt);
  },
};
function drawBone(s, x, y) {
  const a = (time * 14 + s.x * 0.1) % (Math.PI * 2);
  ctx.save(); ctx.translate(x + 3, y + 3); ctx.rotate(a);
  ctx.fillStyle = "#140e18"; ctx.fillRect(-4, -1.67, 8, 3.33);
  ctx.fillStyle = "#e6dcc8"; ctx.fillRect(-3.5, -0.67, 7, 1.33); ctx.fillRect(-4, -1.34, 1.67, 2.67); ctx.fillRect(2.33, -1.34, 1.67, 2.67);
  ctx.restore();
}

// ----- Le carnet -----
let bestiary = {};
try { bestiary = JSON.parse(localStorage.getItem("lepuits.bestiaire")) || {}; } catch (e) {}
let bestiaryDirty = false, bestiarySaveT = 0;
const bestEntry = type => bestiary[type] || (bestiary[type] = { seen: 0, kills: 0 });
function bestiaryKill(type) {
  if (!ENEMY_TYPES[type]) return;
  const b = bestEntry(type); b.kills++; if (!b.seen) b.seen = 1;
  bestiaryDirty = true;
}
function bumpBestiaryLoot(kind) {
  const b = bestiary._loot || (bestiary._loot = {});
  b[kind] = (b[kind] || 0) + 1; bestiaryDirty = true;
}
function updateBestiary(dt) {
  const p = player;
  for (const e of enemies) {
    if (e.dead || bestiary[e.type]?.seen) continue;
    if (Math.abs(e.x - p.x) < 150 && Math.abs(e.y - p.y) < 90) {
      bestEntry(e.type).seen = 1; bestiaryDirty = true;
      if (e.type !== "boss") toast(`Nouvelle créature dans le bestiaire : <b>${ENEMY_TYPES[e.type].name}</b>`, 2400, true);
    }
  }
  bestiarySaveT -= dt;
  if (bestiaryDirty && bestiarySaveT <= 0) {
    bestiarySaveT = 2; bestiaryDirty = false;
    try { localStorage.setItem("lepuits.bestiaire", JSON.stringify(bestiary)); } catch (e) {}
  }
}
const BEST_SPRITE = { crawler: "crawler0", bat: "bat0", spitter: "spitter0", golem: "golem0", wisp: "wisp0", champi: "champi0", squelette: "squelette0", rodeur: "rodeur0", mimic: "mimic1" };
function renderBestiary() {
  const g = document.getElementById("bestGrid"); if (!g) return;
  const known = BESTIARY_ORDER.filter(t => bestiary[t]?.seen).length;
  const loot = bestiary._loot || {};
  g.innerHTML = `<p class="best-sum">${known} / ${BESTIARY_ORDER.length} créatures rencontrées · ${loot.pot || 0} jarres cassées · ${(loot.coin || 0) + 5 * (loot.gem || 0)} pièces ramassées</p>` +
    BESTIARY_ORDER.map(t => {
      const b = bestiary[t] || { seen: 0, kills: 0 }, info = BESTIARY_INFO[t], d = ENEMY_TYPES[t];
      return `<div class="best${b.seen ? "" : " unknown"}">
        <canvas width="44" height="44" data-sprite="${t}"></canvas>
        <div><b>${b.seen ? d.name : "???"}</b>
          <small>${b.seen ? `${info.where} · ${d.hp} PV · vaincu ${b.kills} fois` : "Pas encore rencontré"}</small>
          ${b.seen ? `<span>${info.text}</span>` : ""}</div>
      </div>`;
    }).join("");
  for (const cv of g.querySelectorAll("canvas[data-sprite]")) {
    const t = cv.dataset.sprite, c2 = cv.getContext("2d"), name = BEST_SPRITE[t];
    c2.imageSmoothingEnabled = false;
    if (!name) { c2.fillStyle = "#c4413b"; c2.font = "28px serif"; c2.textAlign = "center"; c2.fillText("☠", 22, 32); continue; }
    const src = spriteCanvas(name, !bestiary[t]?.seen), k = Math.max(1, Math.floor(40 / Math.max(src.width, src.height)));
    if (!bestiary[t]?.seen) { c2.globalAlpha = 0.18; }
    c2.drawImage(src, Math.round(22 - src.width * k / 2), Math.round(42 - src.height * k), src.width * k, src.height * k);
  }
}
