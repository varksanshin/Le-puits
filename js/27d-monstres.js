"use strict";
// ---------- 27d. Nouvelles créatures (0.22) ----------
/* Six monstres, chacun avec sa mécanique à comprendre :
     fouisseur  Fouisseur (mines, profondeurs) : il s'enfouit, file sous terre vers toi et jaillit sous tes pieds.
                Une traînée de poussière le trahit. Frappe-le quand il est sorti, sonné.
     templier   Templier creux (zone noyée, antre) : son bouclier bloque tout ce qui vient de face.
                Passe derrière lui, frappe-le d'en haut, ou brise sa garde (frappe chargée, plongeon).
     gorgone    Gorgone (zone noyée, profondeurs, antre) : quand ses yeux s'ouvrent, ne la regarde pas !
                Si tu lui fais face trop longtemps, tu es pétrifié un instant. Tourne-lui le dos.
     sonneur    Sonneur de glas (entrée, mines) : il fuit et sonne sa cloche ; les monstres autour deviennent enragés.
                À abattre en premier.
     necro      Nécromancien (profondeurs, antre) : il relève les monstres tombés près de lui.
                Quand il meurt, ses revenants tombent en poussière.
     reflet     Reflet (antre) : ton double sombre. Il fait tout à l'envers : si tu avances, il avance ;
                si tu recules, il recule. Il frappe quand tu frappes. */
Object.assign(ENEMY_TYPES, {
  fouisseur: { w: 14, h: 8,  hp: 4, speed: 26, weight: 0.8, damage: 1, name: "Fouisseur" },
  templier:  { w: 10, h: 16, hp: 6, speed: 20, weight: 0.4, damage: 1, name: "Templier creux" },
  gorgone:   { w: 12, h: 10, hp: 4, speed: 22, weight: 1,   damage: 1, name: "Gorgone", fly: true },
  sonneur:   { w: 10, h: 12, hp: 3, speed: 34, weight: 1,   damage: 1, name: "Sonneur de glas" },
  necro:     { w: 10, h: 15, hp: 5, speed: 22, weight: 0.8, damage: 1, name: "Nécromancien" },
  reflet:    { w: 10, h: 14, hp: 6, speed: 0,  weight: 0.9, damage: 1, name: "Reflet" },
});
Object.assign(BESTIARY_INFO, {
  fouisseur: { where: "Mines, profondeurs", text: "Il s'enfouit et file sous terre vers toi : suis la poussière. Il jaillit sous tes pieds, puis reste sonné." },
  templier:  { where: "Zone noyée, antre", text: "Son bouclier arrête tout ce qui vient de face. Passe derrière, frappe d'en haut, ou brise sa garde d'une frappe chargée." },
  gorgone:   { where: "Zone noyée, profondeurs, antre", text: "Quand ses yeux s'ouvrent, tourne-lui le dos. Qui la regarde trop longtemps se change un instant en pierre." },
  sonneur:   { where: "Entrée, mines", text: "Il fuit, puis sonne le glas : tous les monstres autour s'enragent. Abats-le en premier." },
  necro:     { where: "Profondeurs, antre", text: "Il relève les morts autour de lui. Tue-le, et ses revenants retombent en poussière." },
  reflet:    { where: "Antre", text: "Ton double sombre fait tout à l'envers : avance, il avance ; recule, il recule ; frappe, il frappe." },
});
BESTIARY_ORDER.splice(BESTIARY_ORDER.indexOf("boss"), 0, "fouisseur", "templier", "gorgone", "sonneur", "necro", "reflet");
Object.assign(BEST_SPRITE, { fouisseur: "fouisseur0", templier: "templier0", gorgone: "gorgone1", sonneur: "sonneur0", necro: "necro0", reflet: "reflet0" });

