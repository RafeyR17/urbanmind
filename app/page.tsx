'use client';

// leftover from zone layer refactor
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { DistrictZone } from '@/types';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Layer, PickingInfo } from '@deck.gl/core';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import SimulationModeBanner from '@/components/SimulationModeBanner';
import DemoMode, { setDemoCallbacks } from '@/components/DemoMode';
import type { SidebarTab } from '@/components/sidebar/PolicyStudio';
import type { WeatherTileLayer } from '@/lib/weather';
import {
  buildTrafficTrips,
  createBuildingLayer,
  createHeatmapLayer,
  createHospitalLayer,
  createPolicyShockwaveLayer,
  createPolicyStructureLayer,
  createProposedPolicyLayer,
  createSchoolLayer,
  createTrafficParticleLayer,
} from '@/components/map/layers';
import { LAHORE_CENTER } from '@/lib/lahoreData';
import { fetchBuildingsWithType, fetchRoads, getInitialBuildings, getInitialRoads } from '@/lib/overpass';
import { SCENARIO_CONFIGS, loadScenario, resolveScenarioId } from '@/lib/scenarios';
import {
  checkSimulationBackendHealth,
  isMockSimulation,
} from '@/lib/simulation';
import type {
  AppState,
  BuildingFeature,
  GeoJSONPolygonGeometry,
  GeoJSONPosition,
  Scenario,
  ZoneSimulationResult,
} from '@/types';
import type { DeckMapHandle } from '@/components/map';

const DEFAULT_APP_STATE: AppState = {
  current_policy: 'flyover',
  drawn_location: null,
  budget_pkr: 5000000000,
  radius_km: 3,
  simulation_status: 'idle',
  simulation_result: null,
  ai_recommendation: null,
  active_layers: ['buildings', 'hospitals', 'schools'],
  active_scenario: null,
};

interface BuildingTooltip {
  x: number;
  y: number;
  name: string;
  type: string;
  height: number;
}

// TODO: handle case where two zones tie on impact score
function getMostAffectedZone(zones: ZoneSimulationResult[]) {
  return zones.reduce<ZoneSimulationResult | null>((mostAffected, zone) => {
    const trafficDelta = Math.abs(
      zone.after.traffic_score - zone.before.traffic_score,
    );
    const floodDelta = Math.abs(zone.after.flood_risk - zone.before.flood_risk);
    const emergencyDelta =
      Math.abs(zone.after.emergency_minutes - zone.before.emergency_minutes) * 5; // weight emergencies heavier
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
  }, null);
}

function getFirstPolygonRing(polygon: GeoJSONPolygonGeometry): GeoJSONPosition[] {
  return polygon.type === 'Polygon'
    ? polygon.coordinates[0]
    : polygon.coordinates[0][0];
}

function getBuildingCentroid(polygon: number[][]): [number, number] {
  const points =
    polygon.length > 1 &&
    polygon[0][0] === polygon[polygon.length - 1][0] &&
    polygon[0][1] === polygon[polygon.length - 1][1]
      ? polygon.slice(0, -1)
      : polygon;
  const [lngTotal, latTotal] = points.reduce(
    ([lngSum, latSum], [lng, lat]) => [lngSum + lng, latSum + lat],
    [0, 0],
  );

  return [lngTotal / points.length, latTotal / points.length];
}

function getPolygonCentroid(polygon: GeoJSONPolygonGeometry): [number, number] {
  const ring = getFirstPolygonRing(polygon);
  const usablePoints = ring.slice(0, -1);
  const points = usablePoints.length > 0 ? usablePoints : ring;
  const [lngTotal, latTotal] = points.reduce(
    ([lngSum, latSum], [lng, lat]) => [lngSum + lng, latSum + lat],
    [0, 0],
  );

  return [lngTotal / points.length, latTotal / points.length];
}

function MapLoading() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: '100vw', height: '100vh', background: '#080e1c' }}
    >
      <p className="text-sm font-medium tracking-wide text-accent-warning">
        Loading UrbanIQ...
      </p>
    </div>
  );
}

const DeckMap = dynamic(
  () => import('@/components/map').then((module) => module.DeckMap),
  {
    ssr: false,
    loading: MapLoading,
  },
);

const ComparisonMap = dynamic(
  () => import('@/components/map').then((module) => module.ComparisonMap),
  { ssr: false },
);

