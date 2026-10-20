"use strict";
// ---------- 25. Butin, clés, boutiques ----------
/* Le butin à la Isaac :
     pièces (1) et gemmes (5) · cœurs (+1 PV, restent au sol si tu es plein) · clés
   Ce qui en lâche : les monstres, les jarres (V), les coffres (C), les coffres dorés à clé (J)
   Les salles spéciales derrière une porte à clé (terrain k) :
     boutique (Y objet · y cœur ou clé, payés en pièces) · trésor (I objet gratuit) · sacrifice (Z : 1 PV contre une chance de récompense)
   Les effets des objets d'arme et des nouveaux objets de pouvoir sont branchés ici aussi. */
const LOOT_RATES = {
  coin: 0.30, heart: 0.06, key: 0.03,                 // par monstre vaincu
  potCoin: 0.45, potHeart: 0.10, potKey: 0.05,        // par jarre
  gemShare: 0.06,                                     // part des pièces qui sont des gemmes (5)
};
const PRICES = { item: 15, heart: 3, key: 5 };
const LOOT_SIZE = { coin: [6, 6], gem: [7, 7], heart: [8, 7], key: [5, 9] };
let coins = 0, keyCount = 0, loot = [], pots = [], goldChests = [], pedestals = [], sacrAltars = [], merchants = [];
let lootKills = 0, keyDoorHint = 0, avariceHint = 0;

const luck = () => has("lapin") ? 1.6 : 1;
function loadLoot(e) {
  if (e.t === "pot") { pots.push({ x: e.x * T + 3, y: e.y * T + 5, w: 10, h: 11, hp: 1, t: Math.random() * 6 }); return true; }
  if (e.t === "goldchest") { goldChests.push({ x: e.x * T + 1, y: e.y * T + 6, w: 14, h: 10, open: false, rest: 0 }); return true; }
  if (e.t === "treasure" || e.t === "shopitem" || e.t === "shopgood") {
    pedestals.push({ x: e.x * T + 2, y: e.y * T + 4, w: 12, h: 12, kind: e.t, item: null, good: null, taken: false, rest: 0, near: false, t: Math.random() * 6 });
    return true;
  }
  if (e.t === "sacrifice") { sacrAltars.push({ x: e.x * T, y: e.y * T + 2, w: 16, h: 14, rest: 0, uses: 0, cd: 0 }); return true; }
  if (e.t === "merchant") { merchants.push({ x: e.x * T + 2, y: e.y * T, t: Math.random() * 6 }); return true; }
  return false;
}
function resetLoot() {
  loot = []; pots = []; goldChests = []; pedestals = []; sacrAltars = []; merchants = [];
}
function resetPurse() {
  coins = 0; keyCount = 1; lootKills = 0;
  renderPurse();
}

// ----- Faire apparaître du butin -----
function spawnLoot(kind, x, y, o = {}) {
  const [w, h] = LOOT_SIZE[kind];
  loot.push({ kind, x: x - w / 2, y: y - h / 2, w, h, vx: o.vx ?? (Math.random() - 0.5) * 110, vy: o.vy ?? -110 - Math.random() * 90,
    t: Math.random() * 6, delay: o.delay ?? 0.3, onGround: false });
}
function spawnCoins(n, x, y) {
  while (n > 0) {
    if (n >= 5 && Math.random() < LOOT_RATES.gemShare * 4) { spawnLoot("gem", x, y); n -= 5; }
    else { spawnLoot("coin", x, y); n--; }
  }
}
function dropFromEnemy(e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2, L = luck(), mult = has("avarice") ? 2 : 1;
  if (e.boss) { spawnCoins(12 * mult, x, y); spawnLoot("heart", x, y); spawnLoot("heart", x, y); spawnLoot("key", x, y); return; }
  if (e.decoy || e.summonedBy) return;
  if (e.mini) { spawnCoins(8 * mult, x, y); spawnLoot("heart", x, y); if (Math.random() < 0.5) spawnLoot("key", x, y); return; }
  if (e.type === "mimic") { spawnCoins(5 * mult, x, y); if (Math.random() < 0.5) spawnLoot("key", x, y); return; }   // la mimique ne lâche plus d'objet
  if (e.champion && typeof championLoot === "function") championLoot(e, x, y, mult);
  const big = e.type === "golem";
  let n = 0;
  if (big) n = 2 + Math.floor(Math.random() * 2);
  else if (Math.random() < LOOT_RATES.coin * L) n = 1 + (Math.random() < 0.2 ? 1 : 0);
  if (n) spawnCoins(n * mult, x, y);
  // plus on descend, plus les cœurs se font rares
  const deep = typeof depthTier === "function" ? depthTier(e.y) : 0;
  if (Math.random() < LOOT_RATES.heart * L * (big ? 2.5 : 1) * Math.max(0.45, 1 - 0.12 * deep)) spawnLoot("heart", x, y);
  if (Math.random() < LOOT_RATES.key * L * (big ? 2 : 1)) spawnLoot("key", x, y);
}
function chestLoot(ch, secret) {
  const x = ch.x + 7, y = ch.y, L = luck();
  if (secret) { if (Math.random() < 0.5 * L) giveRandomItem(x, y); else { spawnLoot("key", x, y); spawnLoot("heart", x, y); } spawnCoins(4, x, y); return; }
  // un coffre ordinaire ne contient plus d'objet (seuls les coffres secrets en gardent un)
  spawnCoins(2 + Math.floor(Math.random() * 3), x, y);
  if (Math.random() < 0.45) spawnLoot("heart", x, y);
  if (Math.random() < 0.35 * L) spawnLoot("key", x, y);
  toast("Le coffre s'ouvre : un peu de butin.", 1800);
}