// ----- Sprites -----
Object.assign(SPRITES, {
  fouisseur0: [
    ".....ooooo.....",
    "...oo11111oo...",
    "..o111111111o..",
    ".o11111111e1oo.",
    ".o1111111111>>o",
    "o11111111111>o.",
    "o11111111111o..",
    ".o3o3oo3o3oo...",
  ],
  fouisseur1: [
    ".....ooooo.....",
    "...oo11111oo...",
    "..o111111111o..",
    ".o11111111e1oo.",
    ".o1111111111>>o",
    "o11111111111>o.",
    "o11111111111o..",
    "o3o3oo3o3oo....",
  ],
  templier0: [
    "...oooo.....",
    "..oMMMMo....",
    "..oMyyMo....",
    "..oMMMMo.oo.",
    ".ooMMMMoo%%o",
    "oMMMMMMMo%%o",
    "oMMMMMMMo%%o",
    "oMMoMMMMo%%o",
    ".oo.oMMMo%%o",
    "....oMMMo%%o",
    "....oMMMooo.",
    "...oMMoMMo..",
    "...oMo.oMo..",
    "...oMo.oMo..",
    "..oMMo.oMMo.",
    "..ooo..ooo..",
  ],
  templier_atk: [
    "...oooo.........",
    "..oMMMMo........",
    "..oMyyMo........",
    "..oMMMMo........",
    ".ooMMMMooo......",
    "oMMMMMMMMMoooooo",
    "oMMMMMMMMmmmmmmo",
    "oMMoMMMMoooooooo",
    ".oo.oMMMo.......",
    "....oMMMo.......",
    "....oMMMo.......",
    "...oMMoMMo......",
    "...oMo.oMo......",
    "...oMo.oMo......",
    "..oMMo.oMMo.....",
    "..ooo..ooo......",
  ],
  templier_broken: [
    "...oooo.....",
    "..oMMMMo....",
    "..oMyyMo....",
    "..oMMMMo....",
    ".ooMMMMoo...",
    "oMMMMMMMMo..",
    "oMMMMMMMMo..",
    "oMMoMMMMo...",
    ".oo.oMMMo...",
    "....oMMMo...",
    "....oMMMo...",
    "...oMMoMMo..",
    "...oMo.oMo..",
    "...oMo.oMo.o",
    "..oMMo.oMMo%",
    "..ooo..ooo%%",
  ],
  gorgone0: [
    ".g..g..g..g.",
    "gg.gg.gg.gg.",
    ".oooooooooo.",
    "o4444444444o",
    "o4554455444o",
    "o4444444444o",
    "o4444oo4444o",
    ".o44o44o44o.",
    "..o4o44o4o..",
    "...o.oo.o...",
  ],
  gorgone1: [
    ".g..g..g..g.",
    "gg.gg.gg.gg.",
    ".oooooooooo.",
    "o4444444444o",
    "o4yy44yy444o",
    "o4ye44ey444o",
    "o4444oo4444o",
    ".o44o44o44o.",
    "..o4o44o4o..",
    "...o.oo.o...",
  ],
  sonneur0: [
    "...ooo....",
    "..o666o...",
    ".o6e66o...",
    ".o6666oo..",
    "o66666o7o.",
    "o666666o7o",
    "o66666o777",
    ".o6666o.o.",
    ".o6666o...",
    ".o6o6o....",
    ".o6o6o....",
    ".oo.oo....",
  ],
  sonneur_ring: [
    "...ooo..oo",
    "..o666oo77",
    ".o6e66o777",
    ".o6666oo7o",
    "o66666o.o.",
    "o666666o..",
    "o66666o...",
    ".o6666o...",
    ".o6666o...",
    ".o6o6o....",
    ".o6o6o....",
    ".oo.oo....",
  ],
  necro0: [
    "...oooo.....",
    "..o8888o..o.",
    ".o88ww88o.v.",
    ".o8weew8o.o.",
    ".o88ww88o.o.",
    "o88888888oo.",
    "o888888888o.",
    "o88888888oo.",
    ".o888888o.o.",
    ".o888888o.o.",
    ".o888888o.o.",
    "o88888888oo.",
    "o888888888o.",
    "o8888888888o",
    "oooooooooooo",
  ],
  necro_cast: [
    "...oooo...v.",
    "..o8888o.vvv",
    ".o88ww88o.o.",
    ".o8weew8o.o.",
    ".o88ww88ooo.",
    "o888888888o.",
    "o88888888o..",
    "o88888888o..",
    ".o888888o...",
    ".o888888o...",
    ".o888888o...",
    "o88888888o..",
    "o888888888o.",
    "o8888888888o",
    "oooooooooooo",
  ],
});
// Le Reflet reprend les images du héros, dans des couleurs d'ombre
for (const [k, src] of [["reflet0", "hero_idle0"], ["reflet1", "hero_run0"], ["reflet2", "hero_run2"], ["reflet_jump", "hero_jump"]]) if (SPRITES[src]) SPRITES[k] = SPRITES[src];
Object.assign(SPRITE_PAL, {
  fouisseur: { 1: "#6e4a30", ">": "#c9c2b4", e: "#f2b54a", 3: "#e6dcc8" },
  templier: { M: "#5a5866", m: "#d8d0c0", y: "#c4413b", "%": "#8a6a30" },
  gorgone: { g: "#4f8a5a", 4: "#5aa09a", 5: "#2a4a48", y: "#fff3b8", e: "#c4413b" },
  sonneur: { 6: "#5a4a3a", e: "#f2d45a", 7: "#c8962c" },
  necro: { 8: "#3a2a48", w: "#e6dcc8", e: "#8ff0a0", v: "#8ff0a0" },
  reflet: { h: "#1c1424", H: "#0d0b10", s: "#3a2a48", S: "#2a1f36", r: "#4a3560", R: "#2a1838", b: "#9d6bc4", l: "#140e18", B: "#1c1424", e: "#f2d45a", w: "#c88aff", m: "#6a5a80", M: "#3a2a48" },
});
Object.assign(EYE_CHARS, { fouisseur: "e", templier: "y", gorgone: "y", sonneur: "e", necro: "e", reflet: "e" });

