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
* Bonnet : coque en tissu, couture centrale et de bord, protège-oreilles rigides percés, jugulaire,
  numéro au dos. Bonnet rouge pour les gardiens. Équipe à domicile en couleur, visiteurs en blanc.
* Maillot de bain aux couleurs de l'équipe avec liseré. Peau mouillée (rugosité basse + reflets
  de l'environnement). Les parties immergées prennent la teinte de l'eau selon la profondeur.
* NON IMPLÉMENTÉ : cheveux longs visibles, textures de peau / tissu, modèles capturés ou faits par un artiste.

## Animations — IMPLÉMENTÉ (procédural, mélangé)

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
| Draw calls | 57 | 71 | 72 |
| Triangles | 122 k | 229 k | 400 k |

Triangles avant les joueurs sculptés : 104 k / 169 k / 299 k (la densité de la tête et du buste suit
la qualité ; en LOW la tête n'a pas de détails du visage).
Avant optimisation : 237–243 draw calls (skinning des joueurs et fusion de l'arène = ÷4).
**Non mesuré : le FPS réel sur téléphone.** Les FPS affichés dans ce test viennent d'un rendu
logiciel sans GPU et ne sont pas représentatifs. Le test sur appareils réels reste à faire.
