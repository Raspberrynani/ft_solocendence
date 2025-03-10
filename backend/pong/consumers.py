import json
import uuid
import asyncio
import logging
import time
import math
import random
import threading
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from .game import PongGame

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

class Tournament:
    """
    Enhanced tournament system for Pong matches.
    Supports 4, 6, or 8 player tournaments with a bracket structure.
    """
    def __init__(self, id, creator_channel, name="Tournament", size=8):
        self.id = id
        self.name = name
        self.creator_channel = creator_channel
        self.size = size  # Total number of players (4, 6, or 8)
        self.players = []  # List of {channel, nickname}
        self.started = False
        self.rounds = 3  # Default rounds per match
        self.matches = []  # All matches (past, current, upcoming)
        self.current_match = None  # Currently active match
        self.winner = None  # Tournament winner
    
    def add_player(self, channel, nickname):
        """Add a player to the tournament"""
        # Check if tournament already started
        if self.started:
            return False
            
        # Check for duplicate nickname
        if any(p["nickname"] == nickname for p in self.players):
            return False
        
        # Check for existing channel
        if any(p["channel"] == channel for p in self.players):
            return False
        
        # Check if tournament is full
        if len(self.players) >= self.size:
            return False
        
        self.players.append({"channel": channel, "nickname": nickname})
        return True
    
    def remove_player(self, channel):
        """Remove a player from the tournament"""
        # Find player to remove
        player_to_remove = None
        for p in self.players:
            if p["channel"] == channel:
                player_to_remove = p
                break
                
        if not player_to_remove:
            return False
        
        # Remove player
        self.players.remove(player_to_remove)
        
        # If tournament has started, handle match updates
        if self.started and self.current_match:
            # If player was in current match, cancel it
            if (self.current_match.get("player1_channel") == channel or 
                self.current_match.get("player2_channel") == channel):
                # Auto-win for other player
                other_player = None
                other_nickname = None
                
                if self.current_match.get("player1_channel") == channel:
                    other_player = self.current_match.get("player2_channel")
                    other_nickname = self.current_match.get("player2")
                else:
                    other_player = self.current_match.get("player1_channel")
                    other_nickname = self.current_match.get("player1")
                
                if other_player:
                    # Mark match as complete with other player as winner
                    self.record_match_result(other_player)
        
        return True
    
    def start_tournament(self):
        """Start the tournament by creating bracket structure"""
        # Validate we can start
        if self.started:
            return False
            
        # Check for valid player count (4, 6, or 8)
        if len(self.players) not in [4, 6, 8]:
            return False
        
        # Even number of players required
        if len(self.players) % 2 != 0:
            return False
        
        # Reset tournament state
        self.matches = []
        self.current_match = None
        self.winner = None
        
        # Shuffle players for random matchups
        shuffled_players = self.players.copy()
        random.shuffle(shuffled_players)
        
        # Calculate rounds needed based on player count
        rounds_needed = math.ceil(math.log2(len(shuffled_players)))
        
        # Create bracket structure
        self.create_bracket(shuffled_players, rounds_needed)
        
        self.started = True
        
        # Start first match
        return self.advance_tournament()
    
    def create_bracket(self, players, rounds):
        """Create a tournament bracket structure based on player count"""
        player_count = len(players)
        
        # Create initial round matches
        first_round_matches = player_count // 2
        
        # Handle byes for non-power-of-2 player counts
        if player_count & (player_count - 1) != 0:  # Not a power of 2
            # Calculate how many byes we need
            next_power_of_2 = 2 ** rounds
            byes_needed = next_power_of_2 - player_count
            
            # Assign byes to certain positions (advance directly to next round)
            # This is implemented by creating fewer first-round matches
            first_round_matches = (player_count - byes_needed) // 2
        
        # Track all matches we need to create (round, position)
        matches_to_create = []
        final_round = rounds - 1  # 0-indexed
        
        # First determine all match positions needed in bracket
        for round_num in range(rounds):
            matches_in_round = 2 ** (rounds - round_num - 1)
            for position in range(matches_in_round):
                matches_to_create.append((round_num, position))
        
        # Sort by round so we create them in order
        matches_to_create.sort(key=lambda x: x[0])
        
        # Create all matches, starting with round 0
        match_id = 0
        for round_num, position in matches_to_create:
            # Determine if this is a first-round match
            is_first_round = (round_num == 0)
            
            if is_first_round and position < first_round_matches:
                # First round match with assigned players
                player1_idx = position * 2
                player2_idx = position * 2 + 1
                
                if player1_idx < len(players) and player2_idx < len(players):
                    player1 = players[player1_idx]
                    player2 = players[player2_idx]
                    
                    self.matches.append({
                        "id": match_id,
                        "round": round_num,
                        "position": position,
                        "player1": player1["nickname"],
                        "player2": player2["nickname"],
                        "player1_channel": player1["channel"],
                        "player2_channel": player2["channel"],
                        "winner": None,
                        "next_match": self.calculate_next_match(round_num, position, first_round_matches)
                    })
                else:
                    # This shouldn't happen, but handle it gracefully
                    self.matches.append({
                        "id": match_id,
                        "round": round_num,
                        "position": position,
                        "player1": "TBD",
                        "player2": "TBD",
                        "player1_channel": None,
                        "player2_channel": None,
                        "winner": None,
                        "next_match": self.calculate_next_match(round_num, position, first_round_matches)
                    })
            else:
                # Higher round match (including final) - will be filled later
                # For 4 players, this includes the final match (round 1, position 0)
                next_match = None
                if round_num < final_round:
                    matches_in_this_round = 2 ** (rounds - round_num - 1)
                    next_match = self.calculate_next_match(round_num, position, matches_in_this_round)
                
                self.matches.append({
                    "id": match_id,
                    "round": round_num,
                    "position": position,
                    "player1": None,  # Will be filled by winner of previous match
                    "player2": None,  # Will be filled by winner of previous match
                    "player1_channel": None,
                    "player2_channel": None,
                    "winner": None,
                    "next_match": next_match
                })
            
            match_id += 1
        
        # Special handling for byes - check if we have players who get byes
        if player_count & (player_count - 1) != 0:  # Not a power of 2
            bye_players = players[first_round_matches * 2:]
            for i, player in enumerate(bye_players):
                # Calculate position in second round
                round_idx = 1  # Second round (0-indexed)
                position = i // 2
                
                # Find the corresponding match in the second round
                second_round_match = next((m for m in self.matches 
                                        if m["round"] == round_idx and m["position"] == position), None)
                
                if second_round_match:
                    # Add player to first or second slot
                    if second_round_match["player1"] is None:
                        second_round_match["player1"] = player["nickname"]
                        second_round_match["player1_channel"] = player["channel"]
                    else:
                        second_round_match["player2"] = player["nickname"]
                        second_round_match["player2_channel"] = player["channel"]
    
    def calculate_next_match(self, current_round, position, matches_in_round):
        """Calculate the ID of the next match in the bracket"""
        if matches_in_round <= 1:
            return None  # Final match has no next match
            
        next_round = current_round + 1
        next_position = position // 2
        
        return {"round": next_round, "position": next_position}
    
    def advance_tournament(self):
        """Move to the next match in the tournament"""
        # If there's a current match, do nothing until it's completed
        if self.current_match:
            return False
            
        # Find the next match to play
        next_match = self.find_next_match()
        
        if not next_match:
            # No available match, but check for a special case:
            # - First round matches are done
            # - Final match should be created but hasn't been activated
            
            # Find the final round by checking bracket depth
            final_round = math.ceil(math.log2(len(self.players))) - 1
            
            # Find matches where both players are known but winner is None
            final_matches = [m for m in self.matches 
                        if m["round"] == final_round and m["winner"] is None
                        and m["player1"] and m["player2"]
                        and m["player1_channel"] and m["player2_channel"]]
                        
            # If we have a potential final match that's ready to play
            if final_matches and len(final_matches) == 1:
                next_match = final_matches[0]
                logger.info(f"Found final match ready to play: {next_match['player1']} vs {next_match['player2']}")
        
        if not next_match:
            # Tournament is complete or no valid next match
            # Find the winner (winner of the final match)
            final_round = math.ceil(math.log2(len(self.players))) - 1
            final_match = next((m for m in self.matches 
                            if m["round"] == final_round and m["winner"] is not None), None)
            if final_match:
                self.winner = final_match["winner"]
            
            return False
        
        # Double-check that both players are set
        if not next_match["player1"] or not next_match["player2"] or not next_match["player1_channel"] or not next_match["player2_channel"]:
            logger.warning(f"Incomplete match found, cannot set as current: {next_match}")
            return False
        
        # Set as current match
        self.current_match = next_match
        logger.info(f"Advanced tournament to match: {next_match['player1']} vs {next_match['player2']}")
        return True
    
    def find_next_match(self):
        """Find the next match that's ready to be played"""
        # First, look for matches where both players are known and no winner yet
        ready_matches = []
        for match in self.matches:
            if (match["player1"] and match["player2"] and 
                match["player1_channel"] and match["player2_channel"] and
                match["winner"] is None):
                ready_matches.append(match)
        
        # Sort matches by round (lower rounds first)
        ready_matches.sort(key=lambda m: m["round"])
        
        # Return the first available match if any
        return ready_matches[0] if ready_matches else None
    
    def record_match_result(self, winner_channel):
        """Record the result of the current match"""
        if not self.current_match:
            return False
        
        # Verify this player is in the current match
        is_player1 = winner_channel == self.current_match["player1_channel"]
        is_player2 = winner_channel == self.current_match["player2_channel"]
        
        if not (is_player1 or is_player2):
            return False
        
        # Determine winner and loser
        winner_nickname = None
        loser_nickname = None
        loser_channel = None
        
        if is_player1:
            winner_nickname = self.current_match["player1"]
            loser_nickname = self.current_match["player2"]
            loser_channel = self.current_match["player2_channel"]
        else:
            winner_nickname = self.current_match["player2"]
            loser_nickname = self.current_match["player1"]
            loser_channel = self.current_match["player1_channel"]
        
        # Update current match with winner
        self.current_match["winner"] = winner_nickname
        
        # Update next match if there is one
        if self.current_match["next_match"]:
            next_round = self.current_match["next_match"]["round"]
            next_position = self.current_match["next_match"]["position"]
            
            # Find the next match
            next_match = next((m for m in self.matches 
                            if m["round"] == next_round and m["position"] == next_position), None)
            
            if next_match:
                # Determine which player slot to fill
                if next_match["player1"] is None:
                    next_match["player1"] = winner_nickname
                    next_match["player1_channel"] = winner_channel
                else:
                    next_match["player2"] = winner_nickname
                    next_match["player2_channel"] = winner_channel
        
        # Store current match for return value
        current_match = self.current_match
        
        # Clear current match BEFORE calling advance_tournament
        # This is important to avoid potential issues
        self.current_match = None
        
        # Force the tournament to advance after a short delay
        # This ensures all match updates are processed before advancing
        import asyncio
        async def delayed_advance():
            await asyncio.sleep(0.5)
            # Try to advance the tournament
            if not self.advance_tournament() and not self.winner:
                # If advance_tournament didn't work or set a winner, check for final match manually
                final_matches = [m for m in self.matches if m["next_match"] is None]
                if final_matches and len(final_matches) == 1 and final_matches[0]["player1"] and final_matches[0]["player2"]:
                    # We have a valid final match that should be set as current
                    self.current_match = final_matches[0]
                    logger.info(f"Forcing final match: {self.current_match['player1']} vs {self.current_match['player2']}")
        
        # Schedule the delayed advancement (will be executed by the event loop)
        asyncio.create_task(delayed_advance())
        
        # Calculate if tournament is complete
        if not self.advance_tournament() and not self.winner:
            # Find if we have a winner
            final_match = next((m for m in self.matches if m["next_match"] is None and m["winner"] is not None), None)
            if final_match:
                self.winner = final_match["winner"]
        
        # Return the match result for notifications
        return {
            "match": current_match,
            "winner": winner_nickname,
            "winner_channel": winner_channel,
            "loser": loser_nickname,
            "loser_channel": loser_channel,
            "tournament_complete": self.winner is not None
        }
    
    def get_state(self):
        """Get the current state of the tournament for clients"""
        # Format current match data
        current_match_data = None
        if self.current_match:
            current_match_data = {
                "player1": self.current_match["player1"],
                "player2": self.current_match["player2"]
            }
        
        # Format player list
        players = [p["nickname"] for p in self.players]
        
        # Get match data for bracket display
        matches_data = []
        for match in self.matches:
            match_data = {
                "round": match["round"],
                "position": match["position"],
                "player1": match["player1"],
                "player2": match["player2"],
                "winner": match["winner"]
            }
            matches_data.append(match_data)
        
        return {
            "id": self.id,
            "name": self.name,
            "size": self.size,
            "players": players,
            "started": self.started,
            "current_match": current_match_data,
            "matches": matches_data,
            "winner": self.winner
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

    async def start_tournament_match(self, tournament, match):
        """Start a match within a tournament"""
        player1_channel = match["player1_channel"]
        player2_channel = match["player2_channel"]
        player1_nickname = match["player1"]
        player2_nickname = match["player2"]
        
        logger.info(f"Starting tournament match: {player1_nickname} vs {player2_nickname}")
        
        # Create a new game room for this match
        tourney_game_room = "tourney_game_" + str(uuid.uuid4())
        
        # Create server-side game
        game = game_manager.create_game(tourney_game_room, target_rounds=tournament.rounds)
        
        # Add players to the game
        left_side = game_manager.add_player_to_game(tourney_game_room, player1_channel, "left")
        right_side = game_manager.add_player_to_game(tourney_game_room, player2_channel, "right")
        
        if not left_side or not right_side:
            logger.error(f"Failed to add players to tournament game - left: {left_side}, right: {right_side}")
            # Try to recover
            if not left_side:
                logger.error(f"Trying to re-add player1 {player1_nickname} to game")
                game_manager.add_player_to_game(tourney_game_room, player1_channel, "left")
            if not right_side:
                logger.error(f"Trying to re-add player2 {player2_nickname} to game")
                game_manager.add_player_to_game(tourney_game_room, player2_channel, "right")
        
        logger.info(f"Added players to tournament game: left={player1_channel}, right={player2_channel}")
        
        # Add to channel group
        await self.channel_layer.group_add(tourney_game_room, player1_channel)
        await self.channel_layer.group_add(tourney_game_room, player2_channel)
        
        # Store room mapping
        active_games[player1_channel] = tourney_game_room
        active_games[player2_channel] = tourney_game_room
        
        # Start the game with a small delay to ensure players are ready
        await asyncio.sleep(0.5)
        success = game_manager.start_game(tourney_game_room)
        if not success:
            logger.error(f"Failed to start tournament game: {tourney_game_room}")
            # Try once more after a short delay
            await asyncio.sleep(1.0)
            success = game_manager.start_game(tourney_game_room)
            if not success:
                logger.error(f"Failed second attempt to start tournament game: {tourney_game_room}")
                return
        
        logger.info(f"Tournament game started: {success}")
        
        # Set up state sync loop for this game
        asyncio.create_task(self.game_sync_loop(tourney_game_room))
        
        # Start game for both players
        match_message = f"Tournament match: {player1_nickname} vs {player2_nickname}"
        
        await self.channel_layer.send(
            player1_channel,
            {
                "type": "start_game",
                "message": match_message,
                "room": tourney_game_room,
                "rounds": tournament.rounds,
                "is_tournament": True,
                "player_side": "left"
            }
        )
        
        # Add small delay between messages to prevent race conditions
        await asyncio.sleep(0.1)
        
        await self.channel_layer.send(
            player2_channel,
            {
                "type": "start_game",
                "message": match_message,
                "room": tourney_game_room,
                "rounds": tournament.rounds,
                "is_tournament": True,
                "player_side": "right"
            }
        )

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
            
            # Game over notifications (Important for tournaments)
            elif msg_type == "game_over":
                # Check if this game was part of a tournament
                if self.channel_name in tournament_players:
                    await self.handle_tournament_game_over(self.channel_name)
            
            # Tournament game over (specific for tournament matches)
            elif msg_type == "tournament_game_over":
                # Handle tournament-specific game over
                if self.channel_name in tournament_players:
                    winner_nickname = data.get("winner")
                    score = data.get("score", 0)
                    
                    # Only process if there's a valid winner
                    if winner_nickname:
                        await self.handle_tournament_game_over(self.channel_name)
            
            # Tournament commands
            elif msg_type == "create_tournament":
                await self.handle_create_tournament(data)
            elif msg_type == "join_tournament":
                await self.handle_join_tournament(data)
            elif msg_type == "start_tournament":
                await self.handle_start_tournament(data)
            elif msg_type == "leave_tournament":
                await self.handle_leave_tournament()
            elif msg_type == "get_tournaments":
                await self.broadcast_tournament_list()
            
            # New tournament-specific messages
            elif msg_type == "get_tournament_state":
                tournament_id = data.get("tournament_id")
                
                if tournament_id in active_tournaments:
                    tournament = active_tournaments[tournament_id]
                    await self.send(text_data=json.dumps({
                        "type": "tournament_update",
                        "tournament": tournament.get_state()
                    }))
            
            elif msg_type == "leave_queue":
                
                # Now use waiting_players
                # Find and remove player from waiting list
                waiting_players[:] = [p for p in waiting_players if p["channel"] != self.channel_name]
                logger.info(f"Player {self.channel_name} left the queue")
                
                # Update the waiting list count metric if using metrics
                if len(waiting_players) > 0:
                    WAITING_PLAYERS.dec()
                
                # Send confirmation to client
                await self.send(text_data=json.dumps({
                    "type": "queue_update",
                    "message": "You have left the queue"
                }))
                
                # Broadcast updated waiting list to everyone in the lobby
                await self.broadcast_waiting_list()
            
            elif msg_type == "request_final_match":
                tournament_id = data.get("tournament_id")
                
                if tournament_id in active_tournaments:
                    tournament = active_tournaments[tournament_id]
                    
                    # Force tournament to advance if possible
                    if tournament.advance_tournament():
                        logger.info(f"Forced tournament {tournament_id} to advance to next match")
                        
                        # Notify all players in tournament about the update
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
                            await self.start_tournament_match(tournament, tournament.current_match)
                    else:
                        logger.warning(f"Failed to force tournament {tournament_id} to advance")
            
            elif msg_type == "ready_for_match":
                tournament_id = data.get("tournament_id")
                nickname = data.get("nickname")
                
                if tournament_id in active_tournaments:
                    tournament = active_tournaments[tournament_id]
                    
                    # If no current match but we can find a ready match, set it
                    if not tournament.current_match:
                        # Try to find a match that has this player
                        potential_match = None
                        for match in tournament.matches:
                            if (match["player1"] == nickname or match["player2"] == nickname) and match["winner"] is None:
                                if match["player1"] and match["player2"] and match["player1_channel"] and match["player2_channel"]:
                                    potential_match = match
                                    break
                        
                        if potential_match:
                            logger.info(f"Setting match with {nickname} as current match")
                            tournament.current_match = potential_match
                            
                            # Notify all players in tournament about the update
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
                            
                            # Start the match
                            await self.start_tournament_match(tournament, tournament.current_match)
            
            # Client disconnect notification - graceful exit
            elif msg_type == "client_disconnect":
                logger.info(f"Client requested disconnect: {self.channel_name}")
                # No additional action needed, disconnect handler will clean up
            
            # Get initial state after reconnect
            elif msg_type == "get_state":
                # Send waiting list
                await self.send(text_data=json.dumps({
                    "type": "waiting_list",
                    "waiting_list": [
                        {"nickname": p["nickname"], "rounds": p["rounds"]}
                        for p in waiting_players
                    ]
                }))
                
                # Send tournament list
                await self.broadcast_tournament_list()
                
                # If player is in a tournament, send tournament state
                if self.channel_name in tournament_players:
                    tournament_id = tournament_players[self.channel_name]
                    if tournament_id in active_tournaments:
                        tournament = active_tournaments[tournament_id]
                        await self.send(text_data=json.dumps({
                            "type": "tournament_update",
                            "tournament": tournament.get_state()
                        }))
                
                # If player is in a game, need to reconnect them
                game = game_manager.get_game_for_player(self.channel_name)
                if game:
                    # Re-add to game group
                    await self.channel_layer.group_add(game.room_id, self.channel_name)
                    
                    # Send current game state
                    await self.send(text_data=json.dumps({
                        "type": "game_state_update",
                        "state": game.get_state()
                    }))
        
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            # Add traceback for better debugging
            import traceback
            logger.error(traceback.format_exc())

    #----------------
    # Tournament Methods
    #----------------
    
    async def handle_create_tournament(self, data):
        """Handle tournament creation request"""
        global active_tournaments, tournament_players
        
        nickname = data.get("nickname")
        tournament_name = data.get("name", f"{nickname}'s Tournament")
        rounds = data.get("rounds", 3)
        size = data.get("size", 8)
        
        # Validate tournament size
        if size not in [4, 6, 8]:
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": "Tournament size must be 4, 6, or 8 players"
            }))
            return
            
        logger.info(f"Creating tournament: {tournament_name} by {nickname} with {size} players")
        
        # Create new tournament
        tournament_id = str(uuid.uuid4())
        tournament = Tournament(tournament_id, self.channel_name, tournament_name, size)
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
        
        # Record tournament metrics
        TOURNAMENT_CREATED.inc()

    async def handle_join_tournament(self, data):
        """Handle tournament join request"""
        global active_tournaments, tournament_players
        
        tournament_id = data.get("tournament_id")
        nickname = data.get("nickname")
        
        logger.info(f"Player {nickname} attempting to join tournament {tournament_id}")
        
        if tournament_id not in active_tournaments:
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": "Tournament not found"
            }))
            return
            
        tournament = active_tournaments[tournament_id]
        
        # Don't allow joining started tournaments
        if tournament.started:
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": "Cannot join: Tournament has already started"
            }))
            return
        
        # Add player to tournament
        if not tournament.add_player(self.channel_name, nickname):
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": "Cannot join tournament. It might be full or nickname is already taken."
            }))
            return
        
        # Track which tournament this player is in
        tournament_players[self.channel_name] = tournament_id
        
        logger.info(f"Player {nickname} joined tournament {tournament_id}")
        
        # Update tournament metrics
        TOURNAMENT_PLAYERS.observe(len(tournament.players))
        
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

    async def handle_start_tournament(self, data):
        """Handle tournament start request"""
        global active_tournaments, tournament_players
        
        tournament_id = data.get("tournament_id")
        
        logger.info(f"Request to start tournament {tournament_id}")
        
        if tournament_id not in active_tournaments:
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": "Tournament not found"
            }))
            return
            
        tournament = active_tournaments[tournament_id]
        
        # Only creator can start tournament
        if self.channel_name != tournament.creator_channel:
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": "Only the tournament creator can start the tournament"
            }))
            return
        
        # Start the tournament
        if not tournament.start_tournament():
            # Check specific error conditions
            player_count = len(tournament.players)
            
            if player_count < 4:
                message = "Cannot start: Need at least 4 players"
            elif player_count not in [4, 6, 8]:
                message = "Cannot start: Tournament requires 4, 6, or 8 players"
            elif player_count % 2 != 0:
                message = "Cannot start: Need an even number of players"
            else:
                message = "Cannot start tournament"
            
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": message
            }))
            return
        
        logger.info(f"Tournament {tournament_id} started successfully")
        
        # Notify all players
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
            await self.start_tournament_match(tournament, tournament.current_match)
        
        # Broadcast updated tournament list
        await self.broadcast_tournament_list()

    async def handle_leave_tournament(self):
        """Handle player leaving a tournament"""
        global active_tournaments, tournament_players
        
        if self.channel_name not in tournament_players:
            await self.send(text_data=json.dumps({
                "type": "tournament_error",
                "message": "You are not in a tournament"
            }))
            return
            
        tournament_id = tournament_players[self.channel_name]
        
        logger.info(f"Player leaving tournament {tournament_id}")
        
        if tournament_id not in active_tournaments:
            # Clean up tracking even if tournament doesn't exist
            del tournament_players[self.channel_name]
            await self.send(text_data=json.dumps({
                "type": "tournament_left",
                "message": "You have left the tournament"
            }))
            return
            
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

    async def handle_tournament_game_over(self, winner_channel):
        """Handle completion of a tournament game"""
        global active_tournaments, tournament_players
        
        if winner_channel not in tournament_players:
            return False
            
        tournament_id = tournament_players[winner_channel]
        tournament = active_tournaments.get(tournament_id)
        
        if not tournament or not tournament.current_match:
            return False
        
        logger.info(f"Tournament match completed in tournament {tournament_id}")
        
        # Record match result
        result = tournament.record_match_result(winner_channel)
        if not result:
            return False
            
        logger.info(f"Match result recorded, winner: {result['winner']}")
        
        # Send result notifications
        
        # Notify winner
        await self.channel_layer.send(
            result["winner_channel"],
            {
                "type": "tournament_match_result",
                "won": True,
                "opponent": result["loser"],
                "tournament_complete": result["tournament_complete"]
            }
        )
        
        # Notify loser - show tournament elimination
        await self.channel_layer.send(
            result["loser_channel"],
            {
                "type": "tournament_eliminated",
                "winner": result["winner"]
            }
        )
        
        # If tournament is complete, notify all players
        if result["tournament_complete"]:
            # Get all players in the tournament
            for player in tournament.players:
                # Skip winner (already notified)
                if player["channel"] == result["winner_channel"]:
                    # Send tournament victory notification
                    await self.channel_layer.send(
                        player["channel"],
                        {
                            "type": "tournament_victory"
                        }
                    )
                    continue
                    
                # Notify everyone else about the winner
                await self.channel_layer.send(
                    player["channel"],
                    {
                        "type": "tournament_complete",
                        "winner": result["winner"]
                    }
                )
        
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
        
        # If there's a next match, start it
        if tournament.current_match:
            await self.start_tournament_match(tournament, tournament.current_match)
        
        return True

    async def start_tournament_match(self, tournament, match):
        """Start a match within a tournament"""
        player1_channel = match["player1_channel"]
        player2_channel = match["player2_channel"]
        player1_nickname = match["player1"]
        player2_nickname = match["player2"]
        
        logger.info(f"Starting tournament match: {player1_nickname} vs {player2_nickname}")
        
        # Create a new game room for this match
        tourney_game_room = "tourney_game_" + str(uuid.uuid4())
        
        # Create server-side game
        game = game_manager.create_game(tourney_game_room, target_rounds=tournament.rounds)

        
        # Add players to the game
        game_manager.add_player_to_game(tourney_game_room, player1_channel, "left")
        game_manager.add_player_to_game(tourney_game_room, player2_channel, "right")
        
        logger.info(f"Added players to tournament game: left={player1_channel}, right={player2_channel}")
        
        # Add to channel group
        await self.channel_layer.group_add(tourney_game_room, player1_channel)
        await self.channel_layer.group_add(tourney_game_room, player2_channel)
        
        # Store room mapping
        active_games[player1_channel] = tourney_game_room
        active_games[player2_channel] = tourney_game_room
        
        # Start the game with a small delay to ensure players are ready
        await asyncio.sleep(0.5)
        success = game_manager.start_game(tourney_game_room)
        if not success:
            logger.error(f"Failed to start tournament game: {tourney_game_room}")
            return
        logger.info(f"Tournament game started: {success}")
        # Set up state sync loop for this game
        asyncio.create_task(self.game_sync_loop(tourney_game_room))
        
        # Start game for both players
        match_message = f"Tournament match: {player1_nickname} vs {player2_nickname}"
        
        await self.channel_layer.send(
            player1_channel,
            {
                "type": "start_game",
                "message": match_message,
                "room": tourney_game_room,
                "rounds": tournament.rounds,
                "is_tournament": True,
                "player_side": "left"
            }
        )
        
        # Add small delay between messages to prevent race conditions
        await asyncio.sleep(0.1)
        
        await self.channel_layer.send(
            player2_channel,
            {
                "type": "start_game",
                "message": match_message,
                "room": tourney_game_room,
                "rounds": tournament.rounds,
                "is_tournament": True,
                "player_side": "right"
            }
        )

    async def broadcast_tournament_list(self):
        """Broadcast the current tournament list to all clients in lobby"""
        # Build list of active tournaments
        tournament_list = [
            {
                "id": t_id,
                "name": tournament.name,
                "players": len(tournament.players),
                "size": tournament.size,
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

    async def broadcast_waiting_list(self):
        """Broadcast waiting list to all clients in lobby"""
        waiting_list = [{"nickname": p["nickname"], "rounds": p["rounds"]} for p in waiting_players]
        logger.debug(f"Broadcasting waiting list: {len(waiting_list)} players")
        
        try:
            await self.channel_layer.group_send("lobby", {
                "type": "waiting_list_update",
                "waiting_list": waiting_list
            })
        except Exception as e:
            logger.error(f"Error broadcasting waiting list: {e}")

    async def waiting_list_update(self, event):
        """Send waiting list update to connected client"""
        waiting_list = event.get("waiting_list", [])
        logger.debug(f"Sending waiting list update: {len(waiting_list)} players")
        
        await self.send(text_data=json.dumps({
            "type": "waiting_list",
            "waiting_list": waiting_list
        }))
    
    async def tournament_match_result(self, event):
        """Send tournament match result to client"""
        await self.send(text_data=json.dumps({
            "type": "tournament_match_result",
            "won": event.get("won", False),
            "opponent": event.get("opponent"),
            "tournament_complete": event.get("tournament_complete", False)
        }))
    
    async def tournament_eliminated(self, event):
        """Send tournament elimination notification to client"""
        await self.send(text_data=json.dumps({
            "type": "tournament_eliminated",
            "winner": event.get("winner")
        }))
    
    async def tournament_victory(self, event):
        """Send tournament victory notification to client"""
        await self.send(text_data=json.dumps({
            "type": "tournament_victory"
        }))
    
    async def tournament_complete(self, event):
        """Send tournament completion notification to client"""
        await self.send(text_data=json.dumps({
            "type": "tournament_complete",
            "winner": event.get("winner")
        }))
    
    async def tournament_list_update(self, event):
        """Send updated tournament list to client"""
        tournaments = event.get("tournaments", [])
        
        await self.send(text_data=json.dumps({
            "type": "tournament_list",
            "tournaments": tournaments
        }))
    
    async def tournament_update(self, event):
        """Distribute tournament update to connected client"""
        tournament = event.get("tournament")
        logger.debug(f"Sending tournament update for tournament {tournament['id'] if tournament else 'unknown'}")
        
        await self.send(text_data=json.dumps({
            "type": "tournament_update",
            "tournament": tournament
        }))
    
    async def tournament_left(self, event):
        """Notify client they left or were removed from a tournament"""
        message = event.get("message", "You have left the tournament")
        logger.debug(f"Sending tournament left message: {message}")
        
        await self.send(text_data=json.dumps({
            "type": "tournament_left",
            "message": message
        }))

    async def game_sync_loop(self, game_room):
        """Periodically send game state to clients"""
        
        logger.info(f"Starting game sync loop for room: {game_room}")
        
        try:
            # Track when we start the game sync
            start_time = time.time()
            sync_count = 0
            
            while True:
                # Get game instance
                game = game_manager.active_games.get(game_room)
                
                # Debug game instance lookup
                if not game:
                    logger.error(f"Game not found in game_manager.active_games for room: {game_room}")
                    # Check if the room exists in the global dictionary for additional debugging
                    is_in_global = game_room in [room for room in active_games.values()]
                    logger.error(f"Room {game_room} exists in global active_games: {is_in_global}")
                    break
                    
                if not game.is_running:
                    logger.info(f"Game in room {game_room} is no longer running")
                    # Check if game has a winner and notify players
                    if game.winner:
                        logger.info(f"Game in room {game_room} has winner: {game.winner}")
                        # Determine scores to send
                        if game.winner == "left":
                            winner_score = game.left_score
                            winner = "left"
                        else:
                            winner_score = game.right_score
                            winner = "right"
                        # Send game over notification
                        await self.channel_layer.group_send(
                            game_room,
                            {
                                "type": "broadcast_game_over",
                                "score": winner_score,
                                "winner": winner
                            }
                        )
                        logger.info(f"Game over notification sent for room {game_room}")
                    else:
                        logger.warning(f"Game in room {game_room} stopped without a winner")
                    break
                
                # Get current game state
                state = game.get_state()
                
                # Increment sync counter
                sync_count += 1
                
                # Log performance metrics occasionally
                if sync_count % 300 == 0:  # Log every ~5 seconds
                    elapsed = time.time() - start_time
                    fps = sync_count / elapsed
                    logger.debug(f"Game sync stats for room {game_room}: {sync_count} updates, {fps:.1f} FPS")
                
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
        except asyncio.CancelledError:
            logger.info(f"Game sync loop cancelled for room: {game_room}")
        except Exception as e:
            logger.error(f"Error in game sync loop for room {game_room}: {e}")
            # Add traceback for better debugging
            import traceback
            logger.error(traceback.format_exc())
        finally:
            logger.info(f"Game sync loop ended for room: {game_room}")
            
            # Record game duration if applicable
            if start_time:
                duration = time.time() - start_time
                logger.info(f"Game in room {game_room} ran for {duration:.2f} seconds")
                
                # If we have metrics integration, record the duration
                try:
                    # Assume 'classic' mode if not specified
                    GAME_DURATION.labels(mode='classic').observe(duration)
                except Exception as metrics_error:
                    # Don't let metrics recording failure affect the game
                    logger.warning(f"Failed to record game metrics: {metrics_error}")

    async def start_game(self, event):
        """Send start game event to client"""
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
        
    async def game_state_update(self, event):
        """Send game state update to client"""
        logger.debug(f"Sending game state update")
        await self.send(text_data=json.dumps({
            "type": "game_state_update",
            "state": event.get("state")
        }))

    async def broadcast_game_over(self, event):
        """Send game over notification to client"""
        await self.send(text_data=json.dumps({
            "type": "game_over",
            "score": event.get("score"),
            "winner": event.get("winner")
        }))
        
        game_mode = event.get("game_mode", "classic")
        GAME_COMPLETED.labels(mode=game_mode).inc()
        ACTIVE_PLAYERS.dec()

    async def opponent_left(self, event):
        """Send opponent left notification to client"""
        await self.send(text_data=json.dumps({
            "type": "opponent_left",
            "message": event.get("message")
        }))