export default function HomePage() {
  const deckMapRef = useRef<DeckMapHandle | null>(null);
  const animationRef = useRef<number>();
  const growthAnimRef = useRef<number | null>(null);
  const structureCameraFiredRef = useRef(false);
  const [structureGrowth, setStructureGrowth] = useState(0);
  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE);
  const [buildings, setBuildings] = useState<BuildingFeature[]>(getInitialBuildings);
  const [roads, setRoads] = useState(getInitialRoads);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [buildingTooltip, setBuildingTooltip] =
    useState<BuildingTooltip | null>(null);
  const [markerPulse, setMarkerPulse] = useState(0);
  const [hospitalPulse, setHospitalPulse] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [mapZoom, setMapZoom] = useState(13);
  const [activeTileLayer, setActiveTileLayer] =
    useState<WeatherTileLayer>('none');
  const [weatherWarning, setWeatherWarning] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('studio');
  const [demoRunning, setDemoRunning] = useState(false);

  const animate = useCallback(() => {
    setCurrentTime((t) => (t + 1) % 1800);
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const animateStructureGrowth = useCallback(() => {
    if (growthAnimRef.current !== null) {
      cancelAnimationFrame(growthAnimRef.current);
    }

    setStructureGrowth(0);
    const duration = 1100; // ms — tuned by eye, not science
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - t) ** 3;
      setStructureGrowth(eased);
      if (t < 1) {
        growthAnimRef.current = requestAnimationFrame(tick);
      } else {
        growthAnimRef.current = null;
        setStructureGrowth(1);
      }
    }

    growthAnimRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (growthAnimRef.current !== null) {
        cancelAnimationFrame(growthAnimRef.current);
      }
    };
  }, [animate]);

  useEffect(() => {
    setStructureGrowth(0);
    structureCameraFiredRef.current = false;
    if (growthAnimRef.current !== null) {
      cancelAnimationFrame(growthAnimRef.current);
      growthAnimRef.current = null;
    }
  }, [appState.drawn_location?.lat, appState.drawn_location?.lng]);

  useEffect(() => {
    if (appState.simulation_status !== 'loading') return;

    setStructureGrowth(0);
    structureCameraFiredRef.current = false;
    if (growthAnimRef.current !== null) {
      cancelAnimationFrame(growthAnimRef.current);
      growthAnimRef.current = null;
    }
  }, [appState.simulation_status]);

  useEffect(() => {
    if (appState.simulation_status !== 'complete' || !appState.drawn_location) {
      return;
    }

    structureCameraFiredRef.current = false;
    const timer = window.setTimeout(() => {
      animateStructureGrowth();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [
    animateStructureGrowth,
    appState.drawn_location,
    appState.simulation_result,
    appState.simulation_status,
  ]);

  useEffect(() => {
    if (structureGrowth < 1 || !appState.drawn_location) return;
    if (structureCameraFiredRef.current) return;

    structureCameraFiredRef.current = true;
    deckMapRef.current?.flyToLocation({
      lat: appState.drawn_location.lat,
      lng: appState.drawn_location.lng,
      zoom: 16.1,
      pitch: 58,
      bearing: 25,
    });
  }, [structureGrowth, appState.drawn_location]);

  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    const flyToLahoreCenter = () => {
      if (deckMapRef.current) {
        deckMapRef.current.flyToLocation({
          longitude: 74.3587,
          latitude: 31.5204,
          zoom: 12,
          pitch: 45,
          bearing: 0,
        });
        return;
      }

      attempts += 1;
      if (attempts < 30) {
        frame = window.requestAnimationFrame(flyToLahoreCenter);
      }
    };

    flyToLahoreCenter();

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMapData() {
      const buildingFeatures = await fetchBuildingsWithType();
      if (cancelled) return;
      setBuildings(buildingFeatures);
      console.log('[map] buildings loaded:', buildingFeatures.length);

      const roadNetwork = await fetchRoads();
      if (cancelled) return;
      setRoads(roadNetwork);
    }

    loadMapData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const probeBackend = async () => {
      const online = await checkSimulationBackendHealth();
      if (!cancelled) setBackendOnline(online);
    };

    probeBackend();
    const interval = window.setInterval(probeBackend, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!appState.drawn_location && !isDrawingMode) return;

    let animationFrame = 0;
    const startTime = performance.now();

    const pulse = (time: number) => {
      setMarkerPulse(((time - startTime) % 1800) / 1800);
      animationFrame = window.requestAnimationFrame(pulse);
    };

    animationFrame = window.requestAnimationFrame(pulse);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [appState.drawn_location, isDrawingMode]);

  useEffect(() => {
    if (!appState.active_layers.includes('hospitals')) return;

    let animationFrame = 0;
    const startTime = performance.now();

    const pulse = (time: number) => {
      setHospitalPulse(((time - startTime) % 1600) / 1600);
      animationFrame = window.requestAnimationFrame(pulse);
    };

    animationFrame = window.requestAnimationFrame(pulse);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [appState.active_layers]);

  useEffect(() => {
    if (!isDrawingMode) return;

    deckMapRef.current?.flyToLocation({
      ...LAHORE_CENTER,
      zoom: 13,
      pitch: 30,
      bearing: 0,
    });
  }, [isDrawingMode]);

  useEffect(() => {
    if (
      appState.simulation_status !== 'complete' ||
      !appState.simulation_result ||
      appState.active_scenario
    ) {
      return;
    }

    const mostAffectedZone = getMostAffectedZone(
      appState.simulation_result.affected_zones,
    );

    if (!mostAffectedZone) return;

    const [lng, lat] = getPolygonCentroid(mostAffectedZone.polygon);

    deckMapRef.current?.flyToLocation({
      lat,
      lng,
      zoom: 14,
      pitch: 55,
      bearing: -15,
    });
  }, [
    appState.active_scenario,
    appState.simulation_result,
    appState.simulation_status,
  ]);

  const trafficTrips = useMemo(() => {
    return buildTrafficTrips(
      roads,
      appState.simulation_result,
    );
  }, [roads, appState.simulation_result]);

  const handleBuildingHover = useCallback(
    (info: PickingInfo<BuildingFeature>) => {
      if (!info.object) {
        setBuildingTooltip(null);
        return;
      }

      setBuildingTooltip({
        x: info.x,
        y: info.y,
        name: info.object.name ?? info.object.type,
        type: info.object.type,
        height: info.object.height,
      });
    },
    [],
  );

  const handleBuildingClick = useCallback((building: BuildingFeature) => {
    const [lng, lat] = getBuildingCentroid(building.polygon);
    deckMapRef.current?.flyToLocation({
      lat,
      lng,
      zoom: 16,
      pitch: 55,
      bearing: 0,
    });
  }, []);

  const layers = useMemo((): Layer[] => {
    const nextLayers: Layer[] = [];
    // console.log('zones:', appState.simulation_result?.affected_zones.length) // debug, remove before demo

    if (appState.active_layers.includes('buildings')) {
      const buildingLayer = createBuildingLayer({
        data: buildings,
        mapZoom,
        onHover: handleBuildingHover,
        onClick: handleBuildingClick,
      });
      if (buildingLayer) nextLayers.push(buildingLayer);
    }

    if (appState.drawn_location) {
      if (structureGrowth < 0.98) {
        const shockwaveLayer = createPolicyShockwaveLayer({
          location: appState.drawn_location,
          growth: structureGrowth,
        });
        if (shockwaveLayer) nextLayers.push(shockwaveLayer);
      }

      const structureLayers = createPolicyStructureLayer({
        policyType: appState.current_policy,
        location: appState.drawn_location,
        growth: structureGrowth,
        roads,
      });
      if (structureLayers) nextLayers.push(...structureLayers);
    }

    if (appState.active_layers.includes('hospitals')) {
      nextLayers.push(
        createHospitalLayer({ data: buildings, pulse: hospitalPulse }),
      );
    }

    if (appState.active_layers.includes('schools')) {
      nextLayers.push(createSchoolLayer({ data: buildings }));
    }

    if (appState.active_layers.includes('traffic') && trafficTrips.length > 0) {
      nextLayers.push(
        createTrafficParticleLayer(
          trafficTrips,
          currentTime,
          appState.simulation_result,
        ),
      );
    }

    if (
      appState.active_layers.includes('heatmap') &&
      appState.simulation_result &&
      appState.drawn_location
    ) {
      nextLayers.push(
        createHeatmapLayer({
          location: appState.drawn_location,
          radiusKm: appState.radius_km,
          simulationResult: appState.simulation_result,
        }),
      );
    }

    if (appState.drawn_location) {
      nextLayers.push(
        createProposedPolicyLayer({
          location: appState.drawn_location,
          pulse: markerPulse,
        }),
      );
    }

    return nextLayers;
  }, [
    appState,
    buildings,
    currentTime,
    handleBuildingClick,
    handleBuildingHover,
    hospitalPulse,
    mapZoom,
    markerPulse,
    roads,
    structureGrowth,
    trafficTrips,
  ]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (demoRunning || !isDrawingMode) return;

      setAppState((current) => ({
        ...current,
        drawn_location: { lat, lng },
      }));
      setIsDrawingMode(false);
      setToastMessage('Location set');
    },
    [demoRunning, isDrawingMode],
  );

  const handleScenarioSelect = useCallback((scenario: Scenario) => {
    const config = SCENARIO_CONFIGS.find((item) => item.id === scenario.id);
    setWeatherWarning(null);
    setAppState((current) => ({
      ...current,
      current_policy: scenario.policy_type,
      drawn_location: scenario.location,
      budget_pkr: scenario.budget_pkr,
      radius_km: config?.radius_km ?? current.radius_km,
      simulation_status: 'complete',
      simulation_result: scenario.result,
      ai_recommendation: scenario.ai_response,
      active_scenario: scenario,
      active_layers: current.active_layers.includes('heatmap')
        ? current.active_layers
        : [...current.active_layers, 'heatmap'],
    }));
    setIsDrawingMode(false);
    deckMapRef.current?.flyToLocation({
      ...scenario.location,
      zoom: 14,
      pitch: 60,
      bearing: 20,
    });
  }, []);

  const loadScenarioById = useCallback(
    async (scenarioId: string) => {
      const resolvedId = resolveScenarioId(scenarioId);
      const config = SCENARIO_CONFIGS.find((item) => item.id === resolvedId);
      if (!config) {
        console.warn('[demo] Unknown scenario:', scenarioId);
        return;
      }

      const scenario = await loadScenario(config);
      handleScenarioSelect(scenario);
    },
    [handleScenarioSelect],
  );

  const handleDemoRunningChange = useCallback((running: boolean) => {
    setDemoRunning(running);
    if (running) {
      setComparisonMode(false);
      setIsDrawingMode(false);
      setActiveTab('studio');
    }
  }, []);

  useEffect(() => {
    setDemoCallbacks({
      flyTo: (payload) => deckMapRef.current?.flyToLocation(payload),
      loadScenario: loadScenarioById,
      switchTab: setActiveTab,
    });

    return () => setDemoCallbacks(null);
  }, [loadScenarioById]);

  return (
    <main
      className="relative overflow-hidden"
      style={{ width: '100vw', height: '100vh' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        <DeckMap
          onMapHandle={(handle) => {
            deckMapRef.current = handle;
          }}
          layers={layers}
          onMapClick={handleMapClick}
          isDrawingMode={isDrawingMode}
          activeTileLayer={activeTileLayer}
          onZoomChange={setMapZoom}
        />
      </div>

      {comparisonMode && appState.simulation_result ? (
        <ComparisonMap
          appState={appState}
          buildings={buildings}
          roads={roads}
          simulationResult={appState.simulation_result}
          currentTime={currentTime}
          mapZoom={mapZoom}
        />
      ) : null}

      {comparisonMode ? (
        <div
          style={{
            position: 'fixed',
            top: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
        >
          <button
            id="exit-comparison-btn"
            type="button"
            onClick={() => setComparisonMode(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 18px',
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.45)',
              color: 'var(--alert-danger)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Exit Comparison
          </button>
        </div>
      ) : null}

      <SimulationModeBanner
        backendOnline={backendOnline}
        isMockResult={isMockSimulation(appState.simulation_result)}
      />
      <TopBar />
      <Sidebar
        appState={appState}
        setAppState={setAppState}
        isDrawingMode={isDrawingMode}
        setIsDrawingMode={setIsDrawingMode}
        buildings={buildings}
        onScenarioSelect={handleScenarioSelect}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        demoLocked={demoRunning}
        activeTileLayer={activeTileLayer}
        onTileLayerChange={setActiveTileLayer}
        weatherWarning={weatherWarning}
        setWeatherWarning={setWeatherWarning}
        onCompare={() => setComparisonMode(true)}
      />

      <DemoMode onRunningChange={handleDemoRunningChange} />

      {buildingTooltip ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-accent-warning/30 bg-bg-primary/95 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-accent-warning/10"
          style={{
            left: buildingTooltip.x + 12,
            top: buildingTooltip.y + 12,
          }}
        >
          <p className="font-medium text-accent-warning">{buildingTooltip.name}</p>
          <p className="mt-1 capitalize text-secondary">{buildingTooltip.type}</p>
          <p className="mt-1 text-secondary">
            Height: {buildingTooltip.height.toFixed(1)}m
          </p>
        </div>
      ) : null}

      {toastMessage ? (
        <div
          className="glass pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-medium text-slate-100 shadow-lg"
          role="status"
        >
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}
