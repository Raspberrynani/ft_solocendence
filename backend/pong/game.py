import time
import math
import random
import threading
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

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
                        "y": self.left_paddle_y,
                        "width": self.paddle_width,
                        "height": self.paddle_height
                    },
                    "right": {
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
    
    def handle_game_over(self, game):
        """Handle game over event"""
        # This method will be called when a game ends
        # We'll keep the game instance for a short while to allow final state retrieval
        logger.info(f"Game over: room={game.room_id}, winner={game.winner}")
        
        # Schedule cleanup after a delay (would use proper cleanup mechanism in production)
        def delayed_cleanup():
            time.sleep(5)  # 5 second delay before cleanup
            with self.lock:
                if game.room_id in self.active_games:
                    del self.active_games[game.room_id]
        
        # Start cleanup thread
        cleanup_thread = threading.Thread(target=delayed_cleanup)
        cleanup_thread.daemon = True
        cleanup_thread.start()

# Create a global game manager instance
game_manager = GameManager()