# MARA — Plan d'Exécution : Refonte Web Épurée, Backend API Mobile & Setup Dossier Mobile

Ce plan formalise l'implémentation complète des maquettes graphiques partagées (Design épuré sombre, halos dégradés, stories plein écran, fil anonyme, ajout contact & QR scanner, barre de navigation 5 onglets), la mise en place d'un backend d'API REST & WebSockets pour alimenter simultanément le Web et les applications mobiles, et la création du dossier `mobile/` prêt pour Android & iOS (Capacitor).

---

## 🎨 1. Identité Visuelle & Refonte Web Épurée (Basée sur les Maquettes)

### 🌟 Charte Graphique & Tokens de Style
- **Arrière-plan** : Obsidian sombre profond (`#0B0E14` fond principal, `#111622` surface carte, `#161D2B` conteneurs surélevés).
- **Gradient Signature MARA** : `linear-gradient(135deg, #FF4565 0%, #FF8038 100%)`.
- **Halos Dégradés (Story Rings / Glows)** : `box-shadow: 0 0 15px rgba(255, 69, 101, 0.45); border: 2px solid transparent; background-image: linear-gradient(#111622, #111622), linear-gradient(135deg, #FF4565, #FF8038); background-origin: border-box; background-clip: content-box, border-box;`.
- **Bordures Translucides** : `border: 1px solid rgba(255, 255, 255, 0.08)`.
- **Typographie** : `Plus Jakarta Sans`, graisses 500 (moyen), 700 (gras), 800 (extra-gras), texte blanc pur `#FFFFFF` et texte secondaire `#8E9BAE`.
- **Barre de Navigation Basse (5 Onglets)** :
  1. 💬 **Discussions** (actif : pastille arrondie illuminée avec icône rose et label)
  2. 👥 **Groupes**
  3. ➕ **Nouveau**
  4. ⭕ **Stories**
  5. 👤 **Profil**

---

## 📱 2. Écrans Clés à Implémenter & Moderniser

### A. Écran Discussions (Accueil Principal — Image 3 & 4)
- En-tête : Titre grand format **Discussions**, Avatar de profil avec halo en haut à droite.
- Barre de recherche en pilule : `🔍 Rechercher un pseudo ou une conversation`.
- **Rail horizontal des Stories / Contacts actifs** : Avatars ronds avec anneaux dégradés lumineux (rose/orange), pseudo en dessous.
- **Liste des conversations** :
  - Avatar (photo, silhouette anonyme sombre, mosaïque 4 avatars pour les groupes).
  - Titre (pseudo ou nom du groupe), dernier message en gris clair, heure/jour à droite.
  - Badge de message non-lu (pastille rose/rouge avec chiffre `1`, `2`, `3`) ou chevron discret `>`.

### B. Écran Fil Anonyme (PV Thread — Image 2)
- En-tête : Bouton retour `<` dans un cercle sombre, titre **Fil anonyme**, menu `...` en cercle.
- Avatar central silhouette floutée avec halo rose/orange arrière.
- Titre : **Message anonyme** + sous-titre *"Quelqu'un t'a envoyé un message sans révéler son identité"*.
- Séparateur de date : *"Aujourd'hui"*.
- Bulles de messages :
  - Bulle anonyme (gauche) : fond sombre `#161D2B`, texte blanc avec émojis, heure.
  - Bulle utilisateur (droite) : fond gradient MARA rose/orange, texte blanc, double tick de statut `✓✓`.
- **Bannière de sécurité** : Icône cadenas 🔒 *"Ton identité reste secrète tant que tu ne révèles rien"*.
- **Double action exclusive** :
  - Bouton gradient MARA : **Découvrir qui c'est** (modal de confirmation irréversible).
  - Bouton sombre arrondi : **Clore la discussion** (suppression immédiate du fil).
- Barre de saisie en pilule sombre avec bouton d'envoi circulaire en avion en papier.

### C. Écran Visionneuse de Story (Image 1)
- Affichage plein écran (image / vidéo / texte avec fond sunset).
- Barres de progression segmentées en haut (segment actif en dégradé, inactifs sombres).
- En-tête : Avatar avec halo dégradé, pseudo **Yuna**, temps *"il y a 2h"*, bouton fermeture `✕`.
- Zone basse flottante : Bouton réaction ❤️ avec effet rebond + champ *"Répondre à [Pseudo]..."* avec bouton d'envoi avion.

