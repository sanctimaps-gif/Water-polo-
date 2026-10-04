# WATER POLO 26 MOBILE — Présentation 3D du match (version web)

Version jouable : https://sanctimaps-gif.github.io/Water-polo-/ · inspection des modèles : `?showcase` ·
mesures à l'écran : `?debug` (draw calls, triangles, FPS, niveau de qualité).

Statuts : **IMPLÉMENTÉ** (fonctionne, testé dans le navigateur), **PROTOTYPE** (fonctionne, qualité
provisoire), **NON IMPLÉMENTÉ**. Tout ce qui suit concerne la version web (Three.js, `web/render/`).
Le projet Unity garde pour l'instant la présentation en primitives : le portage de ces systèmes vers
Unity/URP est à faire.

## Joueurs — `web/render/athlete.js` — IMPLÉMENTÉ (procédural)

* Squelette réel (os `THREE.Bone`) : bassin, buste, cou, tête, épaules, bras, coudes, avant-bras,
  mains (paume, pouce, 4 doigts), hanches, cuisses, genoux, jambes, pieds.
* **Un seul maillage skinné par joueur** (toutes les pièces fusionnées, couleur et rugosité par
  sommet, un matériau partagé) ⇒ 1 draw call par joueur (+1 pour le numéro du bonnet en MEDIUM+).
* Morphologie par poste et par graine : taille, largeur d'épaules, carrure (gardien et pointe plus
  grands, pivot plus massif, ailier plus fin).
* **Tête sculptée** : une sphère déformée par sommet (visage allongé, largeur de mâchoire, menton,
  pommettes, arcade sourcilière, orbites creusées, arête et bout du nez, lèvres), paramètres tirés par
  joueur. Couleurs par sommet : lèvres, barbe ou barbe de 3 jours, ombrage des orbites et sous le
  menton. Yeux (sclérotique + iris) posés sur la surface avec paupière supérieure, sourcils
  inclinés ; 6 teintes de peau, 6 couleurs de cheveux.
* **Corps sculpté** : buste, cou, bras et jambes sont des profils lissés (spline) déformés pour les
  muscles : pectoraux, abdominaux, ligne blanche, dorsaux en V, omoplates, sillon de la colonne,
  deltoïdes, biceps / triceps, avant-bras effilés jusqu'au poignet aplati, quadriceps, mollets.
  Ombre peinte par sommet dans les creux (sous les pectoraux, entre les abdominaux). Normales
  soudées sur les coutures (pas de ligne visible).
* **Articulations** : les sommets proches de l'épaule, du coude, de la hanche et du genou sont
  partagés entre deux os (skinning à 2 poids) ⇒ plis lisses au lieu de pièces de mannequin.
* **Types de corps** (`BODY_TYPES`) : petit et rapide, grand et puissant, athlétique, massif, fin,
  choisis selon le poste (pivot massif ou puissant, ailier petit / fin, gardien grand…). Ils
  changent taille, épaules, carrure, hanches, **et l'animation** (cadence et amplitude de nage).
* **Visages différenciés** : largeur du visage, mâchoire, menton, nez (longueur, largeur, narines),
  arcade, lèvres, écartement et taille des yeux, oreilles (hélix + lobe autour des protège-oreilles),
  teint (6 teintes, variation par sommet, rougeur des joues et du nez). Pilosité : barbe, barbe de
  3 jours, moustache, bouc ou rasé de près. Coiffures : rasé, court, bouclé, ondulé, longs (mèches
  mouillées sur un os à ressort amorti : elles pendent, balancent avec la vitesse et les virages).
* **Apparence stable** : le visage, la coiffure et le corps dépendent de l'identifiant du joueur
  de l'effectif ⇒ le même joueur sur sa carte, dans chaque match et d'un match à l'autre.
* Bonnet : coque en tissu, couture centrale et de bord, protège-oreilles rigides percés, jugulaire
  nouée sous le menton, numéro au dos. Bonnet rouge pour les gardiens.
