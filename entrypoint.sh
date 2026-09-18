#!/bin/bash
set -e

echo "Waiting for postgres..."
while ! pg_isready -h db -U mara_user; do
  sleep 1
done
echo "PostgreSQL started"

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Starting server..."
exec "$@"
