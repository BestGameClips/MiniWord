# MiniWord

Un « mini Word » léger, rapide et 100 % hors ligne, développé en **Node.js + Electron (JavaScript)**, avec une interface moderne inspirée de Discord et un **Discord Rich Presence** dynamique.

---

## 🚀 1. Démarrage rapide

**Prérequis :** [Node.js 22 LTS](https://nodejs.org) (Node 20+ fonctionne ; les tests demandent Node 21+).

```bash
npm install        # installe Electron, electron-builder et le module Discord RPC
npm run dev        # lance l'application en mode développement
```

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'app (journaux détaillés dans la console) |
| `npm start` | Lance l'app en mode normal |
| `npm test` | Exécute les tests automatiques (30 scénarios) |
| `npm run check` | Vérifie la syntaxe + la présence des icônes |
| `npm run build` | Vérifie puis produit l'app **non empaquetée** dans `dist/win-unpacked/` (test rapide de l'exe) |
| `npm run dist` | Produit l'**installateur Windows** `dist/MiniWord-Setup-1.0.0.exe` |
| `npm run release -- patch` | **Publie une release** (voir §7) — `npm run release:dry` pour simuler |
| `npm run dist:linux` / `dist:mac` | Versions Linux (AppImage, deb) / macOS (dmg) — à lancer sur l'OS concerné |

---

## 🎮 2. Configurer Discord Rich Presence (fichier unique)

Tout se règle dans **`src/main/discord/discord-rpc.js`**, bloc `CONFIG` tout en haut :

1. Va sur <https://discord.com/developers/applications> → **New Application**. Le nom donné s'affiche sur ton profil (« Joue à MiniWord »).
2. Copie l'**Application ID** et colle-le dans `CONFIG.clientId`.
3. *(Optionnel)* **Rich Presence → Art Assets** : envoie une image nommée `logo` (512×512) pour l'icône du profil.
4. Lance **Discord (application de bureau)** puis `npm run dev`. Vérifie l'état dans **Paramètres › Discord** (pastille verte = connecté, avec aperçu de ce qui est envoyé).

Dans le même bloc `CONFIG` tu modifies : les **textes de chaque statut** (Prêt / Lecture / Édition / Sauvegarde / Recherche), les emojis, les images, les **boutons** (liens https), le masquage du dossier personnel, les délais, etc. Variables disponibles : `{file}`, `{location}`, `{icon}`, `{label}`, `{appName}`, `{tabs}`, `{ext}`.

> 💡 **Sans recompiler l'exécutable installé** : crée `discord-rpc.override.json` dans le dossier de données (Paramètres › Avancé › *Dossier de données*), avec uniquement ce que tu veux changer, par ex. `{ "clientId": "123…", "statuses": { "editing": { "label": "En train d'écrire" } } }`, puis clique **Reconnecter**.

**Confidentialité :** par défaut seuls le *nom du fichier* et le *nom du dossier* sont affichés. 4 niveaux (fichier / +dossier / +chemin / chemin complet) et des interrupteurs (nom, extension, statut, temps) dans Paramètres › Discord. Le **contenu des documents n'est jamais envoyé** (le canal IPC n'accepte que nom, chemin, statut).

---

## 📦 3. Compiler l'installateur Windows

```bash
npm install
npm run dist
```

Résultat : `dist/MiniWord-Setup-1.0.0.exe` (installateur NSIS : choix du dossier, raccourci bureau, raccourci menu démarrer, case « Lancer MiniWord », désinstallation propre).

* Le raccourci bureau se désactive avec `createDesktopShortcut: false` dans `electron-builder.yml`.
* L'exécutable n'étant pas signé, Windows SmartScreen peut afficher un avertissement (« Informations complémentaires › Exécuter quand même »). Une signature de code (certificat) est nécessaire pour l'éviter.
* Si electron-builder se plaint de *« Cannot create symbolic link »* sous Windows : active le **Mode développeur** (Paramètres › Confidentialité et sécurité › Pour les développeurs) ou lance le terminal en administrateur, puis relance.

---

## 🎨 4. Personnaliser

