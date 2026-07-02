from __future__ import annotations

import asyncio
import random
import time
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from models.emergency import LahoreEmergencyModel
from models.flood import LahoreFloodModel
from models.traffic import LahoreTrafficModel

PolicyType = Literal["flyover", "hospital", "drainage", "school", "park"]

ZONE_BASELINES: dict[str, dict[str, float | int | str | tuple[float, float]]] = {
    "gulberg": {
        "name": "Gulberg",
        "centroid": (31.5089, 74.3458),
        "traffic_score": 78,
        "flood_risk": 45,
        "emergency_minutes": 8.2,
    },
    "dha": {
        "name": "DHA",
        "centroid": (31.4697, 74.4085),
        "traffic_score": 55,
        "flood_risk": 20,
        "emergency_minutes": 12.1,
    },
    "model-town": {
        "name": "Model Town",
        "centroid": (31.4915, 74.3237),
        "traffic_score": 62,
        "flood_risk": 65,
        "emergency_minutes": 9.8,
    },
    "johar-town": {
        "name": "Johar Town",
        "centroid": (31.4623, 74.2728),
        "traffic_score": 48,
        "flood_risk": 40,
        "emergency_minutes": 18.4,
    },
    "walled-city": {
        "name": "Walled City",
        "centroid": (31.5788, 74.3214),
        "traffic_score": 88,
        "flood_risk": 82,
        "emergency_minutes": 6.1,
    },
    "cantt": {
        "name": "Cantt",
        "centroid": (31.5264, 74.3891),
        "traffic_score": 41,
        "flood_risk": 18,
        "emergency_minutes": 5.2,
    },
    "allama-iqbal-town": {
        "name": "Allama Iqbal Town",
        "centroid": (31.5030, 74.2891),
        "traffic_score": 67,
        "flood_risk": 55,
        "emergency_minutes": 11.3,
    },
    "faisal-town": {
        "name": "Faisal Town",
        "centroid": (31.5234, 74.2634),
        "traffic_score": 59,
        "flood_risk": 48,
        "emergency_minutes": 13.7,
    },
    "garden-town": {
        "name": "Garden Town",
        "centroid": (31.5167, 74.3289),
        "traffic_score": 71,
        "flood_risk": 42,
        "emergency_minutes": 7.9,
    },
    "township": {
        "name": "Township",
        "centroid": (31.5041, 74.2445),
        "traffic_score": 52,
        "flood_risk": 38,
        "emergency_minutes": 21.2,
    },
}

traffic_model = LahoreTrafficModel()
flood_model = LahoreFloodModel()
emergency_model = LahoreEmergencyModel()

app = FastAPI(
    title="UrbanIQ Simulation API",
    description="hackathon fastapi backend — lahore policy sims",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Location(BaseModel):
    lat: float
    lng: float


class SimulationParameters(BaseModel):
    lanes: int | None = None
    beds: int | None = None
    pipe_diameter: float | None = None


class SimulationRequest(BaseModel):
    policy_type: PolicyType
    location: Location
    budget_pkr: float = Field(gt=0)
    radius_km: float = Field(gt=0)
    parameters: SimulationParameters | None = None


class ZoneMetrics(BaseModel):
    traffic_score: float
    flood_risk: float
    emergency_minutes: float


class CityMetrics(ZoneMetrics):
    economic_score: float


class ZoneSimulationResult(BaseModel):
    zone_id: str
    zone_name: str
    polygon: dict
    before: ZoneMetrics
    after: ZoneMetrics


class SimulationResponse(BaseModel):
    simulation_id: str
    affected_zones: list[ZoneSimulationResult]
    city_totals: dict[str, CityMetrics]
    processing_time_ms: int


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "city": "Lahore"}


