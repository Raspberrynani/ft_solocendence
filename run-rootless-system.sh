#!/bin/bash

# Source the setup script to ensure environment is ready
source ./rootless-setup.sh

# Generate SSL certificates if they don't exist
if [ ! -f "/goinfre/${USER}/pong/certs/cert.pem" ] || [ ! -f "/goinfre/${USER}/pong/certs/key.pem" ]; then
    echo "Generating SSL certificates..."
    ./gen_ssl.sh
fi

# Export UID and GID for docker-compose
export UID=$(id -u)
export GID=$(id -g)

# Start the application
echo "Starting application..."
docker-compose up -d

# Check if monitoring stack should be started
read -p "Do you want to start the monitoring stack? (y/n): " start_monitoring
if [[ $start_monitoring == "y" || $start_monitoring == "Y" ]]; then
    echo "Starting monitoring stack..."
    docker-compose -f docker-compose.monitoring.yml up -d
fi

echo "System is now running!"
echo "Access the application at: https://localhost:8444"
if [[ $start_monitoring == "y" || $start_monitoring == "Y" ]]; then
    echo "Monitoring dashboard available at: http://localhost:3000"
    echo "Grafana default credentials: admin/admin"
fi