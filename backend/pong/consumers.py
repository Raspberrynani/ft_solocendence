import json
import uuid
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
import logging
import time
import math
import random
import threading
from datetime import datetime

from api.metrics import (
    GAME_STARTED, GAME_COMPLETED, GAME_DURATION, 
    TOURNAMENT_CREATED, TOURNAMENT_PLAYERS,
    ACTIVE_PLAYERS, WAITING_PLAYERS,
    WEBSOCKET_CONNECTIONS, WEBSOCKET_MESSAGES
)

# Configure logging
logger = logging.getLogger(__name__)

# Global waiting list and mapping of channel_name to game room
waiting_players = []
active_games = {}  # Maps channel_name to game room

# Tournament tracking
active_tournaments = {}  # Maps tournament_id to Tournament object
tournament_players = {}  # Maps channel_name to tournament_id



# Server-side Pong Game implementation
class PongGame:
    """
    Server-side implementation of Pong game logic.
    """
    def __init__(self, room_id, target_rounds=3, on_game_over=None):
        # Game identification
        self.room_id = room_id
        self.target_rounds = target_rounds
        self.on_game_over = on_game_over
        self.game_start_time = None
        
        # Canvas dimensions (based on standard client width/height)
        self.width = 800
        self.height = 450
        
        # Game state
        self.is_running = False
        self.left_score = 0
        self.right_score = 0
        self.winner = None
        
        # Ball properties
        self.ball_radius = 10
        self.ball_x = self.width / 2
        self.ball_y = self.height / 2
        self.ball_speed = 5
        self.ball_vx = self.ball_speed * (1 if random.random() > 0.5 else -1)
        self.ball_vy = self.ball_speed * (random.random() - 0.5)
        
        # Paddle properties
        self.paddle_width = 15
        self.paddle_height = 100
        self.left_paddle_y = (self.height - self.paddle_height) / 2
        self.right_paddle_y = (self.height - self.paddle_height) / 2
        self.paddle_speed = 7
        
        # Game loop properties
        self.fps = 60
        self.frame_duration = 1.0 / self.fps
        self.last_frame_time = 0
        self.game_thread = None
        self.lock = threading.Lock()
        
        # Player connections
        self.left_player = None
        self.right_player = None
        
        # Special features
        self.speed_increment = 0.2
        
        logger.info(f"Game created: room={room_id}, rounds={target_rounds}")

    def add_player(self, channel_name, player_side=None):
        """Add a player to the game"""
        with self.lock:
            if player_side == "left" or (player_side is None and self.left_player is None):
                self.left_player = channel_name
                return "left"
            elif player_side == "right" or (player_side is None and self.right_player is None):
                self.right_player = channel_name
                return "right"
            else:
                return None  # No space for player

    def remove_player(self, channel_name):
        """Remove a player from the game"""
        with self.lock:
            if self.left_player == channel_name:
                self.left_player = None
                return True
            elif self.right_player == channel_name:
                self.right_player = None
                return True
            return False

    def update_paddle(self, channel_name, y_position):
        """Update paddle position for a player"""
        with self.lock:
            # Validate y_position is within bounds
            y_position = max(0, min(self.height - self.paddle_height, y_position))
            
            if channel_name == self.left_player:
                self.left_paddle_y = y_position
            elif channel_name == self.right_player:
                self.right_paddle_y = y_position

    def reset_ball(self):
        """Reset ball to center with random direction"""
        self.ball_x = self.width / 2
        self.ball_y = self.height / 2
        angle = random.uniform(-math.pi/4, math.pi/4)
        # Ensure ball goes towards player who didn't score
        direction = 1 if self.ball_vx < 0 else -1
        self.ball_vx = self.ball_speed * math.cos(angle) * direction
        self.ball_vy = self.ball_speed * math.sin(angle)

    def start(self):
        """Start the game loop"""
        if self.is_running:
            return False
        
        self.is_running = True
        self.game_start_time = datetime.now()
        self.game_thread = threading.Thread(target=self.game_loop)
        self.game_thread.daemon = True
        self.game_thread.start()
        
        logger.info(f"Game started: room={self.room_id}")
        return True

    def stop(self):
        """Stop the game loop"""
        self.is_running = False
        if self.game_thread:
            self.game_thread = None
        logger.info(f"Game stopped: room={self.room_id}")

    def game_loop(self):
        """Main game loop"""
        self.last_frame_time = time.time()
        
        while self.is_running:
            current_time = time.time()
            delta_time = current_time - self.last_frame_time
            
            # Only update if enough time has passed for next frame
            if delta_time >= self.frame_duration:
                self.update(delta_time)
                self.last_frame_time = current_time
            else:
                # Sleep a bit to avoid consuming too much CPU
                time.sleep(0.001)

    def update(self, delta_time):
        """Update game state for one frame"""
        with self.lock:
            # Apply delta time factor for smooth movement regardless of frame rate
            delta_factor = delta_time / self.frame_duration
            
            # Move ball
            self.ball_x += self.ball_vx * delta_factor
            self.ball_y += self.ball_vy * delta_factor
            
            # Ball collision with top and bottom walls
            if self.ball_y - self.ball_radius < 0 or self.ball_y + self.ball_radius > self.height:
                self.ball_vy = -self.ball_vy
                # Ensure ball stays in bounds
                if self.ball_y - self.ball_radius < 0:
                    self.ball_y = self.ball_radius
                else:
                    self.ball_y = self.height - self.ball_radius
            
            # Check for scoring (ball off left/right edge)
            if self.ball_x - self.ball_radius < 0:
                # Right player scores
                self.right_score += 1
                self.check_game_over()
                self.reset_ball()
            elif self.ball_x + self.ball_radius > self.width:
                # Left player scores
                self.left_score += 1
                self.check_game_over()
                self.reset_ball()
            
            # Check for paddle collisions
            self.check_paddle_collisions()

    def check_paddle_collisions(self):
        """Check and handle ball collisions with paddles"""
        # Left paddle collision
        if (self.ball_x - self.ball_radius < self.paddle_width and 
            self.ball_y > self.left_paddle_y and 
            self.ball_y < self.left_paddle_y + self.paddle_height):
            
            # Calculate hit position relative to paddle center (-1 to 1)
            hit_pos = (self.ball_y - (self.left_paddle_y + self.paddle_height/2)) / (self.paddle_height/2)
            
            # Calculate bounce angle (maximum ±75 degrees)
            bounce_angle = hit_pos * (math.pi/4)  # π/4 radians = 45 degrees
            
            # Increase ball speed
            self.ball_speed += self.speed_increment
            
            # Set new velocity
            self.ball_vx = abs(self.ball_speed * math.cos(bounce_angle))
            self.ball_vy = self.ball_speed * math.sin(bounce_angle)
            
            # Move ball outside paddle to prevent multiple collisions
            self.ball_x = self.paddle_width + self.ball_radius
        
        # Right paddle collision
        elif (self.ball_x + self.ball_radius > self.width - self.paddle_width and 
              self.ball_y > self.right_paddle_y and 
              self.ball_y < self.right_paddle_y + self.paddle_height):
            
            # Calculate hit position relative to paddle center (-1 to 1)
            hit_pos = (self.ball_y - (self.right_paddle_y + self.paddle_height/2)) / (self.paddle_height/2)
            
            # Calculate bounce angle (maximum ±75 degrees)
            bounce_angle = hit_pos * (math.pi/4)  # π/4 radians = 45 degrees
            
            # Increase ball speed
            self.ball_speed += self.speed_increment
            
            # Set new velocity
            self.ball_vx = -abs(self.ball_speed * math.cos(bounce_angle))
            self.ball_vy = self.ball_speed * math.sin(bounce_angle)
            
            # Move ball outside paddle to prevent multiple collisions
            self.ball_x = self.width - self.paddle_width - self.ball_radius

    def check_game_over(self):
        """Check if the game is over"""
        if self.left_score >= self.target_rounds / 2:
            self.winner = "left"
            self.is_running = False
            if self.on_game_over:
                self.on_game_over(self)
        elif self.right_score >= self.target_rounds / 2:
            self.winner = "right"
            self.is_running = False
            if self.on_game_over:
                self.on_game_over(self)

    def get_state(self):
        """Get the current game state as a dict"""
        with self.lock:
            return {
                "ball": {
                    "x": self.ball_x,
                    "y": self.ball_y,
                    "radius": self.ball_radius
                },
                "paddles": {
                    "left": {
                        "x": 0,  # Left paddle is at x=0
                        "y": self.left_paddle_y,
                        "width": self.paddle_width,
                        "height": self.paddle_height
                    },
                    "right": {
                        "x": self.width - self.paddle_width,  # Right paddle is at the right edge
                        "y": self.right_paddle_y,
                        "width": self.paddle_width,
                        "height": self.paddle_height
                    }
                },
                "score": {
                    "left": self.left_score,
                    "right": self.right_score
                },
                "dimensions": {
                    "width": self.width,
                    "height": self.height
                }
            }