@app.post("/simulate", response_model=SimulationResponse)
async def simulate(request: SimulationRequest) -> SimulationResponse:
    started_at = time.perf_counter()
    delay_ms = random.randint(800, 1200)  # fake "compute" pause so UI spinner feels real

    location = request.location.model_dump()
    parameters = (request.parameters or SimulationParameters()).model_dump(
        exclude_none=True
    )

    traffic_task = asyncio.to_thread(
        traffic_model.simulate,
        request.policy_type,
        location,
        request.radius_km,
        parameters,
    )
    flood_task = asyncio.to_thread(
        flood_model.simulate,
        request.policy_type,
        location,
        request.radius_km,
        request.budget_pkr,
    )
    emergency_task = asyncio.to_thread(
        emergency_model.simulate,
        request.policy_type,
        location,
        request.radius_km,
    )
    delay_task = asyncio.sleep(delay_ms / 1000)

    traffic_deltas, flood_deltas, emergency_deltas, _ = await asyncio.gather(
        traffic_task,
        flood_task,
        emergency_task,
        delay_task,
    )

    affected_zones = build_zone_results(
        traffic_deltas,
        flood_deltas,
        emergency_deltas,
    )
    processing_time_ms = int((time.perf_counter() - started_at) * 1000)

    return SimulationResponse(
        simulation_id=str(uuid4()),
        affected_zones=affected_zones,
        city_totals=build_city_totals(affected_zones),
        processing_time_ms=processing_time_ms,
    )


def build_zone_results(
    traffic_deltas: dict[str, float],
    flood_deltas: dict[str, float],
    emergency_deltas: dict[str, float],
) -> list[ZoneSimulationResult]:
    results: list[ZoneSimulationResult] = []

    for zone_id, baseline in ZONE_BASELINES.items():
        traffic_before = float(baseline["traffic_score"])
        flood_before = float(baseline["flood_risk"])
        emergency_before = float(baseline["emergency_minutes"])
        zone_name = str(baseline["name"])
        centroid = baseline["centroid"]
        assert isinstance(centroid, tuple)

        before = ZoneMetrics(
            traffic_score=round(traffic_before, 1),
            flood_risk=round(flood_before, 1),
            emergency_minutes=round(emergency_before, 1),
        )
        after = ZoneMetrics(
            traffic_score=round(clamp(traffic_before + traffic_deltas.get(zone_id, 0), 0, 100), 1),
            flood_risk=round(clamp(flood_before + flood_deltas.get(zone_id, 0), 0, 100), 1),
            emergency_minutes=round(max(1, emergency_before + emergency_deltas.get(zone_id, 0)), 1),
        )

        results.append(
            ZoneSimulationResult(
                zone_id=zone_id,
                zone_name=zone_name,
                polygon=create_bounding_polygon(centroid[0], centroid[1]),
                before=before,
                after=after,
            )
        )

    return results


def build_city_totals(
    affected_zones: list[ZoneSimulationResult],
) -> dict[str, CityMetrics]:
    before_traffic = average([zone.before.traffic_score for zone in affected_zones])
    before_flood = average([zone.before.flood_risk for zone in affected_zones])
    before_emergency = average([zone.before.emergency_minutes for zone in affected_zones])
    after_traffic = average([zone.after.traffic_score for zone in affected_zones])
    after_flood = average([zone.after.flood_risk for zone in affected_zones])
    after_emergency = average([zone.after.emergency_minutes for zone in affected_zones])

    return {
        "before": CityMetrics(
            traffic_score=round(before_traffic, 1),
            flood_risk=round(before_flood, 1),
            emergency_minutes=round(before_emergency, 1),
            economic_score=economic_score(before_traffic, before_flood, before_emergency),
        ),
        "after": CityMetrics(
            traffic_score=round(after_traffic, 1),
            flood_risk=round(after_flood, 1),
            emergency_minutes=round(after_emergency, 1),
            economic_score=economic_score(after_traffic, after_flood, after_emergency),
        ),
    }


def create_bounding_polygon(lat: float, lng: float, delta: float = 0.02) -> dict:
    # ~2km box around centroid — good enough for deck.gl heatmap
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [lng - delta, lat - delta],
                [lng + delta, lat - delta],
                [lng + delta, lat + delta],
                [lng - delta, lat + delta],
                [lng - delta, lat - delta],
            ]
        ],
    }


def average(values: list[float]) -> float:
    return sum(values) / max(len(values), 1)


def economic_score(
    traffic_score: float,
    flood_risk: float,
    emergency_minutes: float,
) -> float:
    # weights from whiteboard scribble — traffic hurts most
    return round(clamp(100 - traffic_score * 0.35 - flood_risk * 0.25 - emergency_minutes * 1.2, 0, 100), 1)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
