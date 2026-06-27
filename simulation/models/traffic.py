from __future__ import annotations

import math
from typing import Any

import networkx as nx

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

KEY_INTERSECTIONS: dict[str, tuple[float, float]] = {
    "kalma-chowk": (31.5089, 74.3458),
    "liberty-roundabout": (31.5167, 74.3412),
    "jail-road": (31.5234, 74.3289),
    "canal-road": (31.4923, 74.3891),
    "mm-alam-road": (31.5123, 74.3523),
    "ferozpur-road": (31.4812, 74.3178),
    "gt-road": (31.5678, 74.4123),
    "raiwind-road": (31.4234, 74.3234),
}

ADDITIONAL_NODES: dict[str, tuple[float, float]] = {
    "ichra": (31.5315, 74.3198),
    "muslim-town": (31.5075, 74.3019),
    "thokar-niaz-baig": (31.4665, 74.2398),
    "bhatti-gate": (31.5848, 74.3122),
    "mall-road": (31.5561, 74.3295),
    "shadman": (31.5412, 74.3315),
    "defence-mor": (31.4762, 74.3818),
    "barkat-market": (31.4972, 74.3185),
    "canal-bank": (31.5039, 74.3668),
    "akbar-chowk": (31.4721, 74.2965),
    "shahdara": (31.6234, 74.2861),
    "walled-city": (31.5788, 74.3214),
    "airport-road": (31.5208, 74.4056),
}

EDGE_DEFINITIONS = [
    ("kalma-chowk", "liberty-roundabout", 4200, 0.82, "Kalma-Liberty"),
    ("liberty-roundabout", "mm-alam-road", 3900, 0.71, "Liberty-MM Alam"),
    ("mm-alam-road", "canal-road", 3600, 0.64, "MM Alam-Canal"),
    ("kalma-chowk", "ferozpur-road", 5200, 0.86, "Kalma-Ferozpur"),
    ("ferozpur-road", "raiwind-road", 3400, 0.68, "Ferozpur-Raiwind"),
    ("kalma-chowk", "jail-road", 4100, 0.76, "Kalma-Jail"),
    ("jail-road", "mall-road", 3800, 0.73, "Jail-Mall"),
    ("mall-road", "walled-city", 3100, 0.88, "Mall-Walled City"),
    ("gt-road", "airport-road", 3700, 0.59, "GT-Airport"),
    ("canal-road", "airport-road", 4300, 0.57, "Canal-Airport"),
    ("canal-road", "defence-mor", 3900, 0.61, "Canal-Defence"),
    ("defence-mor", "ferozpur-road", 3300, 0.54, "Defence-Ferozpur"),
    ("jail-road", "ichra", 3600, 0.72, "Jail-Ichra"),
    ("ichra", "muslim-town", 3000, 0.67, "Ichra-Muslim Town"),
    ("muslim-town", "thokar-niaz-baig", 4100, 0.62, "Muslim Town-Thokar"),
    ("thokar-niaz-baig", "raiwind-road", 3500, 0.58, "Thokar-Raiwind"),
    ("walled-city", "shahdara", 2600, 0.81, "Walled City-Shahdara"),
    ("shadman", "jail-road", 3200, 0.66, "Shadman-Jail"),
    ("barkat-market", "kalma-chowk", 3600, 0.74, "Barkat-Kalma"),
    ("canal-bank", "canal-road", 3900, 0.55, "Canal Bank-Canal"),
    ("akbar-chowk", "thokar-niaz-baig", 3200, 0.63, "Akbar-Thokar"),
]

