#!/bin/bash

echo "Starting initialization process..."

# Run database migrations
echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

# Set environment variables
export PYTHONPATH=/app

# Check if SSL is enabled
if [ "$SSL_ENABLED" = "true" ]; then
    echo "Starting SSL server on port 8000..."
    python manage.py runsslserver --certificate /etc/certs/cert.pem --key /etc/certs/key.pem 0.0.0.0:8000 &
    
    echo "Starting Daphne WebSocket server with SSL on port 8443..."
    daphne -e ssl:8443:privateKey=/etc/certs/key.pem:certKey=/etc/certs/cert.pem backend.asgi:application -b 0.0.0.0
else
    echo "Starting server without SSL on port 8000..."
    daphne backend.asgi:application -b 0.0.0.0 -p 8000
fi

echo "Server initialization completed."