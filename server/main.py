from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Set, Optional
import json
import random
import asyncio
from dataclasses import dataclass, asdict
from datetime import datetime
import math
import uuid
import time

# Game configuration constants
WORLD_SIZE = 11000
GRID_SIZE = 50
PELLET_COUNT = 1500
PELLET_RADIUS = 5

# Virus constants
VIRUS_COUNT = 30
VIRUS_MASS = 100
VIRUS_COLOR = "#00ff00"
VIRUS_SPIKE_COUNT = 24
VIRUS_EXPLODE_THRESHOLD = 133
VIRUS_EXPLODE_SPEED = 250
VIRUS_FEED_MASS = 15
VIRUS_FEEDS_TO_SPLIT = 7
VIRUS_PROJECTILE_SPEED = 350
VIRUS_PROJECTILE_RANGE = 350

# Ejection constants
EJECT_THRESHOLD = 35
EJECT_LOSS = 18
EJECT_MASS_GAIN = 13  # Math.floor(18 * 0.72)
EJECT_RANGE = 320
EJECT_SPEED = 350

# Split constants
SPLIT_THRESHOLD = 32
SPLIT_SPEED = 400
SPLIT_FLIGHT_DURATION = 1000  # ms
MERGE_SPEED = 100

# Player constants
START_MASS = 25
DECAY_RATE = 0.002

@dataclass
class Player:
    id: str
    x: float
    y: float
    mass: float
    radius: float
    color: str
    
@dataclass
class PlayerSplit:
    id: int
    playerId: str
    x: float
    y: float
    vx: float
    vy: float
    mass: float
    born: int
    mergeDelay: float

@dataclass
class PlayerEjected:
    id: int
    playerId: str
    x: float
    y: float
    vx: float
    vy: float
    travelled: float
    mass: float

@dataclass
class Pellet:
    id: int
    x: float
    y: float
    mass: int
    color: str

@dataclass
class Virus:
    id: int
    x: float
    y: float
    mass: float
    feedCount: int
    lastFeedAngle: Optional[float] = None

@dataclass
class VirusProjectile:
    id: int
    x: float
    y: float
    vx: float
    vy: float
    travelled: float
    mass: float

