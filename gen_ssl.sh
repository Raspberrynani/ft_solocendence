#!/bin/bash

# Create certificate directories
mkdir -p /goinfre/${USER}/pong/certs

# Generate self-signed certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /goinfre/${USER}/pong/certs/key.pem \
  -out /goinfre/${USER}/pong/certs/cert.pem \
  -subj "/C=MY/ST=Selangor/L=Unspecified/O=Organization/OU=Unit/CN=localhost"

echo "Self-signed certificates generated in /goinfre/${USER}/pong/certs/"

# Create a symlink to local directory for compatibility
mkdir -p ./certs
ln -sf /goinfre/${USER}/pong/certs/cert.pem ./certs/cert.pem
ln -sf /goinfre/${USER}/pong/certs/key.pem ./certs/key.pem

echo "Symbolic links created in ./certs/"