* **Maillot** : vraie coque autour des hanches (fessiers, avant), couleur d'équipe, ceinture et
  bandes de jambes en couleur de liseré, panneaux latéraux, motif en chevron, coutures plus sombres,
  cordon noué ; numéro sur la hanche en HIGH / ULTRA. Tissu mouillé (rugosité basse).
* **Peau mouillée** : rugosité basse avec micro-variation (pores, film d'eau qui casse le reflet),
  vernis transparent (*clearcoat*) en HIGH / ULTRA = film d'eau sur la peau et le maillot, lumière
  de contour (rim) qui détache le joueur du fond. Les parties immergées prennent la teinte de l'eau.
* **Gouttes** : de l'eau tombe du corps quand le joueur sort de l'eau, tire, plonge, célèbre ou
  nage vite.
* **Ballon dans la main** : le point de prise est à un rayon de ballon devant la paume ⇒ le ballon
  repose sur la main sans la traverser.
* **Cartes joueurs** : portrait 3D réel (le même modèle, rendu hors écran en buste puis mis en cache).
* NON IMPLÉMENTÉ : textures de peau / tissu peintes, doigts articulés autour du ballon, modèles
  scannés ou faits par un artiste. Le rendu reste procédural : il n'atteint pas un personnage de
  jeu console modélisé et texturé à la main. Pour ce niveau, il faudrait des modèles glTF d'artiste
  (même squelette), que ce système d'animation pourrait piloter.

## Animations — IMPLÉMENTÉ (procédural, mélangé)

Ajouts : sprint (corps plus plat, tête basse), accélération (penché en avant), freinage (buste
redressé, jambes devant), virage (inclinaison, la tête mène), passe / tir / **tir puissant**
(rotation du buste plus forte, sortie de l'eau) / **lob** (bras haut, geste doux), **interception
et vol** (fente, un bras vers le ballon, côté du ballon), **parade** du gardien (deux mains hautes),
fatigue (tête qui tombe, bras plus bas). **Regard** : la tête suit le ballon, le but pendant
l'armé du tir, le coéquipier ciblé pendant la passe (rotation + inclinaison, le buste suit un peu).

Nage crawl tête haute (cycle de bras, roulis, battements), eggbeater au repos, ballon tenu au-dessus
de la tête, armé du tir (bras armé, torsion, élévation selon la charge), lâcher de tir et de passe,
contre (bras levés), position du gardien (haut dans l'eau, bras écartés), plongeon du gardien du côté
du tir, célébrations (bras levés / frappe de l'eau, coéquipiers proches inclus), fatigue (cadence et
hauteur réduites), tête qui suit le ballon.
Mélange : poids lissés entre états, interpolation par le plus court angle (pas de saut de pose).
IK : le bras droit se tend vers le ballon qui arrive. Le ballon tenu est attaché à la main.

## Eau — `web/render/water.js` — IMPLÉMENTÉ

Shader : houle (4 ondes), **ondes d'impact** (24 sources : ballon qui tombe, tirs, arrêts, mouvements
de bras), **sillages en V et vague d'étrave** derrière chaque nageur, mousse (sillages, impacts, bords
du bassin), micro-relief (normal map générée), réflexion de l'arène avec les panneaux lumineux du
plafond, fresnel, reflets spéculaires, transparence (on voit les jambes et le fond).
Fond et parois carrelés avec lignes de couloir et **caustiques animées**.
Paramètres exposés (`WATER_PARAMS`) : WaveIntensity, WaveSpeed, ReflectionStrength, FoamAmount,
Transparency, CausticsIntensity, SurfaceSmoothness, SplashIntensity…
NON IMPLÉMENTÉ : réfraction réelle (distorsion de l'image sous l'eau), caméra sous-marine.

## Ballon, éclaboussures, filets

* Ballon : texture caoutchouc jaune à rainures, relief (bump), reflets, rotation selon la vitesse,
  gouttes qui tombent quand il est tenu, ombre au sol de l'eau.
* `web/render/vfx.js` : particules en pool (1 draw call) — coups de bras, tirs, passes, ballon qui
  touche l'eau (selon sa vitesse), arrêts, contres, poteaux, buts.
* Filets dynamiques : grille ressorts-amortisseurs, réagissent à l'impact du but puis reviennent.

## Arène — `web/render/arena.js` — IMPLÉMENTÉ

Carte d'environnement (reflets), lumière principale avec ombres qui suivent l'action, contre-jour,
plage mouillée réfléchissante, bordure, plots 2 m / 5 m / 6 m, lignes de flotteurs aux couleurs
réglementaires, buts flottants (poteaux, barre, cadre, flotteurs), bancs, toit à poutres, rangées de
projecteurs, gradins sur trois côtés, **public instancié animé sur le GPU par sections** (réagit aux
tirs, arrêts, poteaux, buts, fins de période), écran géant avec le score et le temps en direct,
bannières aux sponsors fictifs, rayons de lumière (HIGH+). Ambiances : ÉVÉNEMENT, JOUR, SOIR, NUIT.
Les éléments fixes sont fusionnés automatiquement par matériau.

## Caméra et replay

* Modes STANDARD, DYNAMIQUE, TACTIQUE (menu ou bouton pendant le match), anticipation dans le sens de
  l'attaque, suivi des tirs vers le but, resserrement près des buts.
* Caméra de but (plan rapproché 3/4 sur le filet et la célébration).
* **Replay** des buts : 5 dernières secondes rejouées au ralenti (×0,55), angle derrière le but puis
  au ras de l'eau, réactions visuelles rejouées, « Touchez pour passer », désactivable.
* NON IMPLÉMENTÉ : caméra gardien, caméra sous-marine, profondeur de champ.

## Son — `web/render/audio.js` — PROTOTYPE

Synthétisé (aucun fichier) : sifflet, éclaboussures, impacts du ballon, poteau, filet, ambiance de
foule qui suit l'excitation, clameur sur les buts. Coupable (bouton 🔊).

## Qualité adaptative — `web/render/quality.js`

AUTO détecte le GPU (Apple, Adreno, Mali, PowerVR, desktop, logiciel), la mémoire et les cœurs ;
LOW / MEDIUM / HIGH / ULTRA réglables. AUTO baisse le niveau si le FPS reste sous 80 % de la cible
pendant 4 s. LOW et MEDIUM visent 30 FPS en n'affichant qu'une image sur deux.

| | LOW | MEDIUM | HIGH | ULTRA |
|---|---|---|---|---|
| Échelle de pixels max | 1 | 1,25 | 1,6 | 2 |
| Ombres | non | 1024 | 2048 | 2048 |
| Eau (maillage) | 70×52, sans micro-relief | 120×90 | 170×128 | 230×170 |
| Particules | 300 | 700 | 1400 | 2400 |
| Public | 260 | 700 | 1300 | 2200 |
| Visages / numéro de bonnet | non | oui | oui | oui |
| Rayons de lumière | non | non | oui | oui |

**Mesuré** (navigateur Chromium, rendu logiciel, match en cours) :

| | LOW | MEDIUM | ULTRA |
|---|---|---|---|
| Draw calls | 57 | 71 | 86 |
| Triangles | 136 k | 250 k | 425 k |

ULTRA : +14 draw calls pour les numéros sur les maillots. Triangles avant les joueurs sculptés : 104 k / 169 k / 299 k (la densité de la tête et du buste suit
la qualité ; en LOW la tête n'a pas de détails du visage).
Avant optimisation : 237–243 draw calls (skinning des joueurs et fusion de l'arène = ÷4).
**Non mesuré : le FPS réel sur téléphone.** Les FPS affichés dans ce test viennent d'un rendu
logiciel sans GPU et ne sont pas représentatifs. Le test sur appareils réels reste à faire.
