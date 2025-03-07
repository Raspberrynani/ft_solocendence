#!/bin/bash

# Setup script for running Docker in rootless mode on cluster system
# This script sets up the needed directories and environment variables

# Create necessary directories in /goinfre
mkdir -p /goinfre/${USER}/pong/certs
mkdir -p /goinfre/${USER}/postgres_data
mkdir -p /goinfre/${USER}/prometheus_data
mkdir -p /goinfre/${USER}/grafana_data
mkdir -p /goinfre/${USER}/alertmanager_data

# Copy certificates to /goinfre location
cp -r ./certs/* /goinfre/${USER}/pong/certs/

# Set environment variables for proper user mapping
export UID=$(id -u)
export GID=$(id -g)

# Verify docker is running in rootless mode
if ! docker info 2>/dev/null | grep -q "rootless"; then
    echo "WARNING: Docker does not appear to be running in rootless mode!"
    echo "Please set up Docker in rootless mode before continuing."
    echo "See https://docs.docker.com/engine/security/rootless/ for instructions."
    exit 1
fi

echo "Rootless Docker environment setup complete!"
echo "Your UID=${UID} and GID=${GID} will be used for container user mapping."
echo "Data will be stored in /goinfre/${USER}/"
echo ""
echo "You can now run 'docker-compose up -d' to start the application."