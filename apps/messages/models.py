from django.db import models
import uuid
from cloudinary_storage.storage import MediaCloudinaryStorage


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        'users.UserProfile',
        on_delete=models.CASCADE,
        related_name='received_messages'
    )

    text = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='messages/', null=True, blank=True, storage=MediaCloudinaryStorage())
    image_caption = models.TextField(null=True, blank=True)

    sender_ip = models.GenericIPAddressField(null=True, blank=True)
    sender_device = models.CharField(max_length=255, null=True, blank=True)
    sender_session_token = models.CharField(max_length=255, null=True, blank=True)

    is_read = models.BooleanField(default=False)
    is_reported = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

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
