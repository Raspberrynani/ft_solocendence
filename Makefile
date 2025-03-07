# Makefile for Solocendence Pong

# Variables
COMPOSE = docker-compose
PROJECT_NAME = solocendence

# Targets
.PHONY: all build stop clean re gen-ssl migrate help

all: gen-ssl build ## Generate SSL certificates and build all containers

build: ## Build and start all containers
	$(COMPOSE) up --build -d

stop: ## Stop all running containers
	$(COMPOSE) down

clean: ## Remove all containers, images, and volumes
	$(COMPOSE) down --rmi all --volumes --remove-orphans

re: stop clean all ## Restart everything: stop, clean, and rebuild

gen-ssl: ## Generate self-signed SSL certificates
	mkdir -p ./certs
	mkdir -p ./backend/certs
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout ./certs/key.pem \
		-out ./certs/cert.pem \
		-subj "/C=MY/ST=Selangor/L=Unspecified/O=Solocendence/OU=Pong/CN=localhost"
	echo "Self-signed certificates generated in ./certs/"

migrate: ## Run Django migrations
	$(COMPOSE) exec backend python manage.py makemigrations
	$(COMPOSE) exec backend python manage.py migrate

logs: ## View logs from all containers
	$(COMPOSE) logs -f

logs-backend: ## View backend logs only
	$(COMPOSE) logs -f backend

restart-backend: ## Restart just the backend container
	$(COMPOSE) restart backend

help: ## Display this help message
	@echo "Usage:"
	@echo "  make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'