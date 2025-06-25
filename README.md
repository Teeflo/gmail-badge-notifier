# Gmail Badge Notifier

## Description
Gmail Badge Notifier est une extension Chrome légère qui indique le nombre de messages non lus dans votre boîte de réception Gmail directement sur l'icône de l'extension.

## Fonctionnalités
- Interroge périodiquement le flux Atom de Gmail pour déterminer le nombre d'e-mails non lus.
- Affiche ce nombre sur un badge rouge dans la barre d'outils Chrome.
- Masque automatiquement le badge s'il n'y a pas de message non lu.
- Fonctionne en arrière-plan grâce à l'API `chrome.alarms` de Manifest V3.

## Installation
1. Téléchargez ou clonez ce dépôt.
2. Ouvrez Chrome et accédez à `chrome://extensions`.
3. Activez le mode **Développeur** en haut à droite.
4. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier `gmail-badge-notifier`.

## Comment ça marche
L'extension utilise un service worker (`background.js`) pour interroger toutes les minutes le flux Atom de Gmail (`https://mail.google.com/mail/feed/atom`).
Le nombre de messages non lus est extrait de la balise `<fullcount>` du flux. Ce nombre est affiché sur l'icône de l'extension. Si la requête échoue ou si aucun message n'est trouvé, le badge est caché.

## Confidentialité
Cette extension n'accède qu'au nombre de messages non lus via le flux Atom. Elle ne lit ni ne stocke le contenu de vos e-mails.
