#!/bin/bash

# Create certificates directory if it doesn't exist
mkdir -p ./certs
mkdir -p ./backend/certs

# Generate self-signed certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./certs/key.pem \
  -out ./certs/cert.pem \
  -subj "/C=MY/ST=Selangor/L=Unspecified/O=Organization/OU=Unit/CN=localhost"

echo "Self-signed certificates generated in ./certs/"