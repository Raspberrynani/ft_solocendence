import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Global waiting list and mapping of channel_name to game room
waiting_players = []
active_games = {}  # Maps channel_name to game room

# Tournament tracking
active_tournaments = {}  # Maps tournament_id to Tournament object
tournament_players = {}  # Maps channel_name to tournament_id

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
            logger.debug(f"Received message type: {msg_type}")
            
            # Regular game matchmaking
            if msg_type == "join":
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
                    await self.channel_layer.group_add(game_room, self.channel_name)
                    await self.channel_layer.group_add(game_room, matching_player["channel"])
                    active_games[self.channel_name] = game_room
                    active_games[matching_player["channel"]] = game_room
                    game_message = f"Game starting between {matching_player['nickname']} and {nickname}"
                    await self.channel_layer.send(
                        matching_player["channel"],
                        {
                            "type": "start_game",
                            "message": game_message,
                            "room": game_room,
                            "rounds": rounds
                        }
                    )
                    await self.send(text_data=json.dumps({
                        "type": "start_game",
                        "message": game_message,
                        "room": game_room,
                        "rounds": rounds
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
    
            # Game updates from clients
            elif msg_type == "game_update":
                game_room = active_games.get(self.channel_name)
                if game_room:
                    await self.channel_layer.group_send(
                        game_room,
                        {
                            "type": "broadcast_game_update",
                            "data": data.get("data"),
                            "sender": self.channel_name
                        }
                    )
                    
            # Game over notifications
            elif msg_type == "game_over":
                game_room = active_games.get(self.channel_name)
                if game_room:
                    # Send game over to other players in this game
                    await self.channel_layer.group_send(
                        game_room,
                        {
                            "type": "broadcast_game_over",
                            "score": data.get("score")
                        }
                    )
                    
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
                                
                                # If there's a next match, start it
                                if tournament.current_match:
                                    player1 = tournament.current_match["player1"]
                                    player2 = tournament.current_match["player2"]
                                    
                                    logger.info(f"Starting next match: {player1['nickname']} vs {player2['nickname']}")
                                    
                                    # Create a new game room for this match
                                    tourney_game_room = "tourney_game_" + str(uuid.uuid4())
                                    
                                    # Add players to game room
                                    await self.channel_layer.group_add(tourney_game_room, player1["channel"])
                                    await self.channel_layer.group_add(tourney_game_room, player2["channel"])
                                    
                                    # Update active games
                                    active_games[player1["channel"]] = tourney_game_room
                                    active_games[player2["channel"]] = tourney_game_room
                                    
                                    # Start game for both players
                                    match_message = f"Tournament match: {player1['nickname']} vs {player2['nickname']}"
                                    
                                    await self.channel_layer.send(
                                        player1["channel"],
                                        {
                                            "type": "start_game",
                                            "message": match_message,
                                            "room": tourney_game_room,
                                            "rounds": tournament.rounds,
                                            "is_tournament": True
                                        }
                                    )
                                    
                                    await self.channel_layer.send(
                                        player2["channel"],
                                        {
                                            "type": "start_game",
                                            "message": match_message,
                                            "room": tourney_game_room,
                                            "rounds": tournament.rounds,
                                            "is_tournament": True
                                        }
                                    )
                    
            # Tournament commands
            elif msg_type == "create_tournament":
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
                                
                                # Add players to game room
                                await self.channel_layer.group_add(tourney_game_room, player1["channel"])
                                await self.channel_layer.group_add(tourney_game_room, player2["channel"])
                                
                                # Update active games
                                active_games[player1["channel"]] = tourney_game_room
                                active_games[player2["channel"]] = tourney_game_room
                                
                                # Start game for both players
                                match_message = f"Tournament match: {player1['nickname']} vs {player2['nickname']}"
                                
                                await self.channel_layer.send(
                                    player1["channel"],
                                    {
                                        "type": "start_game",
                                        "message": match_message,
                                        "room": tourney_game_room,
                                        "rounds": tournament.rounds,
                                        "is_tournament": True
                                    }
                                )
                                
                                await self.channel_layer.send(
                                    player2["channel"],
                                    {
                                        "type": "start_game",
                                        "message": match_message,
                                        "room": tourney_game_room,
                                        "rounds": tournament.rounds,
                                        "is_tournament": True
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
            "score": event.get("score")
        }))

    async def opponent_left(self, event):
        await self.send(text_data=json.dumps({
            "type": "opponent_left",
            "message": event.get("message")
        }))