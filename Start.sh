#!/bin/bash

# Start the main application
docker-compose up -d

# Start the monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d