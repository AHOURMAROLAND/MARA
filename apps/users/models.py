from django.db import models
import uuid
from cloudinary_storage.storage import MediaCloudinaryStorage


class PushSubscription(models.Model):
    """Store Web Push subscription data for users"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('UserProfile', on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.TextField()
    p256dh = models.CharField(max_length=255)  # Public key
    auth = models.CharField(max_length=255)   # Auth secret
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'endpoint']

    def __str__(self):
        return f"Push for @{self.user.pseudo}"


class UserProfile(models.Model):
    CONTENT_MODE_CHOICES = [
        ('text', 'Messages texte uniquement'),
        ('images', 'Images uniquement'),
        ('both', 'Les deux'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pseudo = models.CharField(max_length=50, unique=True)
    photo = models.ImageField(upload_to='profiles/', null=True, blank=True, storage=MediaCloudinaryStorage())
    link_id = models.CharField(max_length=100, unique=True)
    pin_code = models.CharField(max_length=128, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    # Token secret pour reconnexion sans cookie (localStorage)
    reconnect_token = models.UUIDField(default=uuid.uuid4, unique=True)

    # Notifications alternatives
    telegram_chat_id = models.CharField(max_length=100, null=True, blank=True, help_text="ID de chat Telegram pour les notifications")

    # Deprecated - kept for backward compatibility, use content_mode instead
    accept_images = models.BooleanField(default=True)
    accept_messages = models.BooleanField(default=True)

    # New single-choice field
    content_mode = models.CharField(
        max_length=10,
        choices=CONTENT_MODE_CHOICES,
        default='both',
        help_text='Choix unique: texte, images, ou les deux'
    )

    def accepts_text(self):
        """Check if user accepts text messages"""
        return self.content_mode in ('text', 'both')

    def accepts_images(self):
        """Check if user accepts images"""
        return self.content_mode in ('images', 'both')

    def __str__(self):
        return f"@{self.pseudo}"


class SessionLog(models.Model):
    SESSION_TYPE = [
        ('owner', 'Proprietaire'),
        ('visitor', 'Visiteur'),
    ]

    token = models.CharField(max_length=255, unique=True)
    session_type = models.CharField(max_length=10, choices=SESSION_TYPE)
    user = models.ForeignKey(
        UserProfile, null=True, blank=True, on_delete=models.SET_NULL
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_name = models.CharField(max_length=255, null=True, blank=True)
    date_connexion = models.DateTimeField(auto_now_add=True)
    expiry = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.session_type} - {self.token[:10]}..."
