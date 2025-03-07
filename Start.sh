#!/bin/bash

# Check if we're in a school environment that requires /goinfre or /sgoinfre
if [ -d "/goinfre/$USER" ]; then
    DOCKER_RUNTIME_DIR="/goinfre/$USER/docker"
elif [ -d "/sgoinfre/$USER" ]; then
    DOCKER_RUNTIME_DIR="/sgoinfre/$USER/docker"
else
    DOCKER_RUNTIME_DIR=""
fi

# Set Docker environment variables if runtime directory is specified
if [ -n "$DOCKER_RUNTIME_DIR" ]; then
    # Create Docker runtime directory if it doesn't exist
    mkdir -p "$DOCKER_RUNTIME_DIR"
    export DOCKER_HOST="unix://${DOCKER_RUNTIME_DIR}/docker.sock"
    echo "Using Docker runtime directory: $DOCKER_RUNTIME_DIR"
fi

# Generate SSL certificates if they don't exist
if [ ! -f "./certs/cert.pem" ] || [ ! -f "./certs/key.pem" ]; then
    echo "Generating SSL certificates..."
    ./gen_ssl.sh
fi

# Initialize volumes with correct content
echo "Initializing volumes with content..."
docker-compose --profile setup up setup
docker-compose -f docker-compose.monitoring.yml --profile setup up monitoring-setup

# Start the main application
echo "Starting main application..."
docker-compose up -d

# Start the monitoring stack
echo "Starting monitoring stack..."
docker-compose -f docker-compose.monitoring.yml up -d

echo "All services are starting. Use 'docker-compose ps' to check status."
echo "Service endpoints:"
echo "- Frontend: http://localhost:$(docker-compose port frontend 80 | cut -d: -f2)"
echo "- Backend: http://localhost:$(docker-compose port backend 8000 | cut -d: -f2)"
echo "- Grafana: http://localhost:$(docker-compose -f docker-compose.monitoring.yml port grafana 3000 | cut -d: -f2)"
echo "- Prometheus: http://localhost:$(docker-compose -f docker-compose.monitoring.yml port prometheus 9090 | cut -d: -f2)"