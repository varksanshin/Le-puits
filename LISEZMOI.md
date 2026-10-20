# Le Puits

Un jeu web qui mêle roguelite et Metroidvania : un aventurier descend au fond d'un puits pour détruire la menace qui ronge son pays.

## Jouer

Double-clique sur `index.html`. Le jeu s'ouvre dans ton navigateur, sans rien installer.
Clavier ou manette, les touches se changent dans Options.

## Comment le projet est rangé

```
index.html                 la page : le cadre du jeu, les menus, l'éditeur
css/style.css              l'apparence de la page
niveaux/map-principale.js  la map du mode histoire, construite depuis le plan (ne pas modifier à la main)
niveaux/plan-histoire.js   le plan du mode histoire : quelle salle va où, les reliques, les serrures
niveaux/salles.js          la bibliothèque de salles modèles (18 × 12 tuiles), partagée avec le mode chaos
js/                        le code du jeu, chargé dans l'ordre des numéros
  01-base.js               taille des tuiles, de l'écran, cadence de la physique
  02-niveau.js             lecture d'une map, reliques, chargement du brouillon
  03-reglages-objets.js    réglages du mouvement, stats, les 6 skills, les 51 objets
  04-entrees.js            clavier, manette, touches configurables
  05-collisions.js         collisions avec le décor, grilles, pics, cristaux
  06-joueur.js             le héros : course, saut, dash, phase, grappin
  07-combat.js             épée, frappe chargée, dégâts, mort
  08-projectiles.js        projectile magique, éclats, feu
  09-ennemis.js            les 5 premiers monstres et leurs comportements
  10-monde.js              autels, reliques, profondeurs, messages, particules, caméra
  11-rendu.js              tout ce qui est dessiné à l'écran
  12-interface.js          cœurs, skills, atelier de test, réglages
  13-editeur.js            l'éditeur de niveau
  14-sauvegarde.js         sauvegarde de la map
  15-menus.js              menu de démarrage, pause, options, écran des touches
  16-boucle.js             la boucle du jeu
  17-tenebres.js           la jauge de ténèbres : sources, feux de camp, stèles, effets
  18-boss.js               le Gardien, sa porte, son arène et ses trois versions
  19-fin-de-run.js         chrono, temps intermédiaires, écran de fin, records
  20-titre.js              écran titre (course dans la forêt) et saut dans le puits au lancement
  21-elements.js           eau, courants d'air, murs d'accroche, plateformes friables, leviers, coffres, épreuves, secrets
  22-biomes.js             les cinq biomes : couleurs, lumière, décors, nom affiché à l'arrivée
  23-assembleur.js         assemble des salles en une map, et vérifie qu'on ne peut pas rester coincé
  24-chaos.js              le mode chaos : tire un chemin, place reliques et serrures, ajoute des branches
  25-butin.js              pièces, cœurs, clés, jarres, coffres dorés, portes à clé, boutique, trésor, sacrifice, effets des armes
  26-sprites.js            les sprites en pixel art (une lettre par pixel) et leurs palettes
  27-bestiaire.js          les 4 nouveaux monstres et le carnet du bestiaire
  27b-gardiens.js          les gardiens (mini-boss) des reliques
  27c-objets.js            la deuxième vague d'objets (24) et les synergies entre objets
  27d-monstres.js          six créatures de la 0.22 : fouisseur, templier, gorgone, sonneur, nécromancien, reflet
  28-decor.js              décors du plafond et des murs, particules d'ambiance, morts en éclats de pixels, étincelles des coups
  28b-pause.js             inventaire, carte du puits, sauvegarde de la partie
  28c-tactile.js           commandes tactiles (seulement sur écran tactile) et plein écran
  28d-remaster.js          le « remaster » : fonds en parallaxe, cape physique, héros, arcs d'épée, déformations des monstres, halos colorés
  28e-heritage.js          l'Héritage : les Braises gagnées à chaque run et les améliorations permanentes
  28f-vraiefin.js          la vraie fin cachée (l'autel des reliques et le Gardien sans chaînes)
  28g-speedrun.js          le mode speedrun (temps intermédiaires, records, graine du jour)
  28h-fins.js              les fins : les deux dimensions (céleste et infernale), les fins alternatives et les scènes de fin animées
  28i-economie.js          l'économie à la Isaac : butin des gardiens, autels des ombres, colporteur, tripot, prison et compagnons,
                           salles spéciales tirées au sort en histoire, champions et renfort des monstres en profondeur
  30-musique.js            la musique 16-bits générée en direct
  31-sons.js               les bruitages générés en direct (héros, combat, monstres, butin, gardiens)
  34-pvp.js                le duel en ligne : pseudo, recherche d'adversaire, draft, arène, manches, classement (Supabase Realtime)
  vendor/supabase.js       la bibliothèque Supabase (chargée seulement quand on ouvre le duel)
  35-objets-au-sol.js      la touche Action, les objets qui tombent au sol, les synergies universelles, ITEM_OFF (objets retirés des tirages : vide pour l'instant)
  36-gardiens-zones.js     un gardien par zone (ZONE_BOSSES), leurs PV selon la profondeur, la Gorgone-Mère et le Templier déchu
  37-siege.js              mode Siège (en test) : vue du dessus, vagues, sorts à niveaux (SG_SPELLS : éveil au 5, forme finale au 10, SG.slots emplacements),
                           objets à rareté (SG_RARITY, SG_SCROLLS), boss final (seigneur, SG.finalWave), difficulté selon l'équipe (SG.coopCount, coopHp, lvCount),
                           coop locale et en ligne (l'invité déplace lui-même son héros)
  33-synchro.js            synchronise la progression entre appareils (code de reprise, Supabase : cloud_saves)
  32-en-ligne.js           envoie un résumé anonyme de chaque partie à Supabase (projet « le-puits ») pour l'équilibrage
  29-demarrage.js          le démarrage du jeu (toujours le dernier)
outils/assembler.py        refait une version en un seul fichier HTML
outils/construire-histoire.js  vérifie le plan du mode histoire et réécrit la map (node outils/construire-histoire.js)
outils/generer-histoire.js     génère un nouveau plan labyrinthique du mode histoire (essaie des graines, garde le meilleur plan valide)
```