// ----- Mécaniques -----
let corpses = [];
const near2 = (e, p, rx, ry) => Math.abs((p.x + p.w / 2) - (e.x + e.w / 2)) < rx && Math.abs((p.y + p.h / 2) - (e.y + e.h / 2)) < ry;
const groundStep = (e, dt) => { e.vy = Math.min(e.vy + 1500 * dt, 430); e.hitWall = false; moveX(e, e.vx * dt); moveY(e, e.vy * dt); };
Object.assign(ENEMY_AI, {
  fouisseur(e, dt, p) {
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h) - (e.y + e.h);
    e.stateT -= dt;
    if (e.state === "walk") {
      e.hidden = false;
      if (e.stun > 0 || e.daze > 0) e.vx = approach(e.vx, 0, 500 * dt);
      else {
        e.vx = approach(e.vx, e.dir * e.speed, 200 * dt);
        if (e.onGround && edgeAhead(e)) { e.dir *= -1; e.vx = 0; }
        if (!p.dead && e.cooldown <= 0 && e.onGround && Math.abs(dx) < 150 && Math.abs(dy) < 40) { e.state = "dig"; e.stateT = 0.45; }
      }
    } else if (e.state === "dig") {
      e.vx = 0; if (Math.random() < dt * 30) dust(e.x + e.w / 2, e.y + e.h, 1);
      if (e.stateT <= 0) { e.state = "under"; e.stateT = 3; e.hidden = true; burst(e.x + e.w / 2, e.y + e.h, 12, "#6e4426", 70); }
    } else if (e.state === "under") {
      e.hidden = true;
      e.dir = Math.sign(dx) || e.dir;
      e.vx = approach(e.vx, e.dir * 80, 400 * dt);
      if (e.onGround && edgeAhead(e)) e.vx = 0;
      if (Math.random() < dt * 22) particles.push({ x: e.x + e.w / 2 + (Math.random() - 0.5) * 8, y: e.y + e.h - 1, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, life: 0.4, max: 0.4, color: "#6e4426", g: 300 });
      if (Math.abs(dx) < 8 || e.stateT <= 0 || Math.abs(dy) > 60) { e.state = "rise"; e.stateT = 0.45; e.vx = 0; shake(1, 0.1); }
    } else if (e.state === "rise") {
      e.vx = 0; if (Math.random() < dt * 40) dust(e.x + e.w / 2 + (Math.random() - 0.5) * 12, e.y + e.h, 1);
      if (e.stateT <= 0) { e.state = "erupt"; e.hidden = false; e.vy = -290; burst(e.x + e.w / 2, e.y + e.h, 18, "#6e4426", 120); }
    } else if (e.state === "erupt") {
      if (e.onGround && e.vy >= 0) { e.state = "expose"; e.stateT = 1.6; e.daze = 1.2; dust(e.x + e.w / 2, e.y + e.h, 6); }
    } else if (e.state === "expose") {
      e.vx = approach(e.vx, 0, 600 * dt);
      if (e.stateT <= 0) { e.state = "walk"; e.cooldown = 1.4; }
    }
    groundStep(e, dt);
    if (e.hitWall && e.state === "walk") e.dir *= -1;
  },
  templier(e, dt, p) {
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h) - (e.y + e.h);
    const sees = !p.dead && Math.abs(dx) < 150 && Math.abs(dy) < 40;
    e.guardBroken = Math.max(0, (e.guardBroken || 0) - dt);
    e.stateT -= dt;
    if (e.state === "wind") { e.vx = 0; if (e.stateT <= 0) { e.state = "thrust"; e.stateT = 0.25; } }
    else if (e.state === "thrust") {
      e.vx = e.dir * 160;
      const box = { x: e.dir > 0 ? e.x + e.w : e.x - 14, y: e.y + 4, w: 14, h: 6 };
      if (!p.dead && overlap(p, box)) hurtPlayer(e, e.damage);
      if (e.stateT <= 0) { e.state = "walk"; e.cooldown = 1.4; }
    } else if (e.stun > 0 || e.daze > 0) e.vx = approach(e.vx, 0, 500 * dt);
    else {
      // il se retourne lentement : c'est ta chance de passer derrière
      const want = Math.sign(dx) || e.dir;
      if (sees && want !== e.dir) { e.turnT = (e.turnT || 0) + dt; if (e.turnT > 0.55) { e.dir = want; e.turnT = 0; } }
      else e.turnT = 0;
      if (sees && Math.abs(dx) < 30 && e.cooldown <= 0 && want === e.dir && !e.guardBroken) { e.state = "wind"; e.stateT = 0.5; e.vx = 0; }
      else {
        e.vx = approach(e.vx, (sees ? (want === e.dir ? e.dir : 0) : e.dir) * e.speed, 150 * dt);
        if (e.onGround && edgeAhead(e)) { if (!sees) e.dir *= -1; e.vx = 0; }
      }
    }
    groundStep(e, dt);
    if (e.hitWall && !sees) e.dir *= -1;
  },
  gorgone(e, dt, p) {
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, px = p.x + p.w / 2, py = p.y + p.h / 2;
    e.gazeT = (e.gazeT ?? 1.5 + Math.random() * 2) - dt;
    if (e.state === "walk" || e.state === "idle") { e.state = "idle"; if (e.gazeT <= 0 && near2(e, p, 170, 100)) { e.state = "wind"; e.gazeT = 0.7; } }
    else if (e.state === "wind") { if (e.gazeT <= 0) { e.state = "gaze"; e.gazeT = 1.7; } }
    else if (e.state === "gaze") {
      if (!p.dead && near2(e, p, 180, 110) && p.face === (Math.sign(ex - px) || 1) && lineClear(ex, ey, px, py) && !(p.petrify > 0)) {
        p.stoneMeter = (p.stoneMeter || 0) + dt;
        if (p.stoneMeter > 0.6) {
          p.petrify = 1.0; p.stoneMeter = 0;
          burst(px, py, 16, "#9a9088", 80); shake(2, 0.2);
          if (typeof SFX !== "undefined") SFX.play("petrify");
          if (!gorgoneHinted) { gorgoneHinted = true; toast("Pétrifié ! <i>Quand ses yeux s'ouvrent, tourne-lui le dos.</i>", 3200, true); }
        }
      }
      if (e.gazeT <= 0) { e.state = "idle"; e.gazeT = 2.6 + Math.random(); }
    }
    if (e.loop && !(e.stun > 0 || e.daze > 0)) {
      // la Gorgone-Mère : elle décrit un ∞ au milieu de la salle, assez bas pour qu'on l'atteigne d'un simple saut
      // (elle ralentit quand ses yeux s'ouvrent ; elle traverse les plateformes)
      const L = e.loop, slow = e.state === "wind" || e.state === "gaze" ? 0.35 : 1;
      L.u += dt * L.w * slow;
      const tx = L.cx + Math.sin(L.u) * L.A - e.w / 2, ty = L.cy + Math.sin(2 * L.u) * L.B - e.h / 2;
      e.vx = Math.max(-90, Math.min(90, (tx - e.x) * 4)); e.vy = Math.max(-90, Math.min(90, (ty - e.y) * 4));
      e.dir = Math.sign(e.vx) || e.dir;
      e.x += e.vx * dt; e.y += e.vy * dt;
      return;
    }
    if (e.stun > 0 || e.daze > 0) { e.vx = approach(e.vx, 0, 200 * dt); e.vy = approach(e.vy, 0, 200 * dt); }
    else {
      const tx = near2(e, p, 200, 120) ? Math.max(-40, Math.min(40, (px - ex) * 0.4)) : (e.homeX - e.x);
      e.vx = approach(e.vx, Math.max(-e.speed, Math.min(e.speed, tx)), 60 * dt);
      e.vy = approach(e.vy, (e.homeY + Math.sin(e.t * 1.8) * 6 - e.y) * 2, 80 * dt);
    }
    moveX(e, e.vx * dt); moveY(e, e.vy * dt);
  },
  sonneur(e, dt, p) {
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h) - (e.y + e.h);
    const sees = !p.dead && Math.abs(dx) < 170 && Math.abs(dy) < 60 && lineClear(e.x + e.w / 2, e.y + 3, p.x + p.w / 2, p.y + 6);
    e.stateT -= dt; e.ringCd = (e.ringCd ?? 1.2) - dt;
    if (e.state === "ring") {
      e.vx = approach(e.vx, 0, 500 * dt);
      if (e.stateT <= 0) {
        e.state = "walk"; e.ringCd = 7;
        let n = 0;
        for (const o of enemies) if (o !== e && !o.dead && !o.boss && Math.hypot(o.x - e.x, o.y - e.y) < 200) { o.frenzy = 6; n++; burst(o.x + o.w / 2, o.y, 6, "#f2d45a", 60); }
        burst(e.x + e.w / 2, e.y, 20, "#c8962c", 110, true); shake(1.5, 0.15);
        if (n && !sonneurHinted) { sonneurHinted = true; toast("Le glas sonne : les monstres alentour s'enragent !", 2400); }
      }
    } else if (e.stun > 0 || e.daze > 0) e.vx = approach(e.vx, 0, 500 * dt);
    else if (sees && e.ringCd <= 0) { e.state = "ring"; e.stateT = 0.9; }
    else {
      let want = e.dir;
      if (sees && Math.abs(dx) < 100) want = -Math.sign(dx) || e.dir;          // il fuit
      e.dir = want;
      e.vx = approach(e.vx, e.dir * e.speed * (sees ? 1.3 : 0.6), 200 * dt);
      if (e.onGround && edgeAhead(e)) { e.vx = 0; if (!sees) e.dir *= -1; }
    }
    groundStep(e, dt);
    if (e.hitWall) e.dir *= -1;
  },
  necro(e, dt, p) {
    const ex = e.x + e.w / 2, dx = (p.x + p.w / 2) - ex, dy = (p.y + p.h / 2) - (e.y + 4);
    const sees = !p.dead && Math.abs(dx) < 170 && Math.abs(dy) < 90 && lineClear(ex, e.y + 3, p.x + p.w / 2, p.y + 6);
    e.stateT -= dt; e.castCd = (e.castCd ?? 2 + Math.random() * 2) - dt;
    if (e.state === "cast") {
      e.vx = approach(e.vx, 0, 400 * dt);
      if (Math.random() < dt * 30) particles.push({ x: ex + (Math.random() - 0.5) * 14, y: e.y + e.h, vx: 0, vy: -40, life: 0.5, max: 0.5, color: "#8ff0a0", g: -20 });
      if (e.stateT <= 0) { e.state = "walk"; e.castCd = 5; necroCast(e); }
    } else if (e.stun > 0 || e.daze > 0) e.vx = approach(e.vx, 0, 500 * dt);
    else {
      if (sees && e.castCd <= 0) { e.state = "cast"; e.stateT = 0.8; }
      let want = e.dir;
      if (sees) { e.dir = Math.sign(dx) || e.dir; want = Math.abs(dx) < 70 ? -e.dir : Math.abs(dx) > 120 ? e.dir : 0; }
      const look = e.dir; e.dir = want || e.dir;
      const blocked = e.onGround && want && edgeAhead(e);
      e.dir = look;
      e.vx = approach(e.vx, blocked ? 0 : want * e.speed, 200 * dt);
      if (!sees && e.onGround && edgeAhead(e)) { e.dir *= -1; e.vx = 0; }
    }
    groundStep(e, dt);
    if (e.hitWall && !sees) e.dir *= -1;
  },
  reflet(e, dt, p) {
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h) - (e.y + e.h);
    const awake = !p.dead && Math.abs(dx) < 220 && Math.abs(dy) < 90;
    e.dir = Math.sign(dx) || e.dir;
    e.stateT -= dt;
    if (e.state === "slash") {
      const box = { x: e.dir > 0 ? e.x + e.w - 2 : e.x - 18, y: e.y - 3, w: 20, h: e.h + 6 };
      if (!p.dead && overlap(p, box)) hurtPlayer(e, e.damage);
      if (e.stateT <= 0) e.state = "walk";
    }
    if (e.stun > 0 || e.daze > 0 || !awake) e.vx = approach(e.vx, 0, 600 * dt);
    else {
      // le miroir : ta vitesse, à l'envers
      e.vx = -p.vx;
      if (p.vy < -150 && p.prevOnGround && e.onGround) { e.vy = p.vy; }
      if (p.atkTimer > 0 && !e.mirrorAtk && e.state !== "slash") { e.state = "slash"; e.stateT = 0.14; }
    }
    e.mirrorAtk = p.atkTimer > 0;
    // pas de chute dans le vide : il s'arrête au bord
    if (e.onGround && e.vx) {
      const fx = e.vx > 0 ? e.x + e.w + 1 : e.x - 1, g = tile(Math.floor(fx / T), Math.floor((e.y + e.h + 1) / T));
      if (!solid(g) && g !== "-") e.vx = 0;
    }
    groundStep(e, dt);
  },
});
let gorgoneHinted = false, sonneurHinted = false;
function necroCast(e) {
  const ex = e.x + e.w / 2, ey = e.y + e.h;
  const mine = enemies.filter(o => o.summonedBy === e && !o.dead).length;
  const near = corpses.filter(c => time - c.t < 25 && Math.hypot(c.x - ex, c.y - ey) < 180 && !c.raised);
  if (near.length && mine < 3) {
    for (const c of near.slice(0, Math.min(2, 3 - mine))) {
      c.raised = true;
      const d = ENEMY_TYPES[c.type];
      const k = summon(e, c.type, c.x - d.w / 2, c.y - d.h - (d.fly ? 4 : 0), { revenant: true });
      k.hp = Math.max(1, d.hp * 0.6); k.scaled = true;
      burst(c.x, c.y - 4, 20, "#8ff0a0", 100);
    }
    if (typeof SFX !== "undefined") SFX.play("necroRaise");
  } else {
    // pas de mort à relever : trois éclats d'os verts
    const px = player.x + player.w / 2, py = player.y + player.h / 2, a0 = Math.atan2(py - (e.y + 3), px - ex);
    for (const k of [-0.25, 0, 0.25]) shots.push({ kind: "bone", x: ex - 3, y: e.y, w: 6, h: 6, vx: Math.cos(a0 + k) * 120, vy: Math.sin(a0 + k) * 120, grav: 0, life: 2.4 });
  }
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  // Les images des nouveaux monstres
  around("enemyFrame", (o, e) => {
    const t = e.t || 0, step = Math.floor(t * 6) % 2;
    switch (e.type) {
      case "fouisseur": return e.hidden ? null : "fouisseur" + (Math.abs(e.vx) > 3 ? step : 0);
      case "templier": return e.state === "wind" || e.state === "thrust" ? "templier_atk" : e.guardBroken > 0 ? "templier_broken" : "templier0";
      case "gorgone": return e.state === "gaze" || (e.state === "wind" && Math.floor(time * 12) % 2) ? "gorgone1" : "gorgone0";
      case "sonneur": return e.state === "ring" ? "sonneur_ring" : "sonneur0";
      case "necro": return e.state === "cast" ? "necro_cast" : "necro0";
      case "reflet": return !e.onGround ? "reflet_jump" : Math.abs(e.vx) > 15 ? "reflet" + (1 + step) : "reflet0";
    }
    return o(e);
  });
  // Le fouisseur enfoui : seulement un petit monticule
  around("drawEnemy", (o, e, ox, oy, a, ...rest) => {
    if (e.type === "fouisseur" && e.hidden) {
      const q = at(e, a), x = snap(q.x - ox), y = snap(q.y - oy);
      ctx.fillStyle = "#4a3020"; ctx.fillRect(x + 3, y + e.h - 2, 8, 2); ctx.fillStyle = "#6e4426"; ctx.fillRect(x + 5, y + e.h - 3, 4, 1.34);
      if (e.state === "rise") { ctx.fillStyle = "rgba(196,65,59,0.5)"; ctx.fillRect(x - 3, y + e.h - 1, e.w + 6, 1.34); }
      return;
    }
    if (e.revenant) { ctx.globalAlpha = 0.75; const r = o(e, ox, oy, a, ...rest); ctx.globalAlpha = 1; const q = at(e, a); ctx.fillStyle = "rgba(143,240,160,0.25)"; ctx.fillRect(snap(q.x - ox), snap(q.y - oy), e.w, e.h); return r; }
    const r = o(e, ox, oy, a, ...rest);
    if (e.frenzy > 0 && !e.dead) {
      const q = at(e, a);
      ctx.fillStyle = `rgba(242,180,60,${0.25 + 0.2 * Math.sin(time * 14)})`; ctx.fillRect(snap(q.x - ox) - 1, snap(q.y - oy) - 1, e.w + 2, 2);
    }
    return r;
  });
  // Le bouclier du templier, et la garde brisée
  around("hitEnemy", (o, e, dmg, dirX, opt = {}, ...a) => {
    if (e && e.type === "templier" && !e.dead && !e.hidden) {
      const p = player, heavy = p.atkDir === "heavy" || p.diveLag > 0 || p.diving || opt.heavy;
      const front = dirX && Math.sign(dirX) === -e.dir;
      if (front && !opt.down && !e.guardBroken && e.state !== "wind" && e.state !== "thrust") {
        if (heavy) {
          e.guardBroken = 2.2; e.stun = Math.max(e.stun, 0.8);
          burst(e.x + (e.dir > 0 ? e.w : 0), e.y + 6, 18, "#d8d0c0", 120); shake(2.5, 0.2);
          if (typeof SFX !== "undefined") SFX.play("wallBreak");
          return o(e, dmg * 0.5, dirX, opt, ...a);
        }
        e.flash = 0.06;
        burst(e.x + (e.dir > 0 ? e.w : 0), e.y + 6, 8, "#f2d45a", 90);
        if (typeof SFX !== "undefined") SFX.play("clang");
        if (overlap({ x: p.x - 24, y: p.y - 10, w: p.w + 48, h: p.h + 20 }, e)) { p.vx = e.dir * 150; freeze = Math.max(freeze, 0.04); }
        if (!templierHinted) { templierHinted = true; toast("Le bouclier arrête le coup. <i>Passe derrière, frappe d'en haut, ou brise sa garde.</i>", 3000, true); }
        return;
      }
    }
    return o(e, dmg, dirX, opt, ...a);
  });
  let templierHinted = false;
  // Les morts : le nécromancien s'en souvient
  around("onEnemyKilled", (o, e, ...a) => {
    const r = o(e, ...a);
    if (!e.mini && !e.boss && !e.summonedBy && !e.decoy && ENEMY_TYPES[e.type] && e.type !== "necro" && e.type !== "mimic")
      corpses.push({ type: e.type, x: e.x + e.w / 2, y: e.y + e.h, t: time });
    if (corpses.length > 40) corpses.splice(0, corpses.length - 40);
    if (e.type === "necro") for (const k of enemies) if (k.summonedBy === e && !k.dead) { k.dead = true; burst(k.x + k.w / 2, k.y + k.h / 2, 14, "#8a7f74", 70); }
    return r;
  });
  around("resetRun", (o, ...a) => { corpses = []; return o(...a); });
  // Rage du glas : les monstres enragés vont plus vite et attaquent plus souvent
  around("updateEnemies", (o, dt, ...a) => {
    const fr = enemies.filter(e => e.frenzy > 0 && !e.dead);
    for (const e of fr) { e.baseSpeed *= 1.5; e.cooldown = Math.max(0, e.cooldown - dt * 0.6); e.shootCd -= dt * 0.6; }
    const r = o(dt, ...a);
    for (const e of fr) { e.baseSpeed /= 1.5; e.frenzy -= dt; if (Math.random() < dt * 10) particles.push({ x: e.x + Math.random() * e.w, y: e.y, vx: 0, vy: -20, life: 0.3, max: 0.3, color: "#f2b54a", g: -10 }); }
    return r;
  });
  // La pétrification : le héros ne bouge plus un instant
  around("updatePlayer", (o, dt, ...a) => {
    const p = player;
    if (!p) return o(dt, ...a);
    const wasGround = p.onGround, x0 = p.x;
    if (p.petrify > 0) {
      p.petrify -= dt;
      const r = o(dt, ...a);
      p.x = x0; p.vx = 0; if (p.vy < 0) p.vy = 0; p.atkTimer = 0; p.dashTimer = 0;
      p.prevOnGround = wasGround;
      return r;
    }
    p.stoneMeter = Math.max(0, (p.stoneMeter || 0) - dt * 0.4);
    const r = o(dt, ...a);
    p.prevOnGround = wasGround;
    return r;
  });
  around("drawLootTop", (o, ox, oy, ...a) => {
    const r = o(ox, oy, ...a), p = player;
    if (p && (p.petrify > 0 || p.stoneMeter > 0.05)) {
      const k = p.petrify > 0 ? 0.75 : Math.min(0.6, p.stoneMeter);
      ctx.fillStyle = `rgba(150,142,134,${k})`; ctx.fillRect(snap(p.x - ox), snap(p.y - oy), p.w, p.h);
      if (p.petrify > 0) { ctx.fillStyle = "rgba(60,56,60,0.8)"; ctx.fillRect(snap(p.x - ox) + 2, snap(p.y - oy) + 4, 1, 6); ctx.fillRect(snap(p.x - ox) + 6, snap(p.y - oy) + 2, 1, 5); }
    }
    return r;
  });
})();
