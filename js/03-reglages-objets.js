"use strict";
// ---------- 2. Réglages, stats, skills, objets ----------
const TUNING_DEFS = [
  { key: "runSpeed",   label: "Vitesse de course",    min: 60,   max: 200,  step: 5,    fmt: v => `${v} px/s`, hint: "Vitesse maximale au sol." },
  { key: "accelTime",  label: "Temps pour démarrer",  min: 0.02, max: 0.4,  step: 0.01, fmt: v => `${v.toFixed(2)} s`, hint: "Plus c'est long, plus le héros a de l'inertie au départ." },
  { key: "decelTime",  label: "Temps pour s'arrêter", min: 0.02, max: 0.4,  step: 0.01, fmt: v => `${v.toFixed(2)} s`, hint: "Plus c'est long, plus il glisse en lâchant la direction." },
  { key: "airControl", label: "Contrôle en l'air",    min: 0.2,  max: 1,    step: 0.05, fmt: v => `${Math.round(v * 100)} %`, hint: "Bas : on garde son élan. Haut : on change de direction librement." },
  { key: "jumpHeight", label: "Hauteur de saut",      min: 2.75, max: 4.25, step: 0.05, fmt: v => `${v.toFixed(2)} tuiles`, hint: "Une marche de 5 tuiles reste infranchissable sans double saut." },
  { key: "timeToApex", label: "Durée de la montée",   min: 0.22, max: 0.6,  step: 0.01, fmt: v => `${v.toFixed(2)} s`, hint: "Court : saut sec et nerveux. Long : saut flottant." },
  { key: "fallMult",   label: "Poids de la retombée", min: 1,    max: 2.5,  step: 0.05, fmt: v => `× ${v.toFixed(2)}`, hint: "Gravité supplémentaire en descente." },
  { key: "maxFall",    label: "Vitesse de chute max", min: 250,  max: 600,  step: 10,   fmt: v => `${v} px/s`, hint: "Limite de vitesse en chute libre." },
];
const PRESETS = {
  "Nerveux": { runSpeed: 115, accelTime: 0.05, decelTime: 0.04, airControl: 0.95, jumpHeight: 3.3, timeToApex: 0.30, fallMult: 1.6, maxFall: 430 },
  "Fluide":  { runSpeed: 125, accelTime: 0.16, decelTime: 0.12, airControl: 0.70, jumpHeight: 3.5, timeToApex: 0.38, fallMult: 1.5, maxFall: 400 },
  "Lourd":   { runSpeed: 105, accelTime: 0.30, decelTime: 0.24, airControl: 0.45, jumpHeight: 3.0, timeToApex: 0.42, fallMult: 2.0, maxFall: 480 },
};
const STORE_KEY = "lepuits.tuning";
let tuning = { ...PRESETS["Fluide"] };
try { const saved = JSON.parse(localStorage.getItem(STORE_KEY)); if (saved) tuning = { ...tuning, ...saved }; } catch (e) {}

const COMBAT = {
  coyote: 0.10, jumpBuffer: 0.12, apexGravMult: 0.55, extraJumps: 1, turnBoost: 2.2,
  maxHp: 5, damageMult: 1, attackCooldown: 0.24, attackBuffer: 0.18, attackTime: 0.12, attackRange: 20,
  knockback: 150, invulnTime: 1.0, pogoMult: 0.9, knockTaken: 1,
  chargeTime: 0.45, heavyDamage: 3,
  dashSpeed: 320, dashTime: 0.15, dashCharges: 1, dashCooldown: 0.4,
  boltSpeed: 250, boltCooldown: 0.35,
  grappleRange: 120, grappleSpeed: 330, grappleCooldown: 0.3,
  phaseSpeed: 230, phaseTime: 0.24, phaseCooldown: 0.65,
};
function deriveStats(t) {
  const h = t.jumpHeight * T, ta = t.timeToApex;
  const groundAccel = t.runSpeed / t.accelTime, groundDecel = t.runSpeed / t.decelTime;
  const jumpVel = 2 * h / ta;
  return {
    ...COMBAT,
    runSpeed: t.runSpeed, groundAccel, groundDecel,
    airAccel: groundAccel * t.airControl, airDecel: groundDecel * t.airControl * 0.35,
    gravity: 2 * h / (ta * ta), jumpVel, apexBand: jumpVel * 0.12,
    fallGravMult: t.fallMult, maxFall: t.maxFall,
  };
}

