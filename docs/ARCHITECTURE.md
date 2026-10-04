# WATER POLO 26 MOBILE — Architecture technique

> Document de référence. Statuts utilisés partout : **IMPLÉMENTÉ** (fonctionnel et testé),
> **PROTOTYPE** (fonctionne, mais version provisoire destinée à être remplacée),
> **NON IMPLÉMENTÉ** (prévu, aucun code).

---

## 1. Analyse de la spécification

La spécification décrit un produit complet (gameplay, carrière, économie, online). Les points qui
structurent les décisions techniques :

| Exigence | Conséquence technique |
|---|---|
| Mobile-first, 4 profils LOW→ULTRA, batterie, chauffe | Moteur au runtime léger, budgets par profil, pas d'effet « gratuit », simulation peu coûteuse |
| Le match est le cœur, priorité au gameplay | Simulation de match isolée, testable sans moteur, itérable très vite |
| IA riche (rôles, personnalités, tactiques, stats) | IA pilotée par données (paramètres de tactique / personnalité / stats) et non par du code spécifique |
| « Chaque statistique doit avoir un effet réel » | Chaque stat est branchée sur une formule nommée, couverte par un test |
| Online, classement, anti-triche, « ne jamais faire confiance au client » | Simulation **déterministe** et **indépendante du moteur** : le serveur pourra rejouer/valider un match avec le même code |
| Replays, caméra de but | Déterminisme + flux d'évènements : un replay = graine + commandes |
| Contrôles tactiles, gestes, 3 niveaux d'assistance | Les entrées produisent des *commandes* ; l'assistance est appliquée par la simulation, pas par l'UI |
| Localisation 6 langues, pas de texte dans le code | Tables de chaînes externes dès le prototype |
| Pas de pay-to-win | Aucune donnée de gameplay ne provient de la boutique ; séparation stricte cosmétique / stats |

Risque principal identifié : **le gameplay**. Un jeu de sport mobile vit ou meurt sur la sensation
du match. D'où l'ordre de développement : simulation → contrôles → présentation → contenu → économie.

---

## 2. Choix du moteur : **Unity 6 LTS** (URP à partir de la phase 3)

