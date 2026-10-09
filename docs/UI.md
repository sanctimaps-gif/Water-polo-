# WATER POLO 26 MOBILE — Interface (version web)

Paysage uniquement. Toutes les valeurs affichées viennent de `web/state.js` (sauvegarde locale de
l'appareil) : aucune valeur décorative. Règles vérifiées par `node tools/web-tests/state.mjs` (CI).

## Écrans — IMPLÉMENTÉ

| Écran | Contenu | Données réelles |
|---|---|---|
| Barre supérieure | réglages, logo + nom du club, TOTAL, niveau / XP, pièces, gemmes (+ = comment les gagner) | oui |
| Choisis ton club (1er lancement) | onglets CLUBS RÉELS / CRÉER MON CLUB, filtre par pays, cartes (nom adapté, pays, ville, championnat, note) ; panneau CLUB DE DÉPART (logo, maillots domicile / extérieur / gardien, JOUER AVEC CE CLUB, CRÉER MA VERSION, ⓘ DONNÉES DE RÉFÉRENCE avec sources) ; choix UTILISER EFFECTIF DE DÉPART / CRÉER MON EFFECTIF | oui |
| Éditeur de club | onglets IDENTITÉ (nom, abréviation, ville, pays, couleurs 1/2/3), LOGO (forme, symbole, lettres / chiffres, motif, bordure), MAILLOTS (domicile, extérieur : motif uni / moitiés / bande / écharpe / chevron, 2 couleurs), BONNETS (couleur, liseré, numéro), BALLON & PISCINE ; APERÇU 3D en direct (domicile / extérieur / gardien, rotation au doigt) ; VALIDER MON CLUB | oui — sauvegardé (`customClubId`, `baseClubId`, couleurs, logo, kits, bonnet, ballon, piscine) |
| Accueil (ordre de la vidéo de référence) | gauche : ÉVÉNEMENTS, CARRIÈRE, OBJECTIFS, RÉCOMPENSES GRATUITES (pastilles) · centre : joueur 3D aux couleurs du club · grandes tuiles JOUER UN CLUB (logo + TOTAL), JOUER UN TOURNOI, BOUTIQUE · droite : les 4 emplacements de paquets (PACK DE MATCH ×3, PACK DE SAISON) | oui |
| Jouer un club | gauche : CLASSEMENT, PERSONNALISER, MON CLUB (équipe, joueurs, composition, tactiques), MATCH RAPIDE · tuile du prochain match du championnat (logos, TOTAL, journée, domicile / extérieur ; le playoff 2e c 3e la remplace) → composition → JOUER → avant-match · STADE (piscine du club, son ambiance sert aux matchs à domicile) · BOUTIQUE · paquets à droite · RETOUR | oui |
| Paquets de récompense | 4 niveaux : BRONZE (défaite), ARGENT (nul), OR (victoire), ÉLITE (victoire de 3 buts ou plus) ; un match de tournoi ou de playoff gagné monte d'un niveau, un match rapide donne au plus ARGENT ; fin de saison = PACK DE SAISON (Élite si champion ou promu, Or si podium, sinon Argent). Écran de résultats : OUVRIR LE PACK ou GARDER POUR PLUS TARD (4 emplacements ; s'ils sont pleins, il faut l'ouvrir). Ouverture : GLISSER POUR OUVRIR, les cartes sont distribuées face cachée, toucher pour retourner ou TOUT RÉVÉLER. Contenu réel : pièces, points d'entraînement, gemmes, trousses de secours, boissons énergie, jetons de qualité (Or : jeton bronze, Élite : jeton argent) et un nouveau joueur dans un pack Élite (jeton or si l'effectif a déjà 18 joueurs). Jamais vendus | oui — `packs` dans la sauvegarde, tirage fixé par la graine du paquet |
| Hubs | MON CLUB (équipe, joueurs, composition, tactiques, personnaliser) · CARRIÈRE (ma carrière, progression, statistiques) | oui |
| Carrière → Mon club | nom, logo, maillots, ville, pays, niveau, budget fictif (calculé : niveau, victoires, trophées), effectif, classement, saison, palmarès, CHANGER DE CLUB | oui |
| Changer de championnat | à la fin du championnat (bouton sur l'écran de résultats du dernier match, ou Carrière > Mon club) et avant ton premier match de la saison suivante : les 8 championnats (drapeau, nom, nombre de clubs, note moyenne) ; le club, l'effectif, le niveau, les monnaies et les trophées sont conservés, la coupe nationale suit le nouveau pays | oui |
| Tournois | coupes nationales (France, Italia, España, Magyar, Hellas, Hrvatska), régional (Adria League), continental (Euro Challenge Cup, Mediterranean Club Cup, Euro Champions Aqua), international (World Club Masters) ; formats élimination directe, groupes + phase finale, ligue ; tableaux de groupes, tableau final avec tirs au but, journées de repos, champion, récompenses | oui |
| Défis | onglet DÉFIS des compétitions (et JOUER > DÉFIS) : TUTORIEL, PENALTY, COUP FRANC, SUPÉRIORITÉ 6 C 5 ; schéma, étoiles, meilleur score ; en match : essais ✓ / ✗, consigne, compte à rebours ; écran de fin (score, étoiles, récompense, REJOUER) | oui |
| Joueurs | tout l'effectif en cartes ; la fiche joueur montre le modèle 3D du joueur en direct (animation au repos, rotation au doigt) | oui |
| Progression | niveau, XP, prochaines compétitions débloquées, objectifs | oui |
| Mon équipe | formation water-polo (ailes et pivot à 2 m, demi-ailes, meneur, gardien), cartes joueurs (portrait 3D du vrai modèle du joueur, note, poste, numéro, rareté, nationalité, club, niveau, 3 stats clés, bonus de poste), panneau TOTAL / NOTE MOYENNE / BONUS DE POSTE, remplaçants, échange par touchers, MEILLEUR TOTAL, onglet TACTIQUES | oui — le bonus de poste (+2 à toutes les stats au poste naturel) est appliqué dans le match |
| Fiche joueur | portrait 3D, note, poste, rareté, pays, âge, taille, niveau, 13–14 statistiques, AMÉLIORER (coût en pièces, +1 à toutes les stats) | oui |
| Classement | ligue de 8 clubs, J V N D +/- PTS TOTAL ; onglets mondial / amis / régional marqués NON IMPLÉMENTÉ (serveur) | oui |
| Événements | 4 cartes (standard, spécial, majeur, premium) : trophée, progression, récompense, minuteur réel, état VERROUILLÉ / BIENTÔT / COMMENCER / CONTINUER / RÉCUPÉRER / TERMINÉ | oui |
| Objectifs | 3 objectifs du jour (renouvelés à minuit, minuteur), progression issue des statistiques de match, RÉCUPÉRER une seule fois | oui |
| Récompenses gratuites | cadeau quotidien sur 7 jours (rater un jour ne fait pas perdre la série) | oui |
| Personnaliser | nom du club, couleurs, forme et symbole du logo (générés en SVG) ; le joueur 3D et les bonnets en match changent | oui |
| Boutique | cosmétiques uniquement (bonnets, liseré, célébration, symbole), payés avec la monnaie du jeu, confirmation avant achat, équiper / déséquiper | oui — aucun achat réel, rien qui modifie les statistiques |
| Avant-match | logos, TOTAL, compétition, piscine, gain, astuce | oui |
| HUD de match | tableau avec écussons, flèche de possession, score animé, horloge 30 s qui clignote sous 5 s ; bandeaux animés BUT (écusson, buteur, flash), ARRÊT, EXCLUSION, 30 S ÉCOULÉES, FIN DE PÉRIODE ; boutons à icônes (états appuyé / désactivé, vibration) ; caméra TV / MATCH / LARGE | oui |
| Tactique (en match) | OFFENSIF, ÉQUILIBRÉ, DÉFENSIF, PRESSION, CONTRE-ATTAQUE (+ RAPIDE, CENTRE) et formations ARC 3-3, PARAPLUIE, 4-2 ; le match est en pause pendant le choix | oui — changent le comportement de l'IA et les positions d'attaque |
| Pause (en match) | « JEU EN PAUSE » : écussons et score, statistiques en direct (possession, tirs cadrés, arrêts, passes réussies, ballons récupérés, fautes / exclusions, supériorités / buts) ; boutons STATS, TACTIQUE, ÉQUIPE (remplacements : joueur dans l'eau → remplaçant, gardien pour gardien, la composition suit), RÉGLAGES (tous les paramètres, appliqués immédiatement), QUITTER (confirmation) | oui |
| Résultats | victoire / défaite / nul, statistiques, pièces, XP, montée de niveau, objectifs atteints, place en ligue, progression d'événement | oui |
| Paramètres (menu et pause) | onglets MATCH, CONTRÔLES, AUDIO, GRAPHISMES, AUTRES ; flèches ‹ › avec points de position, interrupteurs NON / OUI, curseur de zoom. Horloge : chaque période affiche 8:00 (règle réelle) et dure la durée choisie (1, 2, 4 ou 8 min réelles) ; 30 s et exclusions en secondes réelles | graphismes, caméra, ambiance, replays, difficulté, assistance, durée, timing, son, langue, réinitialisation (confirmée) | oui |

Économie : pièces gagnées en jouant (victoire 150, nul 80, défaite 50, +10 par but ; moitié en match
rapide), objectifs, événements, cadeau du jour, titre de champion. Gemmes : objectifs, événements,
cadeaux des jours 4 et 7, titre. Achats en argent réel, publicité, passe saisonnier : NON IMPLÉMENTÉ.

## Progression des joueurs (inspirée des jeux de sport mobiles) — IMPLÉMENTÉ

Chaque effet est réel (appliqué dans le match) et testé (`tools/web-tests/state.mjs`).

| Action (fiche joueur, onglet STANDARD) | Coût | Effet |
|---|---|---|
| ENTRAÎNEMENT / ENTRAÎNEMENT MAXIMAL | points d'entraînement (60 + 40 × niveau) | +1 niveau = +1 à toutes les stats, jusqu'au plafond de la qualité (10 / 15 / 20 / 25) |
| AMÉLIORER LA QUALITÉ | 1 jeton du palier, au niveau max | bronze → argent → or → violet : +2 à toutes les stats, plafond +5, compétence +1 niveau |
| EN FORME POUR LE MATCH | 1 trousse de soins | +50 forme. Un titulaire perd 12 par match, un remplaçant récupère 15 ; à 0, stats −8 % |
| PHYSIQUE MAXIMAL | 1 boisson énergétique | +4 vitesse, accélération, endurance, physique pendant 1 match |

* **Compétences** (2 par poste, niveaux 1 à 3) : bonus de stats réels (Tireur d'élite, Canon, Meneur,
  Mur, Pilier, Sprinteur, Réflexes, Infatigable, Vision du jeu).
* **Statistiques de carrière** par joueur : matchs, victoires, nuls, buts, passes décisives, tirs,
  ballons récupérés, arrêts / passes réussies — comptées dans chaque match joué.
* **ÉCHANGER** (onglet de Mon équipe) : des remplaçants contre des points d'entraînement
  (titulaires et effectif de 9 conservés). **OBTENIR PLUS DE JOUEURS** : recrutement contre des pièces
  (effectif max 18).
* **Ressources**, toutes gagnées en jouant (aucun achat réel) : points d'entraînement (chaque match,
  échanges, cadeau du jour), trousses (victoires en compétition, cadeau), boissons (cadeau, événement
  du week-end), jetons (événements : bronze, argent, or, violet ; titre de champion : or).
* **Cartes en écusson** : cadre du palier de qualité, portrait 3D, note, poste, jauge de niveau,
  flèche de forme, éclair si PHYSIQUE actif, nom, pays, numéro.
* **Paramètres en onglets** : MATCH, CONTRÔLES, AUDIO, GRAPHISMES, AUTRES.

## Monde de la carrière : 5 divisions × 9 clubs par pays — IMPLÉMENTÉ

* **200 pays** (`web/data/world.js`, regroupés par continent), chacun avec **5 divisions de 9 clubs**, plus le club du
  joueur comme 10e équipe de sa division. C'est une **structure de jeu standardisée** : elle n'est pas présentée
  comme la structure officielle des championnats du pays. Noms de divisions adaptés quand ils sont connus
  (France : Élite France, Nationale 1, Nationale 2, Nationale 3, Régionale ; Espagne : Liga de Honor, Primera,
  Segunda…), sinon « Division 1…5 ».
* **Clubs** : les clubs réels vérifiés (sources conservées) sont placés en premier, les plus forts en
  Division 1. Toutes les autres places sont des **clubs créés par le jeu** (`gameCreated: true`,
  `verified: false`, aucune source) : nom original bâti sur une vraie ville du pays + un surnom générique,
  logo et maillots originaux, badge « CLUB DU JEU » dans l'interface. Ils ne sont jamais présentés comme
  des clubs réels. Les sites des fédérations étant bloqués depuis l'environnement de développement, les
  divisions inférieures réelles (N1, N2…) restent à compléter quand des sources lisibles seront disponibles.
* **Saison** : aller-retour (18 journées à 10 équipes), classement automatique (J, V, N, D, BP, BC, diff., pts).
* **Fin de saison** (`finalizeSeason`, `applyMoves` dans `web/world.js`), pour toutes les divisions du pays :
  * Divisions 2 à 5 : le **1er monte** ; le **2e et le 3e jouent un match**, le vainqueur monte aussi ;
  * pour garder 9 clubs par division, autant de clubs IA descendent de la division du dessus (les derniers
    classés) — **le club du joueur ne descend jamais** ;
  * Division 1 : le 1er est **champion national** et obtient la meilleure place continentale ; le match
    2e contre 3e donne la place suivante (puis le perdant, puis 4e, 5e… selon le nombre de places du pays).
  * Si le joueur est 2e ou 3e, il **joue lui-même ce match** (carte « PLAYOFF » sur l'accueil).
  * Page **FIN DE SAISON** : classement final, playoff, promus / champion, places continentales, descentes,
    autres divisions, échelle des 5 divisions, puis animation vers la nouvelle saison. Historique conservé.
* **Places continentales** configurables par pays (`continentalQualificationSlots` selon le niveau du pays) ;
  Europe : Euro Champions Aqua, Euro Challenge Cup, Euro Conference Aqua, Euro Challenger Aqua, Euro Super Aqua
  (noms adaptés ; référence : système de clubs d'European Aquatics), une coupe par autre continent, puis
  World Club Masters pour les vainqueurs continentaux. Une compétition continentale n'est ouverte qu'au club
  qualifié la saison précédente.

## Clubs réels adaptés — choix actuel

Les clubs du jeu s'inspirent de **clubs réels** (championnats masculins 2025-26 de France, Italie,
Espagne, Hongrie, Grèce, Croatie, Serbie, Allemagne), avec une séparation stricte :

* **Données de référence** (`web/data/clubs.json`, généré par `tools/data/build-clubs.mjs`) :
  `officialReferenceName`, ville, pays, compétition réelle, saison, `source` (pages publiques),
  `lastUpdated`. Jamais affichées en jeu, sauf dans le panneau ⓘ DONNÉES DE RÉFÉRENCE, marqué comme tel.
* **Identité dans le jeu** : `gameClubName` (nom légèrement modifié : mot retiré, nom raccourci,
  lettre modifiée, partie supprimée, abréviation modifiée, variante proche), `shortName`,
  championnat au nom adapté, **logo et maillots originaux** générés par le jeu.
* Aucun nom officiel, logo officiel, maillot officiel ni sponsor n'est utilisé comme si le jeu était
  licencié. Aucun club n'est inventé en étant présenté comme réel. Les **joueurs restent fictifs**
  (effectifs générés au niveau du club).
* Le club créé par le joueur (« MON CLUB ») garde `baseClubId` en interne et remplace son club de
  base dans le championnat de son pays.

Sources utilisées (consultées le 6 octobre 2026) : Wikipédia (championnats de France, Espagne,
Hongrie, Grèce, Croatie, Serbie, Allemagne ; Champions League 2025-26), OA Sport (Serie A1),
total-waterpolo.com, lewaterpolo.com, cnmarseille.com — liste complète par club dans `clubs.json`.

## Limites

Textes des menus complets en français et en anglais ; espagnol, allemand, italien et portugais
reprennent l'anglais pour ces menus (à traduire). Sauvegarde locale uniquement (pas de cloud, pas de
validation serveur). Transferts entre clubs, mercato, passe saisonnier, achats réels : NON IMPLÉMENTÉ.

## Logo

Le logo WATER POLO 26 MOBILE fourni par le porteur du projet (`web/assets/logo.webp`, icônes
`icon-192.png` / `icon-512.png`) est l'icône de l'application (onglet, écran d'accueil du téléphone
via le manifeste, raccourci iOS), l'écran de démarrage pendant le chargement, l'écran « Tournez votre
appareil » et le bouton en haut à gauche de chaque menu (retour à l'accueil).