class GameState:
    def __init__(self):
        self.pellets: Dict[int, Pellet] = {}
        self.viruses: Dict[int, Virus] = {}
        self.virus_projectiles: Dict[int, VirusProjectile] = {}
        self.players: Dict[str, Player] = {}
        self.player_splits: Dict[int, PlayerSplit] = {}
        self.player_ejected: Dict[int, PlayerEjected] = {}
        self.websocket_to_player: Dict[WebSocket, str] = {}
        self.next_pellet_id = 0
        self.next_virus_id = 0
        self.next_projectile_id = 0
        self.next_split_id = 0
        self.next_ejected_id = 0
        self.connected_clients: Set[WebSocket] = set()
        self._initialize_pellets()
        self._initialize_viruses()
    
    def _initialize_pellets(self):
        """Initialize pellets with random positions"""
        for _ in range(PELLET_COUNT):
            self._spawn_pellet()
    
    def _initialize_viruses(self):
        """Initialize viruses with random positions"""
        for _ in range(VIRUS_COUNT):
            self._spawn_virus()
    
    def _spawn_pellet(self):
        """Spawn a single pellet at a random position"""
        pellet_id = self.next_pellet_id
        self.next_pellet_id += 1
        
        pellet = Pellet(
            id=pellet_id,
            x=random.uniform(PELLET_RADIUS, WORLD_SIZE - PELLET_RADIUS),
            y=random.uniform(PELLET_RADIUS, WORLD_SIZE - PELLET_RADIUS),
            mass=random.randint(1, 5),
            color=f"hsl({random.randint(0, 360)},70%,60%)"
        )
        self.pellets[pellet_id] = pellet
        return pellet
    
    def _spawn_virus(self, existing_viruses: List[Virus] = None):
        """Spawn a single virus avoiding overlap"""
        if existing_viruses is None:
            existing_viruses = list(self.viruses.values())
        
        virus_radius = PELLET_RADIUS * math.sqrt(VIRUS_MASS)
        
        for _ in range(50):  # Max attempts
            x = random.uniform(virus_radius, WORLD_SIZE - virus_radius)
            y = random.uniform(virus_radius, WORLD_SIZE - virus_radius)
            
            # Check distance from other viruses
            valid = True
            for v in existing_viruses:
                if math.hypot(v.x - x, v.y - y) < virus_radius * 3:
                    valid = False
                    break
            
            if valid:
                virus_id = self.next_virus_id
                self.next_virus_id += 1
                
                virus = Virus(
                    id=virus_id,
                    x=x,
                    y=y,
                    mass=VIRUS_MASS,
                    feedCount=0
                )
                self.viruses[virus_id] = virus
                return virus
        
        # Fallback if no valid position found
        virus_id = self.next_virus_id
        self.next_virus_id += 1
        x = random.uniform(virus_radius, WORLD_SIZE - virus_radius)
        y = random.uniform(virus_radius, WORLD_SIZE - virus_radius)
        
        virus = Virus(
            id=virus_id,
            x=x,
            y=y,
            mass=VIRUS_MASS,
            feedCount=0
        )
        self.viruses[virus_id] = virus
        return virus
    
    def create_player(self, websocket: WebSocket):
        """Create a new player"""
        player_id = str(uuid.uuid4())
        player = Player(
            id=player_id,
            x=random.uniform(100, WORLD_SIZE - 100),
            y=random.uniform(100, WORLD_SIZE - 100),
            mass=START_MASS,
            radius=PELLET_RADIUS * math.sqrt(START_MASS),
            color=f"hsl({random.randint(0, 360)},70%,60%)"
        )
        self.players[player_id] = player
        self.websocket_to_player[websocket] = player_id
        return player
    
    def remove_player(self, websocket: WebSocket):
        """Remove a player and their splits/ejected mass"""
        if websocket in self.websocket_to_player:
            player_id = self.websocket_to_player[websocket]
            
            # Remove player
            if player_id in self.players:
                del self.players[player_id]
            
            # Remove player's splits
            splits_to_remove = [id for id, split in self.player_splits.items() if split.playerId == player_id]
            for split_id in splits_to_remove:
                del self.player_splits[split_id]
            
            # Remove player's ejected mass
            ejected_to_remove = [id for id, ej in self.player_ejected.items() if ej.playerId == player_id]
            for ej_id in ejected_to_remove:
                del self.player_ejected[ej_id]
            
            del self.websocket_to_player[websocket]
    
    def get_game_config(self):
        """Get the game configuration"""
        return {
            "worldSize": WORLD_SIZE,
            "gridSize": GRID_SIZE,
            "pelletCount": PELLET_COUNT,
            "pelletRadius": PELLET_RADIUS,
            "virusCount": VIRUS_COUNT,
            "virusMass": VIRUS_MASS,
            "virusColor": VIRUS_COLOR,
            "virusSpikeCount": VIRUS_SPIKE_COUNT,
            "virusExplodeThreshold": VIRUS_EXPLODE_THRESHOLD,
            "virusExplodeSpeed": VIRUS_EXPLODE_SPEED,
            "virusFeedMass": VIRUS_FEED_MASS,
            "virusFeedsToSplit": VIRUS_FEEDS_TO_SPLIT,
            "virusProjectileSpeed": VIRUS_PROJECTILE_SPEED,
            "virusProjectileRange": VIRUS_PROJECTILE_RANGE,
            "ejectThreshold": EJECT_THRESHOLD,
            "ejectLoss": EJECT_LOSS,
            "ejectMassGain": EJECT_MASS_GAIN,
            "ejectRange": EJECT_RANGE,
            "ejectSpeed": EJECT_SPEED,
            "splitThreshold": SPLIT_THRESHOLD,
            "splitSpeed": SPLIT_SPEED,
            "splitFlightDuration": SPLIT_FLIGHT_DURATION,
            "mergeSpeed": MERGE_SPEED,
            "startMass": START_MASS,
            "decayRate": DECAY_RATE
        }
    
    def get_all_pellets(self):
        """Get all pellets as a list"""
        return [asdict(pellet) for pellet in self.pellets.values()]
    
    def get_all_viruses(self):
        """Get all viruses as a list"""
        return [asdict(virus) for virus in self.viruses.values()]
    
    def get_all_virus_projectiles(self):
        """Get all virus projectiles as a list"""
        return [asdict(proj) for proj in self.virus_projectiles.values()]
    
    def get_all_players(self):
        """Get all players except the requesting player"""
        return [asdict(player) for player in self.players.values()]
    
    def get_all_player_splits(self):
        """Get all player splits"""
        return [asdict(split) for split in self.player_splits.values()]
    
    def get_all_player_ejected(self):
        """Get all player ejected mass"""
        return [asdict(ej) for ej in self.player_ejected.values()]
    
    def update_player(self, player_id: str, x: float, y: float, mass: float, radius: float, color: str = None):
        """Update player position and mass"""
        if player_id in self.players:
            player = self.players[player_id]
            player.x = x
            player.y = y
            player.mass = mass
            player.radius = radius
            if color:
                player.color = color
    
    def update_player_splits(self, player_id: str, splits_data: List[dict]):
        """Update player's splits"""
        # Remove old splits for this player
        splits_to_remove = [id for id, split in self.player_splits.items() if split.playerId == player_id]
        for split_id in splits_to_remove:
            del self.player_splits[split_id]
        
        # Add new splits
        for split_data in splits_data:
            split_id = self.next_split_id
            self.next_split_id += 1
            
            split = PlayerSplit(
                id=split_id,
                playerId=player_id,
                x=split_data['x'],
                y=split_data['y'],
                vx=split_data.get('vx', 0),
                vy=split_data.get('vy', 0),
                mass=split_data['mass'],
                born=split_data.get('born', 0),
                mergeDelay=split_data.get('mergeDelay', 0)
            )
            self.player_splits[split_id] = split
    
    def update_player_ejected(self, player_id: str, ejected_data: List[dict]):
        """Update player's ejected mass"""
        # Remove old ejected for this player
        ejected_to_remove = [id for id, ej in self.player_ejected.items() if ej.playerId == player_id]
        for ej_id in ejected_to_remove:
            del self.player_ejected[ej_id]
        
        # Add new ejected
        for ej_data in ejected_data:
            ej_id = self.next_ejected_id
            self.next_ejected_id += 1
            
            ejected = PlayerEjected(
                id=ej_id,
                playerId=player_id,
                x=ej_data['x'],
                y=ej_data['y'],
                vx=ej_data.get('vx', 0),
                vy=ej_data.get('vy', 0),
                travelled=ej_data.get('travelled', 0),
                mass=ej_data['mass']
            )
            self.player_ejected[ej_id] = ejected
    
    def consume_pellet(self, pellet_id: int):
        """Remove a pellet and spawn a new one"""
        if pellet_id in self.pellets:
            del self.pellets[pellet_id]
            # Spawn a new pellet to maintain count
            new_pellet = self._spawn_pellet()
            return {
                "consumed": pellet_id,
                "spawned": asdict(new_pellet)
            }
        return None
    
    def feed_virus(self, virus_id: int, feed_angle: float):
        """Feed a virus, potentially causing it to split"""
        if virus_id not in self.viruses:
            return None
        
        virus = self.viruses[virus_id]
        virus.lastFeedAngle = feed_angle
        virus.feedCount += 1
        virus.mass += VIRUS_FEED_MASS
        
        result = {"virusId": virus_id, "newMass": virus.mass}
        
        # Check if virus should split
        if virus.feedCount >= VIRUS_FEEDS_TO_SPLIT:
            # Create projectile
            projectile_id = self.next_projectile_id
            self.next_projectile_id += 1
            
            vx = math.cos(feed_angle) * VIRUS_PROJECTILE_SPEED
            vy = math.sin(feed_angle) * VIRUS_PROJECTILE_SPEED
            
            projectile = VirusProjectile(
                id=projectile_id,
                x=virus.x,
                y=virus.y,
                vx=vx,
                vy=vy,
                travelled=0,
                mass=VIRUS_MASS
            )
            self.virus_projectiles[projectile_id] = projectile
            
            # Reset virus
            virus.mass = VIRUS_MASS
            virus.feedCount = 0
            virus.lastFeedAngle = None
            
            result["projectileSpawned"] = asdict(projectile)
        
        return result
    
    def consume_virus(self, virus_id: int):
        """Remove a virus and spawn a new one"""
        if virus_id in self.viruses:
            del self.viruses[virus_id]
            # Spawn a new virus to maintain count
            new_virus = self._spawn_virus()
            return {
                "consumed": virus_id,
                "spawned": asdict(new_virus)
            }
        return None
    
    async def update_virus_projectiles(self, dt: float):
        """Update virus projectile positions"""
        updates = []
        to_remove = []
        
        for proj_id, proj in self.virus_projectiles.items():
            # Update position
            mvx = proj.vx * dt
            mvy = proj.vy * dt
            proj.x += mvx
            proj.y += mvy
            proj.travelled += math.hypot(mvx, mvy)
            
            # Check if projectile should convert to virus
            proj_radius = PELLET_RADIUS * math.sqrt(proj.mass)
            
            if (proj.travelled >= VIRUS_PROJECTILE_RANGE or
                proj.x <= proj_radius or proj.x >= WORLD_SIZE - proj_radius or
                proj.y <= proj_radius or proj.y >= WORLD_SIZE - proj_radius):
                
                # Convert to virus
                new_virus = self._spawn_virus()
                new_virus.x = max(proj_radius, min(WORLD_SIZE - proj_radius, proj.x))
                new_virus.y = max(proj_radius, min(WORLD_SIZE - proj_radius, proj.y))
                
                to_remove.append(proj_id)
                updates.append({
                    "type": "projectile_to_virus",
                    "projectileId": proj_id,
                    "virus": asdict(new_virus)
                })
            else:
                updates.append({
                    "type": "projectile_update",
                    "projectile": asdict(proj)
                })
        
        # Remove converted projectiles
        for proj_id in to_remove:
            del self.virus_projectiles[proj_id]
        
        return updates

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your client URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Global game state
game_state = GameState()

