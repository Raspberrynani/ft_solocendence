#!/bin/bash

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "\q" 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping for 1 second"
  sleep 1
done
echo "PostgreSQL is ready!"

# Create directories with proper permissions if they don't exist
mkdir -p /app/logs
mkdir -p /app/certs

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Start server with or without SSL
if [ "$SSL_ENABLED" = "true" ]; then
  echo "Starting with SSL on port 8443"
  exec daphne -e ssl:8443:privateKey=$SSL_KEY_FILE:certKey=$SSL_CERT_FILE backend.asgi:application -b 0.0.0.0 -p 8000 --access-log /app/logs/access.log
else
  echo "Starting without SSL on port 8000"
  exec daphne backend.asgi:application -b 0.0.0.0 -p 8000 --access-log /app/logs/access.log
fi