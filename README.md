# MARA — Message At Random Anonymous

Application web de messages anonymes inspiree de NGL.

## Stack

- **Backend** : Django 4.2
- **Frontend** : Tailwind CSS (CDN)
- **Base de donnees** : SQLite (dev) / PostgreSQL (prod)
- **Images** : Pillow (watermark automatique)

## Installation

```bash
# 1. Cloner le projet
git clone https://github.com/AHOURMAROLAND/MARA.git
cd MARA

# 2. Environnement virtuel
python -m venv venv
source venv/bin/activate
# Windows : venv\Scripts\activate

# 3. Dependances
pip install -r requirements.txt

# 4. Migrations
python manage.py makemigrations users inbox
python manage.py migrate

# 5. Image OG par defaut
python generate_og.py

# 6. Superuser admin
python manage.py createsuperuser

# 7. Lancer le serveur
python manage.py runserver
```

## Acces

| Page | URL |
|------|-----|
| Accueil | http://localhost:8000/ |
| Creer profil | http://localhost:8000/create/ |
| Envoyer message | http://localhost:8000/m/send/<pseudo>/ |
| Inbox | http://localhost:8000/m/inbox/<pseudo>/ |
| Partager | http://localhost:8000/u/<pseudo>/ |
| Admin | http://localhost:8000/admin/ |

## Structure du projet

```
MARA/
├── manage.py
├── requirements.txt
├── generate_og.py
├── config/
│   ├── settings.py
│   ├── urls.py
│   ├── context_processors.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── users/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── utils.py
│   │   ├── image_utils.py
│   │   ├── signals.py
│   │   ├── apps.py
│   │   ├── admin.py
│   │   └── migrations/
│   └── inbox/
│       ├── models.py
│       ├── views.py
│       ├── urls.py
│       ├── admin.py
│       └── migrations/
├── templates/
│   ├── base.html
│   ├── home.html
│   ├── send.html
│   ├── sent_success.html
│   ├── inbox.html
│   ├── profile_share.html
│   ├── message_detail.html
│   └── settings.html
└── static/
    └── img/
        └── mara-og-default.jpg
```

## Modeles

### UserProfile
- `pseudo` : Pseudo unique
- `photo` : Photo de profil (watermarkee auto)
- `link_id` : Identifiant unique pour le lien de partage
- `accept_images` : Autoriser les images
- `accept_messages` : Autoriser les messages

### SessionLog
- `token` : Token de session unique
- `session_type` : 'owner' ou 'visitor'
- `user` : Lien vers UserProfile (nullable)
- `ip_address` : IP du client
- `device_name` : Type d'appareil
- `expiry` : Date d'expiration (30 jours)

### Message
- `recipient` : Destinataire (UserProfile)
- `text` : Contenu texte
- `image` : Image jointe
- `image_caption` : Legende image
- `sender_ip` : IP anonyme
- `sender_device` : Appareil anonyme
- `is_read` : Message lu
- `is_reported` : Message signale

## Fonctionnalites

✅ Creer un profil avec pseudo unique
✅ Recevoir des messages anonymes
✅ Envoyer des images avec legende
✅ Watermark automatique MARA (rose/orange)
✅ Meta tags Open Graph dynamiques
✅ Sessions anonymes avec cookies
✅ Interface Tailwind CSS moderne
✅ Admin Django complet

## Watermark

Les photos de profil sont automatiquement watermarkees avec :
- Texte "MARA" en bas a droite
- Couleur : Rose/Orange (#FF5078 → #FF8C42)
- Qualite JPEG : 90%

## Meta Tags

Les pages utilisent des meta tags Open Graph dynamiques :
- `og:title` : Titre personnalise par page
- `og:image` : Photo profil watermarkee ou image par defaut
- `og:description` : Description personnalisee
- `og:url` : URL de la page

## Securite

- Sessions stockees en BD (pas de cookies non chiffres)
- Tokens UUID aleatoires
- CSRF protection active
- Anonymat complet des visiteurs
- Signalement de messages

## Commandes Utiles

```bash
# Creer les migrations
python manage.py makemigrations

# Appliquer les migrations
python manage.py migrate

# Creer un superuser
python manage.py createsuperuser

# Lancer le serveur
python manage.py runserver

# Acceder a l'admin
# http://localhost:8000/admin/

# Generer l'image OG
python generate_og.py
```

## Deployment

Pour deployer en production :

1. Definis `DEBUG = False` dans `config/settings.py`
2. Configure `ALLOWED_HOSTS` avec ton domaine
3. Genere une nouvelle `SECRET_KEY`
4. Utilise une base de donnees PostgreSQL
5. Configure les variables d'environnement
6. Collecte les fichiers statiques : `python manage.py collectstatic`

## Licence

MIT

## Auteur

AHOURMAROLAND

---

**MARA** — Message At Random Anonymous 🔥

