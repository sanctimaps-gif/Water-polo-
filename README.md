# WATER POLO 26 MOBILE

Jeu mobile de water-polo en 3D (Android, iPhone, iPad, tablettes) — **Unity 6 LTS**, conçu mobile-first.

> **État : prototype jouable de gameplay (Phase 1 + noyau de la Phase 2).**
> Le cœur du match (simulation, IA, gardien, règles de base) est implémenté et couvert par 67 tests.
> La présentation (piscine, joueurs, HUD) est un **PROTOTYPE** en primitives, destiné à être remplacé.
> Carrière, boutique, online, audio, public : **NON IMPLÉMENTÉS** (volontairement, le match passe d'abord).

## ▶ Jouer dans le navigateur (téléphone ou ordinateur)

**https://sanctimaps-gif.github.io/Water-polo-/**

Version web du prototype : même simulation de match (portée en JavaScript depuis le C#), rendu 3D
Three.js, contrôles tactiles. **Jeu exclusivement en paysage** : téléphone tenu verticalement, tout l'affichage
est tourné de 90° automatiquement (pas de message « tournez votre appareil »). Au clavier : WASD, Maj, J, K, L, Q.
C'est une démo jouable du gameplay ; le jeu final reste l'application Unity (Android / iOS).

## Documentation

* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — analyse de la spec, choix du moteur, architecture,
  performance mobile, MVP, feuille de route, statut de chaque module.
* [`docs/UI.md`](docs/UI.md) — écrans (accueil, équipe, événements, boutique…), données réelles affichées, économie, choix sur les données sportives réelles.
* [`docs/GRAPHICS.md`](docs/GRAPHICS.md) — présentation 3D du match : joueurs, eau, animations, arène, caméra, replay, qualité, mesures.
* [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md) — contrôles, assistance, nage, ballon, passes, tirs, timing,
  gardien, IA, tactiques, règles, effet de chaque statistique, équilibrage mesuré.

## Premier lancement dans Unity

1. Installer **Unity 6 LTS (6000.0.x)** avec les modules Android et/ou iOS.
2. Unity Hub → *Add project from disk* → dossier `WaterPolo26Mobile/`.
   Si Unity propose d'activer le nouveau système d'entrée (Input System), accepter et redémarrer.
3. Menu **Water Polo 26 → Create Prototype Scene** (crée `Assets/_Project/Scenes/Prototype.unity`,
   l'ajoute au build, crée la matière de base, règle l'orientation).
4. **Play**. Dans l'éditeur : souris sur les contrôles tactiles, ou clavier (WASD, Maj, J, K, L, Q).
   Pour tester le tactile : Device Simulator (Window → General → Device Simulator) ou build sur téléphone.
5. Tests : *Window → General → Test Runner → EditMode → Run All*.

Au premier import, Unity génère les fichiers `.meta` : les committer.

## Tester sans Unity

Le gameplay est en C# pur (aucune dépendance à Unity), donc testable avec le SDK .NET 8 :

```bash
dotnet test tools/SimTests            # 67 tests : nage, ballon, passes, tirs, gardien, règles, IA, tactiques, stats
dotnet build tools/UnityCompileCheck  # compile la couche Unity contre l'API Unity (références NuGet)
```

La CI GitHub (`.github/workflows/simulation.yml`) exécute les deux à chaque push.
Dans Unity, le menu **Water Polo 26 → Run AI Benchmark** joue 10 matchs IA et affiche l'équilibrage.

## Contrôles (paysage)

Joystick flottant à gauche (bord = sprint) · **A** : tir (maintenir/relâcher, *tap* = tir rapide) ou
défense · **B** : passe (appui long = lob) ou changement de joueur · swipe en relâchant = viser /
passe dirigée · glisser à droite = caméra · double tap à droite = action contextuelle.

## Arborescence

```
WaterPolo26Mobile/Assets/_Project/
  Scripts/Core/        maths, RNG déterministe, profils d'appareil, presets qualité, localisation
  Scripts/Simulation/  match, règles, joueurs, ballon, passes, tirs, duels, IA, gardien, tactiques
  Scripts/Runtime/     Unity : bootstrap, MatchRunner, vues, caméra, tactile, HUD, qualité
  Scripts/Editor/      outils éditeur
  Tests/EditMode/      tests NUnit
  Resources/Localization/  fr en es de it pt
tools/SimTests/          exécution des tests hors Unity
tools/UnityCompileCheck/ vérification de compilation de la couche Unity
index.html + web/          version jouable dans le navigateur (GitHub Pages)
```

## Principes non négociables

**Paysage uniquement (LANDSCAPE ONLY)** · gameplay d'abord · fluide avant d'être beau · aucune fausse fonctionnalité (PROTOTYPE / NON IMPLÉMENTÉ
affichés clairement) · chaque statistique a un effet testé · aucun texte en dur · pas de pay-to-win,
pas de loot box payante opaque, publicités uniquement optionnelles · clubs réels **adaptés** (nom modifié,
logo et maillots originaux, sources conservées à part, aucune marque officielle), joueurs fictifs.
