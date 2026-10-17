"use strict";
/* =========================================================
   LE PUITS — moteur de base + éditeur
   1. Constantes et niveau   2. Réglages, stats, skills, objets
   3. Entrées   4. Collisions   5. Joueur   6. Combat
   7. Projectiles et feu   8. Ennemis   9. Monde   10. Rendu
   11. HUD et atelier   12. Éditeur   13. Sauvegarde   14. Boucle
   ========================================================= */

// ---------- 1. Constantes et niveau ----------
const T = 16, VW = 320, VH = 180, STEP = 1 / 120;
const S = 3;
const snap = v => Math.round(v * S) / S;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clone = o => JSON.parse(JSON.stringify(o));

/* Format d'un niveau :
   rows : le terrain, une chaîne par ligne. # pierre · x mur fissuré · ^ pics · - planche · . vide
   ents : tout ce qui est posé dessus, en coordonnées de tuiles :
          spawn · exit · altar · relic (s = skill) · crawler · bat · bucket (d = descente en tuiles) */