| Je veux… | Je modifie… |
|---|---|
| **Changer le logo** | Remplace `assets/logo/logo.svg` (barre de titre, accueil, À propos) et `assets/icons/icon.ico` / `icon.png` / `icon.icns` (icône de l'exe et de la fenêtre). Aucun code à toucher. |
| **Renommer l'application** | `appName` dans `app.config.js` **et** `productName` dans `electron-builder.yml` (+ `productName` dans `package.json`). Le nom s'affiche partout automatiquement. ⚠ Le dossier de données porte ce nom : renommer = nouveaux paramètres. |
| **Ajouter un type de fichier** | Une ligne dans `FILE_TYPES` (`src/shared/constants.js`). |
| **Préparer .docx / .rtf** | `fileManager.registerHandler(['docx'], { read(buffer), write(content, meta) })` (`src/main/filesystem/file-manager.js`). |
| **Activer les mises à jour auto** | `app.config.js › updates` + section `publish` de `electron-builder.yml` (GitHub Releases). Désactivées par défaut. |
| **Modifier un raccourci** | Paramètres › Raccourcis (détection de conflits) ou valeur par défaut dans `src/renderer/app/commands.js`. |

Les paramètres, logs, sauvegardes et fichiers de récupération sont stockés hors du projet : `%APPDATA%\MiniWord` (Windows), `~/.config/MiniWord` (Linux), `~/Library/Application Support/MiniWord` (macOS).

---

## ✨ 5. Fonctionnalités

* **Fichiers** : nouveau, ouvrir (multi-sélection), enregistrer, enregistrer sous, glisser-déposer, ouverture via « Ouvrir avec » / ligne de commande, formats `.txt .md .log .json .csv .xml .html .css .js .ts`, détection d'encodage (UTF-8, UTF-8 BOM, UTF-16, Windows-1252) et des fins de ligne (LF/CRLF) conservés à l'enregistrement.
* **Onglets** : réordonnables par glisser-déposer, épinglés, fermer / autres / à droite / tous, dupliquer, rouvrir (`Ctrl+Maj+T`), indicateur ● de modification, restauration de session.
* **Sécurité des données** : auto-save avec debounce (0,5 s à 30 s, jamais à chaque frappe) · écriture atomique · versions de sauvegarde automatiques avec nettoyage · **récupération après crash** · détection des fichiers **modifiés / supprimés / renommés** hors de l'application avec bandeau (Recharger / Conserver ma version / **Comparer** avec diff) · conflit de sauvegarde détecté côté disque (rien n'est jamais écrasé en silence).
* **Éditeur** : annuler/rétablir par document, recherche (casse, mot entier, regex) et remplacement (un / suivant / tout), indentation/désindentation, caractères invisibles, retour à la ligne, zoom 50–200 %, police / taille / interligne, compteurs mots/caractères/lignes, position Ln/Col.
* **Formatage** : gras, italique, souligné, barré, titres, listes, citations, liens, code, alignement et surlignage — **uniquement pour `.md` et `.html`**. Sur un fichier texte brut, l'app l'indique au lieu d'ajouter du formatage en silence.
* **Interface** : thèmes Sombre / Clair / Système, couleur d'accent, densité, arrondis, animations, barre latérale (Récents, Favoris), barre de statut, **palette de commandes** (`Ctrl+Maj+P`), menus contextuels, notifications, accessibilité clavier (focus visible, aria-labels).
* **Sécurité Electron** : `contextIsolation`, `nodeIntegration: false`, `sandbox`, CSP, API `window.api` minimale, toutes les entrées IPC validées, expéditeur vérifié, aucune stack trace affichée (journaux dans `logs/app.log` et `errors.log`).

### Raccourcis par défaut

`Ctrl+N` nouveau · `Ctrl+O` ouvrir · `Ctrl+S` sauvegarder · `Ctrl+Maj+S` sauvegarder sous · `Ctrl+W` fermer l'onglet · `Ctrl+Maj+W` fermer la fenêtre · `Ctrl+Z / Ctrl+Y` annuler / rétablir · `Ctrl+F` rechercher · `Ctrl+H` remplacer · `F3 / Maj+F3` suivant / précédent · `Ctrl+B / I / U` gras / italique / souligné · `Ctrl +  / − / 0` zoom · `Ctrl+Maj+P` palette · `Ctrl+/` raccourcis · `Ctrl+,` paramètres · `F11` plein écran · `Ctrl+Maj+I` DevTools (mode développeur) · `Échap`.

---

## 🗂 6. Architecture

```
src/
├─ main/       Processus principal : fenêtre, menus, IPC (ipc/), système de fichiers (filesystem/),
│              discord/discord-rpc.js (⭐ config Discord), updater/, logger
├─ preload/    preload.js — seule passerelle sécurisée (window.api)
├─ core/       Logique métier : documents, onglets, auto-save, historique, raccourcis, commandes, paramètres, récents
├─ renderer/   Interface : editor/, tabs/, sidebar/, settings/, command-palette/, dialogs/, notifications/, styles/, app/
└─ shared/     Constantes, canaux IPC, schéma de paramètres validé, utilitaires, diff
tests/         30 tests automatiques (node:test)
```

---

## 🆕 7. Nouveautés v1.1 — mode dev, Wiki, mises à jour, release, Markdown

### Configuration GitHub (une seule fois)
Dans **`app.config.js`** renseigne `github: { owner: 'ton-compte', repo: 'ton-depot' }` : cela active les **mises à jour**, la **synchronisation du Wiki** et les liens « en ligne ». Dans `electron-builder.yml`, remplace `OWNER_A_REMPLACER` / `REPO_A_REMPLACER` par les mêmes valeurs. Sans ces valeurs, tout fonctionne en local (hors ligne).