// ----- Ramasser -----
function renderPurse() {
  const c = document.getElementById("coinVal"), k = document.getElementById("keyVal");
  if (c) c.textContent = coins;
  if (k) k.textContent = keyCount;
}
function addCoins(n) { coins = Math.max(0, Math.min(99, coins + n)); renderPurse(); }
function addKeys(n) { keyCount = Math.max(0, Math.min(99, keyCount + n)); renderPurse(); }
function collectLoot(l) {
  const p = player, cx = l.x + l.w / 2, cy = l.y + l.h / 2;
  if (l.kind === "heart") {
    if (p.hp >= stats.maxHp) return false;              // comme dans Isaac : il reste là si tu es plein
    p.hp += 1; renderHearts(); burst(cx, cy, 10, "#c4413b", 60);
    popText(cx, cy, "+1 PV", "#ff8a80");
  } else if (l.kind === "key") { addKeys(1); burst(cx, cy, 8, "#e8d27a", 60); popText(cx, cy, "+1 clé", "#f2d45a"); }
  else {
    const v = (l.kind === "gem" ? 5 : 1) * (has("bourse") ? 2 : 1);
    addCoins(v); burst(cx, cy, l.kind === "gem" ? 10 : 5, l.kind === "gem" ? "#7fd6c0" : "#f2d45a", 50);
    if (v > 1) popText(cx, cy, `+${v}`, "#f2d45a");
  }
  typeof bumpBestiaryLoot === "function" && bumpBestiaryLoot(l.kind);
  return true;
}
const pops = [];
function popText(x, y, txt, color) { pops.push({ x, y, txt, color, life: 0.9 }); }

function updateLootItems(dt) {
  const p = player, magnet = has("aimant");
  for (const l of loot) {
    l.t += dt; l.delay = Math.max(0, l.delay - dt);
    const dx = (p.x + p.w / 2) - (l.x + l.w / 2), dy = (p.y + p.h / 2) - (l.y + l.h / 2), d = Math.hypot(dx, dy) || 1;
    const pull = l.delay <= 0 && !p.dead && (magnet ? d < 80 : d < 22) && !(l.kind === "heart" && p.hp >= stats.maxHp);
    if (pull) { l.vx = approach(l.vx, dx / d * 160, 900 * dt); l.vy = approach(l.vy, dy / d * 160, 900 * dt); l.x += l.vx * dt; l.y += l.vy * dt; }
    else {
      l.vy = Math.min(l.vy + 620 * dt, 300);
      l.hitWall = false; moveX(l, l.vx * dt); if (l.hitWall) l.vx *= -0.5;
      const vy = l.vy; moveY(l, l.vy * dt);
      if (l.onGround) { l.vx *= Math.pow(0.002, dt); if (vy > 90) { l.vy = -vy * 0.35; l.onGround = false; } }
    }
    if (l.y > MH * T) l.dead = true;
    if (l.delay <= 0 && !p.dead && overlap(p, l) && collectLoot(l)) l.dead = true;
  }
  loot = loot.filter(l => !l.dead);
  for (const f of pops) { f.life -= dt; f.y -= 18 * dt; }
  for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
}

// ----- Jarres, coffres dorés, portes à clé -----
function hitBreakables(box) {
  for (const pt of pots) if (!pt.broken && overlap(box, pt)) breakPot(pt);
}
function breakPot(pt) {
  pt.broken = true;
  const x = pt.x + 5, y = pt.y + 5, L = luck();
  for (let i = 0; i < 10; i++) particles.push({ x: pt.x + Math.random() * 10, y: pt.y + Math.random() * 10, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 90, life: 0.6, max: 0.6, color: Math.random() < 0.5 ? "#a0623a" : "#6e3f22", g: 500 });
  if (Math.random() < LOOT_RATES.potCoin * L) spawnCoins(1 + (Math.random() < 0.25 ? 1 : 0), x, y);
  if (Math.random() < LOOT_RATES.potHeart * L) spawnLoot("heart", x, y);
  if (Math.random() < LOOT_RATES.potKey * L) spawnLoot("key", x, y);
  typeof bumpBestiaryLoot === "function" && bumpBestiaryLoot("pot");
}
function openKeyDoor(c, r) {
  const stack = [[c, r]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (tile(x, y) !== "k") continue;
    grid[y][x] = ".";
    for (let i = 0; i < 6; i++) particles.push({ x: x * T + Math.random() * T, y: y * T + Math.random() * T, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, life: 0.6, max: 0.6, color: Math.random() < 0.5 ? "#8a5a30" : "#f2d45a", g: 300 });
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stack.push([x + dc, y + dr]);
  }
}
function checkKeyDoors(dt) {
  const p = player;
  keyDoorHint = Math.max(0, keyDoorHint - dt);
  const c0 = Math.floor((p.x - 3) / T), c1 = Math.floor((p.x + p.w + 3) / T), r0 = Math.floor((p.y - 2) / T), r1 = Math.floor((p.y + p.h - 1) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tile(c, r) === "k") {
    if (keyCount > 0) {
      addKeys(-1); openKeyDoor(c, r);
      shake(2, 0.15); freeze = Math.max(freeze, 0.08);
      toast("La clé tourne dans la serrure…", 1800);
    } else if (keyDoorHint <= 0) { keyDoorHint = 3; toast("Une porte verrouillée. Il te faut une clé.", 2000); }
    return;
  }
}

