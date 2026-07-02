'use client';

import {
  CameraFlyTo,
  Entity,
  Viewer,
  type CesiumComponentRef,
} from 'resium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cartesian3,
  Color,
  HeightReference,
  Ion,
  Math as CesiumMath,
  Cartesian2,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  type TerrainProvider,
} from 'cesium';
import type {
  BuildingFeature,
  GeoJSONPolygonGeometry,
  SimulationResponse,
} from '@/types';

if (typeof window !== 'undefined') {
  window.CESIUM_BASE_URL = '/cesium';
}

const ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_TOKEN ?? '';
if (ION_TOKEN) {
  Ion.defaultAccessToken = ION_TOKEN;
}

const LAHORE_CENTER = { lng: 74.3587, lat: 31.5204 };

export interface CesiumMapProps {
  buildings: BuildingFeature[];
  simulationResult: SimulationResponse | null;
  cameraFlyKey?: number;
  onReady?: () => void;
}

function getPolygonCentroid(polygon: GeoJSONPolygonGeometry): [number, number] {
  const ring =
    polygon.type === 'Polygon'
      ? polygon.coordinates[0]
      : polygon.coordinates[0][0];
  const points =
    ring.length > 1 ? ring.slice(0, -1) : ring;
  const [lngTotal, latTotal] = points.reduce(
    ([lngSum, latSum], [lng, lat]) => [lngSum + lng, latSum + lat],
    [0, 0],
  );
  return [lngTotal / points.length, latTotal / points.length];
}

function getMostAffectedZone(simulationResult: SimulationResponse) {
  return simulationResult.affected_zones.reduce((mostAffected, zone) => {
    const trafficDelta = Math.abs(
      zone.after.traffic_score - zone.before.traffic_score,
    );
    const floodDelta = Math.abs(zone.after.flood_risk - zone.before.flood_risk);
    const emergencyDelta =
      Math.abs(zone.after.emergency_minutes - zone.before.emergency_minutes) *
      5; // emergency minutes weighted heavier, hackathon tuning
    const impact = trafficDelta + floodDelta + emergencyDelta;

    if (!mostAffected) return zone;

    const currentTrafficDelta = Math.abs(
      mostAffected.after.traffic_score - mostAffected.before.traffic_score,
    );
    const currentFloodDelta = Math.abs(
      mostAffected.after.flood_risk - mostAffected.before.flood_risk,
    );
    const currentEmergencyDelta =
      Math.abs(
        mostAffected.after.emergency_minutes -
          mostAffected.before.emergency_minutes,
      ) * 5;
    const currentImpact =
      currentTrafficDelta + currentFloodDelta + currentEmergencyDelta;

    return impact > currentImpact ? zone : mostAffected;
  }, simulationResult.affected_zones[0]);
}

export function CesiumMap({
  buildings,
  simulationResult,
  cameraFlyKey = 0,
  onReady,
}: CesiumMapProps) {
  const viewerRef = useRef<CesiumComponentRef<import('cesium').Viewer>>(null);
  const osmAddedRef = useRef(false);
  const [terrainProvider, setTerrainProvider] = useState<TerrainProvider | null>(
    null,
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createWorldTerrainAsync()
      .then((terrain) => {
        if (!cancelled) setTerrainProvider(terrain);
      })
      .catch((error) => {
        console.error('[CesiumMap] terrain failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!terrainProvider || osmAddedRef.current) return;

    let cancelled = false;

    const setupBuildings = async () => {
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer || cancelled) return;

      try {
        const osmBuildings = await createOsmBuildingsAsync();
        if (!cancelled) {
          viewer.scene.primitives.add(osmBuildings);
          osmAddedRef.current = true;
          onReady?.();
          console.log('cesium osm buildings loaded');
        }
      } catch (error) {
        console.error('[CesiumMap] OSM buildings load failed:', error);
      }
    };

    const frame = requestAnimationFrame(() => {
      void setupBuildings();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [terrainProvider, onReady]);

  const cameraFlight = useMemo(() => {
    if (simulationResult?.affected_zones.length) {
      const zoneTmp = getMostAffectedZone(simulationResult);
      const [lng, lat] = getPolygonCentroid(zoneTmp.polygon);

      return {
        destination: Cartesian3.fromDegrees(lng, lat, 3000), // 3km altitude feels right for zone view
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-45),
          roll: 0,
        },
        duration: 2,
      };
    }

    return {
      destination: Cartesian3.fromDegrees(
        LAHORE_CENTER.lng,
        LAHORE_CENTER.lat,
        8000,
      ),
      duration: 2,
    };
  }, [simulationResult]);

  const hospitals = buildings.filter((building) => building.category === 'hospital');
  const schools = buildings.filter((building) => building.category === 'school');

  return (
    <Viewer
      ref={viewerRef}
      full
      terrainProvider={terrainProvider ?? undefined}
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      homeButton={false}
      geocoder={false}
      sceneModePicker={false}
      infoBox={false}
      selectionIndicator={false}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <CameraFlyTo key={cameraFlyKey} {...cameraFlight} once={false} />

      {hospitals.map((building) => (
        <Entity
          key={building.id}
          name={building.name ?? building.type}
          polygon={{
            hierarchy: Cartesian3.fromDegreesArray(
              building.polygon.flatMap(([lng, lat]) => [lng, lat]),
            ),
            height: 0,
            extrudedHeight: building.height,
            material: Color.fromCssColorString('var(--alert-danger)').withAlpha(0.85),
            outline: true,
            outlineColor: Color.WHITE.withAlpha(0.5),
            outlineWidth: 1,
          }}
          label={{
            text: building.name ?? building.type,
            show: hoveredNodeId === building.id,
            font: '12px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: 0,
            pixelOffset: new Cartesian2(0, -18),
            heightReference: HeightReference.CLAMP_TO_GROUND,
          }}
          onMouseEnter={() => setHoveredNodeId(building.id)}
          onMouseLeave={() =>
            setHoveredNodeId((current) =>
              current === building.id ? null : current,
            )
          }
        />
      ))}

      {schools.map((building) => (
        <Entity
          key={building.id}
          name={building.name ?? building.type}
          polygon={{
            hierarchy: Cartesian3.fromDegreesArray(
              building.polygon.flatMap(([lng, lat]) => [lng, lat]),
            ),
            height: 0,
            extrudedHeight: building.height,
            material: Color.fromCssColorString('#3b82f6').withAlpha(0.85),
            outline: true,
            outlineColor: Color.WHITE.withAlpha(0.5),
            outlineWidth: 1,
          }}
          label={{
            text: building.name ?? building.type,
            show: hoveredNodeId === building.id,
            font: '12px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: 0,
            pixelOffset: new Cartesian2(0, -18),
            heightReference: HeightReference.CLAMP_TO_GROUND,
          }}
          onMouseEnter={() => setHoveredNodeId(building.id)}
          onMouseLeave={() =>
            setHoveredNodeId((current) =>
              current === building.id ? null : current,
            )
          }
        />
      ))}
    </Viewer>
  );
}
