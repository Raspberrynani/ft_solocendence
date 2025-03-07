#!/bin/bash

echo "Starting initialization process..."

# Enable more verbose output
set -x

# Run database migrations
echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

# Set environment variables
export PYTHONPATH=/app

# Ensure CORS settings are correct in Django
echo "Checking CORS settings in Django..."
grep -n "CORS_ALLOWED_ORIGINS\|CORS_ALLOW_CREDENTIALS\|CSRF_TRUSTED_ORIGINS" backend/settings.py

# Check Channels setup
echo "Checking Channels configuration..."
grep -n "CHANNEL_LAYERS\|ASGI_APPLICATION" backend/settings.py

# Allow connections from all hosts for testing
echo "Allowing all hosts for testing..."
export DJANGO_ALLOWED_HOSTS="*"

# Check if SSL is enabled
if [ "$SSL_ENABLED" = "true" ]; then
    echo "Starting Django development server with SSL for HTTP traffic on port 8000..."
    python manage.py runsslserver --certificate /etc/certs/cert.pem --key /etc/certs/key.pem --addrport 0.0.0.0:8000 &
    DJANGO_PID=$!
    echo "Django server started with PID: $DJANGO_PID"
    
    # Wait a moment for Django to start
    sleep 5
    
    echo "Starting Daphne WebSocket server on port 8001..."
    # Non-SSL WebSocket for simpler debugging
    daphne -p 8001 -b 0.0.0.0 backend.asgi:application
else
    echo "Starting Daphne server without SSL on port 8000..."
    daphne -p 8000 -b 0.0.0.0 backend.asgi:application
fi

echo "Server initialization completed."