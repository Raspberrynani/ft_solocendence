#!/bin/bash

CERT_FILE="cert.pem"
KEY_FILE="key.pem"

CERT_DIR="/etc/certs"

# Check if certificate and key exist
if [ ! -f "$CERT_DIR/$CERT_FILE" ] || [ ! -f "$CERT_DIR/$KEY_FILE" ]; then
    echo "SSL certificates not found. Generating self-signed certificates..."
    
    # Generate SSL/TLS certificates
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/$KEY_FILE" \
    -out "$CERT_DIR/$CERT_FILE" \
    -subj "/C=MY/ST=Selangor/L=Unspecified/O=Solocendence/OU=Pong/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    
    echo "Self-signed certificates generated successfully."
fi

# Check certificate permissions
chmod 644 "$CERT_DIR/$CERT_FILE"
chmod 644 "$CERT_DIR/$KEY_FILE"

echo "SSL certificate setup completed."

# Execute the command passed to docker
exec "$@"