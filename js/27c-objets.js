"use strict";
// ---------- 27c. Nouveaux objets et synergies ----------
/* Une deuxième vague d'objets, et des synergies à la Isaac : posséder deux objets qui vont ensemble
   débloque un bonus caché, annoncé par « Synergie ! ». Le joueur ne voit qu'un nom et une phrase floue.
   Les effets se branchent sur les fonctions du jeu sans les réécrire (même principe que les bruitages). */

const NEW_ITEMS = [
  // Le plongeon
  { id: "enclume",   cat: "passif", name: "Enclume de poche",     desc: "Le plongeon frappe deux fois plus fort.", hint: "Tombe comme une pierre." },
  { id: "meteore",   cat: "passif", name: "Cœur de météore",      desc: "L'impact du plongeon laisse du feu au sol.", hint: "Ta chute embrase le sol." },
  { id: "rebond",    cat: "passif", name: "Ressort de gnome",     desc: "Après l'impact d'un plongeon, tu rebondis haut.", hint: "Ça remonte !" },
  // Armes
  { id: "sangsue",   cat: "lame",   name: "Dent de sangsue",      desc: "Chaque coup d'épée a 4 % de chances de rendre 1 PV.", hint: "Elle boit un peu." },
  { id: "foudre",    cat: "lame",   name: "Épée de foudre",       desc: "Un coup sur cinq lance un éclair vers deux ennemis proches.", hint: "Le ciel répond parfois." },
  { id: "venin",     cat: "lame",   name: "Lame venimeuse",       desc: "Tes coups empoisonnent : l'ennemi saigne un moment.", hint: "Une piqûre qui dure." },
  { id: "boomerang", cat: "lame",   name: "Boomerang d'os",       desc: "Un coup de côté sur trois lance un os qui revient.", hint: "Ce qui part revient." },
  // Défense et butin
  { id: "epines",    cat: "passif", name: "Armure d'épines",      desc: "Quand tu es touché, les ennemis proches sont blessés.", hint: "Ne me touche pas." },
  { id: "bouclier",  cat: "passif", name: "Bouclier de lumière",  desc: "Bloque un coup ; il se recharge à chaque nouvelle profondeur.", hint: "Une fois, la lumière te protège." },
  { id: "sel",       cat: "passif", name: "Sel de purification",  desc: "Chaque gardien vaincu te rend 15 de lumière.", hint: "Leur mort t'éclaire." },
  { id: "carte",     cat: "passif", name: "Carte du cartographe", desc: "Toute la carte du puits est révélée.", hint: "Plus de secrets." },
  { id: "boussole",  cat: "passif", name: "Boussole ancienne",    desc: "Les reliques et la porte du Gardien apparaissent sur les cartes, même inexplorées.", hint: "Elle sait où aller." },
  { id: "fer",       cat: "passif", name: "Fer à cheval",         desc: "Les ennemis lâchent plus souvent des cœurs.", hint: "La chance te soigne." },
  { id: "tirelire",  cat: "passif", name: "Tirelire",             desc: "Toutes les 15 pièces ramassées, tu gagnes une clé.", hint: "Les petits ruisseaux…" },
  // Pouvoirs détournés
  { id: "grappeclair", skill: "grapple",  name: "Grappin d'éclair",   desc: "Accrocher un ennemi l'étourdit et le blesse.", hint: "Une décharge au bout de la chaîne." },
  { id: "carquois",  skill: "bolt",       name: "Carquois sans fond", desc: "Tu tires deux fois plus vite.", hint: "Ça ne s'arrête jamais.", stat: s => { s.boltCooldown *= 0.5; } },
  { id: "orage",     skill: "doubleJump", name: "Plume d'orage",      desc: "Le saut en l'air repousse et blesse les ennemis autour.", hint: "Le vent te porte et frappe." },
  { id: "revenant",  skill: "phase",      name: "Pas du revenant",    desc: "La phase se recharge deux fois plus vite.", hint: "Encore, et encore.", stat: s => { s.phaseCooldown *= 0.5; } },
  { id: "chargerapide", skill: "smash",   name: "Poing d'impatience", desc: "La frappe chargée se prépare deux fois plus vite.", hint: "Pas le temps d'attendre.", stat: s => { s.chargeTime *= 0.5; } },
  { id: "eclairnoir", skill: "dash",      name: "Éclair noir",        desc: "Le point de départ de ton dash explose un instant plus tard.", hint: "Tu laisses quelque chose derrière toi." },
  // Mystères
  { id: "rage",      mystery: true, dark: 8, name: "Masque de rage",   desc: "Chaque ennemi vaincu : +50 % de dégâts pendant 3 s.", hint: "La colère se nourrit." },
  { id: "phenix",    mystery: true, dark: 5, name: "Plume de phénix",  desc: "Une seule fois, tu renais avec tous tes PV au lieu de mourir. La plume brûle.", hint: "Les cendres se souviennent." },
  { id: "sablier",   mystery: true, name: "Sablier fêlé",             desc: "La lumière baisse 40 % moins souvent, mais 1 PV max en moins.", hint: "Le temps s'écoule moins vite. Toi aussi.", stat: s => { s.maxHp -= 1; } },
  { id: "miroir",    mystery: true, dark: 6, name: "Miroir de l'âme", desc: "Le prochain objet que tu ramasses en apporte un second.", hint: "Tout a son reflet." },
];

