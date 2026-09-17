# 📱 MARA — Application Mobile Native (Capacitor Android & iOS)

Ce dossier contient la configuration et le pont natif **Capacitor** permettant de compiler et distribuer MARA sous forme d'applications natives sur le **Google Play Store** (Android) et l'**Apple App Store** (iOS).

---

## 🛠️ 1. Prérequis

- **Node.js** (v18+ recommandé) & **npm**
- Pour **Android** : [Android Studio](https://developer.android.com/studio) avec le SDK Android 34 et Java 17+.
- Pour **iOS** : Un Mac avec [Xcode](https://developer.apple.com/xcode/) (v15+) et CocoaPods (`sudo gem install cocoapods`).

---

## 🚀 2. Installation & Synchronisation

Dans ce dossier `mobile/` :

```bash
# 1. Installer les dépendances Capacitor
npm install

# 2. Synchroniser les plugins natifs et configurations avec les plateformes
npx cap sync
```

---

## 🤖 3. Compiler pour Android

```bash
# Ouvrir le projet dans Android Studio
npx cap open android
```

1. Dans Android Studio, connectez un appareil physique ou lancez un émulateur.
2. Cliquez sur **Run (▶)** pour tester l'application en temps réel.
3. Pour générer un APK / AAB de production :
   - Rendez-vous dans **Build > Generate Signed Bundle / APK**.
   - Sélectionnez **Android App Bundle (AAB)** pour le Play Store.

---

## 🍏 4. Compiler pour iOS

```bash
# Ouvrir le projet dans Xcode
npx cap open ios
```

1. Dans Xcode, sélectionnez votre cible d'appareil (iPhone simulateur ou appareil réel).
2. Configurez votre équipe de signature dans **Signing & Capabilities**.
3. Cliquez sur **Product > Run (⌘ + R)**.
4. Pour archiver et soumettre sur TestFlight / App Store : **Product > Archive**.

---

## ✨ 5. Fonctionnalités Natives Incluses

- **Status Bar Sombre** : Barre d'état translucide adaptée au thème `#0B0E14`.
- **Accès Caméra & Galerie** : Prise de photo directe pour les stories et envoi de médias.
- **Scanner QR Code** : Détection caméra haute cadence pour l'ajout de contacts.
- **Push Notifications** : Support Firebase Cloud Messaging (FCM) et Apple Push Notification service (APNs).
- **Retour Haptique** : Vibrations légères lors des interactions clés (likes, suppressions, envois).
