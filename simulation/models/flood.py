from __future__ import annotations

import math

ZoneDelta = dict[str, float]

ZONE_DATA: dict[str, dict[str, float | str | tuple[float, float]]] = {
    "gulberg": {
        "name": "Gulberg",
        "centroid": (31.5089, 74.3458),
        "base_risk": 45,
        "drainage_capacity": 0.62,
        "elevation": 214,
        "area_sqkm": 18.5,
    },
    "dha": {
        "name": "DHA",
        "centroid": (31.4697, 74.4085),
        "base_risk": 20,
        "drainage_capacity": 0.82,
        "elevation": 219,
        "area_sqkm": 64.0,
    },
    "model-town": {
        "name": "Model Town",
        "centroid": (31.4915, 74.3237),
        "base_risk": 65,
        "drainage_capacity": 0.48,
        "elevation": 211,
        "area_sqkm": 14.2,
    },
    "johar-town": {
        "name": "Johar Town",
        "centroid": (31.4623, 74.2728),
        "base_risk": 40,
        "drainage_capacity": 0.66,
        "elevation": 216,
        "area_sqkm": 29.5,
    },
    "walled-city": {
        "name": "Walled City",
        "centroid": (31.5788, 74.3214),
        "base_risk": 82,
        "drainage_capacity": 0.35,
        "elevation": 208,
        "area_sqkm": 2.6,
    },
    "cantt": {
        "name": "Cantt",
        "centroid": (31.5264, 74.3891),
        "base_risk": 18,
        "drainage_capacity": 0.86,
        "elevation": 220,
        "area_sqkm": 42.0,
    },
    "allama-iqbal-town": {
        "name": "Allama Iqbal Town",
        "centroid": (31.5030, 74.2891),
        "base_risk": 55,
        "drainage_capacity": 0.54,
        "elevation": 213,
        "area_sqkm": 31.0,
    },
    "faisal-town": {
        "name": "Faisal Town",
        "centroid": (31.5234, 74.2634),
        "base_risk": 48,
        "drainage_capacity": 0.58,
        "elevation": 212,
        "area_sqkm": 9.8,
    },
    "garden-town": {
        "name": "Garden Town",
        "centroid": (31.5167, 74.3289),
        "base_risk": 42,
        "drainage_capacity": 0.61,
        "elevation": 214,
        "area_sqkm": 6.4,
    },
    "township": {
        "name": "Township",
        "centroid": (31.5041, 74.2445),
        "base_risk": 38,
        "drainage_capacity": 0.64,
        "elevation": 215,
        "area_sqkm": 24.5,
    },
}


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


class LahoreFloodModel:
    def __init__(self) -> None:
        self.zones = ZONE_DATA

    def simulate(
        self,
        policy_type: str,
        location: dict[str, float],
        radius_km: float,
        budget_pkr: float,
    ) -> ZoneDelta:
        policy_location = (location["lat"], location["lng"])

        if policy_type == "flyover":
            return self._simulate_flyover(policy_location, radius_km)

        if policy_type == "drainage":
            return self._simulate_drainage(budget_pkr)

        if policy_type in {"hospital", "school", "park"}:
            return self._simulate_small_build(policy_location, radius_km)

        return {zone_id: 0.0 for zone_id in self.zones}

    def _simulate_flyover(
        self,
        policy_location: tuple[float, float],
        radius_km: float,
    ) -> ZoneDelta:
        deltas: ZoneDelta = {}
        impermeable_area_sqkm = radius_km * 0.15  # 0.15 from testing, tweak if numbers look off

        for zone_id, zone in self.zones.items():
            centroid = zone["centroid"]
            assert isinstance(centroid, tuple)
            base_risk = float(zone["base_risk"])
            area_sqkm = float(zone["area_sqkm"])
            distance = distance_km(policy_location, centroid)

            if distance <= radius_km:
                proximity = 1 - distance / max(radius_km, 0.1)
                impermeable_ratio = impermeable_area_sqkm / max(area_sqkm, 0.1)
                increase_pct = clamp(0.15 + proximity * 0.20 + impermeable_ratio, 0.15, 0.35)
                deltas[zone_id] = round(base_risk * increase_pct, 1)
            else:
                deltas[zone_id] = 0.0

        gulberg = self.zones["gulberg"]["centroid"]
        model_town = self.zones["model-town"]["centroid"]
        assert isinstance(gulberg, tuple)
        assert isinstance(model_town, tuple)
        if distance_km(policy_location, gulberg) <= max(radius_km, 1.5):
            downstream_increase = 0.10 + min(radius_km, 5) / 5 * 0.10
            model_town_base = float(self.zones["model-town"]["base_risk"])
            deltas["model-town"] = round(
                deltas.get("model-town", 0.0) + model_town_base * downstream_increase,
                1,
            )

        return deltas

    def _simulate_drainage(self, budget_pkr: float) -> ZoneDelta:
        budget_quality = clamp((budget_pkr - 1_000_000_000) / 5_000_000_000, 0, 1)  # 1B–6B PKR sweet spot
        reduction_pct = 0.35 + budget_quality * 0.10  # base 35% cut, up to 45% at max budget

        return {
            zone_id: round(-float(zone["base_risk"]) * reduction_pct, 1)
            for zone_id, zone in self.zones.items()
        }

    def _simulate_small_build(
        self,
        policy_location: tuple[float, float],
        radius_km: float,
    ) -> ZoneDelta:
        nearest_zone_id = min(
            self.zones,
            key=lambda zone_id: distance_km(
                policy_location,
                self.zones[zone_id]["centroid"],  # type: ignore[arg-type]
            ),
        )
        deltas = {zone_id: 0.0 for zone_id in self.zones}
        nearest_zone = self.zones[nearest_zone_id]
        nearest_centroid = nearest_zone["centroid"]
        assert isinstance(nearest_centroid, tuple)
        distance = distance_km(policy_location, nearest_centroid)

        if distance <= max(radius_km, 1):
            base_risk = float(nearest_zone["base_risk"])
            increase_pct = clamp(0.08 - distance * 0.015, 0.03, 0.08)
            deltas[nearest_zone_id] = round(base_risk * increase_pct, 1)

        return deltas
