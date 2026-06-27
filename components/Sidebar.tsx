'use client';

import PolicyStudio, { type SidebarTab } from '@/components/sidebar/PolicyStudio';
import SimulationResults from '@/components/sidebar/SimulationResults';
import AIRecommendationPanel from '@/components/sidebar/AIRecommendation';
import ScenarioLibrary from '@/components/sidebar/ScenarioLibrary';
import HistoryPanel from '@/components/sidebar/HistoryPanel';
import { getAIAnalysis } from '@/lib/ai';
import { updateLatestSimulationRunAi } from '@/lib/supabase';
import type { WeatherTileLayer } from '@/lib/weather';
import type {
  Alternative,
  AppState,
  BuildingFeature,
  MapLayer,
  Scenario,
} from '@/types';
import { LayoutGroup, motion } from 'framer-motion';
import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

const MAP_LAYER_TOGGLES: Array<{ key: MapLayer; label: string }> = [
  { key: 'zones', label: 'Zones' },
  { key: 'hospitals', label: '🏥 Hospital Buildings' },
  { key: 'schools', label: '🏫 School Buildings' },
  { key: 'buildings', label: '🏢 All Buildings' },
  { key: 'traffic', label: 'Traffic Arcs' },
  { key: 'heatmap', label: 'Heatmap' },
];

const OVERLAY_LAYER_TOGGLES = [
  { key: 'terrain' as const, label: 'Terrain' },
  { key: 'labels' as const, label: 'Labels' },
];

const WEATHER_LAYER_TOGGLES: Array<{
  key: Exclude<WeatherTileLayer, 'none'>;
  label: string;
}> = [
  { key: 'precipitation', label: '🌧 Precipitation' },
  { key: 'wind', label: '💨 Wind' },
  { key: 'temp', label: '🌡 Temperature' },
];

const TOMTOM_LAYER_TOGGLES = [
  { key: 'trafficTiles' as const, label: '🚦 Road Traffic Lines' },
  { key: 'incidents' as const, label: '⚠️ Incidents' },
];

const NASA_LAYER_TOGGLES: Array<{ key: MapLayer; label: string; badge: string }> = [
  { key: 'fires', label: '🔥 Thermal Hotspots', badge: 'VIIRS' },
  { key: 'surface-temp', label: '🌡 Surface Temp', badge: 'MODIS' },
];

export interface SidebarProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  isDrawingMode: boolean;
  setIsDrawingMode: Dispatch<SetStateAction<boolean>>;
  buildings: BuildingFeature[];
  onScenarioSelect: (scenario: Scenario) => void;
  activeTab: SidebarTab;
  onActiveTabChange: (tab: SidebarTab) => void;
  demoLocked?: boolean;
  activeTileLayer: WeatherTileLayer;
  onTileLayerChange: (layer: WeatherTileLayer) => void;
  showTerrain: boolean;
  onTerrainChange: (enabled: boolean) => void;
  showLabels: boolean;
  onLabelsChange: (enabled: boolean) => void;
  showTrafficTiles: boolean;
  onTrafficTilesChange: (enabled: boolean) => void;
  showIncidents: boolean;
  onIncidentsChange: (enabled: boolean) => void;
  weatherWarning?: string | null;
  setWeatherWarning: (warning: string | null) => void;
  onCompare: () => void;
}

