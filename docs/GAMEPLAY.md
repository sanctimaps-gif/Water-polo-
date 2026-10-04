# WATER POLO 26 MOBILE — Gameplay (état actuel et réglages)

Toutes les valeurs ci-dessous sont celles du code (`Assets/_Project/Scripts/Simulation`). Une
statistique de joueur va de 1 à 99 et est normalisée en 0..1 (`PlayerStats.N`).

## 1. Contrôles tactiles

**Le jeu est exclusivement en paysage** (tous les écrans, sans exception). Si l'appareil est tenu
verticalement, le jeu se met en pause derrière l'écran « TOURNEZ VOTRE APPAREIL » et reprend seul
une fois l'appareil à l'horizontale. Disposition : joystick à gauche, piscine au centre,
passe / tir / défense / sprint à droite, score et temps en haut. Interface testée en 16:9, 18:9,
19,5:9 et tablette 4:3.

| Commande | Avec le ballon | Sans le ballon |
|---|---|---|
| Joystick gauche (flottant) | nager ; **bord du joystick = sprint** | idem |
| Bouton SPRINT (droite, maintenir) | sprint | sprint |
| Bouton A (gros, droite) | **TIR** : maintenir = charger, relâcher = tirer ; *tap* = tir rapide | **DÉFENSE** : tentative de vol au contact, sinon bras levé (contre) 0,6 s |
| Bouton B | **PASSE** au coéquipier le plus pertinent ; appui long (> 0,35 s) = passe lobée | **CHANGER** de joueur |
| Swipe en relâchant A | viser : haut/bas = poteau opposé/proche, vers le but = tir plus haut ; swipe rapide = tir rapide | — |
| Swipe en relâchant B | passe dirigée dans la direction du swipe | — |
| Glisser dans la zone droite | décale la caméra | idem |
| Double tap zone droite | tir rapide | changer de joueur |
| Clavier (éditeur) | WASD/flèches, Maj = sprint, J = passe, K (maintenir) = tir | L = défense, Q = changer |

Le contrôle suit automatiquement le ballon quand un coéquipier le reçoit. Un anneau vert montre en
permanence le destinataire de la passe automatique ; un anneau jaune marque le joueur contrôlé.
Les gestes, le sprint au bord, le double tap et les vibrations sont des options (`ControlSettings`).

## 2. Assistance

| | ASSISTÉ | STANDARD | PRO |
|---|---|---|---|
| Choix de la cible de passe | automatique, la direction compte peu (poids 0,6) | la direction oriente (poids 1,5) | seuls les coéquipiers dans un cône de 35° ; sinon passe dans l'espace |
| Erreur de passe | ×0,6 | ×1 | ×1 |
| Tir | toujours dans le cadre, dispersion ×0,75 | peut toucher le poteau (cadre +15 cm) | aucune limite : on peut rater |
| Rayon de réception | +30 cm | — | — |

## 3. Nage, sprint, fatigue (`SwimmerMotor`)

* Vitesse max : 1,15 → 1,65 m/s (SPEED) ; ×1,35 en sprint ; ×0,82 → 0,92 avec le ballon (TECHNIQUE).
* Accélération : 1,6 → 3,6 m/s² (ACCELERATION), ×1,2 en sprint, ×0,75 pour inverser la direction ;
  sans commande, la traînée de l'eau freine à 2,2 m/s² (glisse puis arrêt). **Aucun déplacement instantané.**
* Rotation : 200 → 420 °/s (TECHNIQUE).
* Endurance : sprint −0,085 → −0,045 /s (STAMINA) soit ≈ 12 à 22 s de sprint continu ; récupération
  0,03 → 0,065 /s (×0,35 en nageant à fond). À 3 % le sprint se bloque jusqu'à 20 % (hystérésis).
* Fatigue (endurance basse) : vitesse ×0,75, précision/passes/défense ×0,8, puissance ×0,85,
  temps de réaction +25 %. Visible via la barre d'endurance (rouge quand le sprint est bloqué).
* Charger un tir = s'élever hors de l'eau : déplacement ×0,35, rotation vers le but.

## 4. Ballon (`SimBall`, `BallPhysics`)

