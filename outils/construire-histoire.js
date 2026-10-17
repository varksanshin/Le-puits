// Construit la map du mode histoire à partir du plan : node outils/construire-histoire.js
// Vérifie d'abord la logique (ordre des reliques, salles atteignables, pièges), puis écrit niveaux/map-principale.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const racine = path.dirname(__dirname);
globalThis.NOSCATTER = !!process.env.NOSCATTER;
const ctx = { TERRAIN: new Set(["#", "x", "^", "-", "|", "H", "=", "~", "%", "g", "G", "f", "B", "k", "."]), console };
vm.createContext(ctx);
for (const f of ["niveaux/salles.js", "js/23-assembleur.js", "niveaux/plan-histoire.js"])
  vm.runInContext(fs.readFileSync(path.join(racine, f), "utf8").replace(/^"use strict";/, "") + "\nthis.SALLES=typeof SALLES!=='undefined'?SALLES:this.SALLES;this.PLAN_HISTOIRE=typeof PLAN_HISTOIRE!=='undefined'?PLAN_HISTOIRE:this.PLAN_HISTOIRE;this.assemblePlan=typeof assemblePlan!=='undefined'?assemblePlan:this.assemblePlan;this.checkPlan=typeof checkPlan!=='undefined'?checkPlan:this.checkPlan;", ctx);
// Contrôle des salles : 18 × 12 exactement
for (const [n, s] of Object.entries(ctx.SALLES)) {
  if (s.rows.length !== 12 || s.rows.some(r => r.length !== 18)) throw new Error("Salle mal dimensionnée : " + n + " " + s.rows.map(r => r.length).join(","));
}
const { report } = ctx.checkPlan(ctx.PLAN_HISTOIRE);
console.log(report.join("\n"));
const lv = ctx.assemblePlan(ctx.PLAN_HISTOIRE);
const ent = e => "{" + Object.entries(e).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ") + "}";
const out = `"use strict";
/* La map du mode histoire, construite automatiquement depuis niveaux/plan-histoire.js
   (node outils/construire-histoire.js). Tu peux la retoucher dans l'éditeur : ton brouillon est gardé
   tant que la map d'origine (« base ») ne change pas. */
const DEFAULT_LEVEL = {
  v: 1, base: ${JSON.stringify(lv.base)}, w: ${lv.w}, h: ${lv.h},
  biomes: [
    ${lv.biomes.map(b => JSON.stringify(b)).join(",\n    ")},
  ],
  rows: [
${lv.rows.map(r => `    "${r}",`).join("\n")}
  ],
  ents: [
    ${lv.ents.map(ent).join(",\n    ")},
  ],
};
`;
fs.writeFileSync(path.join(racine, "niveaux/map-principale.js"), out);
console.log(`Map écrite : ${lv.w} × ${lv.h} tuiles, ${lv.ents.length} éléments`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(lv));
