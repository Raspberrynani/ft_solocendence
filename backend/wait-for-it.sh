#!/bin/bash

# Wait for PostgreSQL to be ready
set -e

host="$1"
shift
port="$2"
shift
cmd="$@"

until PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c '\q' 2>/dev/null; do
  >&2 echo "PostgreSQL is unavailable - sleeping for 1 second"
  sleep 1
done

>&2 echo "PostgreSQL is up - executing command"
exec $cmd