### D. Écran Ajouter un Contact / Recherche & Scanner QR (Image 5)
- En-tête : Titre **Ajouter un contact**, bouton `✕`.
- Onglets segmentés : **Rechercher un pseudo** (pilule gradient active) vs **Scanner un QR code** (pilule sombre).
- Champ `@ Rechercher un pseudo` avec toggle interactif **Être trouvable**.
- Carte scanner avec cadre de visée aux coins néon rose/orange, bouton lampe torche 🔦, texte d'aide.
- Carte **Mon QR code** avec mini aperçu et bouton de partage rapide.
- Section **Résultats** : Carte contact avec avatar à halo, `@pseudo`, amis en commun, bouton **Inviter** (gradient MARA).

### E. Autres Écrans & Modals Intégrés
- **Écran 8.5 (Carrousel Inbox)** : Défilement swipeable des messages anonymes avec actions : Répondre / Ajouter en story / Suivant.
- **Écran Groupes & Chat de Groupe** : Mode Anonyme (nicknames) vs Mode Connu (vrais profils).
- **Écran Mon Profil & Réglages** : Extraction de palette dynamique depuis la photo de profil, gestion de la confidentialité et des amis.

---

## ⚡ 3. Backend Django : API REST / JSON Complète & WebSockets

Nous créons un module d'API unifié (`apps/api/`) pour alimenter à la fois le Web frontend (fetch/AJAX) et les applications mobiles (Capacitor/React/Vue/Fetch natif) :

### Architecture des Endpoints API (`/api/v1/`) :

| Catégorie | Endpoint | Méthode | Rôle |
|---|---|---|---|
| **Authentification & Profil** | `/api/v1/auth/register/` | POST | Création de profil (pseudo, PIN, photo) |
| | `/api/v1/auth/login-pin/` | POST | Connexion via pseudo + PIN |
| | `/api/v1/auth/reconnect/` | POST | Restauration de session via reconnect_token |
| | `/api/v1/profile/me/` | GET/PUT | Récupération / Mise à jour profil (bio, photo, options) |
| | `/api/v1/profile/settings/` | POST | Toggles (être trouvable, profil privé) |
| **Contacts & Recherche** | `/api/v1/search/users/` | GET | Recherche de pseudos avec debounce |
| | `/api/v1/contacts/invite/` | POST | Envoyer une invitation (max 10 en attente) |
| | `/api/v1/contacts/invitations/` | GET | Liste des invitations reçues/émises |
| | `/api/v1/contacts/respond/` | POST | Accepter / Refuser / Bloquer une invitation |
| | `/api/v1/friends/` | GET | Liste complète de mes amis |
| | `/api/v1/profile/<link_id>/qrcode/` | GET | Génération de QR code personnalisé |
| **Discussions & Messages** | `/api/v1/conversations/` | GET | Liste des conversations avec dernier message & non-lus |
| | `/api/v1/conversations/<id>/messages/` | GET/POST | Historique des messages et envoi multi-média |
| | `/api/v1/messages/action/` | POST | Modifier, supprimer, épingler, réagir emoji |
| | `/api/v1/link-preview/` | POST | Scraper sécurisé anti-SSRF pour aperçu de lien |
| **Fils Anonymes** | `/api/v1/threads/` | GET | Liste des fils anonymes actifs |
| | `/api/v1/threads/<id>/messages/` | GET/POST | Chat dans le fil anonyme |
| | `/api/v1/threads/<id>/reveal/` | POST | Action "Découvrir qui c'est" |
| | `/api/v1/threads/<id>/close/` | POST | Clore et détruire le fil anonyme |
| **Groupes** | `/api/v1/groups/` | GET/POST | Liste et création de groupe (Anonyme ou Connu) |
| | `/api/v1/groups/<id>/messages/` | GET/POST | Messages et réactions de groupe |
| **Stories** | `/api/v1/stories/active/` | GET | Stories actives des amis pour le rail horizontal |
| | `/api/v1/stories/create/` | POST | Créer une story (image/vidéo/texte) |
| | `/api/v1/stories/<id>/view/` | POST | Marquer comme vue (is_fully_loaded) |
| | `/api/v1/stories/<id>/react/` | POST | Envoyer un like ❤️ ou une réponse à une story |
| **Notifications** | `/api/v1/notifications/` | GET | Flux de notifications in-app |
| | `/api/v1/push/register/` | POST | Enregistrement token Push VAPID / FCM |

