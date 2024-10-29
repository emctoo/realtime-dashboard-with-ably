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


# Red Bull Ring track points from TrackView.vue
TRACK_POINTS = [
    {"x": 520, "y": 320},  # Start/Finish
    {"x": 600, "y": 320},  # T1
    {"x": 650, "y": 270},  # T2
    {"x": 650, "y": 200},  # T3
    {"x": 600, "y": 150},  # T4
    {"x": 500, "y": 150},  # T5
    {"x": 400, "y": 120},  # T6
    {"x": 300, "y": 90},  # T7
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
        self.current_point_index = 0
        self.progress = 0.0  # Progress between current and next point (0-1)
        self.lap = 1
        self.channel = ably_client.channels.get(f"telemetry:{car_id}")

    def calculate_distance(self, p1, p2):
        return math.sqrt((p2["x"] - p1["x"]) ** 2 + (p2["y"] - p1["y"]) ** 2)

    def get_next_point_index(self):
        return (self.current_point_index + 1) % len(TRACK_POINTS)

    def calculate_speed(self, current_point_idx, progress):
        """Calculate speed based on track section and randomness"""
        base_speed = 280  # Base speed in km/h

        # Speed variations for different track sections
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

        target_speed = section_speeds.get(current_point_idx, base_speed)

        # Add some randomness
        variation = random.uniform(-10, 10)

        # Simulate braking and acceleration
        if progress < 0.3:  # Braking into corner
            speed = target_speed - (30 * (1 - progress))
        elif progress > 0.7:  # Accelerating out of corner
            speed = target_speed + (20 * (progress - 0.7))
        else:  # Mid corner
            speed = target_speed

        return speed + variation

    async def generate_telemetry(self):
        """Generate and publish telemetry data"""
        while True:
            current_point = TRACK_POINTS[self.current_point_index]
            next_point = TRACK_POINTS[self.get_next_point_index()]

            # Calculate current position
            current_x = (
                current_point["x"]
                + (next_point["x"] - current_point["x"]) * self.progress
            )
            current_y = (
                current_point["y"]
                + (next_point["y"] - current_point["y"]) * self.progress
            )

            # Generate telemetry data
            speed = self.calculate_speed(self.current_point_index, self.progress)
            engine_temp = 90 + random.uniform(-5, 5) + (speed - 200) / 10
            fuel_level = max(
                0,
                100
                - (self.lap - 1) * 3
                - (self.current_point_index / len(TRACK_POINTS)) * 3,
            )

            telemetry_data = {
                "timestamp": int(time.time() * 1000),
                "position": {"x": current_x, "y": current_y},
                "speed": speed,
                "temp": engine_temp,
                "fuel": fuel_level,
                "lap": self.lap,
                "trackPosition": (self.current_point_index + self.progress)
                / len(TRACK_POINTS)
                * 100,
            }

            # Publish to Ably
            await self.channel.publish("update", telemetry_data)

            # Update position
            self.progress += 0.05
            if self.progress >= 1.0:
                self.progress = 0.0
                self.current_point_index = self.get_next_point_index()
                if self.current_point_index == 0:
                    self.lap += 1

            # Wait before next update
            await asyncio.sleep(1)  # 100ms update rate


async def main():
    ably_api_key = os.getenv("ABLY_API_KEY")
    if not ably_api_key:
        log.error("No Ably API key provided")
        return

    ably_client = AblyRealtime(ably_api_key)
    simulator = RaceCarSimulator(ably_client, "car1")

    try:
        log.info("Starting telemetry simulation for %s", simulator.car_id)
        await simulator.generate_telemetry()
    except KeyboardInterrupt:
        log.warning("\r\nsimulation stopped by user")
    except asyncio.CancelledError:
        print("\ruser interrupting ...")
        log.warning("async task canceled")
    finally:
        await ably_client.close()
        log.info("ably client closed")


if __name__ == "__main__":
    asyncio.run(main())