function LayerPill({
  active,
  label,
  onClick,
  badge,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <motion.button
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-cyan bg-cyan/10 text-cyan'
          : 'border-white/10 bg-white/[0.03] text-secondary hover:border-white/20 hover:text-slate-100'
      }`}
      layout
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
      {badge ? (
        <span className="rounded bg-navy/50 px-1 py-0.5 text-[9px] font-bold tracking-wider text-slate-300 border border-white/5">
          {badge}
        </span>
      ) : null}
    </motion.button>
  );
}

export default function Sidebar({
  appState,
  setAppState,
  isDrawingMode,
  setIsDrawingMode,
  buildings,
  onScenarioSelect,
  activeTileLayer,
  onTileLayerChange,
  showTerrain,
  onTerrainChange,
  showLabels,
  onLabelsChange,
  showTrafficTiles,
  onTrafficTilesChange,
  showIncidents,
  onIncidentsChange,
  weatherWarning,
  setWeatherWarning,
  onCompare,
  activeTab,
  onActiveTabChange,
  demoLocked = false,
}: SidebarProps) {
  const [hasNewHistory, setHasNewHistory] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const setActiveTab = onActiveTabChange;

  useEffect(() => {
    if (appState.simulation_status === 'complete' && activeTab !== 'history') {
      setHasNewHistory(true);
    }
  }, [appState.simulation_status, appState.simulation_result, activeTab]);
  const hospitalCount = buildings.filter(
    (building) => building.category === 'hospital',
  ).length;
  const schoolCount = buildings.filter(
    (building) => building.category === 'school',
  ).length;
  const buildingCount = buildings.length;

  const toggleMapLayer = (layer: MapLayer) => {
    setAppState((current) => {
      const isActive = current.active_layers.includes(layer);
      const nextActive = !isActive;
      if (layer === 'traffic') {
        onTrafficTilesChange(nextActive);
      }
      return {
        ...current,
        active_layers: isActive
          ? current.active_layers.filter((item) => item !== layer)
          : [...current.active_layers, layer],
      };
    });
  };

  const toggleWeatherLayer = (layer: Exclude<WeatherTileLayer, 'none'>) => {
    onTileLayerChange(activeTileLayer === layer ? 'none' : layer);
  };

  const handleGetAIAnalysis = async () => {
    if (!appState.simulation_result || isLoadingAI) return;

    setIsLoadingAI(true);
    setActiveTab('ai');

    try {
      const recommendation = await getAIAnalysis({
        policy: {
          type: appState.current_policy,
          budget_pkr: appState.budget_pkr,
          radius_km: appState.radius_km,
          location_name:
            appState.active_scenario?.name ?? 'Selected Lahore site',
        },
        simulation: appState.simulation_result,
      });

      setAppState((current) => ({
        ...current,
        ai_recommendation: recommendation,
      }));
      await updateLatestSimulationRunAi(recommendation).catch((error) => {
        console.error('[Sidebar] Failed to persist AI recommendation:', error);
      });
    } catch (error) {
      console.error('[Sidebar] AI analysis failed:', error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleSimulateAlternative = (alternative: Alternative) => {
    setAppState((current) => ({
      ...current,
      budget_pkr: alternative.estimated_cost_pkr,
      ai_recommendation: null,
      active_scenario: null,
    }));
    setActiveTab('studio');
  };

  return (
    <aside
      className={`glass fixed bottom-0 left-0 top-12 z-40 flex w-[380px] flex-col overflow-y-auto border-r border-white/10 p-5 ${
        demoLocked ? 'pointer-events-none select-none opacity-95' : ''
      }`}
      style={{ width: 380 }}
    >
      <div className="mb-6 border-b border-white/10 pb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan">
          Policy Studio
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">
          Design Your Policy
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Configure infrastructure decisions on Lahore&apos;s digital twin
          before committing billions in real-world spending.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {(['studio', 'results', 'ai', 'scenarios', 'history'] as SidebarTab[]).map((tab) => (
          <button
            key={tab}
            className={`relative rounded-lg px-2 py-2 text-[11px] font-semibold capitalize transition ${
              activeTab === tab
                ? 'bg-cyan text-navy'
                : 'text-secondary hover:bg-white/[0.04] hover:text-slate-100'
            }`}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'history') setHasNewHistory(false);
            }}
          >
            {tab}
            {tab === 'history' && hasNewHistory ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'studio' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <PolicyStudio
              appState={appState}
              setAppState={setAppState}
              isDrawingMode={isDrawingMode}
              setIsDrawingMode={setIsDrawingMode}
              setActiveTab={setActiveTab}
              setWeatherWarning={setWeatherWarning}
            />
          </div>

          <LayerControls
            appState={appState}
            activeTileLayer={activeTileLayer}
            showTerrain={showTerrain}
            showLabels={showLabels}
            showTrafficTiles={showTrafficTiles}
            showIncidents={showIncidents}
            toggleMapLayer={toggleMapLayer}
            toggleWeatherLayer={toggleWeatherLayer}
            onTerrainChange={onTerrainChange}
            onLabelsChange={onLabelsChange}
            onTrafficTilesChange={onTrafficTilesChange}
            onIncidentsChange={onIncidentsChange}
          />

          <InfrastructureStats
            hospitalCount={hospitalCount}
            schoolCount={schoolCount}
            buildingCount={buildingCount}
          />
        </div>
      ) : null}

      {activeTab === 'results' ? (
        <SimulationResults
          appState={appState}
          setAppState={setAppState}
          setActiveTab={setActiveTab}
          weatherWarning={weatherWarning}
          onGetAIAnalysis={handleGetAIAnalysis}
          isAnalyzing={isLoadingAI}
          onCompare={onCompare}
        />
      ) : null}

      {activeTab === 'ai' ? (
        <AIRecommendationPanel
          recommendation={appState.ai_recommendation}
          isLoading={isLoadingAI}
          simulationResult={appState.simulation_result}
          appState={appState}
          onSimulateAlternative={handleSimulateAlternative}
          onRecommendation={(recommendation) =>
            setAppState((current) => ({
              ...current,
              ai_recommendation: recommendation,
            }))
          }
        />
      ) : null}

      {activeTab === 'scenarios' ? (
        <ScenarioLibrary
          activeScenarioId={appState.active_scenario?.id ?? null}
          onLoadScenario={onScenarioSelect}
          setActiveTab={setActiveTab}
        />
      ) : null}

      {activeTab === 'history' ? (
        <HistoryPanel
          appState={appState}
          setAppState={setAppState}
          setActiveTab={setActiveTab}
        />
      ) : null}
    </aside>
  );
}

function LayerControls({
  appState,
  activeTileLayer,
  showTerrain,
  showLabels,
  showTrafficTiles,
  showIncidents,
  toggleMapLayer,
  toggleWeatherLayer,
  onTerrainChange,
  onLabelsChange,
  onTrafficTilesChange,
  onIncidentsChange,
}: {
  appState: AppState;
  activeTileLayer: WeatherTileLayer;
  showTerrain: boolean;
  showLabels: boolean;
  showTrafficTiles: boolean;
  showIncidents: boolean;
  toggleMapLayer: (layer: MapLayer) => void;
  toggleWeatherLayer: (layer: Exclude<WeatherTileLayer, 'none'>) => void;
  onTerrainChange: (enabled: boolean) => void;
  onLabelsChange: (enabled: boolean) => void;
  onTrafficTilesChange: (enabled: boolean) => void;
  onIncidentsChange: (enabled: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-secondary">
        Layers
      </p>
      <LayoutGroup>
        <div className="flex flex-wrap gap-2">
          {MAP_LAYER_TOGGLES.map((layer) => (
            <LayerPill
              key={layer.key}
              active={appState.active_layers.includes(layer.key)}
              label={layer.label}
              onClick={() => toggleMapLayer(layer.key)}
            />
          ))}
          {OVERLAY_LAYER_TOGGLES.map((layer) => (
            <LayerPill
              key={layer.key}
              active={layer.key === 'terrain' ? showTerrain : showLabels}
              label={layer.label}
              onClick={() => {
                if (layer.key === 'terrain') {
                  onTerrainChange(!showTerrain);
                  return;
                }
                onLabelsChange(!showLabels);
              }}
            />
          ))}
          {TOMTOM_LAYER_TOGGLES.map((layer) => (
            <LayerPill
              key={layer.key}
              active={
                layer.key === 'trafficTiles' ? showTrafficTiles : showIncidents
              }
              label={layer.label}
              onClick={() => {
                if (layer.key === 'trafficTiles') {
                  onTrafficTilesChange(!showTrafficTiles);
                  return;
                }
                onIncidentsChange(!showIncidents);
              }}
            />
          ))}
          {WEATHER_LAYER_TOGGLES.map((layer) => (
            <LayerPill
              key={layer.key}
              active={activeTileLayer === layer.key}
              label={layer.label}
              onClick={() => toggleWeatherLayer(layer.key)}
            />
          ))}
          {NASA_LAYER_TOGGLES.map((layer) => (
            <LayerPill
              key={layer.key}
              active={appState.active_layers.includes(layer.key)}
              label={layer.label}
              badge={layer.badge}
              onClick={() => toggleMapLayer(layer.key)}
            />
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

function InfrastructureStats({
  hospitalCount,
  schoolCount,
  buildingCount,
}: {
  hospitalCount: number;
  schoolCount: number;
  buildingCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        ['Hospitals', hospitalCount],
        ['Schools', schoolCount],
        ['Buildings', buildingCount],
      ].map(([label, count]) => (
        <div
          key={label}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
        >
          <p className="text-xs uppercase tracking-wide text-secondary">
            {label}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {count}
          </p>
        </div>
      ))}
    </div>
  );
}
