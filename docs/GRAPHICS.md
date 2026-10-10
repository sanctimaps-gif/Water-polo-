# WATER POLO 26 MOBILE — Présentation 3D du match (version web)

Version jouable : https://sanctimaps-gif.github.io/Water-polo-/ · inspection des modèles : `?showcase` ·
mesures à l'écran : `?debug` (draw calls, triangles, FPS, niveau de qualité).

Statuts : **IMPLÉMENTÉ** (fonctionne, testé dans le navigateur), **PROTOTYPE** (fonctionne, qualité
provisoire), **NON IMPLÉMENTÉ**. Tout ce qui suit concerne la version web (Three.js, `web/render/`).
Le projet Unity garde pour l'instant la présentation en primitives : le portage de ces systèmes vers
Unity/URP est à faire.

## Joueurs — `web/render/athlete.js` — IMPLÉMENTÉ

**Joueurs réalistes (HIGH / ULTRA, cartes, menus)** :
* **Visage scanné en 3D** : scan de tête « Lee Perry-Smith » (Infinite-Realities, licence
  CC BY 3.0) avec ses textures (couleur, carte de normales, rugosité tirée de la carte spéculaire).
  Recadré sous le bonnet, remodelé par joueur (largeur du visage, mâchoire, nez, menton, arcade,
  lèvres), teinté au teint du joueur, barbe / moustache / bouc peints par joueur, paupières ouvertes
  avec de vrais globes oculaires (iris de couleur variable).
* **Corps humain réel** : maillage MakeHuman hm08 (CC0) passé en homme jeune avec les cibles de
  genre (mélange des 3 origines) et de musculature / poids, en 3 gabarits (fin, athlétique, massif)
  choisis selon le type de corps. Mains à 5 doigts, pieds, anatomie réelle. Tête retirée (le scan la
  remplace), squelette du jeu posé sur les articulations MakeHuman, poids de skinning calculés hors
  ligne (4 os par sommet), os « demi-épaule » qui suit la moitié de la rotation du bras (pas d'aisselle
  écrasée bras levé, pas de saut pendant le crawl). Maillot peint sur le corps (couleur d'équipe,
  ceinture et bandes de jambes, panneaux, chevron).
* **Carrure de water-polo** (référence : photo d'une équipe nationale) : 1,90 m pour le gabarit
  athlétique, épaules et haut du torse élargis (+13 %), pectoraux plus pleins, dorsaux, taille plus
  fine (V), musculature naturelle (moins « sèche » qu'avant) ; poils sur le torse chez ~35 % des
  joueurs.
* **Corps amélioré** : 4 gabarits (fin, athlétique, puissant, massif) ; définition musculaire
  renforcée (accentuation des formes moyennes du maillage : ventres musculaires, sillons) ; occlusion
  des creux précalculée par sommet (aisselles, sous les pectoraux, entre les abdominaux, plis) ; peau
  avec pores et relief fin (bruit 3D sur la pose de référence, il ne « glisse » pas pendant
  l'animation) et gouttes d'eau en relief et brillantes au-dessus de l'eau ; ces détails s'effacent
  quand ils deviennent plus petits qu'un pixel (pas de scintillement à distance).
* Préparation des données : `tools/assets/` (sources, licences, scripts). Crédits dans
  Paramètres > Autres et `web/assets/*/LICENSE.txt`.
* Coût mesuré (ULTRA, match) : 114 draw calls, 607 k triangles (avant : 86 / 425 k). LOW et MEDIUM
  gardent le corps procédural ci-dessous.
* Limite : un seul scan de visage de base (les visages diffèrent par la forme, le teint et la
  pilosité, pas par l'identité) ; pas de cheveux visibles hors du bonnet sur ce modèle ; pas de
  textures de peau sur le corps (couleur par sommet). Un rendu console « FIFA / Call of Duty »
  demanderait des scans et textures par joueur faits par des artistes.

**Corps procédural (LOW / MEDIUM)** :

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

**Calé sur des vidéos fournies (tir de penalty à 5 m, crawl tête haute)** :
* Ballon tenu **sur l'eau sous la paume**, bras devant (plus en l'air) ; il n'est levé que pour tirer
  ou passer.
* **Armé** : le ballon est ramassé sur l'eau et remonte en grand arc sur le côté, bras presque tendu,
  puis armé haut derrière la tête, coude au-dessus de l'épaule ; le batteur sort le joueur de l'eau
  jusqu'à la taille ; le bras libre godille sur le côté.
* **Tir** : fouetté rapide (~0,25 s), lâcher haut devant, puis le bras continue en travers du corps,
  le thorax continue de tourner et le joueur retombe vers l'avant (durée totale ~0,7 s).
* **Nage avec le ballon** (vidéo de coaching « 3 étapes ») : 1) battements forts en surface, eau
  blanche derrière les pieds ; 2) coudes hauts, bras qui entrent écartés de chaque côté du ballon pour
  le protéger ; 3) tête et buste hauts au-dessus du ballon, regard devant ; ballon sous le menton.
