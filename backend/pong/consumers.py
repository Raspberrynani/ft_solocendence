import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer

# Global waiting list and mapping of channel_name to game room
waiting_players = []
active_games = {}  # Maps channel_name to game room

class PongConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        # Add every connecting client to a common lobby group
        await self.channel_layer.group_add("lobby", self.channel_name)
        print(f"WebSocket connected: {self.channel_name}")

    async def disconnect(self, close_code):
        global waiting_players, active_games
        waiting_players[:] = [p for p in waiting_players if p["channel"] != self.channel_name]
        # Broadcast updated waiting list
        await self.broadcast_waiting_list()
        game_room = active_games.get(self.channel_name)
        if game_room:
            await self.channel_layer.group_discard(game_room, self.channel_name)
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
        await self.channel_layer.group_discard("lobby", self.channel_name)
        print(f"WebSocket disconnected: {self.channel_name}")

    async def receive(self, text_data):
        global waiting_players, active_games
        data = json.loads(text_data)
        msg_type = data.get("type")

        if msg_type == "join":
            nickname = data.get("nickname")
            token = data.get("token")
            rounds = data.get("rounds")
            print(f"Player {nickname} joined with token: {token} and rounds: {rounds}")

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
        elif msg_type == "game_over":
            game_room = active_games.get(self.channel_name)
            if game_room:
                await self.channel_layer.group_send(
                    game_room,
                    {
                        "type": "broadcast_game_over",
                        "score": data.get("score")
                    }
                )

    async def broadcast_waiting_list(self):
        # Build a simplified waiting list (nickname and rounds only)
        waiting_list = [{"nickname": p["nickname"], "rounds": p["rounds"]} for p in waiting_players]
        await self.channel_layer.group_send("lobby", {
            "type": "waiting_list_update",
            "waiting_list": waiting_list
        })

    async def waiting_list_update(self, event):
        waiting_list = event.get("waiting_list")
        await self.send(text_data=json.dumps({
            "type": "waiting_list",
            "waiting_list": waiting_list
        }))

    async def start_game(self, event):
        await self.send(text_data=json.dumps({
            "type": "start_game",
            "message": event.get("message"),
            "room": event.get("room"),
            "rounds": event.get("rounds")
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
