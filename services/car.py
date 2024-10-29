import asyncio
import logging
import math
import os
import random
import time

import dotenv
from ably import AblyRealtime

dotenv.load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
log = logging.getLogger(__name__)

# Red Bull Ring track points
TRACK_POINTS = [
    {"x": 520, "y": 320},  # Start/Finish
    {"x": 600, "y": 320},  # T1
    {"x": 650, "y": 270},  # T2
    {"x": 650, "y": 200},  # T3
    {"x": 600, "y": 150},  # T4
    {"x": 500, "y": 150},  # T5
    {"x": 400, "y": 120},  # T6
    {"x": 300, "y": 90},   # T7
    {"x": 200, "y": 100},  # T8
    {"x": 150, "y": 170},  # T9
    {"x": 150, "y": 220},  # T10
    {"x": 200, "y": 270},  # Back straight
    {"x": 300, "y": 270},
    {"x": 350, "y": 320},
    {"x": 520, "y": 320},  # Complete lap
]

class RaceCarSimulator:
    def __init__(self, ably_client, car_id):
        self.car_id = car_id
        self.client = ably_client
        self.current_point_index = 0
        self.progress = 0.0  # Progress between current and next point (0-1)
        self.lap = 1
        
        # Initialize channels for different metrics
        self.channels = {
            'speed': self.client.channels.get(f"telemetry:{car_id}:speed"),
            'temp': self.client.channels.get(f"telemetry:{car_id}:temp"),
            'fuel': self.client.channels.get(f"telemetry:{car_id}:fuel"),
            'position': self.client.channels.get(f"telemetry:{car_id}:position")
        }

    def calculate_distance(self, p1, p2):
        return math.sqrt((p2["x"] - p1["x"]) ** 2 + (p2["y"] - p1["y"]) ** 2)

    def get_next_point_index(self):
        return (self.current_point_index + 1) % len(TRACK_POINTS)

    def calculate_speed(self, current_point_idx, progress):
        """Calculate speed based on track section and randomness"""
        # Base speed for different track sections
        section_speeds = {
            0: 310,  # Start/Finish straight
            1: 260,  # T1
            2: 240,  # T2
            3: 280,  # T3
            4: 250,  # T4
            5: 220,  # T5
            6: 200,  # T6
            7: 180,  # T7
            8: 190,  # T8
            9: 220,  # T9
            10: 240,  # T10
            11: 290,  # Back straight
        }

        base_speed = section_speeds.get(current_point_idx, 280)

        # Add braking and acceleration effects
        if progress < 0.3:  # Braking into corner
            speed = base_speed - (30 * (1 - progress))
        elif progress > 0.7:  # Accelerating out of corner
            speed = base_speed + (20 * (progress - 0.7))
        else:  # Mid corner
            speed = base_speed

        # Add some randomness
        variation = random.uniform(-10, 10)
        
        return speed + variation

    def calculate_engine_temp(self, speed):
        """Calculate engine temperature based on speed and random factors"""
        base_temp = 90  # Base engine temperature
        speed_effect = (speed - 200) / 10  # Higher speeds increase temperature
        random_variation = random.uniform(-5, 5)  # Random fluctuations
        return base_temp + speed_effect + random_variation

    def calculate_fuel_level(self):
        """Calculate remaining fuel based on lap and track position"""
        lap_consumption = 3  # Fuel consumed per lap
        position_consumption = (self.current_point_index / len(TRACK_POINTS)) * 3
        return max(0, 100 - (self.lap - 1) * lap_consumption - position_consumption)

    async def generate_telemetry(self):
        """Generate and publish telemetry data for all metrics"""
        try:
            while True:
                current_point = TRACK_POINTS[self.current_point_index]
                next_point = TRACK_POINTS[self.get_next_point_index()]

                # Calculate current position
                current_x = current_point["x"] + (next_point["x"] - current_point["x"]) * self.progress
                current_y = current_point["y"] + (next_point["y"] - current_point["y"]) * self.progress

                # Generate telemetry data
                timestamp = int(time.time() * 1000)
                speed = self.calculate_speed(self.current_point_index, self.progress)
                engine_temp = self.calculate_engine_temp(speed)
                fuel_level = self.calculate_fuel_level()

                # Publish metrics to separate channels
                telemetry_data = {
                    'speed': {
                        'timestamp': timestamp,
                        'speed': speed
                    },
                    'temp': {
                        'timestamp': timestamp,
                        'temp': engine_temp
                    },
                    'fuel': {
                        'timestamp': timestamp,
                        'fuel': fuel_level
                    },
                    'position': {
                        'timestamp': timestamp,
                        'position': {
                            'x': current_x,
                            'y': current_y
                        },
                        'trackPosition': (self.current_point_index + self.progress) / len(TRACK_POINTS) * 100,
                        'lap': self.lap
                    }
                }

                # Publish each metric
                publish_tasks = [
                    self.channels[channel].publish('update', data)
                    for channel, data in telemetry_data.items()
                ]
                await asyncio.gather(*publish_tasks)

                # Update position
                self.progress += 0.05
                if self.progress >= 1.0:
                    self.progress = 0.0
                    self.current_point_index = self.get_next_point_index()
                    if self.current_point_index == 0:
                        self.lap += 1
                        log.info(f"Car {self.car_id} completed lap {self.lap}")

                await asyncio.sleep(1)  # Update every second

        except asyncio.CancelledError:
            log.warning(f"Telemetry generation cancelled for car {self.car_id}")
            raise
        except Exception as e:
            log.error(f"Error generating telemetry for car {self.car_id}: {e}")
            raise

async def main():
    # Load Ably API key from environment
    ably_api_key = os.getenv("ABLY_API_KEY")
    if not ably_api_key:
        log.error("No Ably API key provided")
        return

    try:
        # Initialize Ably client
        ably_client = AblyRealtime(ably_api_key)
        simulator = RaceCarSimulator(ably_client, "car1")

        log.info(f"Starting telemetry simulation for {simulator.car_id}")
        await simulator.generate_telemetry()

    except KeyboardInterrupt:
        log.warning("\nSimulation stopped by user")
    except asyncio.CancelledError:
        log.warning("Async task canceled")
    except Exception as e:
        log.error(f"Simulation error: {e}")
    finally:
        # Clean up
        if 'ably_client' in locals():
            await ably_client.close()
            log.info("Ably client closed")

if __name__ == "__main__":
    asyncio.run(main())