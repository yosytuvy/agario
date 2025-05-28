# server/api/routes.py
"""API routes for the game server."""

from fastapi import APIRouter
from services.game_service import GameService
from config.settings import get_game_config


class GameAPI:
    """API routes for game-related endpoints."""

    def __init__(self, game_service: GameService):
        self.game_service = game_service
        self.router = APIRouter()
        self._setup_routes()

    def _setup_routes(self):
        """Set up all API routes."""

        @self.router.get("/")
        async def root():
            """Root endpoint."""
            return {"message": "Agario Server Running"}

        @self.router.get("/api/game/config")
        async def get_game_config_endpoint():
            """Get game configuration including world size, grid size, etc."""
            return get_game_config()

        @self.router.get("/api/game/pellets")
        async def get_pellets():
            """Get all current pellets."""
            return {"pellets": self.game_service.get_all_pellets()}

        @self.router.get("/api/game/viruses")
        async def get_viruses():
            """Get all current viruses and projectiles."""
            return {
                "viruses": self.game_service.get_all_viruses(),
                "projectiles": self.game_service.get_all_virus_projectiles(),
            }

        @self.router.get("/api/game/players")
        async def get_players():
            """Get all current players."""
            return {
                "players": self.game_service.get_all_players(),
                "splits": self.game_service.get_all_player_splits(),
                "ejected": self.game_service.get_all_player_ejected(),
            }

        @self.router.get("/api/game/stats")
        async def get_game_stats():
            """Get game statistics."""
            return {
                "totalPlayers": len(self.game_service.players),
                "totalPellets": len(self.game_service.pellets),
                "totalViruses": len(self.game_service.viruses),
                "totalProjectiles": len(self.game_service.virus_projectiles),
                "totalSplits": len(self.game_service.player_splits),
                "totalEjected": len(self.game_service.player_ejected),
            }
