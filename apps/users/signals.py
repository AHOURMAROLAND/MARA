from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import UserProfile
from .image_utils import process_and_save_profile_photo
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=UserProfile)
def watermark_profile_photo(sender, instance, created, **kwargs):
    """
    Apres chaque save de UserProfile :
    si une photo est presente et pas encore watermarkee → on la watermarke.
    """
    # Skip watermarking for Cloudinary storage - let Cloudinary handle image optimization
    # This avoids using .path which forces local file storage
    pass