// Synergies : deux objets → un bonus. « stat » modifie les statistiques, les autres sont lues par les effets plus bas.
const SYNERGIES = [
  { id: "aube",        items: ["griffon", "cape"],        name: "Aile de l'aube",      hint: "Le ciel s'ouvre.", stat: s => { s.extraJumps += 1; } },
  { id: "spectre",     items: ["eperons", "voile"],       name: "Spectre filant",      hint: "Insaisissable.", stat: s => { s.dashCharges += 1; } },
  { id: "forteresse",  items: ["pierre", "armure"],       name: "Forteresse",          hint: "Un rempart vivant.", stat: s => { s.maxHp += 2; } },
  { id: "frenesang",   items: ["pacte", "berserker"],     name: "Frénésie sanglante",  hint: "Le sang appelle le sang.", stat: s => { s.damageMult *= 1.5; } },
  { id: "execution",   items: ["aiguise", "bourreau"],    name: "Exécution",           hint: "Le fil trouve la faille." },
  { id: "firmament",   items: ["lune", "etoiles"],        name: "Firmament",           hint: "Le ciel entier tombe." },
  { id: "piqueur",     items: ["enclume", "rebond"],      name: "Marteau-piqueur",     hint: "Encore. Plus fort." },
  { id: "pluiefeu",    items: ["meteore", "braise"],      name: "Pluie de feu",        hint: "Tout brûle." },
  { id: "forge",       items: ["lamebraise", "braise"],   name: "Cœur de forge",       hint: "Ils éclatent en flammes." },
  { id: "ruee",        items: ["aimant", "bourse"],       name: "Ruée vers l'or",      hint: "L'or coule à flots." },
  { id: "sainte",      items: ["lanterne", "eaubenite"],  name: "Sainte lumière",      hint: "La nuit recule." },
  { id: "vampire",     items: ["bourreau", "sangsue"],    name: "Vampire",             hint: "Chaque coup fatal te nourrit." },
  { id: "tonnerre",    items: ["foudre", "marteau"],      name: "Tonnerre",            hint: "Ils restent figés." },
  { id: "banquier",    items: ["tirelire", "avarice"],    name: "Banquier",            hint: "Ton or est en sûreté." },
  { id: "explorateur", items: ["carte", "boussole"],      name: "Explorateur",         hint: "Chaque profondeur t'offre une clé." },
  { id: "cendres",     items: ["phenix", "meteore"],      name: "Cendres ardentes",    hint: "Ta renaissance embrase tout." },
];
const synOn = id => { const s = SYNERGIES.find(x => x.id === id); return !!s && s.items.every(has); };

