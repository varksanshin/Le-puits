"use strict";
// ---------- 36. Un gardien par zone ----------
/* Avant, chaque relique avait SON gardien : en chaos (reliques au hasard), on pouvait tomber sur la Feu-Mère dès le début.
   Maintenant, le gardien dépend de la ZONE où se trouve la relique, et sa force de la profondeur :
     entrée      → la Reine des larves
     mines       → le Contremaître ou le Geôlier
     zone noyée  → la Gorgone-Mère (nouvelle : ne la regarde pas quand ses yeux s'ouvrent)
     profondeurs → le Roi-Champignon ou la Feu-Mère (adoucie)
     antre       → l'Ombre affamée ou le Templier déchu (nouveau : bouclier de face, frappe-le de dos ou d'en haut)
   La relique, elle, reste tirée au sort en chaos, et il faut toujours le bon pouvoir pour aller plus loin. */
Object.assign(MINI_BOSSES, {
  gorgone:  { base: "gorgone",  name: "La Gorgone-Mère",   hp: 24, scale: 2.2, speed: 1.1, every: 3.4, attacks: ["acid", "brood", "acid"] },
  templier: { base: "templier", name: "Le Templier déchu", hp: 30, scale: 1.6, speed: 1.3, every: 3.4, attacks: ["bonerain", "stomp"] },
});
// la Feu-Mère, trop dure : moins de PV, moins d'orbes, attaques plus espacées
Object.assign(MINI_BOSSES.smash, { hp: 18, every: 4.3, orbs: 2 });
const ZONE_BOSSES = {
  entree: ["doubleJump"], mines: ["dash", "grapple"], noyee: ["gorgone"], spores: ["bolt", "smash"], antre: ["phase", "templier"],
  ciel: ["phase", "templier"], enfer: ["phase", "templier"],
};
const ZONE_TIER = { entree: 0, mines: 1, noyee: 2, spores: 3, antre: 4, ciel: 4, enfer: 4 };
const ZONE_HP = [0.62, 0.72, 0.84, 0.95, 1.05];             // part des PV du gardien selon la zone

(() => {
  const around = (name, f) => {
    let orig; try { orig = eval(name); } catch (e) { return; }
    if (typeof orig !== "function") return;
    const w = function (...a) { return f.call(this, orig.bind(this), ...a); };
    try { eval(`${name} = w`); } catch (e) {}
  };
  const zoneOfTile = (c, r) => { const b = (level.biomes || []).find(b => c >= b.x && c < b.x + b.w && r >= b.y && r < b.y + b.h); return b ? b.id : "entree"; };
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  around("setupMinis", (o, ...a) => {
    const r = o(...a);
    const used = {};
    for (const m of minis) {
      const zone = zoneOfTile(Math.floor(m.relic.x / T), Math.floor(m.relic.y / T));
      const list = ZONE_BOSSES[zone] || [m.relic.skill];
      const seed = hash(m.key + "|" + (typeof runSeed !== "undefined" ? runSeed : 0));
      // deux reliques dans la même zone : deux gardiens différents
      let k = seed % list.length;
      if ((used[zone] || []).includes(list[k]) && list.length > 1) k = (k + 1) % list.length;
      (used[zone] = used[zone] || []).push(list[k]);
      m.def = MINI_BOSSES[list[k]] || m.def; m.zone = zone;
    }
    return r;
  });
  // Les PV suivent la zone (et non plus le nombre de reliques déjà prises)
  around("spawnMini", (o, m, ...a) => {
    const r = o(m, ...a), e = m.enemy;
    if (!e || m.state !== "fight") return r;
    const owned = SKILLS.filter(s => skills[s.id]).length, before = miniHpMult(owned);
    const tier = ZONE_TIER[m.zone] ?? 2, want = ZONE_HP[tier] * (gameMode === "chaos" ? 0.92 : 1);
    const k = want / Math.max(0.01, before);
    e.hp = Math.max(8, Math.round(e.hp * k)); e.maxHp = e.hp;
    if (e.mini && e.mini.base === "gorgone") { e.homeX = e.x; e.homeY = e.y; e.gazeT = 3; }
    return r;
  });
})();