class GameManager:
    """
    Manages active games and matchmaking
    """
    def __init__(self):
        self.active_games = {}  # Maps room_id to PongGame instance
        self.player_games = {}  # Maps player channel_name to room_id
        self.lock = threading.Lock()
    
    def create_game(self, room_id, target_rounds=3):
        """Create a new game"""
        with self.lock:
            if room_id in self.active_games:
                return self.active_games[room_id]
            
            game = PongGame(
                room_id=room_id,
                target_rounds=target_rounds,
                on_game_over=self.handle_game_over
            )
            self.active_games[room_id] = game
            return game
    
    def add_player_to_game(self, room_id, channel_name, player_side=None):
        """Add a player to a game"""
        with self.lock:
            game = self.active_games.get(room_id)
            if not game:
                return None
            
            side = game.add_player(channel_name, player_side)
            if side:
                self.player_games[channel_name] = room_id
            return side
    
    def remove_player_from_game(self, channel_name):
        """Remove a player from their game"""
        with self.lock:
            room_id = self.player_games.get(channel_name)
            if not room_id:
                return False
            
            game = self.active_games.get(room_id)
            if not game:
                return False
            
            result = game.remove_player(channel_name)
            if result:
                del self.player_games[channel_name]
                
                # Check if game is now empty
                if game.left_player is None and game.right_player is None:
                    game.stop()
                    del self.active_games[room_id]
            
            return result
    
    def update_paddle(self, channel_name, y_position):
        """Update paddle position for a player"""
        with self.lock:
            room_id = self.player_games.get(channel_name)
            if not room_id:
                return False
            
            game = self.active_games.get(room_id)
            if not game:
                return False
            
            game.update_paddle(channel_name, y_position)
            return True
    
    def get_game_for_player(self, channel_name):
        """Get the game instance for a player"""
        with self.lock:
            room_id = self.player_games.get(channel_name)
            if not room_id:
                return None
            
            return self.active_games.get(room_id)
    
    def start_game(self, room_id):
        """Start a game if both players are ready"""
        with self.lock:
            game = self.active_games.get(room_id)
            if not game:
                return False
            
            if game.left_player and game.right_player:
                return game.start()
            
            return False
    
    async def handle_game_over(self, data):
    # This is now handled by the server game logic
    # But we'll enhance tournament integration
        game_room = active_games.get(self.channel_name)
        if game_room:
            # Check if this game was part of a tournament
            if self.channel_name in tournament_players:
                tournament_id = tournament_players[self.channel_name]
                tournament = active_tournaments.get(tournament_id)
                
                if tournament and tournament.current_match:
                    logger.info(f"Tournament match completed in tournament {tournament_id}")
                    
                    # Record match result
                    if tournament.record_match_result(self.channel_name):
                        logger.info(f"Match result recorded, winner: {self.channel_name}")
                        
                        # Notify all tournament players of the update
                        for player in tournament.players:
                            try:
                                await self.channel_layer.send(
                                    player["channel"],
                                    {
                                        "type": "tournament_update",
                                        "tournament": tournament.get_state()
                                    }
                                )
                            except Exception as e:
                                logger.error(f"Error sending tournament update: {e}")
                        
                        # If there's a next match, schedule it with a delay for synchronization
                        if tournament.current_match:
                            player1 = tournament.current_match["player1"]
                            player2 = tournament.current_match["player2"]
                            
                            logger.info(f"Scheduling next match with delay: {player1['nickname']} vs {player2['nickname']}")
                            
                            # Add a delay before starting the next match to allow for UI transitions
                            await asyncio.sleep(5)  # 5 second delay
                            
                            # Create a new game room for this match
                            tourney_game_room = "tourney_game_" + str(uuid.uuid4())
                            
                            # Create server-side game
                            game = game_manager.create_game(tourney_game_room, target_rounds=tournament.rounds)
                            
                            # Add players to the game
                            game_manager.add_player_to_game(tourney_game_room, player1["channel"], "left")
                            game_manager.add_player_to_game(tourney_game_room, player2["channel"], "right")
                            
                            # Add to channel group
                            await self.channel_layer.group_add(tourney_game_room, player1["channel"])
                            await self.channel_layer.group_add(tourney_game_room, player2["channel"])
                            
                            # Store room mapping
                            active_games[player1["channel"]] = tourney_game_room
                            active_games[player2["channel"]] = tourney_game_room
                            
                            # Start the game
                            game_manager.start_game(tourney_game_room)
                            
                            # Set up state sync loop for this game
                            asyncio.create_task(self.game_sync_loop(tourney_game_room))
                            
                            # Send a pre-match notification to players
                            pre_match_message = f"Your tournament match is about to begin: {player1['nickname']} vs {player2['nickname']}"
                            
                            await self.channel_layer.send(
                                player1["channel"],
                                {
                                    "type": "tournament_match_ready",
                                    "message": pre_match_message
                                }
                            )
                            
                            await self.channel_layer.send(
                                player2["channel"],
                                {
                                    "type": "tournament_match_ready",
                                    "message": pre_match_message
                                }
                            )
                            
                            # Add another delay for players to see the notification
                            await asyncio.sleep(2)
                            
                            # Now start the match
                            match_message = f"Tournament match: {player1['nickname']} vs {player2['nickname']}"
                            
                            await self.channel_layer.send(
                                player1["channel"],
                                {
                                    "type": "start_game",
                                    "message": match_message,
                                    "room": tourney_game_room,
                                    "rounds": tournament.rounds,
                                    "is_tournament": True,
                                    "player_side": "left"
                                }
                            )
                            
                            await self.channel_layer.send(
                                player2["channel"],
                                {
                                    "type": "start_game",
                                    "message": match_message,
                                    "room": tourney_game_room,
                                    "rounds": tournament.rounds,
                                    "is_tournament": True,
                                    "player_side": "right"
                                }
                            )


