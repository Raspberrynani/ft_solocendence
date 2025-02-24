# pong/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer

class PongConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "pong_room"
        # Add this connection to the group 'pong_room'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        print(f"WebSocket connected: {self.channel_name}")

    async def disconnect(self, close_code):
        # Remove this connection from the group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print(f"WebSocket disconnected: {self.channel_name}")

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("type") == "join":
            nickname = data.get("nickname")
            print(f"Player {nickname} joined via channel {self.channel_name}")
            # For simplicity, immediately broadcast that the game should start.
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "start_game",
                    "message": "Game starting"
                }
            )

    async def start_game(self, event):
        # Send the start game message back to the client
        await self.send(text_data=json.dumps({
            "type": "start_game",
            "message": event["message"]
        }))
