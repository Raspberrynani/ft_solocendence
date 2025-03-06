# Makefile for managing Docker-based Pong application with monitoring

# Define Docker Compose files
DOCKER_COMPOSE = docker-compose
DOCKER_COMPOSE_FILE = docker-compose.yml
DOCKER_COMPOSE_MONITORING = docker-compose.monitoring.yml
DOCKER_COMPOSE_CMD = $(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) -f $(DOCKER_COMPOSE_MONITORING)

# SSL certificate script
SSL_SCRIPT = ./gen_ssl.sh

# Set default goal
.DEFAULT_GOAL := run

# Help message
help:
	@echo "Available commands:"
	@echo "  make          - Start all containers (if already built)"
	@echo "  make all      - Build and start all containers"
	@echo "  make build    - Build all containers without starting"
	@echo "  make clean    - Stop and remove all containers, keeping volumes and images"
	@echo "  make fclean   - Stop and remove all containers, volumes, and images"
	@echo "  make re       - Rebuild and restart all containers (fclean + all)"
	@echo "  make ps       - Show running containers"
	@echo "  make logs     - Show logs from all containers"
	@echo "  make ssl      - Generate SSL certificates"
	@echo "  make help     - Show this help message"

# Generate SSL certificates
ssl:
	@echo "Generating SSL certificates..."
	@if [ -f $(SSL_SCRIPT) ]; then \
		chmod +x $(SSL_SCRIPT); \
		$(SSL_SCRIPT); \
	else \
		echo "Error: SSL script $(SSL_SCRIPT) not found"; \
		exit 1; \
	fi
	@echo "SSL certificates generated successfully"

# Run services (if already built)
run: ssl
	$(DOCKER_COMPOSE_CMD) up -d

# Build and run services
all: build ssl run

# Build services without starting
build:
	$(DOCKER_COMPOSE_CMD) build

# Stop and remove containers, keeping volumes
clean:
	$(DOCKER_COMPOSE_CMD) down
	@echo "Containers stopped and removed. Volumes are preserved."

# Complete cleanup - remove containers, volumes, and images
fclean:
	$(DOCKER_COMPOSE_CMD) down -v
	-docker rmi $$(docker images -q 'your-app-*' 2> /dev/null) 2> /dev/null
	-docker volume prune -f
	@echo "Full cleanup completed. Containers, related images, and volumes removed."

# Rebuild and restart
re: fclean all

# Show running containers
ps:
	$(DOCKER_COMPOSE_CMD) ps

# Show logs
logs:
	$(DOCKER_COMPOSE_CMD) logs -f

# Ensure these targets aren't matched with files
.PHONY: help run all build clean fclean re ps logs ssl