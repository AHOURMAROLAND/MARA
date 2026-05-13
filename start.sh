#!/bin/bash
set -o errexit

echo "Running migrations..."
python manage.py migrate --run-syncdb || python manage.py migrate

echo "Starting server..."
exec daphne -b 0.0.0.0 -p $PORT config.asgi:application
