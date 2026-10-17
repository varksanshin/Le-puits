"use strict";
// ---------- 26. Sprites en pixel art ----------
/* Chaque sprite est dessiné à la main, une lettre par pixel (« . » = transparent), avec sa palette.
   Au premier usage, chaque image est peinte une fois dans un petit canvas (plus sa version blanche
   pour le flash quand on touche), puis simplement recopiée à l'écran.
   Pour retoucher un sprite : change les lettres ci-dessous, la palette dit quelle couleur va où. */
const PAL = {
  o: "#140e18",                 // contour
  h: "#4a2e22", H: "#2e1c16",   // cheveux / capuche
  s: "#e3c39a", S: "#b98d66",   // peau
  r: "#a8333a", R: "#6e1f24",   // tunique, cape
  b: "#e8913a",                 // ceinture
  l: "#2a1f2e", B: "#4a3428",   // jambes, bottes
  e: "#0d0b10", w: "#f6efe0",   // œil, blanc
  m: "#c9c2b4", M: "#8a8290",   // métal
};
const SPRITES = {
  // ----- Le héros (12 × 16, regarde à droite, les pieds en bas) -----
  hero_idle0: [
    "............",
    "....oooo....",
    "...ohhhhoo..",
    "..ohhhhhhho.",
    "..ohhhsssso.",
    "..ohhsswseo.",
    "..oohsssSo..",
    "..oRoooooo..",
    ".oRRrrrrro..",
    ".oRrrrrrSo..",
    ".oRrbbbbbo..",
    ".oRrrrrrro..",
    "..oRlllll o.",
    "...olo.olo..",
    "...oBo.oBo..",
    "...oBBooBBo.",
  ],
  hero_idle1: [
    "............",
    "............",
    "....oooo....",
    "...ohhhhoo..",
    "..ohhhhhhho.",
    "..ohhhsssso.",
    "..ohhsswseo.",
    "..oohsssSo..",
    ".oRRoooooo..",
    ".oRRrrrrro..",
    ".oRrrrrrSo..",
    ".oRrbbbbbo..",
    "..oRrrrrro..",
    "...olo.olo..",
    "...oBo.oBo..",
    "...oBBooBBo.",
  ],
  hero_run0: [
    "............",
    "....oooo....",
    "...ohhhhoo..",
    "..ohhhhhhho.",
    "..ohhhsssso.",
    ".ohhhsswseo.",
    "oRohhsssSo..",
    "oRRoooooo...",
    ".oRRrrrrro..",
    "..oRrrrrSo..",
    "..oRbbbbbo..",
    "..orrrrrro..",
    "..olloollo..",
    ".olo...olo..",
    ".oBo....oBo.",
    ".oBBo...oBBo",
  ],
  hero_run1: [
    "....oooo....",
    "...ohhhhoo..",
    "..ohhhhhhho.",
    "..ohhhsssso.",
    ".ohhhsswseo.",
    "oRohhsssSo..",
    "oRRoooooo...",
    ".oRRrrrrro..",
    "..oRrrrrSo..",
    "..oRbbbbbo..",
    "..orrrrrro..",
    "...ollllo...",
    "...oloolo...",
    "...oBooBo...",
    "...oBBoBBo..",
    "............",
  ],
  hero_run2: [
    "............",
    "....oooo....",
    "...ohhhhoo..",
    "..ohhhhhhho.",
    "..ohhhsssso.",
    ".ohhhsswseo.",
    "oRohhsssSo..",
    "oRRoooooo...",
    ".oRRrrrrro..",
    "..oRrrrrSo..",
    "..oRbbbbbo..",
    "..orrrrrro..",
    "...olloolo..",
    "..olo..olo..",
    ".oBBo..oBo..",
    ".......oBBo.",
  ],
  hero_jump: [
    "....oooo....",
    "...ohhhhoo..",
    "..ohhhhhhho.",
    "..ohhhsssso.",
    "..ohhsswseo.",
    "..oohsssSo..",
    ".oRoooooo...",
    "oRRrrrrrro..",
    "oRRrrrrrSo..",
    ".oRrbbbbbo..",
    ".oRrrrrrro..",
    "..olloollo..",
    "..olo..olo..",
    "..oBBo.oBo..",
    "...oo..oBBo.",
    "............",
  ],
  hero_fall: [
    "............",
    "...oooo.....",
    "..ohhhhoo...",
    ".ohhhhhhho..",
    ".ohhhsssso..",
    ".ohhsswseo..",
    ".oohsssSo...",
    "..oooooooRo.",
    ".orrrrrrRRo.",
    ".orrrrrSoRo.",
    ".orbbbbbo...",
    ".orrrrrro...",
    ".olo..olo...",
    ".olo..olo...",
    "oBBo..oBBo..",
    ".oo....oo...",
  ],
  // ----- Les monstres -----
  crawler0: [
    "..............",
    "....oooooo....",
    "..oo66666666o..",
    ".o6656665666o.",
    "o66g66g66g666o",
    "o5555555555e5o",
    ".oo4o4oo4o4oo.",
    "..............",
  ],
  crawler1: [
    "..............",
    "..............",
    "...ooooooo....",
    ".oo66566656oo.",
    "o66g66g66g666o",
    "o5555555555e5o",
    ".o4o4oo4o4ooo.",
    "..............",
  ],
  bat0: [
    "o........o",
    "oo......oo",
    "o7o.oo.o7o",
    "o77o88o77o",
    ".o778877o.",
    "..o8w8wo..",
    "..o8888o..",
    "...o..o...",
  ],
  bat1: [
    "..........",
    "....oo....",
    "...o88o...",
    "..o8w8wo..",
    ".o778877o.",
    "o77o88o77o",
    "o7o.oo.o7o",
    "oo......oo",
  ],
  spitter0: [
    "...oooooo...",
    "..o999999o..",
    ".o99:99999o.",
    ".o999999eeo.",
    ".o99999999o.",
    "..o:9999:o..",
    "...oooooo...",
    "....o;;o....",
    "...o;;;;o...",
    "..o;;oo;;o..",
  ],
  spitter1: [
    "............",
    "..oooooooo..",
    ".o99999999o.",
    "o99:9999eeeo",
    "o999999eoooo",
    "o99999999eeo",
    ".o:99999:oo.",
    "..oooooooo..",
    "....o;;o....",
    "..oo;oo;oo..",
  ],
  golem0: [
    "......oooooooo......",
    ".....oMMMMMMMMo.....",
    ".....oMeMMMMeMo.....",
    ".....oMMMMMMMMo.....",
    "...ooooooooooooooo..",
    "..oMMgggggMMMMMMMMo.",
    ".oMMMggMMMMMMMMMMMMo",
    ".oMMoMMMMMMMMMMMoMMo",
    ".oMMoMMMMoMMMMMMoMMo",
    ".oMMoMMMMoMMMMMMoMMo",
    ".oMMoMMMMMMMMMMMoMMo",
    ".oMMoMMMMMMMMMMMoMMo",
    ".oMMoMMMMMMMMMMMoMMo",
    "..oooMMMMMMMMMMMooo.",
    "....oMMMMMMMMMMMo...",
    "....oooooooooooo....",
    "...oMMMo....oMMMo...",
    "...oMMMo....oMMMo...",
    "...oMMMo....oMMMo...",
    "...oMMMo....oMMMo...",
    "..oMMMMo....oMMMMo..",
    "..oooooo....oooooo..",
  ],
  wisp0: [
    "...oo...",
    "..o<<o..",
    ".o<>><o.",
    "o<>ww><o",
    "o<>ww><o",
    ".o<>><o.",
    "..o<<o..",
    "...oo...",
  ],
  wisp1: [
    "........",
    "...oo...",
    "..o<>o..",
    ".o<ww>o.",
    ".o<ww>o.",
    "..o<>o..",
    "...oo...",
    "........",
  ],
  // ----- Nouveaux monstres -----
  // Champignon sauteur (profondeurs) : il se ramasse, puis bondit vers toi
  champi0: [
    "....oooooo....",
    "..oo!!!!!!oo..",
    ".o!!w!!!!w!!o.",
    "o!!!!!!!!!!!!o",
    "o!w!!!w!!!!w!o",
    "oooooooooooooo",
    "....o$$$$o....",
    "....o$e$eo....",
    "....o$$$$o....",
    "...o$$$$$$o...",
    "...oooooooo...",
  ],
  champi1: [
    "..............",
    "..............",
    "....oooooo....",
    "..oo!!!!!!oo..",
    ".o!!w!!!!w!!o.",
    "o!w!!!w!!!!w!o",
    "oooooooooooooo",
    "...o$$e$$eo...",
    "..o$$$$$$$$o..",
    "..o$$$$$$$$o..",
    "..oooooooooo..",
  ],
  // Prisonnier squelette (mines, antre) : il garde ses distances et lance des os
  squelette0: [
    "...oooo...",
    "..owwwwo..",
    "..oweweo..",
    "..owwwwo..",
    "...owwo...",
    "..oo&&oo..",
    ".ow&ww&wo.",
    ".ow&ww&wo.",
    ".o.owwo.o.",
    "...o&&o...",
    "...owwo...",
    "..ow..wo..",
    "..ow..wo..",
    ".oww..wwo.",
  ],
  squelette1: [
    "...oooo...",
    "..owwwwo..",
    "..oweweo..",
    "..owwwwo..",
    "...owwo...",
    "..oo&&oo..",
    ".ow&ww&wo.",
    ".ow&ww&wo.",
    ".o.owwo.o.",
    "...o&&o...",
    "...owwo...",
    "...owwo...",
    "..owwwo...",
    "..oww.wwo.",
  ],
  squelette_throw: [
    "...oooo..ow",
    "..owwwwo.ow",
    "..oweweo.ow",
    "..owwwwoow.",
    "...owwoow..",
    "..oo&&ow...",
    ".ow&ww&o...",
    ".ow&ww&o...",
    ".o.owwo....",
    "...o&&o....",
    "...owwo....",
    "..ow..wo...",
    "..ow..wo...",
    ".oww..wwo..",
  ],
  // Rôdeur d'ombre (antre) : il se glisse dans le noir et bondit
  rodeur0: [
    "......oooo....",
    "....oo^^^^o...",
    "...o^^^^^^^o..",
    "..o^^^^^^y^yo.",
    ".o^^^^^^^^^^o.",
    "o^^^^^^^^^^o..",
    "o^^o^^o^^^o...",
    ".oo.oo.ooo....",
  ],
  rodeur1: [
    "..............",
    ".....oooo.....",
    "...oo^^^^oo...",
    "..o^^^^^^y^yo.",
    ".o^^^^^^^^^^o.",
    "o^^^^^^^^^^^o.",
    "o^o^^o^^o^^o..",
    ".o.oo.oo.oo...",
  ],
  // Mimique : un coffre qui mord
  mimic0: [
    "..............",
    "..............",
    ".oooooooooooo.",
    "o############o",
    "o#XXXXXXXXXX#o",
    "oXXXXXXXXXXXXo",
    "o############o",
    "o#XXXXyyXXXX#o",
    "o#XXXXyyXXXX#o",
    "o############o",
    ".oooooooooooo.",
  ],
  mimic1: [
    ".oooooooooooo.",
    "o############o",
    "oXXXXXXXXXXXXo",
    "owvwvwvwvwvwvo",
    "o!!!!!!!!!!!!o",
    "o!!!!e!!!e!!!o",
    "owvwvwvwvwvwvo",
    "o#XXXXyyXXXX#o",
    "o#XXXXyyXXXX#o",
    "o############o",
    ".oooooooooooo.",
  ],
  // ----- Le Gardien du puits (34 × 32) : # et X prennent les couleurs de sa variante, c la couleur de ses yeux -----
  boss_idle: [
    "...owwo....................owwo...",
    "...owwoo..................oowwo...",
    "....owwwoo..oooooooooo..oowwwo....",
    ".....oWWwwoo##########oowwWWo.....",
    "......ooWwww##########wwwWoo......",
    "........ooww##########wwoo........",
    "..........oo#kkk##kkk#oo..........",
    "...........o#kkk##kkk#o...........",
    ".....ooooo.o##########o.ooooo.....",
    "...oommmmmooXXXXwwXXXXoommmmmoo...",
    "..ommmmwmmmmXXwXwwXwXXmmmmwmmmmo..",
    "..ommwmmmwmmXXXXXXXXXXmmwmmmwmmo..",
    ".ommmmmmmmmmm########mmmmmmmmmmmo.",
    "..ommmmmmmmm###cccc###mmmmmmmmmo..",
    "..oMMMMMMMMM##cccccc##MMMMMMMMMo..",
    ".oXXXXXMMMMM###cccc###MMMMMXXXXXo.",
    ".oXXXXXo#######cccc#######oXXXXXo.",
    ".oXMXXXo#XXXXXXXXXXXXXXXX#oXXXMXo.",
    ".oXXXXXo##################oXXXXXo.",
    ".oXXMXXo##################oXXMXXo.",
    ".oXXXXXo##XXXXXXXXXXXXXX##oXXXXXo.",
    "o######o##################o######o",
    "oX#####oMMmMMmMMMMMMmMMmMMo#####Xo",
    "o######oMMMMMMMMMMMMMMMMMMo######o",
    "oXXXXX#o##################o#XXXXXo",
    "o######oooXMMXXooooXXMMXooo######o",
    ".oooooo..oXMMXXo..oXXMMXo..oooooo.",
    "........ooXXXXXo..oXXXXXoo........",
    ".......oMmmmmmmMooMmmmmmmMo.......",
    ".......oMMMMMMMMooMMMMMMMMo.......",
    ".......oMMMMMMMMooMMMMMMMMo.......",
    "........oooooooo..oooooooo........",
  ],
  boss_raise: [
    "o#######o................o#######o",
    "o#XXXXX#o................o#XXXXX#o",
    "o#######oo..oooooooooo..oo#######o",
    "o#######wwoo##########ooww#######o",
    "o#######Wwww##########wwwW#######o",
    ".oXXXXXoooww##########wwoooXXXXXo.",
    ".oXXXXXo..oo#kkk##kkk#oo..oXXXXXo.",
    ".oXXXXXo...o#kkk##kkk#o...oXXXXXo.",
    ".oXXXXXooo.o##########o.oooXXXXXo.",
    ".oXXXXXmmmooXXXXwwXXXXoommmXXXXXo.",
    ".oXXXXXwmmmmXXwXwwXwXXmmmmwXXXXXo.",
    ".oXXXXXmmwmmXXXXXXXXXXmmwmmXXXXXo.",
    ".oXXXXXmmmmmm########mmmmmmXXXXXo.",
    "..ommmmmmmmm###cccc###mmmmmmmmmo..",
    "..oMMMMMMMMM##cccccc##MMMMMMMMMo..",
    "..oMMMMMMMMM###cccc###MMMMMMMMMo..",
    "...ooooo#######cccc#######ooooo...",
    ".......o#XXXXXXXXXXXXXXXX#o.......",
    ".......o##################o.......",
    ".......o##################o.......",
    ".......o##XXXXXXXXXXXXXX##o.......",
    ".......o##################o.......",
    ".......oMMmMMmMMMMMMmMMmMMo.......",
    ".......oMMMMMMMMMMMMMMMMMMo.......",
    ".......o##################o.......",
    "........ooXMMXXooooXXMMXoo........",
    ".........oXMMXXo..oXXMMXo.........",
    "........ooXXXXXo..oXXXXXoo........",
    ".......oMmmmmmmMooMmmmmmmMo.......",
    ".......oMMMMMMMMooMMMMMMMMo.......",
    ".......oMMMMMMMMooMMMMMMMMo.......",
    "........oooooooo..oooooooo........",
  ],
  // ----- Dessins des icônes uniques (8 × 10) : # couleur de l'objet, X son reflet -----
  icon_plume: ["......oo", ".....o#o", "....o#Xo", "...o#X#o", "..o#X#o.", ".o#X#o..", ".oXXo...", "o#oo....", "oo......", "........"],
  icon_botte: ["........", "..oooo..", "..o##o..", "..o#Xo..", "..o##o..", "..o##oo.", "..o###oo", "..oX####", "..oooooo", "........"],
  icon_cape: ["...oo...", "..o##o..", ".o#XX#o.", ".o#X##o.", "o##X###o", "o##X###o", "o#X####o", "o######o", "o#o##o#o", ".o.oo.o."],
  icon_flamme: ["...o....", "..o#o...", "..o#Xo..", ".o#XX#o.", ".o#XwX#o", "o#XwwX#o", "o#XwwX#o", ".o#XX#o.", "..oooo..", "........"],
  icon_fantome: ["..oooo..", ".o####o.", "o##XX##o", "o#k##k#o", "o######o", "o#X####o", "o######o", "o#o##o#o", ".o.oo.o.", "........"],
  icon_eperon: ["........", "........", "..o.o.o.", ".o#o#o#o", ".oX#X#Xo", "..o###o.", "ooo#Xoo.", "o####o..", ".oooo...", "........"],
  icon_gant: ["..o.o.o.", ".o#o#o#o", ".o#o#o#o", ".o#####o", "oo#####o", "o#X####o", ".o####o.", ".oXXXXo.", ".o####o.", ".oooooo."],
  icon_marteau: ["oooooooo", "o######o", "oX####Xo", "oooooooo", "...obo..", "...obo..", "...obo..", "...obo..", "...obo..", "...ooo.."],
  icon_chaine: ["..ooo...", ".o#X#o..", ".o#o#o..", ".oo#oo..", "..o#Xo..", ".o#o#o..", ".o#X#o..", "..ooo...", "..o#o...", "...o...."],
  icon_crochet: ["...ooo..", "..o#X#o.", "..o#oo#o", "...oo.o#", "....o.o#", ".o..o#Xo", "o#ooo#o.", "o#X##o..", ".oooo...", "........"],
  icon_dague: ["......o.", ".....o#o", "....o#Xo", "...o#Xo.", "o.o#Xo..", "oo#Xo...", ".okko...", "okoko...", "oo.oo...", "........"],
  icon_spirale: ["..oooo..", ".o####o.", "o#XXXX#o", "o#Xoo##o", "o#X#o#Xo", "o##oX#Xo", ".o###X#o", "..o##Xo.", "...ooo..", "........"],
  icon_orbe: ["..oooo..", ".o#XX#o.", "o#XwwX#o", "o#Xww##o", "o#X####o", "o######o", ".o####o.", "..oooo..", "........", "........"],
  icon_livre: [".oooooo.", "o######o", "o#XXXX#o", "o#X##X#o", "o#XXXX#o", "o#X##X#o", "o######o", "owwwwwwo", "oooooooo", "........"],
  icon_goutte: ["...oo...", "...o#o..", "..o#Xo..", "..o#X#o.", ".o#XX#o.", ".o#X##o.", ".o####o.", "..o##o..", "...oo...", "........"],
  icon_couronne: ["........", "o.o..o.o", "o#oo#o#o", "o##o##Xo", "o#X####o", "o######o", "oXwXXwXo", "oooooooo", "........", "........"],
  icon_fiole: ["..oooo..", "...oo...", "...oo...", "..o##o..", ".o#XX#o.", "o#X####o", "o######o", "o#####Xo", ".o####o.", "..oooo.."],
  icon_armure: [".oo..oo.", "o##oo##o", "o#X##X#o", "o######o", ".o#XX#o.", ".o####o.", ".o#XX#o.", ".o####o.", "..oooo..", "........"],
  icon_oeil: ["........", "..oooo..", ".o####o.", "o#XkkX#o", "o#kwkk#o", "o#XkkX#o", ".o####o.", "..oooo..", "........", "........"],
  icon_de: ["oooooooo", "o######o", "ow####wo", "o######o", "o##ww##o", "o######o", "ow####wo", "o######o", "oooooooo", "........"],
  icon_coeur: ["........", ".oo..oo.", "o##oo##o", "o#X####o", "o######o", ".o####o.", "..o##o..", "...oo...", "........", "........"],
  icon_calice: ["oooooooo", "o######o", "o#XXXX#o", ".o####o.", "..o##o..", "...oo...", "...oo...", "..o##o..", ".oooooo.", "........"],
  icon_lanterne: ["...oo...", "..o..o..", ".oooooo.", ".o#XX#o.", ".o#ww#o.", ".o#ww#o.", ".o#XX#o.", ".oooooo.", "..o##o..", "..oooo.."],
  icon_piece: ["..oooo..", ".o#XX#o.", "o#X##X#o", "o#X##X#o", "o#X##X#o", "o#X##X#o", ".o####o.", "..oooo..", "........", "........"],
  icon_epee: ["......oo", ".....owo", "....owmo", "...owmo.", "o.owmo..", "oo#mo...", ".o#o....", "o#o#o...", "oo.oo...", "........"],
  icon_longue: [".......o", "......om", ".....omo", "....omo.", "...omo..", "o.omo...", "oo#o....", ".o#o....", "o#o#o...", "oo.oo..."],
  icon_pierre: ["........", "........", "..oooo..", ".o####o.", "o#XXXX#o", "o######o", "o######o", ".oooooo.", "........", "........"],
  icon_lames: ["o......o", "wo....ow", ".wo..ow.", "..wmmw..", "...mm...", "..o##o..", ".o#oo#o.", "o#o..o#o", "oo....oo", "........"],
  icon_lune: ["..oooo..", ".o##Xo..", "o##Xo...", "o#Xo....", "o#Xo....", "o##Xo...", ".o##Xo..", "..oooo..", "........", "........"],
  icon_croc: ["oo....oo", "owo..owo", "owwooowo", "owwwwwwo", ".owwwwo.", ".owkkwo.", "..owwo..", "..owwo..", "...oo...", "........"],
  icon_crane: ["..oooo..", ".owwwwo.", "owwwwwwo", "owkwwkwo", "owkwwkwo", "owwwwwwo", ".owkwko.", ".oowwoo.", "..oooo..", "........"],
  icon_etoile: ["...oo...", "...o#o..", "oooo#ooo", "o##XX##o", ".o#XX#o.", "..o##o..", ".o#oo#o.", "o#o..o#o", "oo....oo", "........"],
  icon_diamant: ["........", ".oooooo.", "o#X##X#o", "o######o", ".o#XX#o.", "..o##o..", "...oo...", "........", "........", "........"],
  icon_croissant: ["o.......", "#o......", "X#o.....", "oX#o....", ".oX#o...", ".oX#o...", "oX#o....", "X#o.....", "#o......", "o......."],
  icon_ailes: ["........", "o......o", "#o....o#", "X#o..o#X", "oX#oo#Xo", ".oX##Xo.", "..o##o..", "...oo...", "........", "........"],
  icon_harpon: ["...oo...", "..o#Xo..", ".o#XX#o.", "o#oo#o#o", "...ob...", "...ob...", "...ob...", "...ob...", "...ob...", "...oo..."],
  icon_flocon: ["...oo...", "o.o#o.o.", "#o#X#o#.", "o#XwX#o.", "##XwX##.", "o#XwX#o.", "#o#X#o#.", "o.o#o.o.", "...oo...", "........"],
  icon_poing: ["........", ".oooooo.", "o#o#o#oo", "o#o#o##o", "o######o", "oX#####o", "o######o", ".o####o.", "..oooo..", "........"],
  icon_patte: ["..o..o..", ".o#oo#o.", ".o#oo#o.", "..o##o..", "..o##o..", ".o#XX#o.", ".o#XX#o.", "..o##o..", "..owwo..", "...oo..."],
  icon_trousseau: ["..oooo..", ".o#oo#o.", ".o#..#o.", ".o#oo#o.", "..o##o..", "...o#o..", "...o#o..", "..o##o..", "...o#o..", "...oo..."],
  icon_bourse: ["...oo...", "..o##o..", "..oXXo..", ".o####o.", "o#X####o", "o######o", "o####X#o", ".o####o.", "..oooo..", "........"],
  icon_aimant: ["oo....oo", "wo....ow", "#o....o#", "#o....o#", "#o....o#", "X#oooo#X", ".X####X.", "..oooo..", "........", "........"],
  icon_sceau: ["..oooo..", ".o####o.", "o#XXXX#o", "o#X##X#o", "o#XXXX#o", "o######o", ".o####o.", "..o##o..", "..o##o..", "...oo..."],
  // ----- Icônes d'objets (8 × 10) -----
  ic_lame: [
    "......oo",
    ".....owo",
    "....owmo",
    "...owmo.",
    "o.owmo..",
    "oobmo...",
    ".obo....",
    "obobo...",
    "oo.oo...",
    "........",
  ],
  ic_passif: [
    "........",
    ".oo..oo.",
    "o##oo##o",
    "o#X##X#o",
    "o######o",
    ".o####o.",
    "..o##o..",
    "...oo...",
    "........",
    "........",
  ],
  ic_mystery: [
    "..oooo..",
    ".o<<<<o.",
    "o<o<<o<o",
    "o<<<<<<o",
    ".o<oo<o.",
    "..o<<o..",
    "..o<<o..",
    "...oo...",
    "...<<...",
    "...oo...",
  ],
  ic_skill: [
    "...oo...",
    "..o##o..",
    ".o#XX#o.",
    "o#XwwX#o",
    "o#XwwX#o",
    ".o#XX#o.",
    "..o##o..",
    "...oo...",
    "........",
    "........",
  ],
};
// Couleurs propres à chaque sprite (en plus de la palette commune)
const SPRITE_PAL = {
  boss: { k: "#1a1220", W: "#b4aa96", w: "#e6dcc8", c: "#f2b54a" },
  icon: { k: "#0d0b10", b: "#6b4a2c" },
  crawler: { 4: "#384a2a", 5: "#4f6b3a", 6: "#6f8f4c", g: "#9cbf6a", e: "#e9e1cf" },
  bat: { 7: "#4a3560", 8: "#6a4a88", w: "#e86060" },
  spitter: { 9: "#7a4a6a", ":": "#c88ab0", ";": "#4a6a3a", e: "#1a0f18" },
  golem: { M: "#6a6270", g: "#5a7a4a", e: "#f2b54a" },
  wisp: { "<": "#4ab89a", ">": "#8ff0d0", w: "#f0fff8" },
  champi: { "!": "#c0503c", w: "#f3e6d0", $: "#e6d6b8", e: "#2a1810" },
  squelette: { w: "#e6dcc8", e: "#c4413b", "&": "#8a7f74" },
  rodeur: { "^": "#1c1424", y: "#f2d45a" },
  mimic: { "#": "#6b4a2c", X: "#8a5a30", y: "#f2d45a", "!": "#7a1020", w: "#f6efe0", v: "#7a1020", e: "#f2d45a" },
  ic_passif: { "#": "#f2d45a", X: "#fff3b8" },
  ic_mystery: { "<": "#b48ae0" },
};
const spriteCache = new Map();
function spriteCanvas(name, white, recolor) {
  const key = name + (white ? "|w" : "") + (recolor ? "|" + recolor : "");
  let c = spriteCache.get(key);
  if (c) return c;
  const rows = SPRITES[name];
  const fam = name.replace(/[0-9]+$|_.*$/, "");
  const pal = { ...PAL, ...(SPRITE_PAL[fam] || {}), ...(SPRITE_PAL[name] || {}) };
  if (recolor) { const [a, b, c3] = recolor.split(">"); pal["#"] = a; pal.X = b; if (c3) pal.c = c3; }
  c = document.createElement("canvas");
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      g.fillStyle = white ? (ch === "o" ? "#c8c0b0" : "#ffffff") : (pal[ch] || "#ff00ff");
      g.fillRect(x, y, 1, 1);
    }
  });
  spriteCache.set(key, c);
  return c;
}
// Dessine un sprite : (x, y) = coin haut-gauche, flip = regarde à gauche
function drawSprite(name, x, y, flip, white, recolor) {
  if (!SPRITES[name]) return false;
  const c = spriteCanvas(name, white, recolor);
  if (!c.width) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(Math.round(x * S) / S + c.width, Math.round(y * S) / S); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); }
  else ctx.drawImage(c, Math.round(x * S) / S, Math.round(y * S) / S);
  ctx.restore();
  return true;
}
const spriteW = name => SPRITES[name] ? SPRITES[name][0].length : 0;
const spriteH = name => SPRITES[name] ? SPRITES[name].length : 0;