États : FREE, POSSESSED, PASSED, SHOT, DEFLECTED, BLOCKED, GOAL, OUT.
Gravité + légère traînée dans l'air ; ricochet sur l'eau si la vitesse verticale dépasse 2,5 m/s ;
flottaison et traînée de l'eau (≈ 1,7 /s) ; un ballon en vol qui meurt sur l'eau redevient FREE.
Détection : but (ballon entièrement dans le cadre 3 m × 0,9 m), poteau/barre (rebond, reste en jeu),
sortie ligne de but, sortie latérale.

## 5. Passes et tirs

**Passe** (`PassSystem`) — score de chaque coéquipier : progression vers le but, proximité du but,
danger dans la ligne de passe, pression sur le receveur, distance, bonus pivot (tactique), malus
gardien, direction demandée (selon l'assistance). Vitesse 8 → 12 m/s (PASSING) + jusqu'à 3,5 m/s
sur les passes longues (POWER) ; passe lobée ×0,55 ; anticipation du déplacement du receveur ;
erreur angulaire 7° → 1,5° (PASSING, fatigue).

**Tir** (`ShotSystem`) — charge 0 → 1 en 0,9 s ; vitesse 10,5 → 17 m/s × (0,82 → 1,18 selon POWER),
soit jusqu'à ~20 m/s. Visée automatique : coin opposé au gardien. Dispersion à 7 m :
0,45 + (1 − compétence) × 1,6 m d'amplitude (compétence = 65 % ACCURACY + 35 % SHOOTING), proportionnelle
à la distance, ×1,25 si surchargé, ×1,3 tir rapide, jusqu'à ×1,5 sous pression. Tir lobé : 7 m/s.

**Timing** (désactivable) — zone d'excellence sur la barre de charge entre 72 % et 86 % :
EXCELLENT = dispersion ×0,5, BIEN = ×1, RATÉ (< 50 % ou charge pleine tenue > 0,5 s) = ×1,6.

## 6. Gardien (`GoalkeeperAI`)

Placement sur la ligne ballon–but à 0,6 → 1,3 m de la ligne, anticipation par la vitesse du ballon
(INTELLIGENCE), précision de placement (POSITIONING). Sur un tir : temps de réaction 0,34 → 0,10 s
(REACTION + GOALKEEPING), puis plongeon 1,8 → 3,4 m/s, limité à 0,7 → 1,3 m, + 0,6 m de bras.
Les balles hautes sont plus difficiles. Probabilité d'arrêt selon la marge, la vitesse du tir et le
placement ; arrêt **capté** (balle lente, bien centrée) ou **repoussé** (ballon DEFLECTED). Les tirs
clairement non cadrés sont laissés. Relance : passe après ~0,8 s (PASSING / INTELLIGENCE).

## 7. IA des joueurs de champ (`FieldPlayerAI`)

Décisions toutes les 0,4 → 0,15 s (INTELLIGENCE × difficulté CPU), pilotage à chaque tick.

* **Porteur** : qualité de tir (distance vs portée SHOOTING/POWER, angle, pression, défenseurs dans
  l'axe) comparée à un seuil = tactique + personnalité − urgence des 30 s + contexte de score
  (mené en fin de match ⇒ tire plus, devant ⇒ temporise) ; sinon passe (patience, pression), sinon
  remontée du ballon (contre-attaque) ou attaque de l'espace devant le but.
* **Soutien** : formation 6 postes (ailes à 2 m, demi-ailes à 5 m, pointe, pivot), appels
  périodiques vers le but, démarquage loin du défenseur, erreurs de placement (POSITIONING).
* **Défense** : marquage individuel côté but, dénégation côté ballon des joueurs de périphérie
  (tactique), repli en zone devant le but, lecture des passes en vol, bras levé face à un tireur,
  tentatives de vol (agressivité × tactique).
* **Ballon libre** : les 2 joueurs les plus proches de chaque équipe le disputent en sprint.

### Personnalités (`PersonalityProfile`)

| | Seuil de tir | Risque de passe | Patience | Agressivité | Préférence passe |
|---|---|---|---|---|---|
| LEADER | −0,05 | 1,05 | 1,0 | 1,1 | +0,05 |
| CREATIVE | 0 | 1,35 | 0,9 | 0,9 | +0,10 |
| CALM | +0,05 | 0,8 | 1,3 | 0,7 | +0,05 |
| AGGRESSIVE | −0,08 | 1,1 | 0,75 | 1,6 | −0,05 |
| TEAM_PLAYER | +0,08 | 0,95 | 1,0 | 1,0 | +0,20 |
| TACTICAL | +0,03 | 0,85 | 1,15 | 0,9 | +0,10 |
| RISK_TAKER | −0,12 | 1,5 | 0,7 | 1,2 | −0,10 |

### Tactiques (`TacticParams`) — effets mesurés par `TacticTests` (6 matchs IA, équipe à domicile)

| Style | Principe | Effet vérifié |
|---|---|---|
| ÉQUILIBRÉ | référence | — |
| RAPIDE | tempo ×0,6, sprint de transition 85 % | — |
| OFFENSIF | attaque plus près du but, seuil de tir −0,10 | tirs 101 → 136 |
| DÉFENSIF | repli en zone 65 %, 1 joueur de sécurité, tempo lent | distance moyenne au but en défense 12,3 → 9,9 m |
| PRESSION | marquage à 0,8 m, dénégation 50 %, intensité 1,6 | vols + fautes 232 → 285 ; passes adverses −15 % ; plus de fautes (coût) |
| CENTRE | bonus de passe au pivot ×4, attaque plus large | ballons au pivot 77 → 116 |
| CONTRE-ATTAQUE | sprint de transition 100 %, tempo rapide | — |

La tactique se change en match (bouton en haut à droite).

## 8. Règles (`RuleManager`)

IMPLÉMENTÉ : 4 périodes à chrono courant (durée réglable), sprint d'engagement au début de chaque
période (ballon au centre, joueurs sur leur ligne de but), buts et remise en jeu au centre par
l'équipe qui encaisse, possession de 30 s (20 s sur rebond offensif après tir), sortie latérale
(ballon à l'adversaire), sortie ligne de but (renvoi du gardien ou corner si un défenseur a touché
en dernier), faute ordinaire (coup franc, défenseur écarté 0,6 s), match nul possible.

NON IMPLÉMENTÉ (phase 2 suite) : exclusions de 20 s, penalty à 5 m, hors-jeu des 2 m, temps morts,
remplacements, arrêt du chrono sur chaque coup de sifflet, séance de tirs au but.

## 9. Effet de chaque statistique (couvert par `StatImpactTests`)

| Stat | Effet |
|---|---|
| SPEED | vitesse de nage max |
| ACCELERATION | temps pour atteindre la vitesse max |
| STAMINA | coût du sprint, récupération |
| PASSING | vitesse et précision des passes, relance du gardien |
| SHOOTING | précision du tir (35 %), portée de tir de l'IA |
| POWER | vitesse de tir, passes longues |
| ACCURACY | précision du tir (65 %) |
| DEFENSE | réussite des vols, rayon d'interception, contres |
| REACTION | rayon d'interception/réception/ramassage, réflexes du gardien |
| POSITIONING | précision du placement IA et du gardien |
| TECHNIQUE | vitesse de rotation, contrôle (vitesse balle en main), maladresses à la réception, fautes |
| INTELLIGENCE | fréquence et qualité des décisions IA, anticipation du gardien |
| PHYSICAL | résistance aux vols, duel de placement (poussée), fautes provoquées |
| GOALKEEPING | plongeon, portée et réussite des arrêts |

## 10. Équilibrage mesuré (IA contre IA, 10 matchs de 4 × 2 min)

* ≈ 9,6 buts par match, 32 % de réussite au tir, ≈ 58 % d'arrêts (sur les tirs cadrés), 82 % de passes réussies.
* L'équipe nettement plus forte (88 vs 55) gagne au moins 7 matchs sur 10.
* La difficulté CPU (0,75 / 1 / 1,15) modifie réellement le résultat.

Ces fourchettes sont verrouillées par `Balance_LooksLikeWaterPolo` pour détecter les régressions.
