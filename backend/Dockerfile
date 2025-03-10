FROM python:3.11-slim

WORKDIR /app

# Install dependencies including PostgreSQL client tools
RUN apt-get update && apt-get install -y postgresql-client && apt-get clean

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=backend.settings

# Expose ports for HTTP and HTTPS
EXPOSE 8000 8443

# Copy requirements file
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install daphne django-sslserver psycopg2-binary

# Copy the population script
COPY populate_db.py .

# Copy the start script and make it executable
COPY start.sh .
RUN chmod +x start.sh

# Run the start script on container startup
CMD ["/bin/bash", "start.sh"]