// ----- Piédestaux : trésor et boutique -----
function rollPedestal(pd) {
  if (pd.kind === "shopgood") { pd.good = Math.random() < 0.5 ? "heart" : "key"; return; }
  const taken = pedestals.filter(o => o.item).map(o => o.item);
  const pool = typeof itemPool === "function" ? itemPool(pd.kind === "treasure" ? "tresor" : pd.kind === "guardian" ? "gardien" : "boutique", taken) : eligibleItems(taken);
  pd.item = pool.length ? pick(pool).id : null;
  if (!pd.item) { pd.good = "heart"; pd.kind = pd.kind === "treasure" ? "treasure" : "shopgood"; }
}
const priceOf = pd => {
  if (pd.kind === "treasure" || pd.kind === "guardian" || pd.stolen) return 0;
  // les prix montent avec la profondeur ; un objet maudit est bradé chez le colporteur
  const deep = typeof depthTier === "function" ? depthTier(pd.y) : 0;
  let base = pd.item ? PRICES.item + 3 * deep : PRICES[pd.good] + Math.floor(deep / 2);
  if (pd.kind === "wander" && pd.item && ITEM[pd.item].mystery) base = Math.round(base * 0.6);
  if (pd.deal) base = Math.round(base * 0.6);
  return has("sceau") ? Math.max(1, Math.round(base * 2 / 3)) : base;
};
function pedestalLabel(pd) {
  const name = pd.item ? ITEM[pd.item].name : pd.good === "heart" ? "Cœur" : "Clé";
  const desc = pd.item ? `<i>${ITEM[pd.item].hint}</i>` : pd.good === "heart" ? "Rend 1 PV." : "Ouvre une porte ou un coffre doré.";
  const price = priceOf(pd);
  return `<b>${name}</b>${price ? ` · ${price} pièces` : ""} : ${desc}`;
}
function updatePedestals(dt) {
  const p = player;
  for (const pd of pedestals) {
    pd.t += dt;
    if (pd.taken || pd.gone) continue;
    const dx = Math.abs((p.x + p.w / 2) - (pd.x + 6)), dy = Math.abs((p.y + p.h) - (pd.y + 12));
    if ((!pd.item && !pd.good && dx < 120 && dy < 60) || (pd.item && items.has(pd.item))) rollPedestal(pd);
    const near = dx < 26 && dy < 22;
    if (near && !pd.near) toast(pedestalLabel(pd) + (pd.chained ? "<br><small>Enchaîné : une clé pour le prendre aussi.</small>" : pd.kind === "guardian" ? "<br><small>Butin du gardien : un seul au choix.</small>" : ""), 3800, true);
    pd.near = near;
    const price = priceOf(pd);
    if (!actOffer(pd, pd.chained ? "BRISER LA CHAINE" : price ? `ACHETER ${price}` : "PRENDRE", near || overlap(p, pd))) continue;
    if (coins < price) { toast(`Il te manque ${price - coins} pièce${price - coins > 1 ? "s" : ""}.`, 1800); continue; }
    if (pd.chained) {                                   // le reliquaire : une clé pour un second objet du gardien
      if (keyCount <= 0) { toast("Des chaînes retiennent cet objet. Il te faut une clé.", 1800); continue; }
      addKeys(-1); typeof SFX !== "undefined" && SFX.play("keyDoor");
    }
    addCoins(-price); pd.taken = true;
    if (typeof onPedestalTaken === "function") onPedestalTaken(pd);
    burst(pd.x + 6, pd.y + 2, 24, pd.kind === "treasure" ? "#f2d45a" : "#7fd6c0", 100);
    if (pd.item) { addItem(pd.item); itemToast(ITEM[pd.item], price ? "Acheté : " : ""); freeze = Math.max(freeze, 0.12); }
    else if (pd.good === "heart") { spawnLoot("heart", pd.x + 6, pd.y, { vx: 0, vy: -80, delay: 0 }); toast("Un cœur, merci bien.", 1400); }
    else { addKeys(1); toast("Une clé de plus.", 1400); }
    typeof bumpBestiaryLoot === "function" && bumpBestiaryLoot(price ? "buy" : "treasure");
  }
}
// ----- Autel du sacrifice : 1 PV contre une chance de récompense, et un peu de ténèbres -----
function updateSacrifice(dt) {
  const p = player;
  for (const al of sacrAltars) {
    al.cd = Math.max(0, al.cd - dt);
    if (al.cd > 0 || !actOffer(al, "SACRIFIER 1 PV", overlap(p, al))) continue;
    al.cd = 0.8;
    if (p.hp <= 1) { toast("L'autel refuse : il ne prend pas ta dernière goutte de sang.", 2200); continue; }
    p.hp -= 1; renderHearts(); al.uses++;
    burst(al.x + 8, al.y + 2, 20, "#c4413b", 90); shake(2, 0.15);
    addDark(4, true);
    const r = Math.random(), bonus = Math.min(0.3, al.uses * 0.06);
    if (r < 0.16 + bonus) { giveRandomItem(al.x + 8, al.y); }
    else if (r < 0.58 + bonus) { spawnCoins(4 + al.uses, al.x + 8, al.y); toast("L'autel crache des pièces.", 1800); }
    else if (r < 0.72 + bonus) { spawnLoot("key", al.x + 8, al.y); toast("Une clé tombe de l'autel.", 1800); }
    else toast("Le sang s'écoule… l'autel reste muet.", 1800);
  }
}
function updateGoldChests(dt) {
  const p = player;
  for (const ch of goldChests) {
    if (ch.open) continue;
    const hit = p.atkTimer > 0 && overlap(attackBox(p.x, p.y), ch);
    if (!actOffer(ch, "OUVRIR (1 CLE)", overlap(p, ch)) && !hit) { if (!overlap(p, ch)) ch.hinted = false; continue; }
    if (keyCount <= 0) { if (!ch.hinted) { ch.hinted = true; toast("Un coffre doré, fermé à clé.", 1800); } continue; }
    addKeys(-1); ch.open = true;
    burst(ch.x + 7, ch.y + 4, 30, "#f2d45a", 120);
    if (Math.random() < 0.08 * luck()) { giveRandomItem(ch.x + 7, ch.y); spawnCoins(3, ch.x + 7, ch.y); }
    else { spawnCoins(6 + Math.floor(Math.random() * 4), ch.x + 7, ch.y); spawnLoot("heart", ch.x + 7, ch.y); spawnLoot("key", ch.x + 7, ch.y); toast("Le coffre doré déborde de butin !", 2000); }
  }
}