const SKILLS = [
  { id: "doubleJump", label: "DS", name: "Double saut", ready: true },
  { id: "dash", label: "DA", name: "Dash", ready: true },
  { id: "smash", label: "FR", name: "Frappe chargée", ready: true },
  { id: "grapple", label: "GR", name: "Grappin", ready: true },
  { id: "phase", label: "PH", name: "Phase", ready: true },
  { id: "bolt", label: "PR", name: "Projectile magique", ready: true },
];
const ITEMS = [
  { id: "griffon",  skill: "doubleJump", name: "Plume de griffon",    desc: "Ajoute un troisième saut.", stat: s => { s.extraJumps += 1; } },
  { id: "colosse",  skill: "doubleJump", name: "Bottes du colosse",   desc: "Retomber après un saut en l'air crée une onde de choc." },
  { id: "cape",     skill: "doubleJump", name: "Cape planante",       desc: "Maintiens Saut en tombant pour planer." },
  { id: "braise",   skill: "dash",       name: "Braise du dragon",    desc: "Le dash laisse une traînée de feu qui brûle les ennemis." },
  { id: "voile",    skill: "dash",       name: "Voile spectral",      desc: "Invulnérable pendant le dash : tu traverses les ennemis." },
  { id: "eperons",  skill: "dash",       name: "Éperons du vent",     desc: "Deux dashs d'affilée avant la recharge.", stat: s => { s.dashCharges += 1; } },
  { id: "gantelet", skill: "smash",      name: "Gantelet runique",    desc: "La frappe chargée projette des éclats de pierre." },
  { id: "marteau",  skill: "smash",      name: "Marteau du tonnerre", desc: "La frappe chargée étourdit les ennemis touchés." },
  { id: "chaine",   skill: "grapple",    name: "Chaîne vampirique",   desc: "Accrocher un ennemi lui vole 1 PV qui te revient." },
  { id: "crochet",  skill: "grapple",    name: "Crochet d'acier nain", desc: "Le grappin ramène les petits ennemis vers toi au lieu de te tracter." },
  { id: "ombre",    skill: "phase",      name: "Ombre du voleur",     desc: "Traverser un ennemi en phase le fait saigner." },
  { id: "ether",    skill: "phase",      name: "Pas de l'éther",      desc: "Pendant la phase, les projectiles ennemis te traversent." },
  { id: "ricochet", skill: "bolt",       name: "Orbe ricochet",       desc: "Les projectiles rebondissent trois fois sur les murs." },
  { id: "grimoire", skill: "bolt",       name: "Grimoire scindé",     desc: "Chaque tir se divise en trois, chacun fait moitié moins mal." },
  { id: "pacte",    mystery: true, dark: 12, name: "Pacte de sang",      desc: "Dégâts doublés, mais 2 PV max en moins.", stat: s => { s.damageMult *= 2; s.maxHp -= 2; } },
  { id: "couronne", mystery: true, dark: 10, name: "Couronne maudite",   desc: "Les ennemis ont 50 % de PV en plus, mais lâchent parfois un objet." },
  { id: "berserker",mystery: true, dark: 6, name: "Fiole de berserker", desc: "+25 % de dégâts par PV manquant." },
  { id: "armure",   mystery: true, name: "Armure de plomb",    desc: "+2 PV max et presque plus de recul, mais plus lent et saut plus court.",
    stat: s => { s.maxHp += 2; s.knockTaken = 0.3; s.runSpeed *= 0.85; s.groundAccel *= 0.85; s.airAccel *= 0.85; s.jumpVel *= 0.95; } },
  { id: "oeil",     mystery: true, dark: 10, name: "Œil du devin",       desc: "Ta lumière porte bien plus loin, mais chaque nouvelle profondeur te coûte 1 PV." },
  { id: "de",       mystery: true, dark: 6, name: "Dé du chaos",        desc: "Chaque nouvelle profondeur relance un de tes objets au hasard." },
  // Objets liés à la jauge de ténèbres
  { id: "coeurnoir", mystery: true, dark: 25, name: "Cœur noir",        desc: "+50 % de dégâts, mais les ténèbres montent de 25 d'un coup.", stat: s => { s.damageMult *= 1.5; } },
  { id: "calice",    mystery: true, dark: 8,  name: "Calice des ombres", desc: "Jusqu'à +100 % de dégâts selon le niveau de ténèbres." },
  { id: "lanterne",  mystery: true, dark: -5, name: "Lanterne bénie",    desc: "Les ténèbres montent deux fois moins vite, et ta lumière porte plus loin." },
  { id: "eaubenite", mystery: true, dark: -25, name: "Eau bénite",       desc: "Fait reculer les ténèbres de 25." },
  { id: "avarice",   mystery: true, dark: 10, name: "Pièce d'avarice",   desc: "Les ennemis lâchent deux fois plus de pièces, mais chaque coup reçu t'en fait perdre 3." },
  // ----- Armes : elles changent la façon de frapper -----
  { id: "spectrale", cat: "lame", name: "Lame spectrale",      desc: "Chaque coup d'épée projette une lame fantôme qui traverse les ennemis." },
  { id: "allonge",   cat: "lame", name: "Allonge du chevalier", desc: "Portée de l'épée +60 %.", stat: s => { s.attackRange *= 1.6; } },
  { id: "aiguise",   cat: "lame", name: "Pierre à aiguiser",   desc: "+30 % de dégâts.", stat: s => { s.damageMult *= 1.3; } },
  { id: "frenesie",  cat: "lame", name: "Gant de frénésie",    desc: "Tu frappes 35 % plus vite.", stat: s => { s.attackCooldown *= 0.65; } },
  { id: "lamebraise",cat: "lame", name: "Lame de braise",      desc: "Tes coups enflamment les ennemis." },
  { id: "revers",    cat: "lame", name: "Double tranchant",    desc: "L'épée frappe aussi derrière toi." },
  { id: "pilon",     cat: "lame", name: "Marteau-pilon",       desc: "Recul doublé : les ennemis volent et restent sonnés plus longtemps.", stat: s => { s.knockback *= 2; } },
  { id: "echo",      cat: "lame", name: "Lame d'écho",         desc: "Chaque coup se répète une fraction de seconde plus tard." },
  { id: "lune",      cat: "lame", name: "Éclats de lune",      desc: "Un ennemi vaincu libère quatre éclats de lumière." },
  { id: "affamee",   cat: "lame", name: "Lame affamée",        desc: "Tous les 8 ennemis vaincus, tu récupères 1 PV." },
  { id: "bourreau",  cat: "lame", name: "Œil du bourreau",     desc: "15 % de coups critiques qui font triple dégâts." },
  { id: "etoiles",   cat: "lame", name: "Pluie d'étoiles",     desc: "Quand tu frappes, une étoile tombe parfois sur l'ennemi." },
  // ----- Pouvoirs détournés -----
  { id: "chouette",  skill: "bolt",       name: "Plume de chouette",  desc: "Les projectiles cherchent les ennemis." },
  { id: "percant",   skill: "bolt",       name: "Pointe de diamant",  desc: "Les projectiles traversent les ennemis." },
  { id: "orbe",      skill: "bolt",       name: "Orbe géant",         desc: "Projectiles énormes et deux fois plus forts, mais plus lents." },
  { id: "lamevent",  skill: "dash",       name: "Lame du vent",       desc: "Le dash tranche les ennemis traversés." },
  { id: "ailes",     skill: "doubleJump", name: "Ailes stellaires",   desc: "Chaque saut en l'air lâche une gerbe d'étincelles vers le bas." },
  { id: "harpon",    skill: "grapple",    name: "Harpon barbelé",     desc: "Le grappin fait triple dégâts aux ennemis et les fait saigner." },
  { id: "givre",     skill: "phase",      name: "Phase de givre",     desc: "Les ennemis traversés en phase sont gelés." },
  { id: "seisme",    skill: "smash",      name: "Poing sismique",     desc: "La frappe chargée au sol lance deux ondes de choc." },
  // ----- Butin et passifs -----
  { id: "pierre",    cat: "passif", name: "Cœur de pierre",     desc: "+1 PV max.", stat: s => { s.maxHp += 1; } },
  { id: "lapin",     cat: "passif", name: "Patte de lapin",     desc: "Les ennemis, les jarres et les coffres lâchent plus de butin." },
  { id: "trousseau", cat: "passif", name: "Trousseau rouillé",  desc: "+3 clés." },
  { id: "bourse",    cat: "passif", name: "Bourse du marchand", desc: "Chaque pièce ramassée en vaut deux." },
  { id: "aimant",    cat: "passif", name: "Aimant de mineur",   desc: "Les pièces, les cœurs et les clés viennent à toi." },
  { id: "sceau",     cat: "passif", name: "Sceau du marchand",  desc: "Les boutiques te font un tiers de rabais." },
];
// Ce que le joueur lit en ramassant un objet : une phrase floue, à la Isaac. À lui de comprendre ce que ça fait.
// (La description exacte, « desc », ne sert qu'à l'atelier de test.)
const ITEM_HINTS = {
  griffon: "Encore un peu plus haut.", colosse: "Retombe lourdement.", cape: "Le vent te retient.",
  braise: "Tes pas laissent une trace brûlante.", voile: "Rien ne t'arrête quand tu files.", eperons: "Une fois ne suffit pas.",
  gantelet: "La pierre éclate avec toi.", marteau: "Ils n'entendront plus rien.", chaine: "Ce qui est à eux est à toi.",
  crochet: "Viens par ici.", ombre: "Ils saignent sur ton passage.", ether: "Rien ne t'atteint entre deux mondes.",
  ricochet: "Les murs ne l'arrêtent pas.", grimoire: "Un devient trois.",
  pacte: "Plus fort, plus fragile.", couronne: "Ils deviennent plus durs… et plus généreux.", berserker: "Plus tu saignes, plus tu frappes.",
  armure: "Solide comme un roc. Lent comme un roc.", oeil: "Tu vois loin. Ça se paie.", de: "Rien ne reste pareil.",
  coeurnoir: "Un battement sombre.", calice: "L'ombre te nourrit.", lanterne: "Une flamme qui ne faiblit pas.", eaubenite: "Purifié.",
  avarice: "L'or attire l'or… et le perd.",
  spectrale: "Ta lame a une ombre.", allonge: "Le bras du chevalier.", aiguise: "Le fil est plus fin.", frenesie: "Plus vite, encore.",
  lamebraise: "Ta lame se souvient du feu.", revers: "Tu frappes deux fois, de deux côtés.", pilon: "Ils volent loin.",
  echo: "Le coup se souvient.", lune: "Quand ils tombent, la lune se lève.", affamee: "Elle se nourrit de leurs âmes.",
  bourreau: "Parfois, le coup est fatal.", etoiles: "Le ciel t'accompagne.",
  chouette: "Elle trouve toujours sa proie.", percant: "Rien ne l'arrête.", orbe: "Plus gros. Plus lent. Plus fort.",
  lamevent: "Le vent tranche.", ailes: "Des étoiles sous tes pieds.", harpon: "Il ne lâche plus sa prise.",
  givre: "Un frisson sur ton passage.", seisme: "La terre tremble avec toi.",
  pierre: "Un cœur plus solide.", lapin: "La chance tourne.", trousseau: "Des portes vont s'ouvrir.",
  bourse: "Chaque pièce compte double.", aimant: "Tout vient à toi.", sceau: "Les marchands te font confiance.",
};
for (const it of ITEMS) it.hint = ITEM_HINTS[it.id] || "…";
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
let stats = deriveStats(tuning), skills = {}, items = new Set();
const has = id => items.has(id);
