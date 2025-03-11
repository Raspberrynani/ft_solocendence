# Solocendence

A modern take on the classic Pong game, featuring real-time multiplayer, tournaments, and more. This project is a solo implementation of the 42 School's final common core project "ft_transcendence," which is typically done by a team of 3-5 students.

## Overview

Solocendence is a full-stack web application that allows players to compete in real-time Pong matches, participate in tournaments, and track their performance on leaderboards. The project was completed in less than two weeks and implements 7.5 modules out of the required 7.

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla JS)
- **Backend**: Django, Channels (WebSockets)
- **Database**: PostgreSQL
- **DevOps**: Docker, Docker Compose, Nginx
- **Monitoring**: Prometheus, Grafana

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Make (optional, for convenience)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/raspberrynani/ft_solocendence.git
   cd ft_solocendence
   ```

2. Generate SSL certificates:
   ```
   ./gen_ssl.sh
   ```

3. Start the application:
   ```
   make all
   ```
   Or using Docker Compose directly:
   ```
   docker-compose up -d
   ```

4. Access the application:
   - Web application: https://localhost:8444
   - Backend API: https://localhost:8443
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000

## Project Structure

- `frontend/` - Frontend code (HTML, CSS, JavaScript)
- `backend/` - Django backend code
- `backend/pong/` - WebSocket game logic
- `backend/api/` - REST API endpoints
- `docker-compose.yml` - Main Docker Compose configuration
- `docker-compose.monitoring.yml` - Monitoring stack configuration

## Easter Eggs

Try typing certain codes or key combinations to discover hidden features!

## License

This project is licensed under the GNU AGPL - see the LICENSE file for details.