### Canaux WebSockets Channels (`/ws/`) :
- `/ws/chat/<conversation_id>/` : Messages directs temps réel, typing, statut de lecture.
- `/ws/thread/<thread_id>/` : Messages temps réel du fil anonyme.
- `/ws/groups/<group_link_id>/` : Messages et réactions de groupe.
- `/ws/notifications/<user_id>/` : Badge et alertes temps réel.

---

## 📦 4. Dossier Mobile (`mobile/`) & Configuration Multi-Plateforme

Création de la structure du dossier `mobile/` avec la suite d'outils **Capacitor** :

```
mobile/
├── capacitor.config.json       # Configuration Capacitor (appId: com.mara.app, webDir, server url)
├── package.json               # Dépendances Capacitor (Core, Android, iOS, Camera, Push, Haptics)
├── resources/                 # Icônes (1024x1024) et Splash screens adaptatifs
│   ├── icon.png
│   └── splash.png
├── android/                   # Configuration du projet natif Android
└── ios/                       # Configuration du projet natif iOS
```

### Fonctionnalités Mobiles Natives Configurées :
- **Status Bar & Safe Area** : Barres d'état translucides s'adaptant à l'arrière-plan sombre `#0B0E14` (iOS & Android).
- **Push Notifications FCM & APNS** : Réception native des notifications même app fermée.
- **Accès Caméra & Galerie** : Prise de photo/vidéo directe pour les stories et messages.
- **Retour Haptique (Vibrations douces)** : Lors des likes sur stories, des clics longs sur messages et des envois.
- **Scanner QR Code Natif** : Accès direct caméra avec détection de flux vidéo.

---

## 🚀 Ordre d'Exécution Proposé

1. **Étape 1 (Fondations & Nettoyage)** :
   - Corriger le Service Worker, supprimer le dossier obsolète `apps/messages/`, ajuster `.gitignore`.
2. **Étape 2 (Design System CSS Obsidian & Composants Partagés)** :
   - Réécrire `static/css/style.css` pour intégrer tous les tokens, halos, animations, barres de navigation et styles des maquettes.
   - Créer `templates/includes/bottom_nav.html` et les composants de base.
3. **Étape 3 (Modèles & Base de Données)** :
   - Étendre `UserProfile` (options privacy, theme, stats).
   - Créer les modèles `Friendship`, `Invitation`, `Conversation`, `ConversationMessage`, `AnonymousThread`, `AnonymousThreadMessage`, `Story`, `StoryView`, `Notification`.
   - Appliquer les migrations Django.
4. **Étape 4 (Backend API REST & WebSockets)** :
   - Développer les vues d'API dans `apps/api/` pour l'ensemble des modules (Auth, Contacts, Conversations, Fils anonymes, Groupes, Stories, Notifications).
   - Configurer les routes dans `config/urls.py`.
   - Connecter les WebSockets Channels.
5. **Étape 5 (Templates Web Épurés & Intégration Visuelle)** :
   - Intégrer l'écran Discussions avec rail de stories.
   - Intégrer l'écran Fil anonyme avec double bouton et silhouette.
   - Intégrer la visionneuse de Story plein écran.
   - Intégrer l'écran Ajouter un contact avec scanner QR et recherche.
   - Intégrer le carrousel des messages anonymes reçus.
6. **Étape 6 (Configuration du Dossier Mobile)** :
   - Initialiser et configurer le dossier `mobile/` avec `capacitor.config.json`, `package.json`, assets et documentation de build.
7. **Étape 7 (Tests & Vérifications)** :
   - Tests automatisés des API et modèles.
   - Vérification visuelle responsive (Mobile + Desktop).