OD_PAIRS = [
    ("raiwind-road", "mall-road"),
    ("ferozpur-road", "gt-road"),
    ("defence-mor", "walled-city"),
    ("thokar-niaz-baig", "liberty-roundabout"),
    ("shahdara", "kalma-chowk"),
    ("airport-road", "ferozpur-road"),
    ("canal-road", "muslim-town"),
    ("barkat-market", "gt-road"),
    ("mm-alam-road", "raiwind-road"),
    ("ichra", "airport-road"),
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


class LahoreTrafficModel:
    def __init__(self) -> None:
        self.graph = nx.DiGraph()
        self._build_graph()

    def _build_graph(self) -> None:
        for node_id, coords in {**KEY_INTERSECTIONS, **ADDITIONAL_NODES}.items():
            self.graph.add_node(node_id, lat=coords[0], lng=coords[1])

        for source, target, capacity, current_load, name in EDGE_DEFINITIONS:
            self._add_corridor(source, target, capacity, current_load, name)

    def _add_corridor(
        self,
        source: str,
        target: str,
        capacity: int,
        current_load: float,
        name: str,
    ) -> None:
        source_coords = self._node_coords(source)
        target_coords = self._node_coords(target)
        length_km = distance_km(source_coords, target_coords)
        attrs = {
            "capacity": capacity,
            "current_load": current_load,
            "length_km": round(length_km, 2),
            "name": name,
            "weight": self._travel_time(length_km, current_load),
        }
        self.graph.add_edge(source, target, **attrs)
        self.graph.add_edge(target, source, **attrs)

    def _node_coords(self, node_id: str) -> tuple[float, float]:
        node = self.graph.nodes[node_id]
        return (node["lat"], node["lng"])

    @staticmethod
    def _travel_time(length_km: float, current_load: float) -> float:
        speed_kmh = 42 * (1 - current_load * 0.55)
        return length_km / max(speed_kmh, 8) * 60

    def _edge_midpoint(self, source: str, target: str) -> tuple[float, float]:
        source_lat, source_lng = self._node_coords(source)
        target_lat, target_lng = self._node_coords(target)
        return ((source_lat + target_lat) / 2, (source_lng + target_lng) / 2)

    def _average_travel_time(self, graph: nx.DiGraph) -> float:
        total = 0.0
        measured = 0
        for source, target in OD_PAIRS:
            try:
                total += nx.shortest_path_length(graph, source, target, weight="weight")
                measured += 1
            except nx.NetworkXNoPath:
                continue
        return total / max(measured, 1)

    def _nearby_edges(
        self,
        graph: nx.DiGraph,
        location: tuple[float, float],
        radius_km: float,
    ) -> list[tuple[str, str]]:
        nearby: list[tuple[str, str]] = []
        for source, target in graph.edges:
            midpoint = self._edge_midpoint(source, target)
            if distance_km(location, midpoint) <= radius_km:
                nearby.append((source, target))
        return nearby

    def simulate(
        self,
        policy_type: str,
        location: dict[str, float],
        radius_km: float,
        parameters: dict[str, Any] | None = None,
    ) -> ZoneDelta:
        parameters = parameters or {}
        policy_location = (location["lat"], location["lng"])

        if policy_type == "drainage":
            return {zone_id: 0.0 for zone_id in ZONE_CENTROIDS}

        if policy_type in {"hospital", "school", "park"}:
            return self._minor_construction_impact(policy_location, radius_km)

        if policy_type != "flyover":
            return {zone_id: 0.0 for zone_id in ZONE_CENTROIDS}

        graph = self.graph.copy()
        before_time = self._average_travel_time(graph)
        nearby_edges = self._nearby_edges(graph, policy_location, radius_km)
        lanes = float(parameters.get("lanes") or 4)
        capacity_multiplier = clamp(1.25 + lanes * 0.035, 1.25, 1.40)

        for source, target in nearby_edges:
            edge = graph[source][target]
            edge["capacity"] = int(edge["capacity"] * capacity_multiplier)
            edge["current_load"] = clamp(edge["current_load"] * 0.78, 0.20, 1.0)
            edge["weight"] = self._travel_time(edge["length_km"], edge["current_load"])

        if nearby_edges:
            congested_edges = sorted(
                nearby_edges,
                key=lambda edge_ids: graph[edge_ids[0]][edge_ids[1]]["current_load"],
                reverse=True,
            )[:2]
            bypass_nodes = {node_id for edge in congested_edges for node_id in edge}
            bypass_nodes = sorted(bypass_nodes)
            if len(bypass_nodes) >= 2:
                source, target = bypass_nodes[0], bypass_nodes[-1]
                length_km = distance_km(self._node_coords(source), self._node_coords(target))
                graph.add_edge(
                    source,
                    target,
                    capacity=5600,
                    current_load=0.34,
                    length_km=round(length_km, 2),
                    name="Proposed flyover bypass",
                    weight=self._travel_time(length_km, 0.34),
                )
                graph.add_edge(
                    target,
                    source,
                    capacity=5600,
                    current_load=0.34,
                    length_km=round(length_km, 2),
                    name="Proposed flyover bypass",
                    weight=self._travel_time(length_km, 0.34),
                )

        after_time = self._average_travel_time(graph)
        city_improvement = clamp((before_time - after_time) / max(before_time, 1), 0.02, 0.18)

        deltas: ZoneDelta = {}
        for zone_id, centroid in ZONE_CENTROIDS.items():
            distance = distance_km(policy_location, centroid)
            if distance <= radius_km:
                proximity = 1 - distance / max(radius_km, 0.1)
                deltas[zone_id] = round(clamp(-20 * city_improvement * (1 + proximity), -20, -3), 1)
            elif distance <= radius_km * 1.8:
                deltas[zone_id] = round(clamp(-5 * city_improvement, -5, -0.5), 1)
            else:
                deltas[zone_id] = round(clamp(1 + distance * 0.08, 0, 5), 1)

        return deltas

    def _minor_construction_impact(
        self,
        policy_location: tuple[float, float],
        radius_km: float,
    ) -> ZoneDelta:
        deltas: ZoneDelta = {}
        for zone_id, centroid in ZONE_CENTROIDS.items():
            distance = distance_km(policy_location, centroid)
            if distance <= max(radius_km, 1):
                deltas[zone_id] = round(clamp(3 - distance / max(radius_km, 1) * 2, 1, 3), 1)
            else:
                deltas[zone_id] = 0.0
        return deltas