| Critère | Unity 6 (URP) | Unreal Engine 5 |
|---|---|---|
| Performances Android entrée/milieu de gamme | Très bonnes, pipeline URP conçu pour le mobile | Correctes mais runtime plus lourd ; Lumen/Nanite non disponibles sur mobile |
| Performances iOS | Très bonnes | Bonnes sur appareils récents |
| Taille de l'application | Build vide ≈ 15–25 Mo | Build vide ≈ 60–100 Mo et plus |
| Mémoire / batterie | Faibles, contrôle fin (targetFrameRate, Adaptive Performance) | Plus élevées par défaut |
| Qualité graphique | Bonne, suffisante pour un jeu de sport mobile stylisé-réaliste | Excellente, mais l'avantage se réduit fortement sur mobile |
| Itération / facilité | C#, compilation rapide, tests NUnit intégrés | C++/Blueprints, compilation lente |
| Animation | Mecanim, Animation Rigging, Playables | Très bon (Control Rig), plus lourd |
| Optimisation | Profiler, Frame Debugger, LOD, SRP Batcher, Addressables | Outils puissants, plus complexes |
| Publication mobile | Pipeline très éprouvé (majorité des jeux mobiles) | Plus de friction (toolchains, taille) |
| Code de simulation partageable avec un serveur .NET | **Oui** (C# pur, voir §3) | Non (C++ à porter) |

**Décision : Unity 6 LTS.** Le choix n'est pas fait pour les graphismes mais pour la stabilité, la
taille, la consommation, la vitesse d'itération et — point décisif — la possibilité d'écrire la
simulation du match en **C# pur réutilisable côté serveur** pour l'online et l'anti-triche.

Rendu : le prototype tourne avec le pipeline intégré (zéro configuration). La migration vers **URP**
(profils de qualité, eau, post-process par tier) est planifiée en phase 3 ; le code de rendu actuel
est déjà compatible URP (`MaterialFactory` choisit le shader selon le pipeline actif).

---

## 3. Architecture

### 3.1 Couches

```
┌────────────────────────────────────────────────────────────────────┐
│  WaterPolo.Runtime  (Unity)                                        │
│  Bootstrap · MatchRunner · Vues · Caméra · Contrôles tactiles ·    │
│  HUD · Qualité adaptative · Localisation · Orientation             │
│        │ lit l'état + évènements          ▲ commandes du joueur    │
├────────┼──────────────────────────────────┼────────────────────────┤
│  WaterPolo.Simulation  (C# pur, déterministe, sans UnityEngine)    │
│  Match · Règles · Joueurs · Ballon · Passes · Tirs · Duels ·       │
│  IA joueurs · IA gardien · Tactiques · Équipes · Stats             │
├────────────────────────────────────────────────────────────────────┤
│  WaterPolo.Core  (C# pur)                                          │
│  Maths (Vec3, RNG déterministe) · Profils appareil · Presets       │
│  qualité · Gouverneur de frame time · Tables de localisation       │
└────────────────────────────────────────────────────────────────────┘
   WaterPolo.Editor : outils éditeur (scène prototype, benchmark IA)
   WaterPolo.Tests.EditMode : 67 tests NUnit (Unity Test Runner ET dotnet test)
```

Les assemblies `Core` et `Simulation` ont `noEngineReferences: true` : le compilateur **interdit**
toute dépendance à Unity. C'est ce qui permet :

* de compiler et tester tout le gameplay hors Unity (`dotnet test tools/SimTests`, CI) ;
* de faire tourner exactement le même match sur un serveur .NET (phase 9) ;
* des replays et une validation anti-triche par re-simulation (graine + commandes).

### 3.2 Principes

1. **Pas fixe déterministe** — la simulation avance à 50 Hz (`MatchConfig.FixedDeltaTime`).
   `MatchRunner` accumule le temps réel, exécute 0..5 pas par frame et interpole l'affichage :
   le gameplay est identique à 30, 60 ou 120 fps. Une seule source d'aléatoire :
   `DeterministicRandom` (graine du match). Test : même graine ⇒ même match, au bit près.
2. **Commandes** — humain et IA produisent la même structure `PlayerCommand`. La simulation ne sait
   pas qui joue : cela rend l'IA, le tactile, le clavier et (plus tard) le réseau interchangeables.
3. **Évènements** — la simulation émet des `MatchEvent` (but, arrêt, interception, faute, fin de
   période…). HUD, caméra, vibrations, et plus tard audio, public, analytics et progression s'y
   abonnent. Aucun système de présentation ne modifie l'état du match.
4. **Pas de physique Unity pour le gameplay** — ballon et nageurs ont leur propre modèle (moins cher
   en CPU, déterministe, réglable). Les colliders des primitives sont supprimés.
5. **Formules nommées et testées** — toutes les probabilités de duel sont dans `Duels`, les
   paramètres de style dans `TacticParams`, les biais de caractère dans `PersonalityProfile`.
6. **Texte externalisé** — `Resources/Localization/{fr,en,es,de,it,pt}.txt`, test qui vérifie que
   les 6 langues ont exactement les mêmes clés.

### 3.3 Arborescence

```
WaterPolo26Mobile/                       Projet Unity (Unity 6 LTS)
  Packages/manifest.json
  Assets/_Project/
    Scripts/
      Core/            Math/ · Optimization/ · Localization/        (asmdef WaterPolo.Core)
      Simulation/      Players/ · Ball/ · Gameplay/ · Teams/ ·
                       AI/ · Match/ · Rules/                         (asmdef WaterPolo.Simulation)
      Runtime/         Bootstrap/ · Camera/ · Input/ · UI/ · View/ ·
                       Optimization/ · Localization/ · MatchRunner   (asmdef WaterPolo.Runtime)
      Editor/          PrototypeSetup                                (asmdef WaterPolo.Editor)
    Tests/EditMode/    tests NUnit                                   (asmdef WaterPolo.Tests.EditMode)
    Resources/Localization/  fr · en · es · de · it · pt
tools/
  SimTests/            compile Core + Simulation + tests avec .NET 8 → `dotnet test`
  UnityCompileCheck/   compile Runtime + Editor contre l'API Unity (références NuGet)
docs/                  ARCHITECTURE.md · GAMEPLAY.md
```

### 3.4 Correspondance avec les modules de la spécification

| Module (spec §5) | Emplacement | Statut |
|---|---|---|
| Core | `Scripts/Core` | IMPLÉMENTÉ |
| Gameplay | `Simulation/Gameplay` (passes, tirs, timing, duels, commandes) | IMPLÉMENTÉ |
| Players | `Simulation/Players` (stats, rôles, personnalités, nage, fatigue) | IMPLÉMENTÉ |
| Ball | `Simulation/Ball` (8 états, physique eau/air, but/poteau/sortie) | IMPLÉMENTÉ |
| Teams | `Simulation/Teams` (équipes, formation, 7 tactiques) | IMPLÉMENTÉ (équipes de démo fictives) |
| AI | `Simulation/AI` (joueurs de champ, gardien) | IMPLÉMENTÉ (v1) |
| Match | `Simulation/Match` + `Runtime/MatchRunner` | IMPLÉMENTÉ |
| Rules (RuleManager) | `Simulation/Rules` | IMPLÉMENTÉ partiel — voir GAMEPLAY.md §8 |
| Camera | `Runtime/Camera` | PROTOTYPE (caméra principale + plan de but ; replay NON IMPLÉMENTÉ) |
| UI | `Runtime/UI` (HUD, contrôles, match rapide) | PROTOTYPE |
| Optimization | `Core/Optimization` + `Runtime/Optimization` | IMPLÉMENTÉ (détection, presets, gouverneur) ; consommation des budgets par l'eau/foule/particules NON IMPLÉMENTÉE |
| Localization | `Core/Localization` + `Runtime/Localization` | IMPLÉMENTÉ |
| Animation | `Runtime/View/PlayerView` (procédural) | PROTOTYPE |
| Environment | `Runtime/View/PoolBuilder` | PROTOTYPE (primitives) |
| Audio | — | NON IMPLÉMENTÉ |
| Career, Progression, Customization | — | NON IMPLÉMENTÉ |
| Monetization, Shop, Inventory, Ads | — | NON IMPLÉMENTÉ (volontairement, spec §99) |
| Online, SaveSystem, Analytics | — | NON IMPLÉMENTÉ |

---

## 4. Performance mobile

### 4.1 Profils

`DeviceTierClassifier` attribue des points (RAM, cœurs, fréquence, shader model, compute, VRAM) et
plafonne les appareils à moins de 3 Go de RAM à MEDIUM. Le joueur peut forcer AUTO/LOW/MEDIUM/HIGH/ULTRA
(persisté). Budgets (`QualityPreset`) :

| | LOW | MEDIUM | HIGH | ULTRA |
|---|---|---|---|---|
| FPS cible | 30 | 30 | 60 | 60 |
| Échelle de rendu 3D | 0.70 | 0.85 | 0.90 | 1.00 |
| Eau | simple | standard | vagues + reflet | + réfraction/mousse |
| Ombres | non | 25 m | 40 m | 55 m |
| MSAA | 0 | 0 | 2× | 4× |
| Particules max | 64 | 160 | 400 | 800 |
| Public 3D animé / imposteurs | 0 / 150 | 40 / 400 | 120 / 900 | 250 / 1500 |
| Textures | ½ | ½ | pleine | pleine |
| Post-process | non | non | oui | oui |

### 4.2 Adaptation dynamique / chauffe

`FrameTimeGovernor` (mode AUTO) : si la moyenne glissante dépasse 120 % du budget pendant 4 s
(2× plus vite si l'OS signale un throttling thermique), le tier baisse d'un cran ; il ne remonte
qu'après 45 s de marge confortable (> 30 % de marge), jamais au-dessus du tier détecté. Couvert par tests.

### 4.3 Coûts mesurés

* Simulation : **≈ 4 µs par tick** sur PC x64 (14 joueurs, IA complète) ⇒ ≈ 0,2 ms par seconde de
  jeu. Même avec un facteur 20 sur un téléphone d'entrée de gamme, < 1 % du budget d'une frame.
* Les décisions IA lourdes ne s'exécutent que toutes les 0,15–0,4 s (selon Intelligence) ; seul le
  pilotage est par tick.
* Rendu prototype : une matière partagée par couleur (batching), pas de collider, pas de physique.

### 4.4 Outils prévus (phase 3)

URP + SRP Batcher, LOD Groups, Addressables (chargement asynchrone des piscines), atlas de textures,
compression ASTC/ETC2, animation LOD (`AnimationLodDistance`), foule en imposteurs GPU instanciés,
Adaptive Performance (Samsung/Android) branché sur `FrameTimeGovernor`.

---

## 5. MVP

Le MVP est **un match rapide amusant sur téléphone** :

1. choisir son équipe, la difficulté, l'assistance, la durée ;
2. match 6+1 contre 6+1 en paysage, contrôles tactiles ;
3. nager (inertie, sprint, fatigue), passer, tirer (charge + timing), défendre, intercepter,
   changer de joueur, gardien IA ;
4. règles de base : sprint d'engagement, buts, 30 s de possession, sorties, fautes simples, périodes ;
5. score, chrono, statistiques de fin de match ;
6. fluide sur un appareil MEDIUM.

Hors MVP : carrière, boutique, online, cosmétiques, public, audio final, animations capturées.

## 6. Première version jouable (ce commit) — Phase 1 + noyau Phase 2

* Simulation complète d'un match, testée (67 tests) — IMPLÉMENTÉ.
* Écran MATCH RAPIDE (équipe, difficulté, assistance, durée, timing, langue) — PROTOTYPE.
* Match en paysage : piscine en primitives, joueurs procéduraux, caméra broadcast, HUD,
  joystick flottant, boutons contextuels, gestes — PROTOTYPE.
* Fin de match avec statistiques et « Rejouer » — PROTOTYPE.

Ce qui n'a **pas** pu être vérifié dans cet environnement (pas d'éditeur Unity disponible) :
l'exécution réelle dans Unity, le rendu, la sensation tactile sur appareil. La couche Unity est
**compilée** contre l'API Unity (UnityEngine/UnityEditor 2021 + uGUI) sans erreur ni avertissement,
mais elle doit être lancée dans Unity 6 pour être validée (voir README, « Premier lancement »).

## 7. Feuille de route

| Phase | Contenu | Statut |
|---|---|---|
| 1 — Prototype | piscine, joueur, ballon, nage, passe, tir, but, caméra | **fait** (présentation en PROTOTYPE) |
| 2 — Match | 2 équipes, IA, gardien, défense, score, chrono | **noyau fait** ; reste : exclusions 20 s, penalty 5 m, hors-jeu 2 m, temps morts, remplacements |
| 3 — Mobile | URP, consommation des budgets par tier, réglages persistés (contrôles, vibrations, accessibilité), profils testés sur appareils | à faire |
| 4 — Vertical slice | modèles 3D + animations, shader d'eau, éclaboussures, public LOD, audio, présentation d'avant-match, replay | à faire |
| 5 — Contenu | équipes/joueurs en données, championnat, tournoi, stats saisonnières | à faire |
| 6 — Carrière | carrière joueur / club, transferts, contrats, entraînement | à faire |
| 7 — Personnalisation | création joueur/équipe, maillots, bonnets, célébrations | à faire |
| 8 — Monétisation | boutique cosmétique, monnaies, passe saisonnier, pubs **optionnelles** | à faire |
| 9 — Online | comptes, serveur autoritaire (simulation C# réutilisée), matchmaking, classements | à faire |
| 10 — Polish | bugs, IA, perfs, équilibrage | continu |

Prochaine étape recommandée : **ouvrir le projet dans Unity 6, jouer le prototype sur 2–3
téléphones réels (un LOW, un MEDIUM, un HIGH) et régler la sensation des contrôles** avant toute
production d'assets.

## 8. Garde-fous pour les phases futures

* **Économie** : les objets achetables n'ont accès qu'aux données cosmétiques (`Customization`), jamais
  à `PlayerStats` ni aux paramètres de gameplay. Les joueurs « spéciaux » devront être obtenables en
  jouant. Pas de loot box payante ; si un tirage existe, probabilités affichées et alternative gratuite.
* **Publicité** : uniquement des récompenses optionnelles et modestes après un match.
* **Online** : serveur autoritaire ; le client n'envoie que des `PlayerCommand`, le serveur simule.
  Monnaies, inventaire, progression et classements validés côté serveur.
* **Vie privée** : analytics minimales (crash, perf, équilibrage), sans données personnelles inutiles.
