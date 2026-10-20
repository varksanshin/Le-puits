"use strict";
// ---------- 35. Touche Action, objets au sol, synergies universelles ----------
/* 1. La touche Action : une petite invite apparaît au-dessus de ce qu'on peut prendre, ouvrir, acheter…
   2. Les objets ne s'ajoutent plus d'un coup : ils tombent au sol avec leur icône. On les ramasse avec Action.
      On apprend ainsi à reconnaître chaque objet à son image.
   3. Tous les objets se combinent, comme dans Isaac :
      - ce qui change les projectiles (Grimoire scindé ×3, Plume de chouette téléguidée, Pointe de diamant perçante,
        Orbe ricochet, Orbe géant) s'applique à TOUS tes projectiles : tirs, lames spectrales, os, éclats, flèches… ;
      - ce qui touche (venin, braise, foudre, sangsue, bourreau, marteau-pilon, pluie d'étoiles…) s'applique aussi
        aux coups de tes projectiles, pas seulement à l'épée.
      Lame spectrale + Grimoire + Chouette + Venin = trois lames fantômes téléguidées et empoisonnées. */

// Les objets qui ne sortent plus dans les tirages (ils restent dans le code : les vieilles sauvegardes les gardent)
const ITEM_OFF = new Set();   // vide : tous les objets restent dans les tirages (on gagne moins d'objets, mais n'importe lequel peut sortir)
// Les projectiles qui portent les effets de l'épée (pas les retombées d'effets, pour éviter les réactions en chaîne)
const PROJ_ONHIT = new Set(["bolt", "blade", "shard", "spark", "arrow"]);
const PROJ_SHAPE = new Set(["bolt", "blade", "shard", "spark", "arrow", "moon"]);
let itemDrops = [];

function dropItem(id, x, y) {
  if (!ITEM[id]) return;
  const dir = player ? (Math.sign(x - (player.x + player.w / 2)) || (Math.random() < 0.5 ? -1 : 1)) : 1;
  itemDrops.push({ id, x: x - 5, y: y - 6, w: 10, h: 12, vx: dir * (30 + Math.random() * 30), vy: -170, t: Math.random() * 6, onGround: false, delay: 0.35, near: false });
  burst(x, y, 18, "#f2d45a", 90);
  if (typeof SFX !== "undefined") SFX.play("chest");
}
// Un objet au hasard : il tombe au sol (x, y = d'où il sort). Remplace la version de js/10-monde.js.
giveRandomItem = function (x, y) {
  const pool = eligibleItems();
  if (!pool.length) { toast("Tu possèdes déjà tout ce que le puits pouvait offrir.", 2400); return; }
  const it = pick(pool);
  const p = player;
  dropItem(it.id, x ?? p.x + p.w / 2 + p.face * 14, y ?? p.y);
};