// ----- Effets des armes et des pouvoirs détournés -----
function swordDamage(base) {
  let d = dmgOf(base), crit = false;
  if (has("bourreau") && Math.random() < 0.15 * luck()) { d *= 3; crit = true; }
  return { d, crit };
}
function onSwing(p) {
  if (p.atkDir === "side" && has("spectrale")) {
    projectiles.push({ kind: "blade", x: p.x + p.w / 2 + p.face * 6 - 5, y: p.y + 1, w: 10, h: 10, vx: p.face * 230, vy: 0, grav: 0, life: 0.5, bounces: 0, dmg: dmgOf(0.6), hits: new Set(), pierce: true, ghostWall: false });
  }
  if (has("echo")) p.echoT = 0.17;
}
function onSwordHit(e, crit) {
  // L'épée : un petit arrêt sur image et un tremblement à chaque coup qui porte
  freeze = Math.max(freeze, crit ? 0.11 : 0.065); shake(crit ? 2.5 : 1.3, 0.08);
  if (crit) { burst(e.x + e.w / 2, e.y + e.h / 2, 16, "#f2d45a", 140); popText(e.x + e.w / 2, e.y - 2, "CRITIQUE", "#f2d45a"); freeze = Math.max(freeze, 0.1); }
  if (has("lamebraise") && !e.boss) { e.burn = 3; e.burnT = 0.3; }
  else if (has("lamebraise")) { e.burn = 2; e.burnT = 0.3; }
  if (has("pilon") && !e.boss) e.stun = Math.max(e.stun, 0.6);
  if (has("etoiles") && Math.random() < 0.22 * luck()) {
    projectiles.push({ kind: "star", x: e.x + e.w / 2 - 3, y: e.y - 70, w: 6, h: 6, vx: 0, vy: 330, grav: 0, life: 0.5, bounces: 0, dmg: dmgOf(2), hits: new Set(), ghostWall: true, target: e });
  }
}
function onEnemyKilled(e) {
  dropFromEnemy(e);
  if (typeof enemyDeathFx === "function") enemyDeathFx(e);
  lootKills++;
  if (typeof bestiaryKill === "function") bestiaryKill(e.type);
  if (has("lune")) for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    projectiles.push({ kind: "moon", x: e.x + e.w / 2 - 2, y: e.y + e.h / 2 - 2, w: 4, h: 4, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, grav: 0, life: 0.55, bounces: 0, dmg: dmgOf(0.8), hits: new Set([e]) });
  }
  if (has("affamee") && lootKills % 8 === 0 && player.hp < stats.maxHp) {
    player.hp++; renderHearts(); popText(player.x + 5, player.y - 4, "+1 PV", "#ff8a80");
  }
}
function onPlayerHurt() {
  if (has("avarice") && coins > 0) {
    const lost = Math.min(3, coins); addCoins(-lost);
    for (let i = 0; i < lost; i++) particles.push({ x: player.x + 5, y: player.y + 4, vx: (Math.random() - 0.5) * 120, vy: -90 - Math.random() * 60, life: 0.7, max: 0.7, color: "#f2d45a", g: 400 });
  }
}
function onAirJump(p) {
  if (!has("ailes")) return;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i - 2) * 0.32;
    projectiles.push({ kind: "spark", x: p.x + p.w / 2 - 1.5, y: p.y + p.h - 2, w: 3, h: 3, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, grav: 200, life: 0.5, bounces: 0, dmg: dmgOf(0.6), hits: new Set() });
  }
}
function onHeavyStrike(p) {
  if (!has("seisme") || !p.onGround) return;
  for (const d of [-1, 1]) projectiles.push({ kind: "quake", x: p.x + p.w / 2 - 5 + d * 6, y: p.y + p.h - 10, w: 10, h: 10, vx: d * 210, vy: 0, grav: 0, life: 0.7, bounces: 0, dmg: dmgOf(1.5), hits: new Set(), pierce: true, ground: true });
  shake(3, 0.2);
}
function onPhaseThrough(e) {
  if (!has("givre")) return;
  e.daze = Math.max(e.daze, e.boss ? 0.8 : 2.5); e.frozen = e.boss ? 0.8 : 2.5;
  burst(e.x + e.w / 2, e.y + e.h / 2, 10, "#bfe6ef", 70);
}
function onItemAdded(id) {
  if (id === "trousseau") addKeys(3);
}
// Projectiles : tête chercheuse et ondes au sol
function steerProjectile(q, dt) {
  if (q.kind === "bolt" && has("chouette")) {
    let best = null, bd = 140;
    for (const e of enemies) {
      if (e.dead || q.hits.has(e)) continue;
      const d = Math.hypot(e.x + e.w / 2 - q.x, e.y + e.h / 2 - q.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const sp = Math.hypot(q.vx, q.vy) || 1, a = Math.atan2(q.vy, q.vx), want = Math.atan2(best.y + best.h / 2 - q.y, best.x + best.w / 2 - q.x);
      let da = want - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const na = a + Math.max(-6 * dt, Math.min(6 * dt, da));
      q.vx = Math.cos(na) * sp; q.vy = Math.sin(na) * sp;
    }
  }
  if (q.ground) {                       // l'onde suit le sol, et s'éteint au bord du vide
    const fx = q.vx > 0 ? q.x + q.w : q.x;
    const below = tile(Math.floor(fx / T), Math.floor((q.y + q.h + 2) / T));
    if (!solid(below) && below !== "-") q.life = 0;
    if (Math.random() < dt * 40) dust(q.x + q.w / 2, q.y + q.h, 1);
  }
  if (q.kind === "star" && q.target && !q.target.dead) q.x = approach(q.x, q.target.x + q.target.w / 2 - 3, 200 * dt);
}

// ----- Brûlure et gel -----
function updateStatus(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.frozen) e.frozen = Math.max(0, e.frozen - dt);
    if (e.burn > 0) {
      e.burnT -= dt;
      if (Math.random() < dt * 14) particles.push({ x: e.x + Math.random() * e.w, y: e.y + e.h * 0.5, vx: 0, vy: -30, life: 0.35, max: 0.35, color: Math.random() < 0.5 ? "#f2b54a" : "#e8913a", g: -20 });
      if (e.burnT <= 0) { e.burnT = 0.45; e.burn--; hitEnemy(e, dmgOf(0.5), 0, { power: 0, freeze: 0, stun: 0.05 }); }
    }
  }
}

