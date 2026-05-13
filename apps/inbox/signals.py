from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Message
from apps.users.image_utils import optimize_message_image
import os
from django.conf import settings


@receiver(post_save, sender=Message)
def optimize_message_image_on_save(sender, instance, created, **kwargs):
    """
    Apres chaque save de Message :
    Cloudinary optimise automatiquement les images.
    On ne fait rien ici pour eviter d'utiliser .path qui force le stockage local.
    """
    # Skip optimization - Cloudinary handles this automatically
    pass
