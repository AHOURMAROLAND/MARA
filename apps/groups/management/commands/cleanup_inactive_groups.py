from django.core.management.base import BaseCommand
from apps.groups.views import cleanup_inactive_groups


class Command(BaseCommand):
    help = 'Clean up inactive groups (no activity for 14 days)'

    def handle(self, *args, **options):
        count = cleanup_inactive_groups()
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {count} inactive groups'))