function updateLoot(dt) {
  const p = player;
  updateLootItems(dt);
  if (p.dead) return;
  checkKeyDoors(dt);
  updatePedestals(dt);
  updateSacrifice(dt);
  updateGoldChests(dt);
  updateStatus(dt);
  // Lame d'écho : le coup se répète
  if (p.echoT > 0) {
    p.echoT -= dt;
    if (p.echoT <= 0) {
      const box = attackBox(p.x, p.y);
      ghosts.push({ x: box.x, y: box.y, w: box.w, h: box.h, life: 0.15, echo: true });
      hitBreakables(box);
      for (const e of enemies) if (!e.dead && overlap(box, e)) hitEnemy(e, dmgOf(0.5), p.face, { power: 0.5, freeze: 0.02 });
    }
  }
  // Lame du vent : le dash tranche
  if (p.dashTimer > 0 && has("lamevent")) {
    p.dashHits = p.dashHits || new Set();
    const box = { x: p.x - 3, y: p.y - 2, w: p.w + 6, h: p.h + 4 };
    for (const e of enemies) if (!e.dead && !p.dashHits.has(e) && overlap(box, e)) { p.dashHits.add(e); hitEnemy(e, dmgOf(1.5), p.dashDir, { power: 0.8 }); }
    hitBreakables(box);
  } else if (p.dashHits) p.dashHits = null;
}