# Create a global game manager instance
game_manager = GameManager()


class Tournament:
    """Simple tournament manager class"""
    def __init__(self, id, creator_channel, name="Tournament"):
        self.id = id
        self.name = name
        self.creator_channel = creator_channel
        self.players = []  # List of {channel, nickname}
        self.matches = []  # Future matches
        self.current_match = None
        self.completed_matches = []
        self.started = False
        self.winners = []  # Track match winners
        self.rounds = 3  # Default rounds per match
        self.ready_players = set()
    
    def add_player(self, channel, nickname):
        """Add a player to the tournament"""
        # Check for duplicate nickname
        if len([p for p in self.players if p["nickname"] == nickname]) > 0:
            return False  # Duplicate nickname
        
        # Check for existing channel
        if len([p for p in self.players if p["channel"] == channel]) > 0:
            return False  # Player already in tournament
        
        self.players.append({"channel": channel, "nickname": nickname})
        return True
    
    def remove_player(self, channel):
        """Remove a player from the tournament"""
        # Keep players that don't match this channel
        original_count = len(self.players)
        self.players = [p for p in self.players if p["channel"] != channel]
        
        # If no players were removed, return early
        if len(self.players) == original_count:
            return False
        
        # If tournament has started, handle match updates
        if self.started and self.current_match:
            # If player was in current match, cancel it
            if channel in [self.current_match["player1"]["channel"], 
                           self.current_match["player2"]["channel"]]:
                self.current_match = None
                # Move to next match if available
                self.advance_tournament()
                
        # Also check upcoming matches and remove any with this player
        self.matches = [m for m in self.matches if 
                        m["player1"]["channel"] != channel and 
                        m["player2"]["channel"] != channel]
        
        return True
    
    def start_tournament(self):
        """Start the tournament by creating matches"""
        if len(self.players) < 2:
            return False  # Need at least 2 players
        
        # Clear any existing matches
        self.matches = []
        self.current_match = None
        self.completed_matches = []
        self.winners = []
        
        self.started = True
        
        # Simple round-robin tournament: each player plays against all others
        for i in range(len(self.players)):
            for j in range(i+1, len(self.players)):
                self.matches.append({
                    "player1": self.players[i],
                    "player2": self.players[j],
                    "status": "pending"
                })
        
        # Start first match if available
        return self.advance_tournament()
    
    def advance_tournament(self):
        """Move to the next match in the tournament"""
        if not self.matches:
            # Tournament is complete
            self.current_match = None
            return False
        
        self.current_match = self.matches.pop(0)
        self.current_match["status"] = "active"
        return True
    
    def record_match_result(self, winner_channel):
        """Record the result of a match"""
        if not self.current_match:
            return False
        
        # Verify this player is in the current match
        if winner_channel != self.current_match["player1"]["channel"] and winner_channel != self.current_match["player2"]["channel"]:
            return False
        
        # Find winner nickname
        winner_nickname = None
        for player in self.players:
            if player["channel"] == winner_channel:
                winner_nickname = player["nickname"]
                break
        
        if not winner_nickname:
            return False
        
        # Record winner
        self.winners.append(winner_nickname)
        
        # Move completed match to history
        self.current_match["winner"] = winner_nickname
        self.current_match["status"] = "completed"
        self.completed_matches.append(self.current_match)
        
        # Clear current match
        self.current_match = None
        
        # Advance to next match
        return self.advance_tournament()
    
    def player_ready(self, channel):
        return True
    """hack for tournament match ready"""
    
    def mark_player_ready(self, channel):
        """Mark a player as ready for the next match"""
        self.ready_players.add(channel)
        logger.info(f"Player {channel} marked as ready for next match in tournament {self.id}")
        return self.check_all_ready()
    
    def check_all_ready(self):
        """Check if all players needed for the next match are ready"""
        if not self.current_match:
            return False
            
        # Get players needed for current match
        match_players = [
            self.current_match["player1"]["channel"],
            self.current_match["player2"]["channel"]
        ]
        
        # Check if both match players are ready
        for player in match_players:
            if player not in self.ready_players:
                return False
        
        return True
    
    def reset_readiness(self):
        """Reset player readiness for next match"""
        self.ready_players.clear()
    
    def get_state(self):
        """Get the current state of the tournament"""
        current_match_data = None
        if self.current_match:
            current_match_data = {
                "player1": self.current_match["player1"]["nickname"],
                "player2": self.current_match["player2"]["nickname"]
            }
        
        # Format match data for display
        upcoming_matches = []
        for match in self.matches:
            upcoming_matches.append({
                "player1": match["player1"]["nickname"],
                "player2": match["player2"]["nickname"]
            })
        
        # Format completed matches
        completed = []
        for match in self.completed_matches:
            completed.append({
                "player1": match["player1"]["nickname"],
                "player2": match["player2"]["nickname"],
                "winner": match["winner"]
            })
        
        return {
            "id": self.id,
            "name": self.name,
            "players": [p["nickname"] for p in self.players],
            "started": self.started,
            "current_match": current_match_data,
            "upcoming_matches": upcoming_matches,
            "completed_matches": completed,
            "winners": self.winners
        }


class PongConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        WEBSOCKET_CONNECTIONS.inc()
        # Add every connecting client to a common lobby group
        await self.channel_layer.group_add("lobby", self.channel_name)
        logger.info(f"WebSocket connected: {self.channel_name}")
        
        # Send waiting list update
        await self.send(text_data=json.dumps({
            "type": "waiting_list",
            "waiting_list": [
                {"nickname": p["nickname"], "rounds": p["rounds"]}
                for p in waiting_players
            ]
        }))
        
        # Send active tournaments list
        await self.broadcast_tournament_list()
        
    async def tournament_match_ready(self, event):
        """Handle match ready notification"""
        message = event.get("message", "Your match is starting!")
        logger.info(f"Sending match ready notification to {self.channel_name}: {message}")
        
        await self.send(text_data=json.dumps({
            "type": "tournament_match_ready",
            "message": message
        }))
        

    async def disconnect(self, close_code):
        WEBSOCKET_CONNECTIONS.dec()
        global waiting_players, active_games, tournament_players, active_tournaments
        logger.info(f"WebSocket disconnecting: {self.channel_name}")
        
        # Remove from waiting players
        waiting_players[:] = [p for p in waiting_players if p["channel"] != self.channel_name]
        
        # Broadcast updated waiting list
        await self.broadcast_waiting_list()
        
        # Handle tournament cleanup when player disconnects
        if self.channel_name in tournament_players:
            tournament_id = tournament_players[self.channel_name]
            logger.info(f"Player in tournament {tournament_id} is disconnecting")
            
            if tournament_id in active_tournaments:
                tournament = active_tournaments[tournament_id]
                
                # If this was the creator and tournament hasn't started, remove it entirely
                if tournament.creator_channel == self.channel_name and not tournament.started:
                    logger.info(f"Creator left tournament {tournament_id} - removing tournament")
                    
                    # Notify all players in this tournament
                    for player in tournament.players:
                        if player["channel"] != self.channel_name:  # Don't send to the leaving player
                            try:
                                await self.channel_layer.send(
                                    player["channel"],
                                    {
                                        "type": "tournament_left",
                                        "message": "Tournament has been canceled by the creator."
                                    }
                                )
                                # Also remove from tournament tracking
                                if player["channel"] in tournament_players:
                                    del tournament_players[player["channel"]]
                            except Exception as e:
                                logger.error(f"Error notifying player about tournament deletion: {e}")
                    
                    # Delete the tournament
                    del active_tournaments[tournament_id]
                else:
                    # Remove this player from the tournament
                    if tournament.remove_player(self.channel_name):
                        logger.info(f"Removed player from tournament {tournament_id}")
                        
                        # Notify other tournament players about the update
                        for player in tournament.players:
                            try:
                                await self.channel_layer.send(
                                    player["channel"],
                                    {
                                        "type": "tournament_update",
                                        "tournament": tournament.get_state()
                                    }
                                )
                            except Exception as e:
                                logger.error(f"Error sending tournament update: {e}")
                        
                        # If tournament is now empty, remove it
                        if not tournament.players:
                            logger.info(f"Tournament {tournament_id} is now empty - removing")
                            del active_tournaments[tournament_id]
            
            # Remove the player from tournament tracking
            del tournament_players[self.channel_name]
            
            # Broadcast updated tournament list
            await self.broadcast_tournament_list()
        
        # Handle game room leave
        game_room = active_games.get(self.channel_name)
        if game_room:
            # Remove player from server-side game
            game_manager.remove_player_from_game(self.channel_name)
            
            await self.channel_layer.group_discard(game_room, self.channel_name)
            
            # Notify opponents in the same game room
            for channel, room in list(active_games.items()):
                if room == game_room and channel != self.channel_name:
                    await self.channel_layer.send(
                        channel,
                        {
                            "type": "opponent_left",
                            "message": "Your opponent has disconnected."
                        }
                    )
                    # Remove their game tracking
                    if channel in active_games:
                        del active_games[channel]
            
            # Remove self from active games
            if self.channel_name in active_games:
                del active_games[self.channel_name]
        
        # Remove from lobby group
        await self.channel_layer.group_discard("lobby", self.channel_name)
        logger.info(f"WebSocket disconnected: {self.channel_name}")

    async def receive(self, text_data):
        global waiting_players, active_games, tournament_players, active_tournaments
        
        try:
            data = json.loads(text_data)
            msg_type = data.get("type")
            WEBSOCKET_MESSAGES.labels(message_type=msg_type).inc()
            logger.debug(f"Received message type: {msg_type}")
            
            # Regular game matchmaking
            if msg_type == "join":
                WAITING_PLAYERS.inc()
                nickname = data.get("nickname")
                token = data.get("token")
                rounds = data.get("rounds")
                logger.info(f"Player {nickname} joined with token: {token} and rounds: {rounds}")
    
                # Search for a waiting player with the same rounds
                matching_player = None
                for player in waiting_players:
                    if player["rounds"] == rounds:
                        matching_player = player
                        break
                        
                if matching_player:
                    waiting_players.remove(matching_player)
                    game_room = "game_" + str(uuid.uuid4())
                    
                    # Create server-side game
                    game = game_manager.create_game(game_room, target_rounds=rounds)
                    
                    # Add players to the game
                    game_manager.add_player_to_game(game_room, matching_player["channel"], "left")
                    game_manager.add_player_to_game(game_room, self.channel_name, "right")
                    
                    # Add to channel group
                    await self.channel_layer.group_add(game_room, self.channel_name)
                    await self.channel_layer.group_add(game_room, matching_player["channel"])
                    
                    # Store room mapping
                    active_games[self.channel_name] = game_room
                    active_games[matching_player["channel"]] = game_room
                    
                    # Construct message
                    game_message = f"Game starting between {matching_player['nickname']} and {nickname}"
                    
                    # Start the game
                    game_manager.start_game(game_room)
                    
                    # Set up state sync loop for this game
                    asyncio.create_task(self.game_sync_loop(game_room))
                    
                    # Notify players
                    await self.channel_layer.send(
                        matching_player["channel"],
                        {
                            "type": "start_game",
                            "message": game_message,
                            "room": game_room,
                            "rounds": rounds,
                            "player_side": "left"
                        }
                    )
                    await self.send(text_data=json.dumps({
                        "type": "start_game",
                        "message": game_message,
                        "room": game_room,
                        "rounds": rounds,
                        "player_side": "right"
                    }))
                else:
                    waiting_players.append({
                        "channel": self.channel_name,
                        "nickname": nickname,
                        "token": token,
                        "rounds": rounds
                    })
                    await self.send(text_data=json.dumps({
                        "type": "queue_update",
                        "message": f"Waiting for a player... (Round amount: {rounds})"
                    }))
                    
                # Broadcast the updated waiting list to everyone in the lobby
                await self.broadcast_waiting_list()
    
            # Game updates from clients (paddle movement)
            elif msg_type == "game_update":
                if data.get("data") and "paddleY" in data.get("data"):
                    # Update paddle position in server-side game
                    game_manager.update_paddle(self.channel_name, data["data"]["paddleY"])
                    
                    # No need to broadcast paddle position - server will send game state updates
                    
            # Game over notifications
            elif msg_type == "game_over":
                # This is now handled by the server game logic
                # But we'll keep this for tournament integration
                game_room = active_games.get(self.channel_name)
                if game_room:
                    # Check if this game was part of a tournament
                    if self.channel_name in tournament_players:
                        tournament_id = tournament_players[self.channel_name]
                        tournament = active_tournaments.get(tournament_id)
                        
                        if tournament and tournament.current_match:
                            logger.info(f"Tournament match completed in tournament {tournament_id}")
                            
                            # Record match result
                            if tournament.record_match_result(self.channel_name):
                                logger.info(f"Match result recorded, winner: {self.channel_name}")
                                
                                # Notify all tournament players of the update
                                for player in tournament.players:
                                    try:
                                        await self.channel_layer.send(
                                            player["channel"],
                                            {
                                                "type": "tournament_update",
                                                "tournament": tournament.get_state()
                                            }
                                        )
                                    except Exception as e:
                                        logger.error(f"Error sending tournament update: {e}")
                                
                                # Reset readiness count since we're starting a new match cycle
                                tournament.reset_readiness()
                                
                                # IMPORTANT: Wait for players to mark themselves ready
                                # Next match will be started by tournament_player_ready handler
                                # when all players report they're ready
                        
            # Tournament commands
            elif msg_type == "create_tournament":
                TOURNAMENT_CREATED.inc()
                nickname = data.get("nickname")
                tournament_name = data.get("name", f"{nickname}'s Tournament")
                rounds = data.get("rounds", 3)
                
                logger.info(f"Creating tournament: {tournament_name} by {nickname} with {rounds} rounds")
                
                # Create new tournament
                tournament_id = str(uuid.uuid4())
                tournament = Tournament(tournament_id, self.channel_name, tournament_name)
                tournament.rounds = rounds
                
                # Add creator as first player
                tournament.add_player(self.channel_name, nickname)
                
                # Store tournament
                active_tournaments[tournament_id] = tournament
                tournament_players[self.channel_name] = tournament_id
                
                # Respond to creator
                await self.send(text_data=json.dumps({
                    "type": "tournament_created",
                    "tournament": tournament.get_state()
                }))
                
                # Broadcast updated tournament list
                await self.broadcast_tournament_list()
            
            elif msg_type == "join_tournament":
                tournament_id = data.get("tournament_id")
                nickname = data.get("nickname")
                
                logger.info(f"Player {nickname} attempting to join tournament {tournament_id}")
                
                if tournament_id in active_tournaments:
                    tournament = active_tournaments[tournament_id]
                    
                    # Only join if tournament hasn't started
                    if not tournament.started:
                        # Add player to tournament
                        if tournament.add_player(self.channel_name, nickname):
                            # Track which tournament this player is in
                            tournament_players[self.channel_name] = tournament_id
                            
                            logger.info(f"Player {nickname} joined tournament {tournament_id}")
                            
                            # Send tournament state to the new player
                            await self.send(text_data=json.dumps({
                                "type": "tournament_joined",
                                "tournament": tournament.get_state()
                            }))
                            
                            # Notify all players in tournament
                            for player in tournament.players:
                                try:
                                    await self.channel_layer.send(
                                        player["channel"],
                                        {
                                            "type": "tournament_update",
                                            "tournament": tournament.get_state()
                                        }
                                    )
                                except Exception as e:
                                    logger.error(f"Error sending tournament update: {e}")
                            
                            # Broadcast updated tournament list
                            await self.broadcast_tournament_list()
                        else:
                            # Nickname already taken
                            await self.send(text_data=json.dumps({
                                "type": "tournament_error",
                                "message": "Nickname already taken in this tournament"
                            }))
                    else:
                        # Tournament already started
                        await self.send(text_data=json.dumps({
                            "type": "tournament_error",
                            "message": "Cannot join: Tournament has already started"
                        }))
                else:
                    # Tournament not found
                    await self.send(text_data=json.dumps({
                        "type": "tournament_error",
                        "message": "Tournament not found"
                    }))
                    
            elif msg_type == "get_tournament_info":
                # Handle tournament recovery request
                tournament_id = data.get("tournament_id")
                
                logger.info(f"Player {self.channel_name} requesting tournament info for {tournament_id}")
                
                if tournament_id in active_tournaments:
                    tournament = active_tournaments[tournament_id]
                    
                    # Check if player is already in this tournament
                    player_in_tournament = False
                    for player in tournament.players:
                        if player["channel"] == self.channel_name:
                            player_in_tournament = True
                            break
                    
                    if player_in_tournament:
                        logger.info(f"Player found in tournament {tournament_id}, sending info")
                        
                        # Update player's tournament tracking if needed
                        tournament_players[self.channel_name] = tournament_id
                        
                        # Send tournament state to the player
                        await self.send(text_data=json.dumps({
                            "type": "tournament_joined",
                            "tournament": tournament.get_state()
                        }))
                    else:
                        logger.info(f"Player not found in tournament {tournament_id}")
                        
                        # Send error
                        await self.send(text_data=json.dumps({
                            "type": "tournament_error",
                            "message": "You are not a participant in this tournament"
                        }))
                else:
                    # Tournament not found
                    logger.info(f"Tournament {tournament_id} not found")
                    
                    await self.send(text_data=json.dumps({
                        "type": "tournament_error",
                        "message": "Tournament not found or has ended"
                    }))
            
            elif msg_type == "start_tournament":
                tournament_id = data.get("tournament_id")
                
                logger.info(f"Request to start tournament {tournament_id}")
                
                if tournament_id in active_tournaments:
                    tournament = active_tournaments[tournament_id]
                    
                    # Only creator can start tournament
                    if self.channel_name == tournament.creator_channel:
                        if tournament.start_tournament():
                            logger.info(f"Tournament {tournament_id} started successfully")
                            
                            # If tournament started successfully, notify all players
                            for player in tournament.players:
                                try:
                                    await self.channel_layer.send(
                                        player["channel"],
                                        {
                                            "type": "tournament_update",
                                            "tournament": tournament.get_state()
                                        }
                                    )
                                except Exception as e:
                                    logger.error(f"Error sending tournament update: {e}")
                            
                            # If there's a current match, start it
                            if tournament.current_match:
                                player1 = tournament.current_match["player1"]
                                player2 = tournament.current_match["player2"]
                                
                                logger.info(f"Starting first match: {player1['nickname']} vs {player2['nickname']}")
                                
                                # Create a new game room for this match
                                tourney_game_room = "tourney_game_" + str(uuid.uuid4())
                                
                                # Create server-side game
                                game = game_manager.create_game(tourney_game_room, target_rounds=tournament.rounds)
                                
                                # Add players to the game
                                game_manager.add_player_to_game(tourney_game_room, player1["channel"], "left")
                                game_manager.add_player_to_game(tourney_game_room, player2["channel"], "right")
                                
                                # Add to channel group
                                await self.channel_layer.group_add(tourney_game_room, player1["channel"])
                                await self.channel_layer.group_add(tourney_game_room, player2["channel"])
                                
                                # Store room mapping
                                active_games[player1["channel"]] = tourney_game_room
                                active_games[player2["channel"]] = tourney_game_room
                                
                                # Start the game
                                game_manager.start_game(tourney_game_room)
                                
                                # Set up state sync loop for this game
                                asyncio.create_task(self.game_sync_loop(tourney_game_room))
                                
                                # Start game for both players
                                match_message = f"Tournament match: {player1['nickname']} vs {player2['nickname']}"
                                
                                await self.channel_layer.send(
                                    player1["channel"],
                                    {
                                        "type": "start_game",
                                        "message": match_message,
                                        "room": tourney_game_room,
                                        "rounds": tournament.rounds,
                                        "is_tournament": True,
                                        "player_side": "left"
                                    }
                                )
                                
                                await self.channel_layer.send(
                                    player2["channel"],
                                    {
                                        "type": "start_game",
                                        "message": match_message,
                                        "room": tourney_game_room,
                                        "rounds": tournament.rounds,
                                        "is_tournament": True,
                                        "player_side": "right"
                                    }
                                )
                            
                            # Broadcast updated tournament list
                            await self.broadcast_tournament_list()
                        else:
                            # Not enough players
                            await self.send(text_data=json.dumps({
                                "type": "tournament_error",
                                "message": "Cannot start: Need at least 2 players"
                            }))
                    else:
                        # Not tournament creator
                        await self.send(text_data=json.dumps({
                            "type": "tournament_error",
                            "message": "Only the tournament creator can start the tournament"
                        }))
                else:
                    # Tournament not found
                    await self.send(text_data=json.dumps({
                        "type": "tournament_error",
                        "message": "Tournament not found"
                    }))
                    
            elif msg_type == "tournament_player_ready":
                if self.channel_name in tournament_players:
                    tournament_id = tournament_players[self.channel_name]
                    tournament = active_tournaments.get(tournament_id)
                    
                    if tournament:
                        logger.info(f"Player {self.channel_name} is ready for next match in tournament {tournament_id}")
                        
                        # Mark player as ready
                        all_ready = tournament.mark_player_ready(self.channel_name)
                        
                        # If all players are ready and we have a current match
                        if all_ready and tournament.current_match:
                            logger.info(f"All players ready for next match in tournament {tournament_id} - starting match")
                            
                            # Reset readiness for next time
                            tournament.reset_readiness()
                            
                            # Get match players
                            player1 = tournament.current_match["player1"]
                            player2 = tournament.current_match["player2"]
                            
                            # Send match ready notification to both players
                            match_message = f"Match ready: {player1['nickname']} vs {player2['nickname']}"
                            
                            await self.channel_layer.send(
                                player1["channel"],
                                {
                                    "type": "tournament_match_ready",
                                    "message": match_message
                                }
                            )
                            
                            await self.channel_layer.send(
                                player2["channel"],
                                {
                                    "type": "tournament_match_ready",
                                    "message": match_message
                                }
                            )
                            
                            # Wait a moment for UI to catch up
                            await asyncio.sleep(2)
                            
                            # Create a new game room for this match
                            tourney_game_room = "tourney_game_" + str(uuid.uuid4())
                            
                            # Create server-side game
                            game = game_manager.create_game(tourney_game_room, target_rounds=tournament.rounds)
                            
                            # Add players to the game
                            game_manager.add_player_to_game(tourney_game_room, player1["channel"], "left")
                            game_manager.add_player_to_game(tourney_game_room, player2["channel"], "right")
                            
                            # Add to channel group
                            await self.channel_layer.group_add(tourney_game_room, player1["channel"])
                            await self.channel_layer.group_add(tourney_game_room, player2["channel"])
                            
                            # Store room mapping
                            active_games[player1["channel"]] = tourney_game_room
                            active_games[player2["channel"]] = tourney_game_room
                            
                            # Start the game
                            game_manager.start_game(tourney_game_room)
                            
                            # Set up state sync loop for this game
                            asyncio.create_task(self.game_sync_loop(tourney_game_room))
                            
                            # Start game for both players
                            await self.channel_layer.send(
                                player1["channel"],
                                {
                                    "type": "start_game",
                                    "message": match_message,
                                    "room": tourney_game_room,
                                    "rounds": tournament.rounds,
                                    "is_tournament": True,
                                    "player_side": "left"
                                }
                            )
                            
                            await self.channel_layer.send(
                                player2["channel"],
                                {
                                    "type": "start_game",
                                    "message": match_message,
                                    "room": tourney_game_room,
                                    "rounds": tournament.rounds,
                                    "is_tournament": True,
                                    "player_side": "right"
                                }
                            )
                            
                            # Update all tournament players about the current state
                            for player in tournament.players:
                                await self.channel_layer.send(
                                    player["channel"],
                                    {
                                        "type": "tournament_update",
                                        "tournament": tournament.get_state()
                                    }
                                )
            
            elif msg_type == "leave_tournament":
                # Handle player leaving a tournament
                if self.channel_name in tournament_players:
                    tournament_id = tournament_players[self.channel_name]
                    
                    logger.info(f"Player leaving tournament {tournament_id}")
                    
                    if tournament_id in active_tournaments:
                        tournament = active_tournaments[tournament_id]
                        
                        # If leaving player is creator and tournament hasn't started, delete it
                        if self.channel_name == tournament.creator_channel and not tournament.started:
                            logger.info(f"Tournament creator left, removing tournament {tournament_id}")
                            
                            # Notify other players
                            for player in tournament.players:
                                if player["channel"] != self.channel_name:
                                    try:
                                        await self.channel_layer.send(
                                            player["channel"],
                                            {
                                                "type": "tournament_left",
                                                "message": "Tournament has been canceled by the creator."
                                            }
                                        )
                                        # Remove their tournament tracking
                                        if player["channel"] in tournament_players:
                                            del tournament_players[player["channel"]]
                                    except Exception as e:
                                        logger.error(f"Error notifying player about tournament deletion: {e}")
                            
                            # Delete the tournament
                            del active_tournaments[tournament_id]
                        else:
                            # Remove player from tournament
                            tournament.remove_player(self.channel_name)
                            
                            # Notify other tournament players
                            for player in tournament.players:
                                try:
                                    await self.channel_layer.send(
                                        player["channel"],
                                        {
                                            "type": "tournament_update",
                                            "tournament": tournament.get_state()
                                        }
                                    )
                                except Exception as e:
                                    logger.error(f"Error sending tournament update: {e}")
                            
                            # Remove tournament if empty
                            if not tournament.players:
                                logger.info(f"Tournament {tournament_id} is now empty, removing")
                                del active_tournaments[tournament_id]
                        
                        # Remove from tracking
                        del tournament_players[self.channel_name]
                        
                        # Notify player they left
                        await self.send(text_data=json.dumps({
                            "type": "tournament_left",
                            "message": "You have left the tournament"
                        }))
                        
                        # Broadcast updated tournament list
                        await self.broadcast_tournament_list()
            
            elif msg_type == "get_tournaments":
                # Send list of active tournaments
                await self.broadcast_tournament_list()
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {e}")

    async def broadcast_waiting_list(self):
        # Build a simplified waiting list (nickname and rounds only)
        waiting_list = [{"nickname": p["nickname"], "rounds": p["rounds"]} for p in waiting_players]
        logger.debug(f"Broadcasting waiting list: {waiting_list}")
        
        try:
            await self.channel_layer.group_send("lobby", {
                "type": "waiting_list_update",
                "waiting_list": waiting_list
            })
        except Exception as e:
            logger.error(f"Error broadcasting waiting list: {e}")
    
    async def broadcast_tournament_list(self):
        # Build a list of active tournaments
        tournament_list = [
            {
                "id": t_id,
                "name": tournament.name,
                "players": len(tournament.players),
                "started": tournament.started
            }
            for t_id, tournament in active_tournaments.items()
            if not tournament.started or tournament.current_match is not None
        ]
        
        logger.debug(f"Broadcasting tournament list: {len(tournament_list)} tournaments")
        
        try:
            await self.channel_layer.group_send("lobby", {
                "type": "tournament_list_update",
                "tournaments": tournament_list
            })
        except Exception as e:
            logger.error(f"Error broadcasting tournament list: {e}")

    async def waiting_list_update(self, event):
        waiting_list = event.get("waiting_list", [])
        logger.debug(f"Sending waiting list update: {len(waiting_list)} players")
        
        await self.send(text_data=json.dumps({
            "type": "waiting_list",
            "waiting_list": waiting_list
        }))
    
    async def tournament_list_update(self, event):
        tournaments = event.get("tournaments", [])
        logger.debug(f"Sending tournament list update: {len(tournaments)} tournaments")
        
        await self.send(text_data=json.dumps({
            "type": "tournament_list",
            "tournaments": tournaments
        }))
    
    async def tournament_update(self, event):
        tournament = event.get("tournament")
        logger.debug(f"Sending tournament update for tournament {tournament['id'] if tournament else 'unknown'}")
        
        await self.send(text_data=json.dumps({
            "type": "tournament_update",
            "tournament": tournament
        }))
    
    async def tournament_left(self, event):
        message = event.get("message", "You have left the tournament")
        logger.debug(f"Sending tournament left message: {message}")
        
        await self.send(text_data=json.dumps({
            "type": "tournament_left",
            "message": message
        }))

    async def start_game(self, event):
        logger.debug(f"Sending start game event: {event.get('message')}")
        
        
        await self.send(text_data=json.dumps({
            "type": "start_game",
            "message": event.get("message"),
            "room": event.get("room"),
            "rounds": event.get("rounds"),
            "is_tournament": event.get("is_tournament", False),
            "player_side": event.get("player_side", "left")
        }))
        
        game_mode = event.get("game_mode", "classic")
        GAME_STARTED.labels(mode=game_mode).inc()
        WAITING_PLAYERS.dec()
        ACTIVE_PLAYERS.inc()
        
        if event.get("room") in self.active_games:
            self.active_games[event.get("room")].start_time = time.time()

    async def game_state_update(self, event):
        logger.debug(f"Sending game state update: {event.get('state')}")
        await self.send(text_data=json.dumps({
        "type": "game_state_update",
        "state": event.get("state")
         }))

    async def broadcast_game_over(self, event):
        await self.send(text_data=json.dumps({
            "type": "game_over",
            "score": event.get("score"),
            "winner": event.get("winner")
        }))
        
        game_mode = event.get("game_mode", "classic")
        GAME_COMPLETED.labels(mode=game_mode).inc()
        ACTIVE_PLAYERS.dec()
        
        if event.get("room") in self.active_games:
            game = self.active_games[event.get("room")]
            if game.start_time:
                duration = time.time() - game.start_time
                GAME_DURATION.labels(mode=game_mode).observe(duration)  
        

    async def opponent_left(self, event):
        await self.send(text_data=json.dumps({
            "type": "opponent_left",
            "message": event.get("message")
        }))
    
    async def game_sync_loop(self, game_room):
        """Periodically send game state to clients"""
        
        try:
            while True:
                # Get game instance
                game = game_manager.active_games.get(game_room)
                if not game or not game.is_running:
                    # Game is no longer active
                    # Check if game has a winner and notify players
                    if game and game.winner:
                        # Determine scores to send
                        if game.winner == "left":
                            winner_score = game.left_score
                            winner="left"
                        else:
                            winner_score = game.right_score
                            winner="right"
                        # Send game over notification
                        await self.channel_layer.group_send(
                            game_room,
                            {
                                "type": "broadcast_game_over",
                                "score": winner_score,
                                "winner": winner
                            }
                        )
                    break
                
                # Get current game state
                state = game.get_state()
                
                # Send to all players in this game room
                await self.channel_layer.group_send(
                    game_room,
                    {
                        "type": "game_state_update",
                        "state": state
                    }
                )
                
                # Wait for next update
                await asyncio.sleep(1/60)  # ~ 60 FPS
        except Exception as e:
            logger.error(f"Error in game sync loop: {e}")

    async def start_game(self, event):
        logger.debug(f"Sending start game event: {event.get('message')}")
        
        await self.send(text_data=json.dumps({
            "type": "start_game",
            "message": event.get("message"),
            "room": event.get("room"),
            "rounds": event.get("rounds"),
            "is_tournament": event.get("is_tournament", False)
        }))

    async def broadcast_game_update(self, event):
        if self.channel_name == event.get("sender"):
            return
            
        await self.send(text_data=json.dumps({
            "type": "game_update",
            "data": event.get("data")
        }))

    async def broadcast_game_over(self, event):
        await self.send(text_data=json.dumps({
            "type": "game_over",
            "score": event.get("score"),
            "winner": event.get("winner")
        }))

    async def opponent_left(self, event):
        await self.send(text_data=json.dumps({
            "type": "opponent_left",
            "message": event.get("message")
        }))