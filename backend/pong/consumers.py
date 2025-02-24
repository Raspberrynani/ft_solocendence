import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer

# Global waiting list and mapping of channel_name to game room
waiting_players = []
active_games = {}  # channel_name -> game room name

class PongConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Accept connection without joining a default group.
        await self.accept()
        print(f"WebSocket connected: {self.channel_name}")

    async def disconnect(self, close_code):
        global waiting_players, active_games
        # Remove self from waiting list if present.
        waiting_players[:] = [p for p in waiting_players if p["channel"] != self.channel_name]
        # If part of an active game, remove and notify opponent.
        game_room = active_games.get(self.channel_name)
        if game_room:
            await self.channel_layer.group_discard(game_room, self.channel_name)
            # Notify opponent if any.
            for channel, room in list(active_games.items()):
                if room == game_room and channel != self.channel_name:
                    await self.channel_layer.send(
                        channel,
                        {
                            "type": "opponent_left",
                            "message": "Your opponent has disconnected."
                        }
                    )
                    del active_games[channel]
            if self.channel_name in active_games:
                del active_games[self.channel_name]
        print(f"WebSocket disconnected: {self.channel_name}")

    async def receive(self, text_data):
        global waiting_players, active_games
        data = json.loads(text_data)
        msg_type = data.get("type")

        if msg_type == "join":
            nickname = data.get("nickname")
            token = data.get("token")
            print(f"Player {nickname} joined with token: {token}")

            # Pair players if possible.
            if waiting_players:
                waiting_player = waiting_players.pop(0)
                game_room = "game_" + str(uuid.uuid4())
                # Add both players to the game room.
                await self.channel_layer.group_add(game_room, self.channel_name)
                await self.channel_layer.group_add(game_room, waiting_player["channel"])
                active_games[self.channel_name] = game_room
                active_games[waiting_player["channel"]] = game_room

                game_message = f"Game starting between {waiting_player['nickname']} and {nickname}"
                # Notify both players.
                await self.channel_layer.send(
                    waiting_player["channel"],
                    {
                        "type": "start_game",
                        "message": game_message,
                        "room": game_room
                    }
                )
                await self.send(text_data=json.dumps({
                    "type": "start_game",
                    "message": game_message,
                    "room": game_room
                }))
            else:
                # No waiting player – add to waiting list.
                waiting_players.append({
                    "channel": self.channel_name,
                    "nickname": nickname,
                    "token": token,
                })
                await self.send(text_data=json.dumps({
                    "type": "queue_update",
                    "message": "Waiting for a player..."
                }))

        elif msg_type == "game_update":
            # Broadcast game update (e.g., paddle position) to the opponent.
            game_room = active_games.get(self.channel_name)
            if game_room:
                await self.channel_layer.group_send(
                    game_room,
                    {
                        "type": "broadcast_game_update",
                        "data": data.get("data"),
                        "sender": self.channel_name,
                    }
                )

    async def start_game(self, event):
        await self.send(text_data=json.dumps({
            "type": "start_game",
            "message": event.get("message"),
            "room": event.get("room")
        }))

    async def broadcast_game_update(self, event):
        # Do not send update back to sender.
        if self.channel_name == event.get("sender"):
            return
        await self.send(text_data=json.dumps({
            "type": "game_update",
            "data": event.get("data")
        }))

    async def opponent_left(self, event):
        await self.send(text_data=json.dumps({
            "type": "opponent_left",
            "message": event.get("message")
        }))
