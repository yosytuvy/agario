# server/main.py
"""Main entry point for the Agario server."""

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from services.game_service import GameService
from services.websocket_service import WebSocketService
from api.routes import GameAPI


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Agario Server",
        description="Real-time multiplayer Agar.io clone server",
        version="1.0.0",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # In production, specify your client URL
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    return app


# Initialize services
game_service = GameService()
websocket_service = WebSocketService(game_service)
game_api = GameAPI(game_service)

# Create FastAPI app
app = create_app()

# Include API routes
app.include_router(game_api.router)


@app.on_event("startup")
async def startup_event():
    """Initialize background tasks on startup."""
    print("Starting Agario server...")
    websocket_service.start_background_tasks()
    print("Server startup complete!")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    print("Shutting down Agario server...")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time game communication."""
    await websocket_service.handle_connection(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