# Background task for updating projectiles
async def projectile_update_loop():
    """Background task to update virus projectiles"""
    last_update = asyncio.get_event_loop().time()
    
    while True:
        await asyncio.sleep(1/60)  # 60 FPS update rate
        current_time = asyncio.get_event_loop().time()
        dt = current_time - last_update
        last_update = current_time
        
        updates = await game_state.update_virus_projectiles(dt)
        
        if updates and game_state.connected_clients:
            message = {
                "type": "projectile_updates",
                "updates": updates
            }
            
            # Broadcast to all clients
            disconnected = set()
            for client in game_state.connected_clients:
                try:
                    await client.send_json(message)
                except:
                    disconnected.add(client)
            
            # Remove disconnected clients
            game_state.connected_clients -= disconnected

@app.on_event("startup")
async def startup_event():
    """Start the projectile update loop"""
    asyncio.create_task(projectile_update_loop())

@app.get("/")
async def root():
    return {"message": "Agario Server Running"}

@app.get("/api/game/config")
async def get_game_config():
    """Get game configuration including world size, grid size, etc."""
    return game_state.get_game_config()

@app.get("/api/game/pellets")
async def get_pellets():
    """Get all current pellets"""
    return {
        "pellets": game_state.get_all_pellets()
    }

@app.get("/api/game/viruses")
async def get_viruses():
    """Get all current viruses and projectiles"""
    return {
        "viruses": game_state.get_all_viruses(),
        "projectiles": game_state.get_all_virus_projectiles()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print(f"WebSocket connection attempt from {websocket.client}")
    await websocket.accept()
    print(f"WebSocket connection accepted for {websocket.client}")
    game_state.connected_clients.add(websocket)
    
    # Create player for this connection
    player = game_state.create_player(websocket)
    player_id = player.id
    
    try:
        # Send initial game state with player ID
        initial_data = {
            "type": "init",
            "playerId": player_id,
            "config": game_state.get_game_config(),
            "pellets": game_state.get_all_pellets(),
            "viruses": game_state.get_all_viruses(),
            "virusProjectiles": game_state.get_all_virus_projectiles(),
            "players": [asdict(p) for p in game_state.players.values() if p.id != player_id],
            "playerSplits": game_state.get_all_player_splits(),
            "playerEjected": game_state.get_all_player_ejected()
        }
        await websocket.send_json(initial_data)
        print(f"Sent initial data to player {player_id}")
        
        # Notify other players about new player
        new_player_message = {
            "type": "player_joined",
            "player": asdict(player)
        }
        for client in game_state.connected_clients:
            if client != websocket:
                try:
                    await client.send_json(new_player_message)
                except:
                    pass
        
        # Handle messages from client
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "player_update":
                # Update player state
                game_state.update_player(
                    player_id,
                    data["x"],
                    data["y"],
                    data["mass"],
                    data["radius"],
                    data.get("color")
                )
                
                # Update splits
                if "splits" in data:
                    game_state.update_player_splits(player_id, data["splits"])
                
                # Update ejected
                if "ejected" in data:
                    game_state.update_player_ejected(player_id, data["ejected"])
                
                # Get the player's color for the broadcast
                player_color = game_state.players[player_id].color if player_id in game_state.players else "#999999"
                
                # Broadcast to other players
                update_message = {
                    "type": "player_update",
                    "playerId": player_id,
                    "x": data["x"],
                    "y": data["y"],
                    "mass": data["mass"],
                    "radius": data["radius"],
                    "color": player_color,
                    "splits": game_state.get_all_player_splits(),
                    "ejected": game_state.get_all_player_ejected()
                }
                
                for client in game_state.connected_clients:
                    if client != websocket:
                        try:
                            await client.send_json(update_message)
                        except:
                            pass
            
            elif data["type"] == "consume_pellet":
                pellet_id = data["pelletId"]
                result = game_state.consume_pellet(pellet_id)
                
                if result:
                    # Broadcast pellet update to all connected clients
                    update_message = {
                        "type": "pellet_update",
                        "consumed": result["consumed"],
                        "spawned": result["spawned"]
                    }
                    
                    for client in game_state.connected_clients:
                        try:
                            await client.send_json(update_message)
                        except:
                            pass
            
            elif data["type"] == "feed_virus":
                virus_id = data["virusId"]
                feed_angle = data["angle"]
                result = game_state.feed_virus(virus_id, feed_angle)
                
                if result:
                    # Broadcast virus update to all connected clients
                    update_message = {
                        "type": "virus_feed",
                        **result
                    }
                    
                    for client in game_state.connected_clients:
                        try:
                            await client.send_json(update_message)
                        except:
                            pass
            
            elif data["type"] == "consume_virus":
                virus_id = data["virusId"]
                result = game_state.consume_virus(virus_id)
                
                if result:
                    # Broadcast virus update to all connected clients
                    update_message = {
                        "type": "virus_update",
                        "consumed": result["consumed"],
                        "spawned": result["spawned"]
                    }
                    
                    for client in game_state.connected_clients:
                        try:
                            await client.send_json(update_message)
                        except:
                            pass
    
    except WebSocketDisconnect:
        print(f"Player {player_id} disconnected")
        game_state.connected_clients.remove(websocket)
        game_state.remove_player(websocket)
        
        # Notify other players about disconnection
        disconnect_message = {
            "type": "player_left",
            "playerId": player_id
        }
        for client in game_state.connected_clients:
            try:
                await client.send_json(disconnect_message)
            except:
                pass
    except Exception as e:
        print(f"WebSocket error for player {player_id}: {e}")
        if websocket in game_state.connected_clients:
            game_state.connected_clients.remove(websocket)
            game_state.remove_player(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)