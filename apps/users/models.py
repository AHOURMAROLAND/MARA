from django.db import models
import uuid


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
    bio = models.TextField(max_length=250, null=True, blank=True)
    photo = models.ImageField(upload_to='profiles/', null=True, blank=True)
    link_id = models.CharField(max_length=100, unique=True)
    pin_code = models.CharField(max_length=128, null=True, blank=True)

    # Privacy & Profile Customization
    is_searchable = models.BooleanField(default=True, help_text="Être trouvable dans la recherche publique")
    is_private_pro = models.BooleanField(default=False, help_text="Joignable uniquement via lien direct ou QR code")
    theme_color = models.CharField(max_length=30, default='#FF4565', help_text="Couleur de thème dominante")

    # OAuth Social Auth (100% optionnel)
    oauth_provider = models.CharField(max_length=20, null=True, blank=True, choices=[('google', 'Google'), ('facebook', 'Facebook')])
    oauth_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    email = models.EmailField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    # Token secret pour reconnexion sans cookie (localStorage)
    reconnect_token = models.UUIDField(default=uuid.uuid4, unique=True)

    # Notifications alternatives
    telegram_chat_id = models.CharField(max_length=100, null=True, blank=True, help_text="ID de chat Telegram pour les notifications")

    # Deprecated - kept for backward compatibility, use content_mode instead
    accept_images = models.BooleanField(default=True)
    accept_messages = models.BooleanField(default=True)

    # Single-choice content field
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

    def is_friend_with(self, other_user):
        """Check if this user is friend with another user"""
        if not other_user or not isinstance(other_user, UserProfile):
            return False
        if self.id == other_user.id:
            return True
        return Friendship.objects.filter(
            models.Q(user1=self, user2=other_user) | models.Q(user1=other_user, user2=self)
        ).exists()

    def get_friends(self):
        """Get all friend UserProfiles"""
        friend_ids = []
        f1 = Friendship.objects.filter(user1=self).values_list('user2_id', flat=True)
        f2 = Friendship.objects.filter(user2=self).values_list('user1_id', flat=True)
        friend_ids = list(f1) + list(f2)
        return UserProfile.objects.filter(id__in=friend_ids)

    class Meta:
        indexes = [
            models.Index(fields=['pseudo']),
            models.Index(fields=['link_id']),
            models.Index(fields=['is_searchable']),
        ]

    def __str__(self):
        return f"@{self.pseudo}"


class Friendship(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user1 = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='friendships_initiated')
    user2 = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='friendships_received')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user1', 'user2']
        indexes = [
            models.Index(fields=['user1', 'user2']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"@{self.user1.pseudo} ⇄ @{self.user2.pseudo}"


class Invitation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('accepted', 'Acceptée'),
        ('declined', 'Refusée'),
        ('blocked', 'Bloquée'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='sent_invitations')
    to_user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='received_invitations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['from_user', 'to_user']
        indexes = [
            models.Index(fields=['to_user', 'status']),
            models.Index(fields=['from_user', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"@{self.from_user.pseudo} → @{self.to_user.pseudo} ({self.status})"


class BlockedSender(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='blocked_senders')
    blocked_session_token = models.CharField(max_length=255, null=True, blank=True)
    blocked_user = models.ForeignKey(UserProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='blocked_by_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'blocked_session_token']),
            models.Index(fields=['user', 'blocked_user']),
        ]

    def __str__(self):
        return f"Block by @{self.user.pseudo}"


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
