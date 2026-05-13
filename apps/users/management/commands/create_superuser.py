from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
import os

class Command(BaseCommand):
    help = 'Create a superuser from environment variables'

    def handle(self, *args, **kwargs):
        username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'rolax')
        email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@netflix.com')
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'ad45213')

        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            self.stdout.write(self.style.SUCCESS(f'Superuser "{username}" created successfully!'))
        else:
            self.stdout.write(self.style.WARNING(f'Superuser "{username}" already exists.'))