// ----- Les projectiles prennent tous les modificateurs -----
function modProjectile(q) {
  q._mods = true;
  if (!PROJ_SHAPE.has(q.kind) || q.boomer && q.kind !== "blade") return;
  const own = q.kind === "bolt";                                  // le tir a déjà ses propres règles (fireBolt)
  if (has("percant")) q.pierce = true;
  if (has("ricochet") && !own && !q.ground && !q.ghostWall) q.bounces = Math.max(q.bounces || 0, 2);
  if (has("orbe") && !own) { q.x -= q.w * 0.25; q.y -= q.h * 0.25; q.w *= 1.5; q.h *= 1.5; q.dmg *= 1.5; q.vx *= 0.85; q.vy *= 0.85; }
  if (has("grimoire") && !own && !q.split && q.kind !== "moon" && q.kind !== "spark") {
    q.split = true; q.dmg *= 0.6;
    const sp = Math.hypot(q.vx, q.vy) || 1, a = Math.atan2(q.vy, q.vx);
    for (const k of [-0.28, 0.28]) {
      const c = { ...q, hits: new Set(q.hits), vx: Math.cos(a + k) * sp, vy: Math.sin(a + k) * sp, split: true, _mods: true };
      projectiles.push(c);
    }
  }
}
function onProjHit(q, e) {
  if (!PROJ_ONHIT.has(q.kind) || !e || e.rival) return;
  if (typeof onSwordHit === "function") onSwordHit(e, false);
}

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  // Les effets « élémentaires » passent par TOUS tes coups : épée, plongeon, frappe chargée, dash, grappin,
  // ondes de choc, explosions, projectiles, compagnons… (pas les dégâts qui durent, pour éviter les boucles)
  around("hitEnemy", (o, e, dmg, dirX, opt = {}, ...a) => {
    const mine = e && !e.dead && !e.rival && opt.freeze !== 0;
    const r = o(e, dmg, dirX, opt, ...a);
    if (mine && !e.dead) {
      if (has("lamebraise")) { e.burn = Math.max(e.burn || 0, e.boss ? 2 : 3); e.burnT = Math.min(e.burnT || 0.3, 0.3); }
      if (has("venin")) { e.bleed = Math.max(e.bleed || 0, 3); e.bleedT = Math.min(e.bleedT || 0.3, 0.3); }
      if (has("pilon") && !e.boss) e.stun = Math.max(e.stun, 0.6);
    }
    return r;
  });
  // Les projectiles portent la couleur de tes éléments : feu, poison, foudre
  around("updateProjectiles", (o, dt, ...a) => {
    const r = o(dt, ...a);
    const fx = [has("lamebraise") && ["#f2b54a", "#e8913a"], has("venin") && ["#9cbf6a", "#4f6b3a"], has("foudre") && ["#fff3b8", "#c8a83a"]].filter(Boolean);
    if (fx.length) for (const q of projectiles) if (PROJ_SHAPE.has(q.kind) && Math.random() < dt * 30) {
      const c = fx[Math.floor(Math.random() * fx.length)];
      particles.push({ x: q.x + Math.random() * q.w, y: q.y + Math.random() * q.h, vx: -q.vx * 0.05, vy: c[0] === "#9cbf6a" ? 25 : -25, life: 0.3, max: 0.3, color: c[Math.random() < 0.5 ? 0 : 1], g: 0 });
    }
    return r;
  });
  around("eligibleItems", (o, ...a) => o(...a).filter(it => !ITEM_OFF.has(it.id)));
  // la Plume de chouette guide tous les projectiles (pas seulement le tir)
  around("steerProjectile", (o, q, dt, ...a) => {
    const r = o(q, dt, ...a);
    if (q.kind !== "bolt" && has("chouette") && PROJ_SHAPE.has(q.kind) && !q.ground && !q.boomer) {
      let best = null, bd = 140;
      for (const e of enemies) {
        if (e.dead || e.hidden || q.hits.has(e)) continue;
        const d = Math.hypot(e.x + e.w / 2 - q.x, e.y + e.h / 2 - q.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(q.vx, q.vy) || 1, an = Math.atan2(q.vy, q.vx), want = Math.atan2(best.y + best.h / 2 - q.y, best.x + best.w / 2 - q.x);
        let da = want - an; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const na = an + Math.max(-6 * dt, Math.min(6 * dt, da));
        q.vx = Math.cos(na) * sp; q.vy = Math.sin(na) * sp;
      }
    }
    return r;
  });
  around("resetRun", (o, ...a) => { const r = o(...a); if (!(typeof loadingSave !== "undefined" && loadingSave)) itemDrops = []; return r; });

  // ----- Les objets au sol -----
  around("updateLoot", (o, dt, ...a) => {
    const r = o(dt, ...a), p = player;
    for (const d of itemDrops) {
      d.t += dt; d.delay = Math.max(0, d.delay - dt);
      if (!d.onGround) {
        d.vy = Math.min(d.vy + 620 * dt, 300);
        d.hitWall = false; moveX(d, d.vx * dt); if (d.hitWall) d.vx *= -0.4;
        moveY(d, d.vy * dt);
        if (d.onGround) { d.vx = 0; dust(d.x + 5, d.y + d.h, 3); }
      }
      if (d.y > MH * T) { d.y = player.y - 10; d.x = player.x; d.vy = 0; }
      if (p.dead || d.delay > 0) continue;
      const near = Math.abs(p.x + p.w / 2 - d.x - 5) < 18 && Math.abs(p.y + p.h / 2 - d.y - 6) < 20;
      if (near && !d.near && ITEM[d.id]) toast(`<b>${ITEM[d.id].name}</b>`, 1600, true);
      d.near = near;
      if (actOffer(d, "PRENDRE", near)) {
        d.taken = true;
        addItem(d.id); itemToast(ITEM[d.id]);
        freeze = Math.max(freeze, 0.12); burst(d.x + 5, d.y + 5, 30, "#f2d45a", 120);
      }
    }
    itemDrops = itemDrops.filter(d => !d.taken);
    return r;
  });
  around("drawLoot", (o, ox, oy, ...a) => {
    const r = o(ox, oy, ...a);
    for (const d of itemDrops) {
      const x = snap(d.x - ox), y = snap(d.y - oy - (d.onGround ? 2 + Math.sin(d.t * 2.6) * 1.5 : 0));
      const k = 0.5 + 0.5 * Math.sin(d.t * 3);
      ctx.fillStyle = `rgba(242,212,90,${0.12 + 0.12 * k})`; ctx.fillRect(x - 3, y - 2, 16, 16);
      drawItemIcon(d.id, x + 1, y);
      if (d.onGround) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(snap(d.x - ox) + 1, snap(d.y - oy) + d.h - 1, 8, 1.34); }
    }
    return r;
  });
  around("lootLights", (o, hole, ox, oy, ...a) => { const r = o(hole, ox, oy, ...a); for (const d of itemDrops) hole(d.x + 5 - ox, d.y + 5 - oy, 30); return r; });

  // ----- L'invite de la touche Action -----
  const keyName = () => {
    if (input.pad) return padLabel(padBinds.action);
    const k = (binds.action || []).find(Boolean);
    return k ? keyLabel(k) : "HAUT";
  };
  around("draw", (o, a, ...rest) => {
    const r = o(a, ...rest);
    const f = ACT.focus;
    if (!f || typeof screen === "undefined" || screen !== "play" || !player || player.dead) return r;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const ox = snap(cam.x), oy = snap(cam.y);
    const cx = Math.round(f.x + (f.w || 10) / 2 - ox), top = Math.round(f.y - oy) - 13 + Math.sin(time * 4) * 0.8;
    const key = String(keyName()).toUpperCase().slice(0, 6), label = ACT.label.slice(0, 22);
    const kw = key.length * 4 + 3, lw = label.length * 4 + 2, w = kw + lw + 3;
    const x0 = cx - w / 2;
    ctx.fillStyle = "rgba(10,8,14,0.82)"; ctx.fillRect(x0 - 1, top - 1, w + 2, 9);
    ctx.fillStyle = "#f2d45a"; ctx.fillRect(x0, top, kw, 7);
    drawTinyText(x0 + kw / 2, top + 1, key, "#140e18");
    drawTinyText(x0 + kw + 2 + lw / 2, top + 1, label, "#f6efe0");
    return r;
  });

  // ----- Sauvegarde des objets au sol -----
  around("saveGame", (o, quiet, ...a) => {
    const r = o(quiet, ...a);
    if (!r) return r;
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); s.drops = itemDrops.map(d => ({ id: d.id, x: d.x, y: d.y })); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
    return r;
  });
  around("loadGame", (o, ...a) => {
    let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
    const r = o(...a);
    if (r && s && s.drops) itemDrops = s.drops.filter(d => ITEM[d.id]).map(d => ({ ...d, w: 10, h: 12, vx: 0, vy: 0, t: 0, onGround: true, delay: 0, near: false }));
    return r;
  });
})();