// ----- Enregistrement des objets et de leurs icônes -----
for (const it of NEW_ITEMS) if (!ITEM[it.id]) { ITEMS.push(it); ITEM[it.id] = it; }
Object.assign(SPRITES, {
  icon_enclume: ["........", "oooooooo", "o######o", "oX#####o", ".oo##oo.", "..o##o..", ".o####o.", "o######o", "oooooooo", "........"],
  icon_comete: ["........", "......oo", ".....o#o", "....o#Xo", "..oo#Xo.", ".o#XX#o.", "o#XwX#o.", "o#XX#o..", ".o##o...", "..oo...."],
  icon_ressort: ["oooooooo", "o######o", ".o#oo...", "..oo#o..", "..o#oo..", "...oo#o.", "..o#oo..", ".o####o.", "oooooooo", "........"],
  icon_dent: ["..oooo..", ".owwwwo.", "owwwwwwo", "owwwwwwo", "owwoowwo", ".o#oo#o.", ".o#oo#o.", ".oXo.oXo", "..o...o.", "........"],
  icon_eclair: ["....ooo.", "...o#Xo.", "..o#Xo..", ".o#Xooo.", "o#XXX#o.", "ooo#Xo..", "..o#Xo..", ".o#Xo...", ".oXo....", ".oo....."],
  icon_boomerang: ["oooo....", "o##Xo...", "oX##Xo..", ".oo##Xo.", "...oX#o.", "...o##o.", "..o##o..", ".o##o...", ".ooo....", "........"],
  icon_masque: ["..oooo..", ".o####o.", "o##XX##o", "okk##kko", "o#k##k#o", "o######o", ".o#oo#o.", ".o#XX#o.", "..oooo..", "........"],
  icon_bouclier: [".oooooo.", "o#XXXX#o", "o#X##X#o", "o#XwwX#o", "o#X##X#o", ".o#XX#o.", ".o####o.", "..o##o..", "...oo...", "........"],
  icon_sablier: ["oooooooo", "obbbbbbo", ".o####o.", "..oXXo..", "...oo...", "..o##o..", ".o#XX#o.", "obbbbbbo", "oooooooo", "........"],
  icon_carte: [".oooooo.", "o#X##X#o", "o#XkX##o", "o##X#X#o", "o#X#kX#o", "o##X##Xo", "o#X##X#o", ".oooooo.", "........", "........"],
  icon_boussole: ["..oooo..", ".o####o.", "o##wk##o", "o#Xwk#Xo", "o#X#k#Xo", "o##kw##o", ".o####o.", "..oooo..", "........", "........"],
  icon_fer: ["........", "oo....oo", "o#o..o#o", "o#o..o#o", "o#o..o#o", "oX#oo#Xo", ".oX##Xo.", "..oooo..", "........", "........"],
  icon_tirelire: ["........", "..o.oo..", ".o#o##o.", "o#X####o", "o#kX###o", "o######o", ".o####o.", ".o#oo#o.", ".oo..oo.", "........"],
  icon_miroir: ["..oooo..", ".o####o.", "o#wXXX#o", "o#XwXX#o", "o#XXwX#o", ".o####o.", "..o##o..", "...bb...", "..obbo..", "..oooo.."],
});
Object.assign(ITEM_ICONS, {
  enclume: ["enclume", "#5a5560", "#a8a0b0"],
  meteore: ["comete", "#c4413b", "#f2b54a"],
  rebond: ["ressort", "#8a8290", "#c9c2b4"],
  sangsue: ["dent", "#8a1a24", "#c4413b"],
  foudre: ["eclair", "#c8a83a", "#fff3b8"],
  venin: ["dague", "#4f6b3a", "#9cbf6a"],
  boomerang: ["boomerang", "#a87a4a", "#e6d6b8"],
  rage: ["masque", "#a8333a", "#f07070"],
  epines: ["armure", "#4f6b3a", "#9cbf6a"],
  bouclier: ["bouclier", "#8a9ab8", "#e8f0ff"],
  phenix: ["plume", "#e8913a", "#f2d45a"],
  sablier: ["sablier", "#c8a83a", "#e6d6b8"],
  sel: ["diamant", "#d8d0bc", "#ffffff"],
  carte: ["carte", "#c9a07a", "#8a6a4a"],
  boussole: ["boussole", "#b48a2a", "#c4413b"],
  fer: ["fer", "#8a8290", "#c9c2b4"],
  tirelire: ["tirelire", "#d08aa0", "#f6c0d0"],
  grappeclair: ["crochet", "#c8a83a", "#fff3b8"],
  carquois: ["livre", "#6b4a2c", "#7fc8d6"],
  orage: ["plume", "#4a6ab8", "#bfe4ff"],
  revenant: ["fantome", "#4f8a6a", "#bff0d0"],
  chargerapide: ["poing", "#e8913a", "#f2d45a"],
  miroir: ["miroir", "#7fb8d6", "#e8f4ff"],
  eclairnoir: ["croissant", "#4a3560", "#c88aff"],
});

