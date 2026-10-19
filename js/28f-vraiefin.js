"use strict";
// ---------- 28f. La vraie fin ----------
/* Une fois les fins de la Lumière ET des Abysses obtenues, un autel apparaît devant la porte du Gardien.
   Il porte six empreintes. Si tu l'atteins avec toutes les reliques de la carte, reste immobile devant lui :
   le Gardien t'attendra sans ses chaînes, plus fort que jamais. Le vaincre mène à la vraie fin, « La Source ». */

BOSS_VARIANTS.true = {
  name: "Le Gardien sans chaînes", hp: 70, idle: 0.8, volley: 5, waveSpeed: 180, charge: 240, contact: 2,
  color: "#e8d27a", dark: "#3a2448", eye: "#ffffff", summons: [0.66, 0.33], doubleSlam: true, summonMore: true,
};
ENDINGS.true = {
  name: "La Source", color: "#f2d45a",
  text: "Les reliques brillent ensemble et le Gardien s'agenouille : il n'était que le premier à être descendu. Au fond du puits, la Source attendait quelqu'un qui ne soit ni tout à fait lumière, ni tout à fait ombre. Tu poses la main sur l'eau… et le puits, enfin, se tait.",
  note: "Vraie fin. Merci d'être descendu jusqu'ici.",
};
// La vraie fin s'ouvre quand on a connu la Lumière et les Abysses (en histoire ou en chaos)
function trueEndingUnlocked() {
  const e = (loadRecords().endings) || {};
  return !!((e.pure || e["chaos-pure"]) && (e.abyss || e["chaos-abyss"]));
}
let trueRun = false;

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  const missing = () => relics.filter(r => !r.taken).length;
  around("resetRun", (o, ...a) => { const r = o(...a); trueRun = false; return r; });

  // L'autel se pose sur le sol le plus proche, à gauche ou à droite de la porte
  function altarOf(d) {
    if (d.altar !== undefined) return d.altar;
    d.altar = null;
    const fr = Math.floor((d.y + d.h - 1) / T);
    for (const off of [-3, 3, -4, 4, -5, 5, -2, 2]) {
      const c = Math.floor((d.x + d.w / 2) / T) + off;
      if (!solid(tile(c, fr)) && !solid(tile(c, fr - 1)) && solid(tile(c, fr + 1)) && tile(c, fr) !== "^") {
        d.altar = { x: c * T, y: (fr + 1) * T - 12, w: 16, h: 12, hold: 0, hinted: false }; break;
      }
    }
    return d.altar;
  }

  around("updateBossDoor", (o, dt, ...a) => {
    const r = o(dt, ...a), d = bossDoor, p = player;
    if (!d || bossFight || !p || p.dead || trueRun || !trueEndingUnlocked()) return r;
    const al = altarOf(d); if (!al) return r;
    if (overlap(p, { x: al.x - 4, y: al.y - 8, w: al.w + 8, h: al.h + 8 })) {
      if (!al.hinted) {
        al.hinted = true;
        const m = missing();
        toast(m > 0 ? `Un autel aux empreintes de reliques. Il en manque ${m}…` : "Toutes les empreintes s'illuminent. Pose tes reliques…", 2800);
      }
      if (missing() === 0) {
        if (actOffer(al, "POSER LES RELIQUES", true)) al.hold = 1.2;
        if (al.hold >= 1.2) {
          trueRun = true;
          burst(al.x + 8, al.y, 60, "#f2d45a", 160, true); shake(3, 0.4); freeze = Math.max(freeze, 0.25);
          if (typeof SFX !== "undefined") SFX.play("relic");
          toast("<b>Les chaînes du Gardien se brisent.</b> La porte s'ouvre sur une autre voie…", 3600, true);
        }
      }
    } else { al.hold = Math.max(0, al.hold - dt * 2); al.hinted = false; }
    return r;
  });
  // Une vraie run : le Gardien qui attend derrière la porte est le Gardien sans chaînes
  around("enterArena", (o, ...a) => {
    const r = o(...a);
    if (trueRun && bossFight) {
      enemies = enemies.filter(e => !e.boss);
      const boss = makeBoss("true");
      enemies.push(boss);
      bossFight.tier = "true"; bossFight.boss = boss;
      bossNameEl.textContent = BOSS_VARIANTS.true.name;
      bossBarEl.dataset.tier = "true";
      renderBossBar();
      toast(BOSS_VARIANTS.true.name.toUpperCase(), 2600);
    }
    return r;
  });

  // Dessin de l'autel et de la porte dorée
  around("drawBossDoor", (o, ox, oy, ...a) => {
    const r = o(ox, oy, ...a), d = bossDoor;
    if (!d || mode === "edit" || !trueEndingUnlocked()) return r;
    const al = altarOf(d); if (!al) return r;
    const x = al.x - ox, y = al.y - oy, pul = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.fillStyle = "#3a3444"; ctx.fillRect(x + 1, y + 3, 14, 9);
    ctx.fillStyle = "#5a5560"; ctx.fillRect(x, y + 1, 16, 3); ctx.fillRect(x + 2, y + 10, 12, 2);
    // six empreintes : allumées si la relique correspondante est prise
    const list = relics.slice(0, 6);
    for (let i = 0; i < 6; i++) {
      const rl = list[i], cx = x + 2 + (i % 3) * 4.5, cy = y + 5 + Math.floor(i / 3) * 3;
      ctx.fillStyle = !rl ? "#24202a" : rl.taken ? RELIC_INFO[rl.skill].color : "#16121c";
      ctx.fillRect(cx, cy, 2.5, 2);
    }
    if (trueRun) {
      ctx.fillStyle = `rgba(242,212,90,${0.25 + 0.25 * pul})`;
      ctx.fillRect(d.x - ox - 3, d.y - oy - 6, d.w + 6, d.h + 6);
    }
    if (al.hold > 0 && !trueRun) { ctx.fillStyle = "rgba(242,212,90,0.9)"; ctx.fillRect(x, y - 6, 16 * Math.min(1, al.hold / 1.2), 1.33); }
    return r;
  });

  // Fin de run : le compte des fins inclut la vraie, et l'indice change une fois la voie ouverte
  around("renderEndPanel", (o, ...a) => {
    const r = o(...a), el = document.getElementById("endUnlock"), e = (loadRecords().endings) || {};
    if (!el) return r;
    const got = ["normal", "pure", "abyss"].filter(t => e[t] || e["chaos-" + t]).length;
    let txt = `Fins obtenues : ${got} / 3`;
    if (e.true || e["chaos-true"]) txt += " · ✦ Vraie fin trouvée";
    else if (trueEndingUnlocked()) txt += " · Tu as connu la Lumière et les Abysses. Un autel attend devant la porte du Gardien : apporte-lui toutes les reliques.";
    el.textContent = txt;
    return r;
  });
})();
