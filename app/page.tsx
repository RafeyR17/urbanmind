'use client';

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
  createBuildingLayer,
  createHeatmapLayer,
  createIncidentLayer,
  createLocationMarkerLayer,
  createTrafficArcLayer,
  createZoneLayer,
  formatIncidentTooltip,
  type BuildingHighlightCategory,
} from '@/components/map/layers';
import { LAHORE_CENTER, LAHORE_ZONES } from '@/lib/lahoreData';
import { fetchBuildingsWithType } from '@/lib/overpass';
import {
  fetchTrafficFlow,
  fetchTrafficIncidents,
  TRAFFIC_REFRESH_MS,
  type TrafficFlowSegment,
  type TrafficIncident,
} from '@/lib/tomtom';
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
  active_layers: ['zones', 'hospitals', 'schools', 'traffic'],
  active_scenario: null,
};

interface BuildingTooltip {
  x: number;
  y: number;
  name: string;
  type: string;
  height: number;
}

interface IncidentTooltip {
  x: number;
  y: number;
  text: string;
}

function getMostAffectedZone(zones: ZoneSimulationResult[]) {
  return zones.reduce<ZoneSimulationResult | null>((mostAffected, zone) => {
    const trafficDelta = Math.abs(
      zone.after.traffic_score - zone.before.traffic_score,
    );
    const floodDelta = Math.abs(zone.after.flood_risk - zone.before.flood_risk);
    const emergencyDelta =
      Math.abs(zone.after.emergency_minutes - zone.before.emergency_minutes) * 5;
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
      style={{ width: '100vw', height: '100vh', background: '#0a0f1e' }}
    >
      <p className="text-sm font-medium tracking-wide text-cyan">
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

const CesiumMap = dynamic(
  () => import('@/components/map').then((module) => module.CesiumMap),
  {
    ssr: false,
    loading: MapLoading,
  },
);

export default function HomePage() {
  const deckMapRef = useRef<DeckMapHandle | null>(null);
  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [viewMode, setViewMode] = useState<'deck' | 'cesium'>('deck');
  const [cesiumFlyKey, setCesiumFlyKey] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [buildingTooltip, setBuildingTooltip] =
    useState<BuildingTooltip | null>(null);
  const [markerPulse, setMarkerPulse] = useState(0);
  const [activeTileLayer, setActiveTileLayer] =
    useState<WeatherTileLayer>('none');
  const [showTerrain, setShowTerrain] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showTrafficTiles, setShowTrafficTiles] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [trafficData, setTrafficData] = useState<TrafficFlowSegment[]>([]);
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [lastTrafficUpdate, setLastTrafficUpdate] = useState<Date | null>(null);
  const [incidentPulse, setIncidentPulse] = useState(0);
  const [weatherWarning, setWeatherWarning] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [incidentTooltip, setIncidentTooltip] =
    useState<IncidentTooltip | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('studio');
  const [demoRunning, setDemoRunning] = useState(false);
  const [zoneScanPulse, setZoneScanPulse] = useState(0.35);

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
    }

    loadMapData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTrafficData = async () => {
      const [flow, incidentData] = await Promise.all([
        fetchTrafficFlow(),
        fetchTrafficIncidents(),
      ]);
      if (cancelled) return;
      setTrafficData(flow);
      setIncidents(incidentData);
      setLastTrafficUpdate(new Date());
    };

    loadTrafficData();
    const interval = window.setInterval(loadTrafficData, TRAFFIC_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
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
    if (!showIncidents || !incidents.some((incident) => incident.severity === 4)) {
      return;
    }

    let animationFrame = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      setIncidentPulse(((time - startTime) % 1200) / 1200);
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [incidents, showIncidents]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!appState.drawn_location) return;

    let animationFrame = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      setMarkerPulse(((time - startTime) % 1800) / 1800);
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [appState.drawn_location]);

  useEffect(() => {
    if (appState.simulation_status !== 'loading') return;

    let animationFrame = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      const phase = (time - startTime) % 1500;
      setZoneScanPulse(0.2 + (phase / 1500) * 0.4);
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [appState.simulation_status]);

  useEffect(() => {
    if (viewMode === 'cesium') {
      setCesiumFlyKey((current) => current + 1);
    }
  }, [viewMode]);

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

  const handleIncidentHover = useCallback(
    (info: PickingInfo<TrafficIncident>) => {
      if (!info.object) {
        setIncidentTooltip(null);
        return;
      }

      setIncidentTooltip({
        x: info.x,
        y: info.y,
        text: formatIncidentTooltip(info.object),
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

  const buildingLayerConfig = useMemo(() => {
    const showHospitals = appState.active_layers.includes('hospitals');
    const showSchools = appState.active_layers.includes('schools');
    const showAll = appState.active_layers.includes('buildings');
    const showBuildingLayer = showHospitals || showSchools || showAll;

    let highlightCategory: BuildingHighlightCategory = null;
    if (showHospitals && showSchools) highlightCategory = 'both';
    else if (showHospitals) highlightCategory = 'hospital';
    else if (showSchools) highlightCategory = 'school';
    else if (showAll) highlightCategory = 'all';

    const visibleBuildings = showAll
      ? buildings
      : buildings.filter((building) => {
          if (building.category === 'hospital') return showHospitals;
          if (building.category === 'school') return showSchools;
          return false;
        });

    return { showBuildingLayer, highlightCategory, visibleBuildings };
  }, [appState.active_layers, buildings]);

  const layers = useMemo((): Layer[] => {
    const nextLayers: Layer[] = [];

    if (appState.active_layers.includes('zones')) {
      nextLayers.push(
        createZoneLayer({
          data: LAHORE_ZONES,
          simulationResult: appState.simulation_result,
          scanning: appState.simulation_status === 'loading',
          scanPulse: zoneScanPulse,
        }),
      );
    }

    if (buildingLayerConfig.showBuildingLayer) {
      nextLayers.push(
        createBuildingLayer({
          data: buildingLayerConfig.visibleBuildings,
          highlightCategory: buildingLayerConfig.highlightCategory,
          onHover: handleBuildingHover,
          onClick: handleBuildingClick,
        }),
      );
    }

    if (appState.active_layers.includes('traffic')) {
      nextLayers.push(
        createTrafficArcLayer({
          trafficData,
          simulationResult: appState.simulation_result,
        }),
      );
    }

    if (showIncidents && incidents.length > 0) {
      nextLayers.push(
        createIncidentLayer({
          data: incidents,
          pulse: incidentPulse,
          onHover: handleIncidentHover,
        }),
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
        createLocationMarkerLayer({
          location: appState.drawn_location,
          pulse: markerPulse,
        }),
      );
    }

    return nextLayers;
  }, [
    appState,
    buildingLayerConfig,
    handleBuildingClick,
    handleBuildingHover,
    handleIncidentHover,
    incidentPulse,
    incidents,
    markerPulse,
    showIncidents,
    trafficData,
    zoneScanPulse,
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
      setViewMode('deck');
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
          display: viewMode === 'deck' ? 'block' : 'none',
        }}
      >
        <DeckMap
          ref={deckMapRef}
          layers={layers}
          onMapClick={handleMapClick}
          isDrawingMode={isDrawingMode}
          activeTileLayer={activeTileLayer}
          showTerrain={showTerrain}
          showLabels={showLabels}
          showTrafficTiles={showTrafficTiles}
          showIncidentTiles={showIncidents}
          showFires={appState.active_layers.includes('fires')}
          showSurfaceTemp={appState.active_layers.includes('surface-temp')}
        />
      </div>

      {viewMode === 'cesium' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
          }}
        >
          <CesiumMap
            zones={LAHORE_ZONES}
            buildings={buildings}
            simulationResult={appState.simulation_result}
            cameraFlyKey={cesiumFlyKey}
          />
        </div>
      ) : null}

      {/* Comparison split-screen — rendered on top when active */}
      {comparisonMode && appState.simulation_result ? (
        <ComparisonMap
          appState={appState}
          buildings={buildings}
          trafficData={trafficData}
          simulationResult={appState.simulation_result}
          showLabels={showLabels}
          showTrafficTiles={showTrafficTiles}
          showFires={appState.active_layers.includes('fires')}
          showSurfaceTemp={appState.active_layers.includes('surface-temp')}
        />
      ) : null}

      {/* Exit Comparison button — fixed at top center */}
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
              color: '#ef4444',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              transition: 'background 0.15s',
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
      <TopBar
        trafficData={trafficData}
        incidents={incidents}
        lastTrafficUpdate={lastTrafficUpdate}
        showIncidents={showIncidents}
        onToggleIncidents={() => setShowIncidents((current) => !current)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
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
        showTerrain={showTerrain}
        onTerrainChange={setShowTerrain}
        showLabels={showLabels}
        onLabelsChange={setShowLabels}
        showTrafficTiles={showTrafficTiles}
        onTrafficTilesChange={setShowTrafficTiles}
        showIncidents={showIncidents}
        onIncidentsChange={setShowIncidents}
        weatherWarning={weatherWarning}
        setWeatherWarning={setWeatherWarning}
        onCompare={() => setComparisonMode(true)}
      />

      <DemoMode onRunningChange={handleDemoRunningChange} />

      {incidentTooltip ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xs whitespace-pre-line rounded-md border border-warning/30 bg-navy/95 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-warning/10"
          style={{
            left: incidentTooltip.x + 12,
            top: incidentTooltip.y + 12,
          }}
        >
          {incidentTooltip.text}
        </div>
      ) : null}

      {buildingTooltip ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-cyan/30 bg-navy/95 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-cyan/10"
          style={{
            left: buildingTooltip.x + 12,
            top: buildingTooltip.y + 12,
          }}
        >
          <p className="font-medium text-cyan">
            {buildingTooltip.name}
          </p>
          <p className="mt-1 capitalize text-secondary">
            {buildingTooltip.type}
          </p>
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