### Mode développeur
**Paramètres › Avancé › Mode développeur** débloque :
* la **console de logs** (`Ctrl+Maj+L`, ou `/dev` dans la palette) : flux temps réel **coloré** — 🟢 succès, 🟡 avertissements, 🔴 erreurs, 🔵 infos — avec filtres par niveau, pause, copie, effacement ;
* des **outils de test** : logs de test, diagnostic (versions, mémoire, état Discord/MAJ/Wiki), erreur simulée, reconnexion Discord, DevTools ;
* l'accès à l'**administration du Wiki**.
**Numéros de ligne** (Paramètres › Éditeur, `Alt+L`, suivent le retour à la ligne) et compteur « N lignes » dans la barre d'état pour tous.

### Wiki
**Paramètres › Wiki & Aide** ou `F1` / `/wiki`. Les pages `.md` viennent de 3 sources (priorité : **locale > GitHub > livrée**) : `assets/wiki/` (livrées), le dossier `wiki/` de ton dépôt GitHub (mis en cache, **rafraîchi au démarrage en même temps que la vérification des mises à jour**, utilisable hors ligne), et les pages créées par l'admin. Le bouton **↻ Recharger** force la synchronisation à la volée.

### Administration du Wiki (`/admin`)
Créer / modifier / supprimer des pages avec aperçu en direct, sans toucher au code. Accès : **mode développeur** ou **mot de passe admin** (SHA-256 dans `app.config.js › admin.passwordSha256` ; vérifié côté processus principal). Stockage au choix : **fichiers Markdown locaux** ou **base SQLite** (module `node:sqlite` intégré, sans dépendance native) ; option **publication sur GitHub** à chaque enregistrement (jeton `repo` chiffré par le système, ou variable `GITHUB_TOKEN`). MySQL n'est pas inclus (cela imposerait un serveur ; SQLite couvre le besoin local).

### Aperçu Markdown `/md` et créateur de README
* `/md` (palette) ou `Ctrl+Maj+M` : aperçu **en direct** à côté de l'éditeur, thèmes **Néon**, **Verre** (glassmorphism) et **Papier**. L'interpréteur est maison et **sûr** : le HTML brut et les liens `javascript:` sont neutralisés.
* `/readme` : **créateur de README** (gabarits App / Bibliothèque / Bot Discord, badges shields.io, sections, licence, sommaire) → « Créer le document » ouvre un `README.md` prêt à enregistrer. *Les badges et images distantes se chargent depuis Internet à l'affichage.*

### Discord RPC refondu
Titres clairs par statut, **icônes dynamiques par type de fichier** (`fileTypeIcons` dans `discord-rpc.js`), nombre d'onglets, temps écoulé, 4 niveaux de confidentialité. **Chaque utilisateur peut saisir son propre Client ID** dans Paramètres › Discord (avec aperçu en direct et bouton « Reconnecter ») — plus besoin de modifier le code.

### Mises à jour & notes de patch (GitHub Releases)
Au démarrage, MiniWord vérifie la dernière release ; si une version est disponible : **Télécharger → progression → Redémarrer et installer** (les documents sont d'abord enregistrés). Au **premier lancement après la mise à jour**, une fenêtre **« Nouveautés »** affiche les notes lues dans `CHANGELOG.md`.

### Publier une release
1. Ajoute une entrée en haut de `CHANGELOG.md` : `## [1.2.0] - 2026-11-01` puis `### Nouveautés` / `### Améliorations` / `### Corrections` avec des `- éléments`.
2. `set GITHUB_TOKEN=...` (jeton `repo`) et, optionnel, `set DISCORD_WEBHOOK_URL=...`
3. `npm run release:dry` (simulation, rien n'est modifié) puis `npm run release -- minor` (ou `patch`, `major`, `1.2.0`).
Le script enchaîne : tests → build (installateur NSIS + **archive zip** + `latest.yml`) → commit/tag/push → **release GitHub** avec les fichiers → **webhook Discord** (message `:clipboard: **Mise à jour** - MiniWord v1.2.0` + embed avec les sections).
**Automatique côté GitHub :** `.github/workflows/release.yml` compile et publie à chaque tag `vX.Y.Z` ; `discord-notify.yml` envoie les notes sur ton salon dès qu'une release est publiée (secret `DISCORD_WEBHOOK_URL` à créer dans *Settings › Secrets*).

> ⚠ Ces fonctions réseau (GitHub, webhook, mises à jour) n'ont pas pu être testées contre de vrais serveurs ici : elles sont couvertes par des tests avec réponses simulées, et le script de release a un mode simulation.

## ⚠ Limites connues (transparence)

* L'éditeur est un champ de texte natif : **pas de sélection multiple** (multi-curseurs) ni de coloration syntaxique.
* Le formatage riche (gras, couleurs…) n'est pas un traitement de texte WYSIWYG : il insère la syntaxe Markdown/HTML. `.docx` et `.rtf` ne sont pas encore pris en charge (architecture prête).
* Renommage détecté uniquement dans le **même dossier**.
* Interface en français uniquement.
* Le build `.exe` n'a pas pu être exécuté dans l'environnement de génération (Linux) : l'app a été validée par tests automatiques et lancée réellement sous Electron 44 ; lance `npm run dist` sur ta machine Windows pour produire l'installateur.

Licence MIT.