// ----- Le héros -----
function heroFrame(p) {
  if (p.dashTimer > 0 || p.phasing) return "hero_run0";
  if (!p.onGround && !p.inWater) return p.vy < -20 ? "hero_jump" : "hero_fall";
  const running = Math.abs(p.vx) > 15;
  if (running) return ["hero_run0", "hero_run1", "hero_run2", "hero_run1"][Math.floor(p.anim * 0.18) % 4];
  return Math.floor(time * 1.8) % 2 ? "hero_idle1" : "hero_idle0";
}
// ----- Les monstres -----
function enemyFrame(e) {
  const t = e.t || 0, step = Math.floor(t * 6) % 2;
  switch (e.type) {
    case "crawler": return e.daze > 0 ? "crawler0" : "crawler" + step;
    case "bat": return "bat" + (Math.floor(t * (e.state === "wind" ? 18 : 9)) % 2);
    case "spitter": return e.state === "wind" ? "spitter1" : "spitter0";
    case "golem": return "golem0";
    case "wisp": return "wisp" + (Math.floor(t * 5) % 2);
    case "champi": return e.state === "crouch" ? "champi1" : "champi0";
    case "squelette": return e.state === "throw" ? "squelette_throw" : (Math.abs(e.vx) > 3 ? "squelette" + step : "squelette0");
    case "rodeur": return "rodeur" + (Math.floor(t * (e.state === "lunge" ? 14 : 4)) % 2);
    case "mimic": return e.state === "sleep" || e.state === "walk" ? "mimic0" : "mimic" + (Math.floor(t * 8) % 2);
  }
  return null;
}
// Place le sprite d'un monstre : centré en bas de sa boîte de collision
function spritePlace(e, x, y) {
  const f = enemyFrame(e);
  if (!f) return null;
  const w = spriteW(f), h = spriteH(f);
  let sx = x + e.w / 2 - w / 2, sy = y + e.h - h;
  if (e.type === "golem") {
    if (e.state === "wind") sx += Math.sin(time * 90) > 0 ? 0.67 : -0.67;
    if (e.state === "charge") sx += e.dir * 1.67;
    if (Math.abs(e.vx) > 3) sy -= Math.round(Math.abs(Math.sin(e.t * 6)));
  }
  if (e.type === "bat" || e.type === "wisp") sy = y + e.h / 2 - h / 2;
  if (e.type === "crawler" && e.daze > 0) sy += 1;
  return { f, sx, sy, flip: (e.dir || 1) < 0 };
}
// (drawEnemySprite : voir js/28d-remaster.js)
// Les yeux brillent par-dessus l'obscurité : on repeint les pixels d'yeux après la lumière
const EYE_CHARS = { crawler: "e", bat: "w", golem: "e", squelette: "e", rodeur: "y", mimic: "e", spitter: "e" };
const eyeCache = new Map();
function spriteEyes(name, fam) {
  if (eyeCache.has(name)) return eyeCache.get(name);
  const chars = EYE_CHARS[fam] || "", out = [];
  if (chars) SPRITES[name].forEach((row, y) => { for (let x = 0; x < row.length; x++) if (chars.includes(row[x])) out.push([x, y]); });
  eyeCache.set(name, out);
  return out;
}
function drawEnemyEyes(e, x, y) {
  if (e.mini) return true;
  const pl = spritePlace(e, x, y);
  if (!pl) return false;
  if (e.type === "mimic" && e.state === "sleep") return true;
  const eyes = spriteEyes(pl.f, e.type), w = spriteW(pl.f);
  if (!eyes.length) return true;
  const pal = { ...PAL, ...(SPRITE_PAL[e.type] || {}) }, ch = EYE_CHARS[e.type][0];
  let col = pal[ch];
  if (e.type === "golem" && e.state !== "walk" && e.state !== "idle") col = "#ff7a3a";
  if (e.type === "rodeur" && e.state === "wind") col = Math.floor(time * 16) % 2 ? "#ffffff" : "#f2d45a";
  if (e.type === "crawler") col = "#d8f070";
  ctx.fillStyle = col;
  const bx = Math.round(pl.sx * S) / S, by = Math.round(pl.sy * S) / S;
  for (const [ex, ey] of eyes) ctx.fillRect(bx + (pl.flip ? w - 1 - ex : ex), by + ey, 1, 1);
  return true;
}
// Icône propre à chaque objet : [dessin, couleur, reflet]. Un objet absent de la liste garde l'icône de sa famille.
const ITEM_ICONS = {
  griffon: ["plume", "#e8d27a", "#fff3b8"],
  colosse: ["botte", "#7a7180", "#b4aa96"],
  cape: ["cape", "#a8333a", "#e86060"],
  braise: ["flamme", "#e8913a", "#f2d45a"],
  voile: ["fantome", "#8fb8d6", "#e8f4ff"],
  eperons: ["eperon", "#c9c2b4", "#f6efe0"],
  gantelet: ["gant", "#6a6270", "#7fd6c0"],
  marteau: ["marteau", "#8a8290", "#f2d45a"],
  chaine: ["chaine", "#8a2a3a", "#e86060"],
  crochet: ["crochet", "#8a8290", "#c9c2b4"],
  ombre: ["dague", "#4a3560", "#9d6bc4"],
  ether: ["spirale", "#6a4a88", "#c88aff"],
  ricochet: ["orbe", "#4ab89a", "#8ff0d0"],
  grimoire: ["livre", "#6a4a88", "#c88aff"],
  pacte: ["goutte", "#8a1a24", "#e04a4a"],
  couronne: ["couronne", "#b48a2a", "#f2d45a"],
  berserker: ["fiole", "#a8333a", "#f07070"],
  armure: ["armure", "#5a5560", "#8a8290"],
  oeil: ["oeil", "#7a4a6a", "#c88ab0"],
  de: ["de", "#c4413b", "#f6efe0"],
  coeurnoir: ["coeur", "#24142e", "#5a3470"],
  calice: ["calice", "#4a3560", "#9d6bc4"],
  lanterne: ["lanterne", "#8a6a2a", "#f2d45a"],
  eaubenite: ["goutte", "#4a8ac4", "#bfe4ff"],
  avarice: ["piece", "#b48a2a", "#f2d45a"],
  spectrale: ["epee", "#7fb8d6", "#e8f4ff"],
  allonge: ["longue", "#8a8290", "#c9c2b4"],
  aiguise: ["pierre", "#6a6270", "#c9c2b4"],
  frenesie: ["gant", "#c4413b", "#f2b54a"],
  lamebraise: ["epee", "#c4413b", "#f2b54a"],
  revers: ["lames", "#6a6270", "#c9c2b4"],
  pilon: ["marteau", "#6b4a2c", "#a87a4a"],
  echo: ["epee", "#6a4a88", "#c88aff"],
  lune: ["lune", "#8a9ab8", "#e8f0ff"],
  affamee: ["croc", "#6e1f24", "#a8333a"],
  bourreau: ["crane", "#6e1f24", "#a8333a"],
  etoiles: ["etoile", "#c8a83a", "#fff3b8"],
  chouette: ["plume", "#8a6a4a", "#e6d6b8"],
  percant: ["diamant", "#7fd6c0", "#e8fff8"],
  orbe: ["orbe", "#6a4a88", "#c88aff"],
  lamevent: ["croissant", "#7fc8d6", "#e8f4ff"],
  ailes: ["ailes", "#c8a83a", "#fff3b8"],
  harpon: ["harpon", "#8a8290", "#e86060"],
  givre: ["flocon", "#7fc8d6", "#e8f4ff"],
  seisme: ["poing", "#8a6a4a", "#c9a07a"],
  pierre: ["coeur", "#6a6270", "#a8a0b0"],
  lapin: ["patte", "#e6d6b8", "#f6efe0"],
  trousseau: ["trousseau", "#b48a2a", "#f2d45a"],
  bourse: ["bourse", "#6b4a2c", "#f2d45a"],
  aimant: ["aimant", "#c4413b", "#f6efe0"],
  sceau: ["sceau", "#8a1a24", "#e8913a"],
};
function itemIcon(id) {
  const it = ITEM[id], ic = ITEM_ICONS[id];
  if (ic && SPRITES["icon_" + ic[0]]) return ["icon_" + ic[0], `${ic[1]}>${ic[2]}`];
  if (it && it.skill) return ["ic_skill", `${RELIC_INFO[it.skill].color}>${RELIC_INFO[it.skill].light}`];
  if (it && it.mystery) return ["ic_mystery", null];
  if (it && it.cat === "lame") return ["ic_lame", null];
  return ["ic_passif", null];
}
function drawSpriteIcon(id, x, y) {
  if (!ITEM[id]) return false;
  const [name, recolor] = itemIcon(id);
  return drawSprite(name, x, y, false, false, recolor);
}
