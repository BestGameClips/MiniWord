# Discord Rich Presence

MiniWord affiche votre activité sur Discord : **statut** (Lecture, Édition, Sauvegarde, Recherche), **nom du fichier**, **dossier** et **temps écoulé**.

## Configurer votre propre profil
1. Créez une application sur <https://discord.com/developers/applications>.
2. Copiez son **Application ID** dans `CONFIG.clientId` (`src/main/discord/discord-rpc.js`).
3. Ajoutez une image nommée `logo` dans *Rich Presence › Art Assets*.
4. Relancez MiniWord avec Discord ouvert.

## Confidentialité
Quatre niveaux dans **Paramètres › Discord** : fichier seul, + dossier, + chemin, chemin complet. Le **contenu** de vos documents n'est jamais envoyé.

> Sans recompiler : créez `discord-rpc.override.json` dans le dossier de données pour surcharger les textes et images.
