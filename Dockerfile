FROM python:3.11-slim

WORKDIR /app

# Installe les dependances systeme
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copie les requirements
COPY requirements.txt .

# Installe les dependances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copie le code
COPY . .

# Set Django settings
ENV DJANGO_SETTINGS_MODULE=config.settings
ENV PYTHONUNBUFFERED=1

# Expose le port
EXPOSE 8000

# Collect static files at runtime along with migrations
CMD sh -c "python manage.py collectstatic --noinput && python manage.py migrate && python manage.py create_superuser && gunicorn config.wsgi:application --bind 0.0.0.0:8000"
