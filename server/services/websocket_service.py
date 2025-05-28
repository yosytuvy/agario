# server/services/websocket_service.py
"""WebSocket connection management and message handling."""

import asyncio
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from dataclasses import asdict
from .game_service import GameService
from config.settings import get_game_config, UPDATE_RATE


class WebSocketService:
    """Manages WebSocket connections and message routing."""

    def __init__(self, game_service: GameService):
        self.game_service = game_service
        self.connected_clients: Set[WebSocket] = set()
        self.websocket_to_player: Dict[WebSocket, str] = {}
        self._update_task = None

    def start_background_tasks(self):
        """Start background tasks like projectile updates."""
        if not self._update_task:
            self._update_task = asyncio.create_task(self._projectile_update_loop())

    async def _projectile_update_loop(self):
        """Background task to update virus projectiles."""
        last_update = asyncio.get_event_loop().time()

        while True:
            await asyncio.sleep(1 / UPDATE_RATE)
            current_time = asyncio.get_event_loop().time()
            dt = current_time - last_update
            last_update = current_time

            updates = await self.game_service.update_virus_projectiles(dt)

            if updates and self.connected_clients:
                message = {"type": "projectile_updates", "updates": updates}
                await self._broadcast_message(message)

    async def handle_connection(self, websocket: WebSocket):
        """Handle a new WebSocket connection."""
        print(f"WebSocket connection attempt from {websocket.client}")
        await websocket.accept()
        print(f"WebSocket connection accepted for {websocket.client}")

        self.connected_clients.add(websocket)

        # Create player for this connection
        player = self.game_service.create_player()
        self.websocket_to_player[websocket] = player.id

        try:
            # Send initial game state
            await self._send_initial_state(websocket, player.id)

            # Notify other players about new player
            await self._broadcast_player_joined(player, exclude=websocket)

            # Handle messages from client
            await self._handle_client_messages(websocket, player.id)

        except WebSocketDisconnect:
            await self._handle_disconnect(websocket, player.id)
        except Exception as e:
            print(f"WebSocket error for player {player.id}: {e}")
            await self._handle_disconnect(websocket, player.id)

    async def _send_initial_state(self, websocket: WebSocket, player_id: str):
        """Send initial game state to a newly connected player."""
        initial_data = {
            "type": "init",
            "playerId": player_id,
            "config": get_game_config(),
            "pellets": self.game_service.get_all_pellets(),
            "viruses": self.game_service.get_all_viruses(),
            "virusProjectiles": self.game_service.get_all_virus_projectiles(),
            "players": [
                p for p in self.game_service.get_all_players() if p["id"] != player_id
            ],
            "playerSplits": self.game_service.get_all_player_splits(),
            "playerEjected": self.game_service.get_all_player_ejected(),
        }
        await websocket.send_json(initial_data)
        print(f"Sent initial data to player {player_id}")

    async def _broadcast_player_joined(self, player, exclude: WebSocket = None):
        """Broadcast that a new player joined."""
        message = {"type": "player_joined", "player": asdict(player)}
        await self._broadcast_message(message, exclude=exclude)

    async def _handle_client_messages(self, websocket: WebSocket, player_id: str):
        """Handle incoming messages from a client."""
        while True:
            data = await websocket.receive_json()
            await self._process_message(websocket, player_id, data)

    async def _process_message(self, websocket: WebSocket, player_id: str, data: dict):
        """Process a single message from a client."""
        message_type = data.get("type")

        if message_type == "player_update":
            await self._handle_player_update(websocket, player_id, data)
        elif message_type == "consume_pellet":
            await self._handle_consume_pellet(data)
        elif message_type == "feed_virus":
            await self._handle_feed_virus(data)
        elif message_type == "consume_virus":
            await self._handle_consume_virus(data)
        elif message_type == "consume_player":
            await self._handle_consume_player(player_id, data)
        elif message_type == "consume_other_ejected":
            await self._handle_consume_other_ejected(player_id, data)

    async def _handle_player_update(
        self, websocket: WebSocket, player_id: str, data: dict
    ):
        """Handle player position/state update."""
        # Update player state
        self.game_service.update_player(
            player_id,
            data["x"],
            data["y"],
            data["mass"],
            data["radius"],
            data.get("color"),
        )

        # Update splits and ejected mass
        if "splits" in data:
            self.game_service.update_player_splits(player_id, data["splits"])

        if "ejected" in data:
            self.game_service.update_player_ejected(player_id, data["ejected"])

        # Broadcast to other players
        player = self.game_service.players.get(player_id)
        if player:
            update_message = {
                "type": "player_update",
                "playerId": player_id,
                "x": data["x"],
                "y": data["y"],
                "mass": data["mass"],
                "radius": data["radius"],
                "color": player.color,
                "splits": self.game_service.get_all_player_splits(),
                "ejected": self.game_service.get_all_player_ejected(),
            }
            await self._broadcast_message(update_message, exclude=websocket)

    async def _handle_consume_pellet(self, data: dict):
        """Handle pellet consumption."""
        pellet_id = data["pelletId"]
        result = self.game_service.consume_pellet(pellet_id)

        if result:
            message = {"type": "pellet_update", **result}
            await self._broadcast_message(message)

    async def _handle_feed_virus(self, data: dict):
        """Handle virus feeding."""
        virus_id = data["virusId"]
        feed_angle = data["angle"]
        result = self.game_service.feed_virus(virus_id, feed_angle)

        if result:
            message = {"type": "virus_feed", **result}
            await self._broadcast_message(message)

    async def _handle_consume_virus(self, data: dict):
        """Handle virus consumption."""
        virus_id = data["virusId"]
        result = self.game_service.consume_virus(virus_id)

        if result:
            message = {"type": "virus_update", **result}
            await self._broadcast_message(message)

    async def _handle_consume_player(self, player_id: str, data: dict):
        """Handle player consumption."""
        result = self.game_service.consume_player(
            player_id,
            data["targetId"],
            data["targetType"],
            data.get("consumingEntityType", "player"),
            data.get("consumingEntityIndex", -1),
            data.get("consumingEntity"),
        )

        if result:
            message = {"type": "player_consumed", **result}
            await self._broadcast_message(message)

    async def _handle_consume_other_ejected(self, player_id: str, data: dict):
        """Handle consumption of other players' ejected mass."""
        result = self.game_service.consume_other_ejected(
            player_id,
            data["ejectedId"],
            data.get("consumingEntityType", "player"),
            data.get("consumingEntityIndex", -1),
            data.get("consumingEntity"),
        )

        if result:
            message = {"type": "other_ejected_consumed", **result}
            await self._broadcast_message(message)

    async def _handle_disconnect(self, websocket: WebSocket, player_id: str):
        """Handle client disconnection."""
        print(f"Player {player_id} disconnected")

        # Clean up
        if websocket in self.connected_clients:
            self.connected_clients.remove(websocket)
        if websocket in self.websocket_to_player:
            del self.websocket_to_player[websocket]

        self.game_service.remove_player(player_id)

        # Notify other players
        disconnect_message = {"type": "player_left", "playerId": player_id}
        await self._broadcast_message(disconnect_message)

    async def _broadcast_message(self, message: dict, exclude: WebSocket = None):
        """Broadcast a message to all connected clients."""
        disconnected = set()

        for client in self.connected_clients:
            if client == exclude:
                continue

            try:
                await client.send_json(message)
            except:
                disconnected.add(client)

        # Clean up disconnected clients
        self.connected_clients -= disconnected
        for client in disconnected:
            if client in self.websocket_to_player:
                player_id = self.websocket_to_player[client]
                del self.websocket_to_player[client]
                self.game_service.remove_player(player_id)
