FROM python:3.11-slim

# Create a non-root user and set ownership
RUN useradd -m -u 1000 ponguser
WORKDIR /app
RUN chown -R ponguser:ponguser /app

# Install dependencies including PostgreSQL client tools
RUN apt-get update && apt-get install -y postgresql-client && apt-get clean

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=backend.settings

# Expose ports for HTTP and HTTPS
EXPOSE 8000 8443

# Copy requirements file and install dependencies
COPY --chown=ponguser:ponguser requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install daphne django-sslserver psycopg2-binary

# Switch to non-root user for better security
USER ponguser

# Copy the application code (will be mounted in docker-compose)
# CMD will be set in docker-compose.yml