// ----- Dessin -----
function drawCoinAt(x, y, t, gem) {
  if (gem) {
    ctx.fillStyle = "#1f5a4e"; ctx.fillRect(x + 1, y, 5, 7); ctx.fillRect(x, y + 1, 7, 5);
    ctx.fillStyle = "#7fd6c0"; ctx.fillRect(x + 1, y + 1, 5, 5);
    ctx.fillStyle = "#e6fff8"; ctx.fillRect(x + 2, y + 2, 2, 2);
    return;
  }
  const sq = Math.abs(Math.cos(t * 4));                        // la pièce tourne sur elle-même
  const w = Math.max(1.34, 6 * sq);
  ctx.fillStyle = "#8a6420"; ctx.fillRect(x + 3 - w / 2, y, w, 6);
  ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 3 - w / 2 + 0.67, y + 0.67, Math.max(0.67, w - 1.34), 4.66);
  if (w > 3) { ctx.fillStyle = "#fff3b8"; ctx.fillRect(x + 3 - w / 2 + 1.34, y + 1.34, 1.34, 1.34); }
}
function drawHeartAt(x, y) {
  ctx.fillStyle = "#5a1414";
  ctx.fillRect(x, y + 1, 8, 3); ctx.fillRect(x + 1, y, 2, 1); ctx.fillRect(x + 5, y, 2, 1); ctx.fillRect(x + 1, y + 4, 6, 1); ctx.fillRect(x + 2, y + 5, 4, 1); ctx.fillRect(x + 3, y + 6, 2, 1);
  ctx.fillStyle = "#e0453c";
  ctx.fillRect(x + 1, y + 1, 2, 3); ctx.fillRect(x + 5, y + 1, 2, 3); ctx.fillRect(x + 3, y + 2, 2, 3); ctx.fillRect(x + 2, y + 4, 4, 1);
  ctx.fillStyle = "#ffb3a8"; ctx.fillRect(x + 1.5, y + 1.34, 1, 1);
}
function drawKeyAt(x, y) {
  ctx.fillStyle = "#6e5418"; ctx.fillRect(x, y, 5, 5); ctx.fillRect(x + 1.5, y + 4, 2, 5); ctx.fillRect(x + 3.5, y + 6, 1.5, 1); ctx.fillRect(x + 3.5, y + 8, 1.5, 1);
  ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 0.67, y + 0.67, 3.67, 3.67); ctx.fillRect(x + 2, y + 4, 1, 4.5); ctx.fillRect(x + 3, y + 6.2, 1.5, 0.67); ctx.fillRect(x + 3, y + 8.2, 1.5, 0.67);
  ctx.fillStyle = "#3a2c0c"; ctx.fillRect(x + 1.67, y + 1.67, 1.67, 1.67);
}
function drawPotAt(x, y, t) {
  ctx.fillStyle = "#3a2214"; ctx.fillRect(x + 2, y, 6, 2); ctx.fillRect(x, y + 3, 10, 7); ctx.fillRect(x + 1, y + 2, 8, 9);
  ctx.fillStyle = "#a0623a"; ctx.fillRect(x + 3, y + 0.67, 4, 1.33); ctx.fillRect(x + 1, y + 3, 8, 6.5); ctx.fillRect(x + 2, y + 2, 6, 8.33);
  ctx.fillStyle = "#6e3f22"; ctx.fillRect(x + 1, y + 6, 8, 1); ctx.fillRect(x + 2, y + 9.4, 6, 0.67);
  ctx.fillStyle = "#d89a62"; ctx.fillRect(x + 2.5, y + 3.5, 1.33, 2);
}
function drawGoldChestAt(x, y, open) {
  ctx.fillStyle = "#2a1a08"; ctx.fillRect(x, y + 2, 14, 8);
  ctx.fillStyle = open ? "#5a4010" : "#c8962c"; ctx.fillRect(x + 1, y + 3, 12, 6);
  ctx.fillStyle = "#8a6420"; ctx.fillRect(x + 1, y + 6, 12, 1);
  if (open) { ctx.fillStyle = "#c8962c"; ctx.fillRect(x + 1, y - 2, 12, 3); ctx.fillStyle = "rgba(242,212,90,0.4)"; ctx.fillRect(x + 3, y + 1, 8, 2); return; }
  ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 1, y + 3, 12, 1); ctx.fillRect(x + 6, y + 5, 2, 3);
  ctx.fillStyle = "#2a1a08"; ctx.fillRect(x + 6.67, y + 6, 0.67, 1.33);
}
function drawPedestalAt(pd, ox, oy) {
  const x = snap(pd.x - ox), y = snap(pd.y - oy);
  ctx.fillStyle = "#3a3440"; ctx.fillRect(x - 1, y + 7, 14, 5);
  ctx.fillStyle = "#6a6270"; ctx.fillRect(x, y + 7, 12, 1.33); ctx.fillRect(x + 2, y + 9, 8, 3);
  if (pd.taken || pd.gone) return;
  const bob = pd.chained ? 0 : Math.sin(pd.t * 2.4) * 1.5, ix = x + 2, iy = snap(y - 6 + bob);
  if (pd.item) drawItemIcon(pd.item, ix, iy);
  else if (pd.good === "heart") drawHeartAt(ix + 2, iy + 2);
  else if (pd.good === "key") drawKeyAt(ix + 3, iy);
  else { ctx.fillStyle = "rgba(233,225,207,0.3)"; ctx.fillRect(ix + 3, iy + 3, 4, 4); }
  const price = priceOf(pd);
  if (price && (pd.item || pd.good)) drawPrice(x + 6, y + 14, price, coins >= price);
  if (pd.chained) {                                     // chaînes en croix + petite clé
    ctx.fillStyle = "#a9b7b0";
    for (let i = 0; i < 6; i++) { ctx.fillRect(ix - 1 + i * 2, iy - 1 + i * 2, 1.34, 1.34); ctx.fillRect(ix + 9 - i * 2, iy - 1 + i * 2, 1.34, 1.34); }
    drawKeyAt(x + 3, y + 13);
  }
}
// Une petite icône par objet : une forme selon la famille, la couleur de son pouvoir
const ITEM_COLORS = { lame: ["#e9e1cf", "#8a8290"], passif: ["#f2d45a", "#8a6420"], mystery: ["#b48ae0", "#3a2550"] };
function itemColors(it) {
  if (it.skill) return [RELIC_INFO[it.skill].color, "#2a1f2e"];
  if (it.mystery) return ITEM_COLORS.mystery;
  return ITEM_COLORS[it.cat] || ITEM_COLORS.passif;
}
function drawItemIcon(id, x, y) {
  if (typeof drawSpriteIcon === "function" && drawSpriteIcon(id, x, y)) return;
  const it = ITEM[id], [c1, c2] = itemColors(it);
  ctx.fillStyle = c2; ctx.fillRect(x, y + 1, 8, 8); ctx.fillRect(x + 1, y, 6, 10);
  ctx.fillStyle = c1;
  if (it.cat === "lame") { ctx.fillRect(x + 3.5, y + 1, 1.33, 6); ctx.fillRect(x + 2, y + 6, 4.33, 1); ctx.fillRect(x + 3.5, y + 7, 1.33, 2); }
  else { ctx.fillRect(x + 1, y + 1, 6, 8); ctx.fillStyle = c2; ctx.fillRect(x + 3, y + 3, 2, 4); }
}
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];
function drawNumber(x, y, n, color) {
  const s = String(n); let cx = x - s.length * 2;
  ctx.fillStyle = color;
  for (const ch of s) {
    const d = DIGITS[+ch];
    for (let i = 0; i < 15; i++) if (d[i] === "1") ctx.fillRect(cx + (i % 3) * 0.67 * 1.5, y + Math.floor(i / 3) * 0.67 * 1.5, 1, 1);
    cx += 4;
  }
}
function drawPrice(x, y, price, afford) {
  ctx.fillStyle = "rgba(10,8,14,0.75)"; ctx.fillRect(x - 8, y - 1, 16, 9);
  drawCoinAt(x - 7, y + 0.5, 0, false);
  drawNumber(x + 3, y + 0.5, price, afford ? "#f2d45a" : "#8a7f74");
}
function drawSacrificeAt(al, ox, oy) {
  const x = snap(al.x - ox), y = snap(al.y - oy);
  ctx.fillStyle = "#24142e"; ctx.fillRect(x, y + 6, 16, 8);
  ctx.fillStyle = "#4a3050"; ctx.fillRect(x + 1, y + 6, 14, 1.33); ctx.fillRect(x + 3, y + 8, 10, 6);
  ctx.fillStyle = "#c4413b"; ctx.fillRect(x + 6, y + 4, 4, 2);
  const k = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.fillStyle = `rgba(196,65,59,${0.4 + 0.4 * k})`; ctx.fillRect(x + 7, y + 6, 2, 3 + al.uses % 4);
  // Des pointes d'os de chaque côté
  ctx.fillStyle = "#d8cfbf"; ctx.fillRect(x + 1, y + 1, 1.33, 5); ctx.fillRect(x + 13.67, y + 1, 1.33, 5);
}
function drawMerchantAt(m, ox, oy) {
  const x = snap(m.x - ox), y = snap(m.y - oy), b = Math.sin(m.t * 1.6 + time) * 0.6;
  ctx.fillStyle = "#1c1622"; ctx.fillRect(x, y + 4 + b, 12, 12 - b);
  ctx.fillStyle = "#3d2f4a"; ctx.fillRect(x + 1, y + 3 + b, 10, 12 - b); ctx.fillRect(x + 2, y + 1 + b, 8, 4);
  ctx.fillStyle = "#0b0810"; ctx.fillRect(x + 3, y + 3 + b, 6, 3);
  ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 4, y + 4 + b, 1, 1); ctx.fillRect(x + 7, y + 4 + b, 1, 1);
  ctx.fillStyle = "#8a6420"; ctx.fillRect(x + 8, y + 10 + b, 3, 3);    // sa bourse
}
function drawLoot(ox, oy) {
  for (const m of merchants) drawMerchantAt(m, ox, oy);
  for (const pt of pots) if (!pt.broken) drawPotAt(snap(pt.x - ox), snap(pt.y - oy), pt.t);
  for (const ch of goldChests) drawGoldChestAt(snap(ch.x - ox), snap(ch.y - oy), ch.open);
  for (const pd of pedestals) drawPedestalAt(pd, ox, oy);
  for (const al of sacrAltars) drawSacrificeAt(al, ox, oy);
  for (const l of loot) {
    const x = snap(l.x - ox), y = snap(l.y - oy - (l.onGround ? Math.abs(Math.sin(l.t * 3)) * 1.2 : 0));
    if (l.kind === "coin" || l.kind === "gem") drawCoinAt(x, y, l.t, l.kind === "gem");
    else if (l.kind === "heart") drawHeartAt(x, y);
    else drawKeyAt(x, y);
  }
}
function drawLootTop(ox, oy) {
  for (const e of enemies) if (e.frozen > 0) {
    ctx.fillStyle = `rgba(191,230,239,${Math.min(0.55, e.frozen)})`;
    ctx.fillRect(snap(e.x - ox), snap(e.y - oy), e.w, e.h);
  }
  for (const f of pops) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    drawTinyText(f.x - ox, f.y - oy, f.txt, f.color);
  }
  ctx.globalAlpha = 1;
}
function drawProjectileExtra(q, x, y) {
  if (q.kind === "blade") {
    const k = Math.min(1, q.life / 0.2);
    ctx.fillStyle = `rgba(190,215,255,${0.35 * k})`; ctx.fillRect(x + (q.vx > 0 ? -6 : 10), y + 2, 6, 6);
    ctx.fillStyle = `rgba(220,235,255,${0.85 * k})`;
    const f = q.vx > 0 ? 1 : -1, cx = x + 5;
    for (let i = 0; i < 5; i++) ctx.fillRect(cx + f * (3 - Math.abs(i - 2) * 1.5), y + 1 + i * 2, 1.67, 2);
  } else if (q.kind === "spark" || q.kind === "moon") {
    ctx.fillStyle = q.kind === "moon" ? "#eaf3ff" : "#f2d45a"; ctx.fillRect(x, y, q.w, q.h);
    ctx.fillStyle = q.kind === "moon" ? "rgba(160,200,255,0.4)" : "rgba(232,145,58,0.5)"; ctx.fillRect(x - q.vx * 0.02, y - q.vy * 0.02, q.w, q.h);
  } else if (q.kind === "star") {
    ctx.fillStyle = "rgba(242,212,90,0.35)"; ctx.fillRect(x + 2, y - 10, 2, 10);
    ctx.fillStyle = "#fff3b8"; ctx.fillRect(x + 2, y, 2, 6); ctx.fillRect(x, y + 2, 6, 2);
    ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 2, y + 2, 2, 2);
  } else if (q.kind === "quake") {
    const h = 6 + Math.sin(time * 40 + q.x) * 2;
    ctx.fillStyle = "rgba(232,145,58,0.8)"; ctx.fillRect(x, y + q.h - h, q.w, h);
    ctx.fillStyle = "#fff3d6"; ctx.fillRect(x + 2, y + q.h - h, q.w - 4, 1.33);
  } else { ctx.fillStyle = "#9a9088"; ctx.fillRect(x, y, q.w, q.h); }
}
function lootLights(hole, ox, oy) {
  for (const l of loot) hole(l.x + l.w / 2 - ox, l.y + l.h / 2 - oy, l.kind === "coin" ? 12 : 18);
  for (const pd of pedestals) if (!pd.taken && !pd.gone) hole(pd.x + 6 - ox, pd.y - oy, 40);
  for (const ch of goldChests) if (!ch.open) hole(ch.x + 7 - ox, ch.y + 4 - oy, 26);
  for (const al of sacrAltars) hole(al.x + 8 - ox, al.y + 6 - oy, 36);
  for (const m of merchants) hole(m.x + 6 - ox, m.y + 6 - oy, 44);
  for (const q of projectiles) if (q.kind !== "shard" && q.kind !== "bolt") hole(q.x + q.w / 2 - ox, q.y + q.h / 2 - oy, 18);
}
// Un tout petit alphabet 3×5 pour les nombres et les mots qui flottent
const FONT35 = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101",
  S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", "+": "000010111010000", "-": "000000111000000", " ": "000000000000000", "!": "010010010000010",
  É: "111100110100111", È: "111100110100111",
};
DIGITS.forEach((d, i) => { FONT35[i] = d; });
function drawTinyText(x, y, txt, color) {
  const s = txt.toUpperCase(), w = s.length * 4 - 1;
  let cx = Math.round(x - w / 2);
  ctx.fillStyle = "rgba(10,8,14,0.6)"; ctx.fillRect(cx - 1, Math.round(y) - 1, w + 2, 7);
  ctx.fillStyle = color;
  for (const ch of s) {
    const g = FONT35[ch] || FONT35[" "];
    for (let i = 0; i < 15; i++) if (g[i] === "1") ctx.fillRect(cx + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1);
    cx += 4;
  }
}
// La porte à clé
function drawKeyDoorTile(x, y, c, r, get = tile) {
  ctx.fillStyle = "#3a2414"; ctx.fillRect(x, y, T, T);
  ctx.fillStyle = "#6e4426"; ctx.fillRect(x + 1, y, 6, T); ctx.fillRect(x + 9, y, 6, T);
  ctx.fillStyle = "#8a5a30"; ctx.fillRect(x + 2, y, 1, T); ctx.fillRect(x + 10, y, 1, T);
  ctx.fillStyle = "#5b5560"; ctx.fillRect(x, y + 3, T, 2); ctx.fillRect(x, y + 11, T, 2);
  // la serrure dorée, sur la tuile du milieu de la porte
  const above = get(c, r - 1) === "k", below = get(c, r + 1) === "k";
  if ((above && below) || (!above && !below)) {
    ctx.fillStyle = "#f2d45a"; ctx.fillRect(x + 5, y + 5, 6, 6);
    ctx.fillStyle = "#1a1008"; ctx.fillRect(x + 7, y + 6, 2, 2); ctx.fillRect(x + 7.5, y + 8, 1, 2);
  }
}
