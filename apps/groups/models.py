from django.db import models
from django.utils import timezone
import uuid
from cloudinary_storage.storage import MediaCloudinaryStorage

class Group(models.Model):
    EPHEMERAL_CHOICES = [
        ('none', 'Désactivé'),
        ('1h', '1 heure'),
        ('24h', '24 heures'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        'users.UserProfile', 
        on_delete=models.CASCADE, 
        related_name='created_groups'
    )
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to='groups/', null=True, blank=True, storage=MediaCloudinaryStorage())
    link_id = models.CharField(max_length=100, unique=True)
    ephemeral_mode = models.CharField(max_length=10, choices=EPHEMERAL_CHOICES, default='none')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Group: {self.name} (@{self.creator.pseudo})"

class GroupParticipant(models.Model):
    """Link a session token to a random nickname in a specific group"""
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='participants')
    session_token = models.CharField(max_length=255)
    nickname = models.CharField(max_length=50)
    
    can_write = models.BooleanField(default=True)
    last_activity = models.DateTimeField(default=timezone.now)
    last_pseudo_update = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['group', 'session_token']

    def __str__(self):
        return f"{self.nickname} in {self.group.name} ({'Banni' if not self.can_write else 'Actif'})"

class GroupMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='messages')
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    
    # Metadata for the sender
    sender_session_token = models.CharField(max_length=255)
    sender_nickname = models.CharField(max_length=50) # Denormalized for faster lookup
    
    text = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='group_messages/', null=True, blank=True, storage=MediaCloudinaryStorage())
    
    sender_ip = models.GenericIPAddressField(null=True, blank=True)
    sender_device = models.CharField(max_length=255, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Msg in {self.group.name} by {self.sender_nickname}"

class GroupMessageReaction(models.Model):
    message = models.ForeignKey(GroupMessage, on_delete=models.CASCADE, related_name='reactions')
    session_token = models.CharField(max_length=255)
    emoji = models.CharField(max_length=10) # Store the emoji character
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['message', 'session_token', 'emoji']
