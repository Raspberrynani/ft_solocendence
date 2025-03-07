FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=backend.settings

# Install system dependencies
RUN apt-get update && \
    apt-get install -y postgresql-client openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directory for certificates
RUN mkdir -p /etc/certs

# Copy requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install daphne django-sslserver psycopg2-binary

# Copy project files
COPY . /app/

# Make scripts executable
RUN chmod +x entrypoint.sh
RUN chmod +x init.sh
RUN chmod +x wait-for-it.sh

# Expose ports for HTTP and HTTPS
EXPOSE 8000 8443

# Use the entrypoint script to handle certificate setup
ENTRYPOINT ["/bin/bash", "entrypoint.sh"]

# Command to run the initialization and server startup
CMD ["./wait-for-it.sh", "db:5432", "--", "/bin/bash", "init.sh"]