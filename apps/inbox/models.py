from django.db import models
from django.utils import timezone
import uuid
from datetime import timedelta


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        'users.UserProfile',
        on_delete=models.CASCADE,
        related_name='received_messages'
    )

    text = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='messages/', null=True, blank=True)
    image_caption = models.TextField(null=True, blank=True)

    sender_ip = models.GenericIPAddressField(null=True, blank=True)
    sender_device = models.CharField(max_length=255, null=True, blank=True)
    sender_session_token = models.CharField(max_length=255, null=True, blank=True)

    is_read = models.BooleanField(default=False)
    is_reported = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient']),
            models.Index(fields=['is_read']),
            models.Index(fields=['is_archived']),
            models.Index(fields=['is_reported']),
            models.Index(fields=['created_at']),
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
        ]

    def __str__(self):
        return f"Msg pour @{self.recipient.pseudo} - {self.created_at:%d/%m/%Y}"

    @property
    def has_image(self):
        return bool(self.image)

    @property
    def preview(self):
        if self.text:
            return self.text[:50] + '...' if len(self.text) > 50 else self.text
        return 'Image'


class AnonymousThread(models.Model):
    STATUS_CHOICES = [
        ('active', 'Actif'),
        ('revealed', 'Identité révélée'),
        ('closed', 'Clos'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    initial_message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='threads')
    recipient = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='anonymous_threads')
    sender_session_token = models.CharField(max_length=255)
    revealed_user = models.ForeignKey('users.UserProfile', null=True, blank=True, on_delete=models.SET_NULL, related_name='revealed_threads')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['recipient', 'status']),
            models.Index(fields=['sender_session_token']),
            models.Index(fields=['updated_at']),
        ]

    def __str__(self):
        return f"Fil Anonyme #{str(self.id)[:8]} pour @{self.recipient.pseudo}"


class AnonymousThreadMessage(models.Model):
    SENDER_TYPE_CHOICES = [
        ('recipient', 'Destinataire'),
        ('anonymous', 'Expéditeur anonyme'),
    ]
    STATUS_CHOICES = [
        ('sent', 'Envoyé'),
        ('delivered', 'Délivré'),
        ('read', 'Lu'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(AnonymousThread, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=20, choices=SENDER_TYPE_CHOICES)
    text = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='thread_media/', null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='sent')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['thread', 'created_at']),
        ]

    def __str__(self):
        return f"Msg dans fil #{str(self.thread.id)[:8]} ({self.sender_type})"


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user1 = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='conversations_as_user1')
    user2 = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='conversations_as_user2')
    pinned_for_user1 = models.BooleanField(default=False)
    pinned_for_user2 = models.BooleanField(default=False)
    last_message_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_message_at']
        unique_together = ['user1', 'user2']
        indexes = [
            models.Index(fields=['user1', 'last_message_at']),
            models.Index(fields=['user2', 'last_message_at']),
        ]

    def get_other_user(self, current_user):
        if self.user1_id == current_user.id:
            return self.user2
        return self.user1

    def is_pinned_by(self, user):
        if self.user1_id == user.id:
            return self.pinned_for_user1
        return self.pinned_for_user2

    def __str__(self):
        return f"Chat @{self.user1.pseudo} & @{self.user2.pseudo}"


class ConversationMessage(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('text', 'Texte'),
        ('image', 'Image'),
        ('video', 'Vidéo'),
        ('audio', 'Message vocal'),
        ('doc', 'Document'),
    ]
    STATUS_CHOICES = [
        ('sent', 'Envoyé'),
        ('delivered', 'Délivré'),
        ('read', 'Lu'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='sent_conversation_messages')
    text = models.TextField(null=True, blank=True)
    media_file = models.FileField(upload_to='conversation_media/', null=True, blank=True)
    media_type = models.CharField(max_length=15, choices=MEDIA_TYPE_CHOICES, default='text')
    voice_duration = models.IntegerField(default=0, help_text="Durée audio en secondes")

    reply_to = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='replies')
    link_preview = models.ForeignKey('LinkPreview', null=True, blank=True, on_delete=models.SET_NULL, related_name='messages')
    is_pinned = models.BooleanField(default=False)
    is_forwarded = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    is_deleted_for_all = models.BooleanField(default=False)
    deleted_for_user1 = models.BooleanField(default=False)
    deleted_for_user2 = models.BooleanField(default=False)

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='sent')
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['sender']),
        ]

    def __str__(self):
        return f"Msg from @{self.sender.pseudo} in chat #{str(self.conversation.id)[:8]}"


def default_story_expiry():
    return timezone.now() + timedelta(hours=24)


class Story(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Vidéo'),
        ('text', 'Texte'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='stories')
    media_file = models.FileField(upload_to='stories/', null=True, blank=True)
    media_type = models.CharField(max_length=15, choices=MEDIA_TYPE_CHOICES, default='image')
    text_content = models.TextField(null=True, blank=True)
    text_color = models.CharField(max_length=20, default='#FFFFFF')
    bg_gradient = models.CharField(max_length=120, default='linear-gradient(135deg, #FF4565 0%, #FF8038 100%)')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_story_expiry)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['user', 'expires_at']),
            models.Index(fields=['expires_at']),
        ]

    @property
    def is_active(self):
        return timezone.now() < self.expires_at

    def __str__(self):
        return f"Story by @{self.user.pseudo} ({self.media_type})"


class StoryView(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='story_views')
    is_fully_loaded = models.BooleanField(default=True)
    liked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['story', 'viewer']
        indexes = [
            models.Index(fields=['story', 'viewer']),
        ]

    def __str__(self):
        return f"View by @{self.viewer.pseudo} on Story #{str(self.story.id)[:8]}"


class Notification(models.Model):
    VERB_CHOICES = [
        ('invitation_received', 'Nouvelle invitation'),
        ('invitation_accepted', 'Invitation acceptée'),
        ('anonymous_reply', 'Réponse dans fil anonyme'),
        ('new_message', 'Nouveau message privé'),
        ('story_like', 'Like sur story'),
        ('story_reaction', 'Réaction sur story'),
        ('group_message', 'Nouveau message de groupe'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='notifications')
    actor = models.ForeignKey('users.UserProfile', null=True, blank=True, on_delete=models.SET_NULL, related_name='triggered_notifications')
    verb = models.CharField(max_length=30, choices=VERB_CHOICES)
    title = models.CharField(max_length=255)
    body = models.TextField(null=True, blank=True)
    target_url = models.CharField(max_length=255, default='/')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
        ]

    def __str__(self):
        return f"Notif for @{self.recipient.pseudo}: {self.title}"


class MessageReaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions', null=True, blank=True)
    conversation_message = models.ForeignKey(ConversationMessage, on_delete=models.CASCADE, related_name='reactions', null=True, blank=True)
    user = models.ForeignKey('users.UserProfile', null=True, blank=True, on_delete=models.CASCADE)
    session_token = models.CharField(max_length=255, null=True, blank=True)
    emoji = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['message']),
            models.Index(fields=['conversation_message']),
        ]

    def __str__(self):
        return f"Reaction {self.emoji}"


class LinkPreview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    url = models.URLField(max_length=500, unique=True)
    title = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    image_url = models.URLField(max_length=500, null=True, blank=True)
    domain = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Preview: {self.domain or self.url}"
