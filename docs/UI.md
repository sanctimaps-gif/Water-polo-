# WATER POLO 26 MOBILE — Interface (version web)

Paysage uniquement. Toutes les valeurs affichées viennent de `web/state.js` (sauvegarde locale de
l'appareil) : aucune valeur décorative. Règles vérifiées par `node tools/web-tests/state.mjs` (CI).

## Écrans — IMPLÉMENTÉ

| Écran | Contenu | Données réelles |
|---|---|---|
| Barre supérieure | réglages, logo + nom du club, TOTAL, niveau / XP, pièces, gemmes (+ = comment les gagner) | oui |
| Choisis ton club (1er lancement) | onglets CLUBS RÉELS / CRÉER MON CLUB, filtre par pays, cartes (nom adapté, pays, ville, championnat, note) ; panneau CLUB DE DÉPART (logo, maillots domicile / extérieur / gardien, JOUER AVEC CE CLUB, CRÉER MA VERSION, ⓘ DONNÉES DE RÉFÉRENCE avec sources) ; choix UTILISER EFFECTIF DE DÉPART / CRÉER MON EFFECTIF | oui |
| Éditeur de club | onglets IDENTITÉ (nom, abréviation, ville, pays, couleurs 1/2/3), LOGO (forme, symbole, lettres / chiffres, motif, bordure), MAILLOTS (domicile, extérieur : motif uni / moitiés / bande / écharpe / chevron, 2 couleurs), BONNETS (couleur, liseré, numéro), BALLON & PISCINE ; APERÇU 3D en direct (domicile / extérieur / gardien, rotation au doigt) ; VALIDER MON CLUB | oui — sauvegardé (`customClubId`, `baseClubId`, couleurs, logo, kits, bonnet, ballon, piscine) |
| Accueil | gauche : JOUER, MON CLUB, CARRIÈRE, CONTENU (pastille), BOUTIQUE · centre : joueur 3D aux couleurs du club · droite : carte PROCHAIN MATCH (championnat du pays du club, logos, TOTAL, piscine, JOUER) + MON ÉQUIPE, TOURNOIS, MA CARRIÈRE, MATCH RAPIDE | oui |
| Hubs | JOUER (match rapide, tournoi, championnat) · MON CLUB (équipe, joueurs, composition, tactiques, personnaliser) · CARRIÈRE (ma carrière, progression, statistiques) · CONTENU (défis, événements, récompenses) | oui |
| Carrière → Mon club | nom, logo, maillots, ville, pays, niveau, budget fictif (calculé : niveau, victoires, trophées), effectif, classement, saison, palmarès, CHANGER DE CLUB | oui |
| Tournois | coupes nationales (France, Italia, España, Magyar, Hellas, Hrvatska), régional (Adria League), continental (Euro Challenge Cup, Mediterranean Club Cup, Euro Champions Aqua), international (World Club Masters) ; formats élimination directe, groupes + phase finale, ligue ; tableaux de groupes, tableau final avec tirs au but, journées de repos, champion, récompenses | oui |
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
| Pause (en match) | REPRENDRE, TACTIQUES, COMMANDES, PARAMÈTRES (caméra, zoom, radar, son, vibrations, changement auto), QUITTER LE MATCH (confirmation ; compétition = défaite 0-5) | oui |
| Résultats | victoire / défaite / nul, statistiques, pièces, XP, montée de niveau, objectifs atteints, place en ligue, progression d'événement | oui |
| Paramètres | graphismes, caméra, ambiance, replays, difficulté, assistance, durée, timing, son, langue, réinitialisation (confirmée) | oui |

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