// ----- Effets -----
(() => {
  // around(nom, f) : remplace une fonction du jeu par f(originale, ...arguments)
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  const near = (x, y, r) => enemies.filter(e => !e.dead && !e.hidden && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r);
  const heal = (n, txt) => { const p = player; if (p.hp >= stats.maxHp) return; p.hp = Math.min(stats.maxHp, p.hp + n); renderHearts(); popText(p.x + 5, p.y - 4, txt || "+1 PV", "#ff8a80"); };
  const S = n => { if (typeof SFX !== "undefined") SFX.play(n); };
  let run = {};
  const resetState = () => { run = { rage: 0, shield: true, mirror: false, piggy: 0, swings: 0, hits: 0, pending: [], zone: null, dash: 0, vampT: 0, known: new Set(SYNERGIES.filter(s => s.items.every(has)).map(s => s.id)) }; };
  resetState();
  around("resetRun", (o, ...a) => { const r = o(...a); resetState(); return r; });

  // Statistiques : la lumière qui baisse moins vite, et les synergies qui donnent des stats
  const baseTick = DARK.tickEvery;
  // les synergies s'ajoutent aux stats de base, avant les objets : computeStats gère ensuite les PV comme d'habitude
  around("deriveStats", (o, ...a) => {
    const st = o(...a);
    if (typeof items !== "undefined") for (const s of SYNERGIES) if (s.stat && s.items.every(has)) s.stat(st);
    return st;
  });
  around("computeStats", (o, ...a) => {
    const r = o(...a);
    let k = 1; if (has("sablier")) k *= 1.4; if (synOn("sainte")) k *= 1.5;
    DARK.tickEvery = baseTick * k;
    return r;
  });
  around("dmgOf", (o, ...a) => o(...a) * (run.rage > 0 ? 1.5 : 1));
  around("swordDamage", (o, ...a) => {
    const r = o(...a);
    if (synOn("execution") && !r.crit && Math.random() < 0.15 * luck()) { r.d *= 3; r.crit = true; }
    return r;
  });

  // Plongeon
  around("diveSlam", (o, ...a) => {
    const p = player, cx = p.x + p.w / 2, cy = p.y + p.h, keep = { ...DIVE };
    if (has("enclume")) DIVE.damage *= 2;
    if (synOn("piqueur")) DIVE.reach *= 2;
    const r = o(...a);
    Object.assign(DIVE, keep);
    if (has("meteore")) {
      const n = synOn("pluiefeu") ? 5 : 3;
      for (let i = -n; i <= n; i++) {
        const hx = cx + i * 8 - 4, below = tile(Math.floor((hx + 4) / T), Math.floor((cy + 2) / T));
        if (solid(below) || below === "-") hazards.push({ x: hx, y: cy - 8, w: 8, h: 8, life: synOn("pluiefeu") ? 3.5 : 2, t: Math.random() * 6 });
      }
    }
    if (has("rebond")) { p.vy = -stats.jumpVel * 0.95; p.onGround = false; p.jumping = false; p.diveLag = 0; }
    return r;
  });

  // Les coups d'épée
  around("onSwordHit", (o, e, crit, ...a) => {
    const r = o(e, crit, ...a);
    if (has("sangsue") && Math.random() < 0.04 * luck()) heal(1);
    if (synOn("vampire") && crit && run.vampT <= 0) { heal(1); run.vampT = 1.5; }
    if (has("venin") && !e.dead) { e.bleed = Math.max(e.bleed, 3); e.bleedT = Math.min(e.bleedT || 0.3, 0.3); }
    if (has("foudre") && ++run.hits % 5 === 0) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const targets = near(cx, cy, 100).filter(x => x !== e).slice(0, 2);
      for (const t of [e, ...targets]) {
        const tx = t.x + t.w / 2, ty = t.y + t.h / 2;
        for (let i = 0; i < 8; i++) particles.push({ x: cx + (tx - cx) * i / 8 + (Math.random() - 0.5) * 6, y: cy + (ty - cy) * i / 8 + (Math.random() - 0.5) * 6, vx: 0, vy: 0, life: 0.18, max: 0.18, color: i % 2 ? "#fff3b8" : "#c8a83a", g: 0 });
        if (t !== e) hitEnemy(t, dmgOf(1.2), Math.sign(tx - cx) || 1, { power: 0.6, freeze: 0.03 });
        if (synOn("tonnerre") && !t.boss) t.stun = Math.max(t.stun, 1);
      }
      S("bolt");
    }
    return r;
  });
  around("onSwing", (o, p, ...a) => {
    const r = o(p, ...a);
    if (has("boomerang") && p.atkDir === "side" && ++run.swings % 3 === 0)
      projectiles.push({ kind: "blade", boomer: true, x: p.x + p.w / 2 + p.face * 6 - 4, y: p.y + 2, w: 8, h: 8, vx: p.face * 210, vy: 0, grav: 0, life: 1.4, bounces: 0, dmg: dmgOf(0.8), hits: new Set(), pierce: true, ghostWall: true, t: 0 });
    return r;
  });
  around("steerProjectile", (o, q, dt, ...a) => {
    if (q.boomer) {                                  // l'os part, ralentit, puis revient vers le héros
      q.t += dt;
      if (q.t > 0.42) {
        if (!q.back) { q.back = true; q.hits = new Set(); }
        const p = player, dx = p.x + p.w / 2 - (q.x + q.w / 2), dy = p.y + p.h / 2 - (q.y + q.h / 2), d = Math.hypot(dx, dy) || 1;
        q.vx = dx / d * 240; q.vy = dy / d * 240;
        if (d < 10) q.life = 0;
      }
    }
    return o(q, dt, ...a);
  });
  around("onEnemyKilled", (o, e, ...a) => {
    const burning = e.burn > 0;
    const r = o(e, ...a);
    if (has("rage")) run.rage = 3;
    if (synOn("firmament")) for (let i = 0; i < 4; i++) {
      const an = i * Math.PI / 2;
      projectiles.push({ kind: "moon", x: e.x + e.w / 2 - 2, y: e.y + e.h / 2 - 2, w: 4, h: 4, vx: Math.cos(an) * 170, vy: Math.sin(an) * 170, grav: 0, life: 0.55, bounces: 0, dmg: dmgOf(0.8), hits: new Set([e]) });
    }
    if (synOn("forge") && burning) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      burst(cx, cy, 26, "#e8913a", 130); shake(1.5, 0.1);
      for (const t of near(cx, cy, 34)) { hitEnemy(t, dmgOf(1.5), Math.sign(t.x - cx) || 1, { power: 1, freeze: 0.03 }); t.burn = 3; t.burnT = 0.3; }
    }
    if (synOn("ruee") && !e.decoy && !e.summonedBy) spawnCoins(1, e.x + e.w / 2, e.y);
    if (has("fer") && !e.decoy && !e.summonedBy && Math.random() < 0.1 * luck()) spawnLoot("heart", e.x + e.w / 2, e.y);
    return r;
  });

  // Coups reçus, mort
  around("hurtPlayer", (o, src, dmg, ...a) => {
    const p = player;
    if (has("bouclier") && run.shield && p.invuln <= 0 && !p.dead && !(p.dashTimer > 0 && (has("voile") || has("lamevent")))) {
      run.shield = false; p.invuln = 1;
      burst(p.x + p.w / 2, p.y + p.h / 2, 22, "#e8f0ff", 110); shake(1.5, 0.1);
      popText(p.x + 5, p.y - 4, "Bloqué !", "#e8f0ff"); S("grappleHit");
      return;
    }
    const hp = p.hp, r = o(src, dmg, ...a);
    if (p.hp < hp && has("epines")) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      burst(cx, cy, 16, "#9cbf6a", 120);
      for (const e of near(cx, cy, 44)) hitEnemy(e, dmgOf(1), Math.sign(e.x - cx) || 1, { power: 1.2, freeze: 0.03 });
    }
    return r;
  });
  around("onPlayerHurt", (o, ...a) => { if (synOn("banquier")) return; return o(...a); });
  around("die", (o, ...a) => {
    const p = player;
    if (!has("phenix")) return o(...a);
    const ashes = synOn("cendres");                     // à vérifier avant que la plume ne brûle
    removeItem("phenix");
    p.dead = false; p.hp = stats.maxHp; p.invuln = 2.2; renderHearts();
    if (touchingSpikes(p)) { p.x = p.safeX; p.y = p.safeY; p.vx = p.vy = 0; p.prevX = p.x; p.prevY = p.y; }
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    burst(cx, cy, 60, "#f2b54a", 180, true); shake(4, 0.4); freeze = Math.max(freeze, 0.25);
    if (ashes) for (const e of near(cx, cy, 90)) { hitEnemy(e, dmgOf(3), Math.sign(e.x - cx) || 1, { power: 1.6, freeze: 0.05 }); e.burn = 4; e.burnT = 0.3; }
    toast("La plume de phénix s'embrase… tu renais de tes cendres !", 2600, true); S("relic");
  });

  // Gardiens, butin, grappin, sauts
  around("beatMini", (o, ...a) => { const r = o(...a); if (has("sel")) addDark(-15, true); return r; });
  around("addCoins", (o, n, ...a) => {
    const r = o(n, ...a);
    if (n > 0 && has("tirelire")) { run.piggy += n; while (run.piggy >= 15) { run.piggy -= 15; addKeys(1); popText(player.x + 5, player.y - 10, "+1 clé", "#f2d45a"); } }
    return r;
  });
  around("startGrapple", (o, tg, ...a) => {
    const r = o(tg, ...a);
    if (has("grappeclair") && tg && tg.kind === "enemy" && tg.ref && !tg.ref.dead) {
      const e = tg.ref; hitEnemy(e, dmgOf(1), Math.sign(e.x - player.x) || 1, { power: 0, freeze: 0.05 });
      e.stun = Math.max(e.stun, e.boss ? 0.4 : 1.4); burst(e.x + e.w / 2, e.y + e.h / 2, 14, "#fff3b8", 90);
    }
    return r;
  });
  around("onAirJump", (o, p, ...a) => {
    const r = o(p, ...a);
    if (has("orage")) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      burst(cx, cy + 4, 18, "#bfe4ff", 120, true);
      for (const e of near(cx, cy, 40)) hitEnemy(e, dmgOf(1), Math.sign(e.x - cx) || 1, { power: 1.5, freeze: 0.03 });
    }
    return r;
  });
  // Le miroir : le prochain objet en apporte un second (une seule fois)
  around("addItem", (o, id, ...a) => {
    const had = items.has(id), r = o(id, ...a);
    if (!had && items.has(id)) {
      if (id !== "miroir" && has("miroir") && !run.mirror && screen === "play") {
        run.mirror = true;
        setTimeout(() => { toast("Le miroir de l'âme se brise… et reflète un second objet.", 2200); giveRandomItem(); }, 900);
      }
      if (id === "carte") revealMap();
      // nouvelles synergies
      for (const s of SYNERGIES) if (!run.known.has(s.id) && s.items.every(has)) {
        run.known.add(s.id);
        if (screen === "play") setTimeout(() => { toast(`<b>Synergie !</b> ${s.name} · <i>${s.hint}</i>`, 3200, true); S("relic"); burst(player.x + 5, player.y + 6, 40, "#f2d45a", 150, true); }, 1400);
      }
    }
    return r;
  });
  function revealMap() {
    if (typeof mapSeen === "undefined") return;
    const cols = Math.floor((MW - 1) / CELL_W), rows = Math.floor((MH - 1) / CELL_H);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      // seulement les cases qui contiennent une salle (pas les blocs de roche pleine)
      const x0 = 1 + c * CELL_W, y0 = 1 + r * CELL_H;
      let open = false;
      for (let y = y0; y < y0 + ROOM_H && !open; y += 2) for (let x = x0; x < x0 + ROOM_W; x += 2) if (!solid(tile(x, y))) { open = true; break; }
      if (open) mapSeen.add(`${c},${r}`);
    }
  }

  // Chaque image : rage, bouclier rechargé à chaque profondeur, éclair noir
  around("updateWorld", (o, dt, ...a) => {
    const r = o(dt, ...a), p = player;
    if (!p) return r;
    run.rage = Math.max(0, run.rage - dt); run.vampT = Math.max(0, run.vampT - dt);
    if (run.rage > 0 && Math.random() < dt * 20) particles.push({ x: p.x + Math.random() * p.w, y: p.y + p.h * Math.random(), vx: 0, vy: -25, life: 0.3, max: 0.3, color: "#e04a4a", g: -10 });
    if (p.zone !== run.zone) {
      // seulement à la PREMIÈRE visite d'une profondeur (avant : chaque passage de frontière donnait une clé)
      run.seen = run.seen || new Set();
      const fresh = !run.seen.has(p.zone); run.seen.add(p.zone);
      if (run.zone !== null && fresh) {
        if (has("bouclier") && !run.shield) { run.shield = true; popText(p.x + 5, p.y - 4, "Bouclier", "#e8f0ff"); }
        if (synOn("explorateur")) { addKeys(1); popText(p.x + 5, p.y - 10, "+1 clé", "#f2d45a"); }
      }
      run.zone = p.zone;
    }
    if (has("carte") && !run.mapped) { run.mapped = true; revealMap(); }
    if (has("eclairnoir") && p.dashTimer > 0 && !(run.dash > 0)) run.pending.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, t: 0.35 });
    run.dash = p.dashTimer;
    for (const b of run.pending) {
      b.t -= dt;
      if (Math.random() < dt * 30) particles.push({ x: b.x + (Math.random() - 0.5) * 8, y: b.y + (Math.random() - 0.5) * 8, vx: 0, vy: 0, life: 0.15, max: 0.15, color: "#c88aff", g: 0 });
      if (b.t <= 0) {
        burst(b.x, b.y, 30, "#c88aff", 140, true); shake(1.5, 0.12); S("bossBoom");
        for (const e of near(b.x, b.y, 34)) hitEnemy(e, dmgOf(2), Math.sign(e.x - b.x) || 1, { power: 1.3, freeze: 0.05 });
      }
    }
    run.pending = run.pending.filter(b => b.t > 0);
    return r;
  });

  // Inventaire : les synergies trouvées (l'inventaire est chargé plus tard : on attend la fin du chargement)
  setTimeout(() => around("renderInventory", (o, ...a) => {
    const r = o(...a), g = document.getElementById("invGrid");
    const on = SYNERGIES.filter(s => s.items.every(has));
    if (g && on.length) { const html = `<div class="inv-syn"><span class="inv-syn-t">Synergies</span>${on.map(s => `<div class="inv-item syn"><span class="syn-star">✦</span><div><b>${s.name}</b><i>${s.hint}</i></div></div>`).join("")}</div>`; if (g.insertAdjacentHTML) g.insertAdjacentHTML("beforeend", html); else g.innerHTML += html; }
    return r;
  }), 0);
})();
