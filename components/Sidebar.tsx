'use client';

import PolicyStudio, { type SidebarTab } from '@/components/sidebar/PolicyStudio';
import SimulationResults from '@/components/sidebar/SimulationResults';
import AIRecommendationPanel from '@/components/sidebar/AIRecommendation';
import ScenarioLibrary from '@/components/sidebar/ScenarioLibrary';
import HistoryPanel from '@/components/sidebar/HistoryPanel';
import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
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

const MAP_LAYER_TOGGLES: Array<{
  key: MapLayer;
  icon: string;
  label: string;
  requiresSimulation?: boolean;
}> = [
  { key: 'buildings', icon: '🏢', label: 'Buildings' },
  { key: 'hospitals', icon: '🏥', label: 'Hospitals' },
  { key: 'schools', icon: '🏫', label: 'Schools' },
  { key: 'heatmap', icon: '🌡', label: 'Heatmap', requiresSimulation: true },
];

const WEATHER_LAYER_TOGGLES: Array<{
  key: Exclude<WeatherTileLayer, 'none'>;
  icon: string;
  label: string;
}> = [];

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
  weatherWarning?: string | null;
  setWeatherWarning: (warning: string | null) => void;
  onCompare: () => void;
}

function LayerCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-sm border"
      style={{
        width: '8px',
        height: '8px',
        borderRadius: 'var(--radius)',
        borderColor: checked ? 'var(--stamp-red)' : 'var(--hairline)',
        backgroundColor: checked ? 'var(--stamp-red)' : 'transparent',
      }}
    >
      {checked ? (
        <svg aria-hidden fill="none" height="6" viewBox="0 0 6 6" width="6">
          <path
            d="M1 3.2 2.4 4.6 5 1.8"
            stroke="#fff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1"
          />
        </svg>
      ) : null}
    </span>
  );
}

function LayerCheckRow({
  checked,
  icon,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean;
  icon: string;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 bg-transparent p-0 text-left ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
      disabled={disabled}
      type="button"
      onClick={onToggle}
    >
      <LayerCheckbox checked={checked} />
      <span
        aria-hidden
        className="leading-none"
        style={{ fontSize: '16px', color: 'var(--paper-dim)' }}
      >
        {icon}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: checked ? 'var(--paper)' : 'var(--paper-dim)',
        }}
      >
        {label}
      </span>
    </button>
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

  const hospitalCount = buildings.filter((b) => b.category === 'hospital').length;
  const schoolCount = buildings.filter((b) => b.category === 'school').length;
  // console.log('layer counts', hospitalCount, schoolCount);
  const buildingCount = buildings.length; // might be wrong if overpass times out
  const hasSimulation = Boolean(appState.simulation_result);

  const toggleMapLayer = (layer: MapLayer) => {
    setAppState((current) => {
      const isActive = current.active_layers.includes(layer);
      return {
        ...current,
        active_layers: isActive
          ? current.active_layers.filter((l) => l !== layer)
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
      // api flaky during demo, just log it
      console.error('[Sidebar] AI failed:', error);
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

  const handleRenewSimulation = () => {
    setAppState((current) => ({
      ...current,
      drawn_location: null,
      simulation_status: 'idle',
      simulation_result: null,
      ai_recommendation: null,
      active_scenario: null,
      active_layers: current.active_layers.filter((layer) => layer !== 'heatmap'),
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
      <div className="mb-4 border-b border-hairline">
        <div className="flex gap-4">
          {(
            [
              { key: 'studio', label: 'Studio' },
              { key: 'results', label: 'Results' },
              { key: 'ai', label: 'AI' },
              { key: 'scenarios', label: 'Scenarios' },
              { key: 'history', label: 'History' },
            ] as const
          ).map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                className="relative bg-transparent pb-2 uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  color: isActive ? 'var(--stamp-red)' : 'var(--file-olive)',
                }}
                type="button"
                onClick={() => {
                  setActiveTab(key);
                  if (key === 'history') setHasNewHistory(false);
                }}
              >
                {label}
                {key === 'history' && hasNewHistory ? (
                  <span
                    aria-hidden
                    className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: 'var(--stamp-red)' }}
                  />
                ) : null}
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                      height: '2px',
                      backgroundColor: 'var(--stamp-red)',
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
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

          <div>
            <p
              className="pb-2 uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--file-olive)',
              }}
            >
              Layers
            </p>
            <div className="mb-3 border-b border-hairline" />
            <div className="flex flex-col gap-1.5">
              {MAP_LAYER_TOGGLES.map((layer) => (
                <LayerCheckRow
                  key={layer.key}
                  checked={appState.active_layers.includes(layer.key)}
                  disabled={layer.requiresSimulation && !hasSimulation}
                  icon={layer.icon}
                  label={layer.label}
                  onToggle={() => {
                    if (layer.requiresSimulation && !hasSimulation) return;
                    toggleMapLayer(layer.key);
                  }}
                />
              ))}
              {WEATHER_LAYER_TOGGLES.map((layer) => (
                <LayerCheckRow
                  key={layer.key}
                  checked={activeTileLayer === layer.key}
                  icon={layer.icon}
                  label={layer.label}
                  onToggle={() => toggleWeatherLayer(layer.key)}
                />
              ))}
            </div>
          </div>

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
          onRenewSimulation={handleRenewSimulation}
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

function InfrastructureStats({
  hospitalCount,
  schoolCount,
  buildingCount,
}: {
  hospitalCount: number;
  schoolCount: number;
  buildingCount: number;
}) {
  const stats = [
    { label: 'Hospitals', count: hospitalCount },
    { label: 'Schools', count: schoolCount },
    { label: 'Buildings', count: buildingCount },
  ];

  return (
    <div className="grid grid-cols-3">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={index > 0 ? 'border-l border-hairline pl-3' : 'pr-3'}
        >
          <p
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--file-olive)',
            }}
          >
            {stat.label}
          </p>
          <p
            className="mt-1 text-[22px] tabular-nums text-paper"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {stat.count}
          </p>
        </div>
      ))}
    </div>
  );
}
