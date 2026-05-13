# MARA — Guide de Securite 🔒

## Mesures de Securite Implementees

### 🔴 Priorite Critique

#### 1. Rate Limiting (Anti-Spam)
- **Limite** : 5 messages par IP par 10 minutes
- **Localisation** : `apps/inbox/views.py`
- **Cache** : Django cache (LocMemCache en dev, DB en prod)
- **Risque evite** : Bombardement de messages, crash DB

```python
cache_key = f"send_limit_{ip}_{link_id}"
count = cache.get(cache_key, 0)
if count >= 5:
    return render(..., {'error': 'Trop de messages...'})
cache.set(cache_key, count + 1, timeout=600)
```

#### 2. Validation des Fichiers Uploadés
- **Taille max** : 5 MB par image
- **Types autorises** : JPEG, PNG, GIF, WebP
- **Verification** : Content-Type + taille
- **Localisation** : `apps/inbox/views.py`

```python
MAX_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

if image.size > MAX_IMAGE_SIZE:
    return render(..., {'error': 'Image trop lourde'})
if image.content_type not in ALLOWED_IMAGE_TYPES:
    return render(..., {'error': 'Format non autorise'})
```

#### 3. Protection XSS (Nettoyage HTML)
- **Bibliotheque** : `bleach`
- **Methode** : Suppression de tout HTML
- **Limite texte** : 500 caracteres max
- **Localisation** : `apps/inbox/views.py`

```python
import bleach
text = bleach.clean(text, tags=[], strip=True)
if len(text) > MAX_TEXT_LENGTH:
    text = text[:MAX_TEXT_LENGTH]
```

#### 4. Configuration Securisee
- **SECRET_KEY** : Via variable d'environnement
- **DEBUG** : False en production
- **ALLOWED_HOSTS** : Configurable
- **HTTPS** : Cookies securises en prod
- **Localisation** : `config/settings.py`

```python
from decouple import config
SECRET_KEY = config('SECRET_KEY', default='dev-key')
DEBUG = config('DEBUG', default=True, cast=bool)
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
```

### 🟠 Priorite Importante

#### 5. Logging des Erreurs
- **Fichier** : `logs/mara.log`
- **Niveau** : ERROR et WARNING
- **Localisation** : `config/settings.py`
- **Avantage** : Tracer les attaques, debugger les problemes

```python
logger.warning(f"[MARA] Rate limit atteint pour IP {ip}")
logger.error(f"[MARA] Erreur watermark pour {instance.pseudo}")
```

#### 6. Anti-Scraping
- **Limite** : 30 pages vues par IP par minute
- **Cache** : 60 secondes
- **Localisation** : `apps/inbox/views.py`

```python
cache_key_view = f"view_limit_{ip}"
count_view = cache.get(cache_key_view, 0)
if count_view >= 30:
    return HttpResponseTooManyRequests("Trop de requetes")
```

#### 7. Gestion des Erreurs Watermark
- **Try/Except specifique** : FileNotFoundError vs Exception
- **Logging** : Toutes les erreurs enregistrees
- **Fallback** : Le profil est sauvé meme si watermark echoue
- **Localisation** : `apps/users/signals.py`

```python
try:
    watermarked_path = process_and_save_profile_photo(...)
except FileNotFoundError:
    logger.error(f"Photo introuvable pour {instance.pseudo}")
except Exception as e:
    logger.error(f"Erreur watermark : {e}")
```

### 🟡 Priorite Moyen

#### 8. Cache Backend
- **Dev** : LocMemCache (RAM)
- **Prod** : DatabaseCache (persistant)
- **Commande** : `python manage.py createcachetable`

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'mara-cache',
    }
}
```

#### 9. Limites d'Upload Globales
- **DATA_UPLOAD_MAX_MEMORY_SIZE** : 10 MB
- **FILE_UPLOAD_MAX_MEMORY_SIZE** : 5 MB
- **Localisation** : `config/settings.py`

```python
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
```

## Checklist Production

- [ ] Generer une nouvelle `SECRET_KEY`
- [ ] Definir `DEBUG = False`
- [ ] Configurer `ALLOWED_HOSTS` avec ton domaine
- [ ] Activer HTTPS (SSL/TLS)
- [ ] Configurer le cache avec Redis ou DB
- [ ] Mettre en place les logs
- [ ] Tester le rate limiting
- [ ] Verifier les permissions des fichiers
- [ ] Configurer les backups DB
- [ ] Mettre en place un monitoring

## Variables d'Environnement (.env)

```bash
# Securite
SECRET_KEY=your-super-secret-key-here
DEBUG=False
ALLOWED_HOSTS=mara.app,www.mara.app

# Database (optionnel)
DATABASE_URL=postgresql://user:pass@localhost/mara

# Cache (optionnel)
CACHE_URL=redis://localhost:6379/0
```

## Commandes de Securite

```bash
# Creer la table de cache
python manage.py createcachetable

# Collecter les fichiers statiques
python manage.py collectstatic --noinput

# Verifier la configuration
python manage.py check --deploy

# Voir les logs
tail -f logs/mara.log
```

## Risques Residuels

| Risque | Mitigation | Statut |
|--------|-----------|--------|
| DDoS massif | Rate limiting + WAF | ⚠️ Partiel |
| SQL Injection | ORM Django | ✅ Protege |
| XSS | Bleach + template escaping | ✅ Protege |
| CSRF | Django middleware | ✅ Protege |
| Brute force login | Pas de login (sessions anonymes) | ✅ N/A |
| File upload malveillant | Validation MIME + taille | ✅ Protege |
| Scraping | Rate limiting vues | ✅ Protege |
| Watermark crash | Try/except + logging | ✅ Protege |

## Ressources

- [Django Security](https://docs.djangoproject.com/en/4.2/topics/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Bleach Documentation](https://bleach.readthedocs.io/)

---

**MARA** — Securise et pret pour la production 🔒
