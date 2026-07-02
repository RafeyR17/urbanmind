from __future__ import annotations

import math

ZoneDelta = dict[str, float]

ZONE_CENTROIDS: dict[str, tuple[float, float]] = {
    "gulberg": (31.5089, 74.3458),
    "dha": (31.4697, 74.4085),
    "model-town": (31.4915, 74.3237),
    "johar-town": (31.4623, 74.2728),
    "walled-city": (31.5788, 74.3214),
    "cantt": (31.5264, 74.3891),
    "allama-iqbal-town": (31.5030, 74.2891),
    "faisal-town": (31.5234, 74.2634),
    "garden-town": (31.5167, 74.3289),
    "township": (31.5041, 74.2445),
}

BASE_EMERGENCY_MINUTES: dict[str, float] = {
    "gulberg": 8.2,
    "dha": 12.1,
    "model-town": 9.8,
    "johar-town": 18.4,
    "walled-city": 6.1,
    "cantt": 5.2,
    "allama-iqbal-town": 11.3,
    "faisal-town": 13.7,
    "garden-town": 7.9,
    "township": 21.2,
}

MAJOR_HOSPITALS: list[tuple[str, tuple[float, float]]] = [
    ("Services Hospital", (31.5408, 74.3323)),
    ("Mayo Hospital", (31.5733, 74.3147)),
    ("Jinnah Hospital", (31.4825, 74.2936)),
    ("General Hospital", (31.5074, 74.3036)),
    ("Combined Military Hospital", (31.5352, 74.3869)),
]


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1 = a
    lat2, lng2 = b
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    hav = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(hav))


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


class LahoreEmergencyModel:
    def __init__(self) -> None:
        self.hospitals = MAJOR_HOSPITALS
        self.zone_centroids = ZONE_CENTROIDS

    def simulate(
        self,
        policy_type: str,
        location: dict[str, float],
        radius_km: float,
    ) -> ZoneDelta:
        policy_location = (location["lat"], location["lng"])

        if policy_type == "hospital":
            return self._simulate_new_hospital(policy_location)

        if policy_type == "flyover":
            return self._simulate_flyover(policy_location, radius_km)

        return {zone_id: 0.0 for zone_id in self.zone_centroids}

    def _nearest_hospital_minutes(
        self,
        zone_centroid: tuple[float, float],
        hospitals: list[tuple[str, tuple[float, float]]],
    ) -> float:
        nearest_distance = min(
            distance_km(zone_centroid, hospital_location)
            for _, hospital_location in hospitals
        )
        urban_speed_kmh = 28  # ambulances don't hit 60 in gulberg
        dispatch_buffer_minutes = 3.5  # call center + dispatch lag
        # rough drive time — not google maps accurate
        return nearest_distance / urban_speed_kmh * 60 + dispatch_buffer_minutes

    def _simulate_new_hospital(self, location: tuple[float, float]) -> ZoneDelta:
        hospitals_after = [*self.hospitals, ("Proposed Hospital", location)]
        deltas: ZoneDelta = {}

        for zone_id, centroid in self.zone_centroids.items():
            current_minutes = BASE_EMERGENCY_MINUTES[zone_id]
            modeled_after = self._nearest_hospital_minutes(centroid, hospitals_after)
            after_minutes = min(current_minutes, modeled_after)

            if zone_id in {"johar-town", "township", "faisal-town"}:
                after_minutes *= 0.88  # south lahore gets extra bump from new hospital

            deltas[zone_id] = round(clamp(after_minutes - current_minutes, -9.0, 0.0), 1)

        return deltas

    def _simulate_flyover(
        self,
        location: tuple[float, float],
        radius_km: float,
    ) -> ZoneDelta:
        deltas: ZoneDelta = {}

        for zone_id, centroid in self.zone_centroids.items():
            current_minutes = BASE_EMERGENCY_MINUTES[zone_id]
            distance = distance_km(location, centroid)

            if distance <= radius_km:
                proximity = 1 - distance / max(radius_km, 0.1)
                improvement_pct = 0.05 + proximity * 0.10
                deltas[zone_id] = round(-current_minutes * improvement_pct, 1)
            elif distance <= radius_km * 1.5:
                deltas[zone_id] = round(-current_minutes * 0.03, 1)
            else:
                deltas[zone_id] = 0.0

        return deltas
