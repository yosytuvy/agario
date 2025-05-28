# server/config/settings.py
"""Game configuration constants and settings."""

# World settings
WORLD_SIZE = 11000
GRID_SIZE = 50

# Pellet settings
PELLET_COUNT = 1500
PELLET_RADIUS = 5

# Virus settings
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

# Ejection settings
EJECT_THRESHOLD = 35
EJECT_LOSS = 18
EJECT_MASS_GAIN = 13  # Math.floor(18 * 0.72)
EJECT_RANGE = 320
EJECT_SPEED = 350

# Split settings
SPLIT_THRESHOLD = 32
SPLIT_SPEED = 400
SPLIT_FLIGHT_DURATION = 1000  # ms
MERGE_SPEED = 100

# Player settings
START_MASS = 25
DECAY_RATE = 0.002

# Server settings
UPDATE_RATE = 60  # FPS for projectile updates
WEBSOCKET_UPDATE_INTERVAL = 50  # ms


def get_game_config():
    """Get the complete game configuration as a dictionary."""
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
        "decayRate": DECAY_RATE,
    }
