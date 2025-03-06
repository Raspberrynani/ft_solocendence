# Create a new file: backend/api/metrics.py

from prometheus_client import Counter, Histogram, Gauge
from django.conf import settings

# Game metrics
GAME_STARTED = Counter(
    'pong_game_started_total', 
    'Number of Pong games started',
    ['mode']  # classic, ai, tournament
)

GAME_COMPLETED = Counter(
    'pong_game_completed_total', 
    'Number of Pong games completed',
    ['mode']
)

GAME_DURATION = Histogram(
    'pong_game_duration_seconds',
    'Duration of Pong games in seconds',
    ['mode'],
    buckets=(30, 60, 120, 300, 600, 1800)  # 30s, 1m, 2m, 5m, 10m, 30m
)

# Tournament metrics
TOURNAMENT_CREATED = Counter(
    'pong_tournament_created_total',
    'Number of tournaments created'
)

TOURNAMENT_PLAYERS = Histogram(
    'pong_tournament_players',
    'Number of players per tournament',
    buckets=(2, 3, 4, 8, 16, 32)
)

# Player metrics
ACTIVE_PLAYERS = Gauge(
    'pong_active_players',
    'Number of players currently active'
)

WAITING_PLAYERS = Gauge(
    'pong_waiting_players',
    'Number of players currently waiting for a game'
)

# Connection metrics
WEBSOCKET_CONNECTIONS = Gauge(
    'pong_websocket_connections',
    'Number of active WebSocket connections'
)

WEBSOCKET_MESSAGES = Counter(
    'pong_websocket_messages_total',
    'Number of WebSocket messages processed',
    ['message_type']
)
