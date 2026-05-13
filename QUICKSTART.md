# MARA — Quick Start Guide

Demarrage rapide du projet MARA en 5 minutes.

## 1. Installation

```bash
# Clone le repo
git clone https://github.com/AHOURMAROLAND/MARA.git
cd MARA

# Cree l'environnement virtuel
python -m venv venv

# Active l'environnement
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Installe les dependances
pip install -r requirements.txt
```

## 2. Configuration Django

```bash
# Cree les migrations
python manage.py makemigrations users inbox

# Applique les migrations
python manage.py migrate

# Cree un superuser (admin)
python manage.py createsuperuser
# Username: admin
# Email: admin@example.com
# Password: (entre un mot de passe)
```

## 3. Lance le serveur

```bash
python manage.py runserver
```

L'app est maintenant disponible sur : **http://localhost:8000**

## 4. Teste l'app

### Creer un profil
1. Va sur http://localhost:8000
2. Entre un pseudo (ex: "roland")
3. Ajoute une photo (optionnel)
4. Clique "Creer mon profil"

### Envoyer un message
1. Partage ton lien (ex: http://localhost:8000/m/send/roland/)
2. Ouvre le lien dans une autre fenetre/navigateur
3. Envoie un message anonyme

### Voir tes messages
1. Va sur http://localhost:8000/u/roland/
2. Clique "Voir mes messages"
3. Consulte ton inbox

## 5. Admin Django

Accede a l'admin sur : **http://localhost:8000/admin/**

Identifiants : admin / (ton mot de passe)

Tu peux :
- Voir tous les utilisateurs
- Voir tous les messages
- Gerer les sessions
- Signaler les messages

## Fichiers Importants

| Fichier | Role |
|---------|------|
| `config/settings.py` | Configuration Django |
| `apps/users/models.py` | Modele UserProfile |
| `apps/inbox/models.py` | Modele Message |
| `templates/` | Pages HTML |
| `requirements.txt` | Dependances Python |

## Troubleshooting

### Erreur : "No module named 'django'"
```bash
pip install -r requirements.txt
```

### Erreur : "db.sqlite3 not found"
```bash
python manage.py migrate
```

### Erreur : "Port 8000 already in use"
```bash
python manage.py runserver 8001
```

### Photos ne s'affichent pas
```bash
# Cree le dossier media
mkdir media
```

## Prochaines Etapes

- [ ] Ajouter une image OG par defaut dans `static/img/mara-og-default.jpg`
- [ ] Configurer un domaine personnalise
- [ ] Ajouter l'authentification email
- [ ] Deployer sur Heroku/Railway/Vercel
- [ ] Ajouter des tests unitaires
- [ ] Configurer les logs

## Support

Pour toute question, ouvre une issue sur GitHub :
https://github.com/AHOURMAROLAND/MARA/issues

---

**MARA** — Message At Random Anonymous 🔥
