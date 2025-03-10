#!/bin/bash

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "\q" 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping for 1 second"
  sleep 1
done
echo "PostgreSQL is ready!"

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Populate database with fake players for demo
echo "Populating database with demo data..."
python populate_db.py

# Start server with or without SSL
if [ "$SSL_ENABLED" = "true" ]; then
  echo "Starting with SSL on port 8443"
  daphne -e ssl:8443:privateKey=$SSL_KEY_FILE:certKey=$SSL_CERT_FILE backend.asgi:application -b 0.0.0.0 -p 8000
else
  echo "Starting without SSL on port 8000"
  daphne backend.asgi:application -b 0.0.0.0 -p 8000
fi