Les fichiers JS se partagent leurs variables : l'ordre des balises `<script>` dans `index.html` compte.
Pour ajouter un fichier, place sa balise au bon endroit dans cette liste.

## Les endroits à modifier le plus souvent

- **Un objet** : tableau `ITEMS` dans `js/03-reglages-objets.js`. Un objet qui change des chiffres utilise `stat`, les autres sont lus dans le code avec `has("id")`.
- **Un monstre** : `ENEMY_TYPES` et sa fonction `update…` dans `js/09-ennemis.js` (ou `ENEMY_AI` dans `js/27-bestiaire.js`), son texte dans `BESTIARY_INFO`, son sprite dans `SPRITES` (`js/26-sprites.js`) et son image dans `enemyFrame`.
- **Un sprite** : `SPRITES` dans `js/26-sprites.js`. Une lettre par pixel, « . » pour le vide. Les couleurs viennent de `PAL` (commune) et `SPRITE_PAL` (par monstre).
- **Les gardiens des reliques** : `MINI_BOSSES` en haut de `js/27b-gardiens.js` (PV, taille, vitesse, liste d'attaques, délai entre deux attaques) ; chaque attaque est décrite dans `MINI_ATTACKS`.
- **Les phrases floues des objets** : `ITEM_HINTS` dans `js/03-reglages-objets.js`.
- **Le butin** : les taux sont dans `LOOT_RATES`, les prix dans `PRICES`, en haut de `js/25-butin.js`.
- **Les salles spéciales** : `boutique`, `tresor`, `sacrifice` dans `niveaux/salles.js` (lettres : M marchand, Y objet à vendre, y cœur ou clé, I trésor, Z autel, V jarre, J coffre doré). Dans le plan, le lien vers elles porte `lock: "k"` (porte à clé).
- **Le mouvement** : `PRESETS` et `COMBAT` dans `js/03-reglages-objets.js`.
- **La jauge de ténèbres** : tous les chiffres sont dans `DARK`, en haut de `js/17-tenebres.js`.
- **Le Gardien** : ses trois versions sont dans `BOSS_VARIANTS`, en haut de `js/18-boss.js` (la quatrième, cachée, dans `js/28f-vraiefin.js`). Son sprite est `boss_idle` / `boss_raise` dans `js/26-sprites.js`.
- **Les icônes des objets** : `ITEM_ICONS` dans `js/26-sprites.js` (dessin, couleur, reflet) ; les dessins sont les sprites `icon_…`.
- **Les synergies** : `SYNERGIES` dans `js/27c-objets.js` (deux objets → un bonus).
- **L'Héritage** : `HERITAGE` en haut de `js/28e-heritage.js` (coûts par niveau) et `embersFor` pour les Braises gagnées.
- **Économie et difficulté** : `ECO` en haut de `js/28i-economie.js` (autels, colporteurs, renfort par profondeur, taux de champions, plafond des dégâts, prix du tripot). Les salles spéciales de l'histoire : `STORY_BAGS`. Les prix de base : `PRICES` dans `js/25-butin.js`.
- **Duel** : `PVP` en haut de `js/34-pvp.js` (nombre de choix, temps par choix, manches, durée d'une manche, PV par cœur, dégâts). Objets interdits en duel : `PVP_BAN`. Les arènes : `PVP_ARENAS` (moitié gauche, recopiée en miroir). Côté Supabase : `pvp_players`, `pvp_matches`, fonctions `pvp_*` (Elo, K = 32).
- **Statistiques en ligne** : tableau `runs` dans Supabase, vues `balance_summary` (taux de victoire, objets et dégâts moyens par profondeur) et `death_causes` (ce qui tue le plus).
- **Les fins** : textes dans `ENDINGS` (`js/19-fin-de-run.js` et `js/28h-fins.js`), conditions dans `specialEnding`, scènes dans `SCENES` et leur durée dans `OUTRO_LEN` (`js/28h-fins.js`). Les dimensions sont dans `DIMENSIONS` (renfort des créatures, danger, fréquence) ; leurs maîtres sont `BOSS_VARIANTS.seraphin` et `BOSS_VARIANTS.demon`.
- **Le plongeon** : `DIVE` en haut de `js/07-combat.js`.
- **Les sons** : une recette par son dans `js/31-sons.js` ; le volume général est `VOLUME`.
- **Les textes de fin** : `ENDINGS` dans `js/19-fin-de-run.js`.
- **Le plan du mode histoire** : `niveaux/plan-histoire.js`, puis `node outils/construire-histoire.js`. L'outil dit dans quel ordre on trouve les reliques et prévient si une salle peut coincer le joueur.
- **Le mode chaos** : les réglages sont en haut de `js/24-chaos.js` (taille de la grille, nombre de reliques, de branches).
- **Une salle modèle** : `niveaux/salles.js`. Les portes sont toujours aux mêmes endroits, ce qui permet de tout raccorder.
- **La map** : utilise l'éditeur intégré, puis « Copier, importer, réinitialiser » pour récupérer le texte de la map.

## Sauvegardes

Joué depuis ce dossier, le jeu garde ta map et tes réglages dans ton navigateur.
La version en ligne a sa propre sauvegarde. Pour passer une map de l'une à l'autre, copie son texte depuis l'éditeur et importe-le de l'autre côté.

## Version en un seul fichier

`python outils/assembler.py` crée `le-puits.html`, un fichier unique qui contient tout le jeu. Pratique pour l'envoyer à quelqu'un ou le publier en ligne.
