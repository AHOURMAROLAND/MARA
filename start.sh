#!/bin/bash
set -o errexit

echo "Running migrations..."
python manage.py migrate --run-syncdb || python manage.py migrate

echo "Starting server..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