* **Crawl** : épaules hautes, tête fixe regardant devant (ne tourne jamais), roulis modéré, retour du
  bras coude haut près de la tête (coude ~90°), entrée courte devant l'épaule.

**Articulations et limites humaines** (`JOINT_LIMITS`, vérifiées en CI dans tous les états) : coude
0–145° sans hyperextension, genou 0–140°, hanche 125° de flexion / 25° d'extension, abduction 50°,
épaule abduction 180° / flexion jusqu'à 215° (armé) / extension 60° (hors crawl, qui est une
circumduction), colonne flexion / extension / rotation / inclinaison limitées, cou 50° / 70°,
rotation 75°. **Avant-bras** : pronation / supination (±90°) pour que la paume se pose sur le ballon
tenu sur l'eau et face à la cible à l'armé et au tir.
**Ballon dans la main** : point de prise calculé sur la vraie main (centre de la paume + un rayon de
ballon selon la normale de la paume, d'après le pouce, l'auriculaire et la courbure des doigts) ;
ballon tenu sur l'eau : petite IK de l'épaule qui amène la main au niveau de l'eau.

**Bonnet de water-polo** (`buildCap`, d'après des photos de vrais bonnets) : tissu ajusté sur la
forme réelle de la tête (rayon trouvé par direction à partir des sommets de la tête, lissé comme un
tissu tendu, jamais à l'intérieur de la tête), qui couvre le crâne et la nuque et descend en rabats
devant les oreilles jusqu'à la mâchoire ; bord droit sur le front, juste au-dessus des sourcils, bord
lissé (sans escalier) avec liseré roulé de couleur ; couture sur le dessus ; protège-oreilles ovales
bombés avec une grille de trous ; cordons noués sous le menton avec un nœud et deux bouts qui pendent ;
numéros au dos et sur les deux côtés, posés sur le tissu (bleu foncé sur bonnet clair, blanc sinon).
Coût : +50 k triangles en ULTRA.

**Tronc en deux parties** : bassin (os `torso`, porte les jambes) et thorax (os `chest`, porte les
bras et la tête, poids de peau répartis autour de la taille). Le thorax se penche, s'incline et tourne
plus que le bassin.
* **Crawl water-polo** : tête hors de l'eau regardant devant, roulis des épaules à chaque mouvement
  (thorax ±0,36 rad, bassin 40 % de ça, tête stable), entrée des bras courte et écartée, retour coude
  haut (~70°), traction coude fléchi (~45°), battements rapides. Vérifié en CI : l'épaule du bras qui
  tire est plus basse.
* **Conduite du ballon** : nager en avant avec le ballon = crawl tête haute, ballon sur l'eau devant
  la tête (plus de ballon tenu en l'air en nageant). Tenu au-dessus de la tête seulement à l'arrêt.
* **Batteur (eggbeater)** pour tout déplacement latéral ou en arrière : corps penché dans le sens du
  déplacement, godille des mains plus ample avec la vitesse, bassin qui tourne avec les jambes. Les
  défenseurs regardent le jeu (porteur ou ballon) pendant les petits ajustements au lieu de nager
  dos au jeu.
* **Tir en chaîne** : armé = bassin puis thorax tournés vers l'arrière, buste incliné, coude à hauteur
  d'épaule, bras libre pointé vers la cible ; déclenché = bassin d'abord, thorax ensuite, bras en
  dernier (fouetté), buste qui plonge vers l'avant à la fin.
* **Teint** : le corps prend la couleur moyenne de la texture du visage teintée (même teint visage /
  corps) ; ombre de barbe d'origine du scan atténuée ; bonnet élargi pour couvrir le crâne scanné.


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

## Animations capturées (Mixamo) — IMPLÉMENTÉ

- `web/assets/anim/treading.json` : « Treading Water » (Mixamo, Adobe, libre de droits), fourni par l'utilisateur, **retargeté** sur le squelette du jeu (`tools/anim`) : pour chaque image (30 i/s, boucle de 3 s), les angles des articulations du jeu (bassin, thorax, tête, épaules avec la **rotation humérale** ajoutée au squelette, coudes, hanches, genoux) qui reproduisent au mieux les directions du bassin, du thorax, de la tête, des bras / avant-bras et des cuisses / jambes de la capture, dans les limites articulaires (erreur d'ajustement : torse ≈ 0, bras ≈ 0, jambes < 0,09).
- En jeu : remplace le surplace procédural (eggbeater) dès que le fichier est chargé ; joué plus vite que le clip (rythme de match, gardien encore plus vite), avec les inclinaisons de déplacement (recul, côté) et la fatigue par-dessus. Sans le fichier (tests Node), le surplace procédural reste utilisé.
- Ajouter un autre clip Mixamo : `node tools/anim/extract.mjs clip.fbx pos.json` puis `node tools/anim/retarget.cjs pos.json web/assets/anim/<nom>.json <nom> "<source>"` (voir l'en-tête du fichier).

## Eau — `web/render/water.js` — IMPLÉMENTÉ

Shader : houle (4 ondes), **ondes d'impact** (24 sources : ballon qui tombe, tirs, arrêts, mouvements
de bras), **sillages en V et vague d'étrave** derrière chaque nageur, mousse (sillages, impacts, bords
du bassin), micro-relief (normal map générée), réflexion de l'arène avec les panneaux lumineux du
plafond, fresnel, reflets spéculaires, transparence (on voit les jambes et le fond).
Fond et parois carrelés avec lignes de couloir et **caustiques animées**.
Paramètres exposés (`WATER_PARAMS`) : WaveIntensity, WaveSpeed, ReflectionStrength, FoamAmount,
Transparency, CausticsIntensity, SurfaceSmoothness, SplashIntensity…
NON IMPLÉMENTÉ : réfraction réelle (distorsion de l'image sous l'eau), caméra sous-marine.

## Présentation (inspirée d'écrans de jeux de sport mobiles) — IMPLÉMENTÉ

* **Avant-match** : le meilleur joueur de chaque équipe en 3D, debout sur la plage du bassin (gradins
  derrière, éclairage de présentation), carte centrale (écussons + OVR, VS, piscine), 6 options réelles
  (maillot domicile / extérieur, ballon, tactique, formation, caméra, durée), retour noir et JOUER rose.
* **Compositions** avant l'entrée dans l'eau : bandeau de l'équipe (écusson, nom, OVR, formation) et les 7
  titulaires en cartes (portrait 3D du vrai modèle, note, poste, drapeau, forme) sur le bassin vu de haut ;
  les deux équipes l'une après l'autre, bouton ▶❙ pour passer, désactivable (Paramètres > Match).
* **HUD** : tableau compact en haut à gauche (écussons, scores sur fond clair, horloge rouge, 30 s),
  mini-carte en bas au centre, nom du joueur contrôlé au-dessus de sa tête (triangle, endurance, charge
  du tir) et nom de l'adversaire le plus proche, boutons ronds sombres à anneau de couleur.
* **But** : bandeau équipe + « BUT », bandeau rose du buteur, carte du buteur (portrait 3D), confettis aux
  couleurs du club, bouton ▶❙ (passe la carte et le replay).

## Ballon, éclaboussures, filets

* Ballon : texture caoutchouc à rainures (4 modèles au choix du club : classique jaune / bleu,
  océan, couchant, lime), relief (bump), reflets, rotation selon la vitesse, gouttes qui tombent quand
  il est tenu, ombre au sol de l'eau, **traînée lumineuse** légère (ligne additive de 26 points qui
  s'efface) quand il vole.
* Maillots : chaque club a un kit domicile, extérieur et gardien (motif uni / moitiés / bande /
  écharpe / chevron sur le maillot, 2 couleurs, bonnet + liseré + couleur du numéro). En match, une
  équipe en bonnets foncés, l'autre en bonnets clairs ; gardiens en rouge.
* `web/render/vfx.js` : particules en pool (1 draw call) — coups de bras, tirs, passes, ballon qui
  touche l'eau (selon sa vitesse), arrêts, contres, poteaux, buts.
* Filets dynamiques : grille ressorts-amortisseurs, réagissent à l'impact du but puis reviennent.

## Arène — `web/render/arena.js` — IMPLÉMENTÉ

Tribunes pleines : foule dense peinte par le jeu sur les pentes des gradins (silhouettes, maillots, bras levés ; 1 appel de dessin par tribune) derrière les spectateurs 3D animés. Ballon qui flotte : balancement et petites ondes.


Carte d'environnement (reflets), lumière principale avec ombres qui suivent l'action, contre-jour,
plage mouillée réfléchissante, bordure, plots 2 m / 5 m / 6 m, lignes de flotteurs aux couleurs
réglementaires, buts flottants (poteaux, barre, cadre, flotteurs), bancs, toit à poutres, rangées de
projecteurs, gradins sur trois côtés, **public instancié animé sur le GPU par sections** (réagit aux
tirs, arrêts, poteaux, buts, fins de période), écran géant avec le score et le temps en direct,
bannières aux sponsors fictifs, rayons de lumière (HIGH+). Ambiances : ÉVÉNEMENT, JOUR, SOIR, NUIT.
Les éléments fixes sont fusionnés automatiquement par matériau.

## Caméra et replay

**Caméra ATTAQUE (par défaut)** : haute, dans l'axe du bassin, derrière le jeu, regardant le but
attaqué par l'utilisateur (comme les jeux de rugby / football sur mobile) ; elle suit le ballon.

**Cinématique d'entrée** (réglable, touchez pour passer) : les deux équipes debout sur la plage
derrière leur ligne de but plongent l'une après l'autre (plongeon tête la première, éclaboussures),
glissent jusqu'à leur position de départ ; la caméra filme chaque bout puis s'élève vers le jeu,
coup de sifflet. ~7 s, la simulation est arrêtée pendant ce temps.

**Bouton CAM du HUD** : TV (standard) / MATCH (attaque) / LARGE / YEUX. **SOUS L'EAU** (Paramètres) : caméra immergée à côté du joueur contrôlé (jambes en batteur à œufs, surface vue d'en dessous avec la fenêtre de Snell, brouillard turquoise, lumière diffuse de l'eau) ; le replay d'un but passe aussi sous l'eau. **YEUX** : vue à la première personne depuis les yeux du joueur qui a la balle (les deux équipes), au ras de l'eau ; il regarde le but quand il arme un tir ; sans porteur, yeux du joueur contrôlé tournés vers le ballon. Petit zoom (−8° de champ) pendant
les tirs, flash et bandeau animé au but avant le plan de but et le replay.

**Autres caméras** (Paramètres > Match, ou PAUSE > PARAMÈTRES) : 1 Standard (TV), 2 Large,
3 Courte portée, 4 Dynamique (parallèle qui suit l'attaque), 5 Tactique (haute), 6 Derrière le
joueur (vue du dessus, depuis l'arrière : haute et plongeante, le but attaqué en haut de l'écran), 7 Bord du bassin (au ras de l'eau). **Zoom 1 à 10**.
La caméra reste toujours dans la salle (sous le toit, devant le mur). Le joystick et la visée du tir
sont calculés dans l'espace du monde ⇒ ils fonctionnent dans tous les angles. **Radar** (activable) :
vue de dessus du bassin en haut à gauche (joueurs, gardiens, ballon, joueur contrôlé).

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
