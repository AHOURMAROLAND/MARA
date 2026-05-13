# 📖 Guide Complet - Déploiement MARA sur Render

## 🎯 Objectif
Déployer l'application MARA (Django) sur Render avec : PostgreSQL, Notifications Push (VAPID), Analytics visiteurs

---

## 📋 Table des Matières
1. [Prérequis](#prérequis)
2. [Déploiement Étape par Étape](#déploiement)
3. [Configuration Clés VAPID](#clés-vapid)
4. [Gestion Base de Données](#base-de-données)
5. [Analytics Visiteurs](#analytics)
6. [Dépannage](#dépannage)

---

## <a name="prérequis"></a>1. Prérequis

### Comptes nécessaires :
- [ ] Compte GitHub (pour le code)
- [ ] Compte Render (gratuit) : https://render.com
- [ ] (Optionnel) Compte Google Analytics

### Outils installés :
- Git
- Python 3.11+
- OpenSSL (pour générer les clés VAPID)

---

## <a name="déploiement"></a>2. Déploiement Étape par Étape

### Étape 1 : Push sur GitHub

```bash
# Initialiser git (si pas déjà fait)
git init
git add .
git commit -m "Ready for Render deployment"

# Créer repo sur GitHub puis :
git remote add origin https://github.com/TON_USERNAME/mara.git
git branch -M main
git push -u origin main
```

### Étape 2 : Créer le Web Service sur Render

1. Va sur https://dashboard.render.com
2. Clique **"New +"** → **"Web Service"**
3. Connecte ton repo GitHub **mara**
4. Render détectera automatiquement `render.yaml` → Clique **"Apply"**

**Configuration manuelle si render.yaml non détecté :**
- **Name** : `mara-app`
- **Environment** : `Python 3`
- **Build Command** : 
  ```bash
  pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
  ```
- **Start Command** : `gunicorn config.wsgi:application`
- **Plan** : Free

### Étape 3 : Créer la Base de Données PostgreSQL

1. Dans Render Dashboard → **"New +"** → **"PostgreSQL"**
2. **Name** : `mara-db`
3. **Database** : `mara`
4. **User** : `mara`
5. **Plan** : Free
6. Clique **"Create Database"**
7. **IMPORTANT** : Copie l'**Internal Database URL** et ajoute-la comme variable d'environnement `DATABASE_URL` dans ton Web Service

### Étape 4 : Variables d'Environnement

Dans ton Web Service Render → **Environment** :

```env
# Auto-générées par Render
DATABASE_URL=postgres://mara:xxx@postgres.render.com:5432/mara_xxx
SECRET_KEY=auto-genere-par-render

# À configurer manuellement
DEBUG=False
ALLOWED_HOSTS=ton-app.onrender.com,.onrender.com

# VAPID (voir section suivante)
VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
VAPID_CLAIMS_SUB=mailto:ton-email@example.com
```

---

## <a name="clés-vapid"></a>3. Configuration Clés VAPID (Notifications Push)

Les clés VAPID sont nécessaires pour envoyer des notifications push aux utilisateurs.

### Générer les clés (3 méthodes)

#### Méthode 1 : En local avec OpenSSL
```bash
# Générer clé privée
openssl ecparam -genkey -name prime256v1 -out vapid_private.pem

# Générer clé publique
openssl ec -in vapid_private.pem -pubout -out vapid_public.pem

# Convertir en base64 URL-safe (format VAPID)
# Sur Linux/Mac :
cat vapid_private.pem | base64 | tr '+/' '-_' | tr -d '\n'
cat vapid_public.pem | base64 | tr '+/' '-_' | tr -d '\n'

# Sur Windows (PowerShell) :
[Convert]::ToBase64String([IO.File]::ReadAllBytes("vapid_private.pem")) -replace '\+','-' -replace '/','_' -replace '=',''
```

#### Méthode 2 : Utiliser un générateur en ligne
1. Va sur https://vapidkeys.com/
2. Clique "Generate"
3. Copie les clés Public et Private

#### Méthode 3 : Python (après déploiement)
```bash
# Une fois déployé, dans le shell Render :
pip install py-vapid
python -c "from vapid import Vapid; v = Vapid(); v.generate_keys(); print('Public:', v.public_key); print('Private:', v.private_key)"
```

### Ajouter dans Render

Va dans ton Web Service → **Environment** et ajoute :

```env
VAPID_PUBLIC_KEY=BLxxxxxxxxxxxxx...
VAPID_PRIVATE_KEY=xxxxxxxxxxxxx...
VAPID_CLAIMS_SUB=mailto:admin@tondomaine.com
```

---

## <a name="base-de-données"></a>4. Gestion Base de Données

### Structure automatique
Render crée automatiquement la base PostgreSQL. Django crée les tables via les migrations.

### Accès à la base de données

**Via Render Dashboard :**
1. Va dans ton service PostgreSQL
2. Onglet **"Shell"** pour exécuter des commandes SQL
3. Onglet **"Metrics"** pour voir l'utilisation

**Commandes utiles (dans Render Shell) :**
```bash
# Voir les tables
python manage.py dbshell
\dt

# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Migrations automatiques
Les migrations sont exécutées automatiquement à chaque déploiement via :
```bash
python manage.py migrate
```
(dans le Build Command)

### Stockage des médias (photos)
**IMPORTANT** : Sur Render Free, les fichiers uploadés sont **perdus** à chaque redéploiement !

**Solutions :**
1. **Cloudinary** (Gratuit 25GB) ← Recommandé
2. **AWS S3** (Payant)
3. **Base64** dans la DB (limité)

#### Configuration Cloudinary (Optionnel)
```bash
pip install cloudinary django-cloudinary-storage
```

Dans `settings.py` :
```python
import cloudinary
cloudinary.config(
    cloud_name = config('CLOUDINARY_CLOUD_NAME'),
    api_key = config('CLOUDINARY_API_KEY'),
    api_secret = config('CLOUDINARY_API_SECRET')
)

DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

---

## <a name="analytics"></a>5. Analytics Visiteurs (comme Vercel)

### Solution 1 : Google Analytics 4 (Gratuit)

**1. Créer un compte GA4**
- Va sur https://analytics.google.com
- Crée une propriété
- Copie le **Measurement ID** (ex: `G-XXXXXXXXXX`)

**2. Ajouter à MARA**

Crée `templates/analytics.html` :
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id={{ GA_TRACKING_ID }}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '{{ GA_TRACKING_ID }}');
</script>
```

Dans `base.html`, avant `</head>` :
```html
{% if GA_TRACKING_ID %}
  {% include 'analytics.html' %}
{% endif %}
```

Dans `settings.py` :
```python
GA_TRACKING_ID = config('GA_TRACKING_ID', default='')
```

Dans `context_processors.py`, ajoute :
```python
def app_meta(request):
    return {
        'GA_TRACKING_ID': settings.GA_TRACKING_ID,
        # ... reste du code
    }
```

**3. Variable d'environnement Render**
```env
GA_TRACKING_ID=G-XXXXXXXXXX
```

### Solution 2 : Plausible Analytics (Privacy-friendly)
```html
<script defer data-domain="ton-app.onrender.com" src="https://plausible.io/js/script.js"></script>
```

### Solution 3 : Counter.dev (Simple, gratuit)
```html
<script src="https://cdn.counter.dev/script.js" data-id="TON_ID" data-utcoffset="1"></script>
```

### Solution 4 : Analytics natif Django (DIY)

**Créer un modèle Analytics :**
```python
# apps/users/models.py
class PageView(models.Model):
    user = models.ForeignKey(UserProfile, null=True, on_delete=models.SET_NULL)
    path = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    referrer = models.URLField(null=True, blank=True)
```

**Middleware pour tracker :**
```python
# apps/users/middleware.py
class AnalyticsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from .models import PageView
        
        # Exclure les requêtes static/media/admin
        if not request.path.startswith(('/static/', '/media/', '/admin/')):
            PageView.objects.create(
                path=request.path,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
                referrer=request.META.get('HTTP_REFERER', '')
            )
        
        return self.get_response(request)
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
```

**Dashboard admin :**
```python
# apps/users/admin.py
@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ['path', 'ip_address', 'timestamp', 'user']
    list_filter = ['timestamp']
    date_hierarchy = 'timestamp'
```

---

## <a name="dépannage"></a>6. Dépannage

### Erreur "Build failed"
```bash
# Vérifier les logs dans Render Dashboard → Logs
# Souvent causé par :
# - requirements.txt mal formaté
# - Migration échouée
# - Static files collect échoué
```

### Base de données SQLite en production
**Symptôme** : "database is locked" ou données perdues
**Solution** : Vérifier que `DATABASE_URL` pointe bien sur PostgreSQL

### Notifications push ne fonctionnent pas
1. Vérifier VAPID keys dans les variables d'env
2. Vérifier que le site est en HTTPS (Render le fait auto)
3. Vérifier Service Worker enregistré (Console Dev → Application)

### Static files 404
Vérifier `whitenoise` dans `MIDDLEWARE` et `STATIC_ROOT` défini

### Photos uploadées disparaissent
**Normal** : Render Free = filesystem éphémère
**Solution** : Utiliser Cloudinary ou AWS S3

---

## 📊 Récapitulatif Commandes

```bash
# Local - test avant déploiement
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py runserver

# Générer clés VAPID
openssl ecparam -genkey -name prime256v1 -out vapid_private.pem
openssl ec -in vapid_private.pem -pubout -out vapid_public.pem

# Render - Redéployer
# Juste push sur GitHub, Render déploie auto
```

---

## 🔗 Liens Utiles

- **Render Dashboard** : https://dashboard.render.com
- **Render Docs** : https://render.com/docs
- **Django on Render** : https://render.com/docs/deploy-django
- **VAPID Generator** : https://vapidkeys.com/
- **Cloudinary** : https://cloudinary.com (pour photos)

---

**🎉 Une fois configuré, chaque `git push` déploie automatiquement !**
