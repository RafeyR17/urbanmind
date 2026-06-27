'use client';

import { motion } from 'framer-motion';
import type { Dispatch, SetStateAction } from 'react';
import { runSimulation, type SimulationRunResult } from '@/lib/simulation';
import type { AppState, PolicyType, SimulationRequest } from '@/types';

export type SidebarTab = 'studio' | 'results' | 'ai' | 'scenarios' | 'history';

const POLICY_OPTIONS: Array<{ value: PolicyType; label: string }> = [
  { value: 'flyover', label: 'Flyover' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'drainage', label: 'Drainage Upgrade' },
  { value: 'school', label: 'School' },
  { value: 'park', label: 'Park' },
];

export interface PolicyStudioProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  isDrawingMode: boolean;
  setIsDrawingMode: Dispatch<SetStateAction<boolean>>;
  setActiveTab: (tab: SidebarTab) => void;
  setWeatherWarning: (warning: string | null) => void;
}

function formatBudget(value: number) {
  return `₨${(value / 1_000_000_000).toFixed(1)}B`;
}

function getParameters(policyType: PolicyType) {
  if (policyType === 'flyover') return { lanes: 4 };
  if (policyType === 'hospital') return { beds: 350 };
  if (policyType === 'drainage') return { pipe_diameter: 1.8 };
  return {};
}

export default function PolicyStudio({
  appState,
  setAppState,
  isDrawingMode,
  setIsDrawingMode,
  setActiveTab,
  setWeatherWarning,
}: PolicyStudioProps) {
  const isLoading = appState.simulation_status === 'loading';
  const hasLocation = Boolean(appState.drawn_location);

  const updatePolicy = (policy: PolicyType) => {
    setAppState((current) => ({
      ...current,
      current_policy: policy,
      active_scenario: null,
    }));
  };

  const runSelectedSimulation = async () => {
    if (!appState.drawn_location || isLoading) return;

    const request: SimulationRequest = {
      policy_type: appState.current_policy,
      location: appState.drawn_location,
      budget_pkr: appState.budget_pkr,
      radius_km: appState.radius_km,
      parameters: getParameters(appState.current_policy),
    };

    setWeatherWarning(null);
    setAppState((current) => ({
      ...current,
      simulation_status: 'loading',
      simulation_result: null,
      ai_recommendation: null,
      active_scenario: null,
    }));

    try {
      const result: SimulationRunResult = await runSimulation(request);

      setWeatherWarning(result.weather_warning ?? null);
      setAppState((current) => ({
        ...current,
        simulation_status: 'complete',
        simulation_result: result,
        active_layers: current.active_layers.includes('heatmap')
          ? current.active_layers
          : [...current.active_layers, 'heatmap'],
      }));
      window.setTimeout(() => setActiveTab('results'), 250);
    } catch (error) {
      console.error('[PolicyStudio] Simulation failed:', error);
      setAppState((current) => ({
        ...current,
        simulation_status: 'error',
      }));
    }
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-secondary">
          Policy type
        </span>
        <select
          className="mt-2 w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20"
          value={appState.current_policy}
          onChange={(event) => updatePolicy(event.target.value as PolicyType)}
        >
          {POLICY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-secondary">
          <span>Budget</span>
          <span className="text-cyan">{formatBudget(appState.budget_pkr)}</span>
        </div>
        <input
          className="mt-3 w-full accent-cyan"
          type="range"
          min={1_000_000_000}
          max={50_000_000_000}
          step={500_000_000}
          value={appState.budget_pkr}
          onChange={(event) =>
            setAppState((current) => ({
              ...current,
              budget_pkr: Number(event.target.value),
              active_scenario: null,
            }))
          }
        />
      </label>

      <label className="block">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-secondary">
          <span>Radius</span>
          <span className="text-cyan">{appState.radius_km.toFixed(1)} km</span>
        </div>
        <input
          className="mt-3 w-full accent-cyan"
          type="range"
          min={0.5}
          max={15}
          step={0.5}
          value={appState.radius_km}
          onChange={(event) =>
            setAppState((current) => ({
              ...current,
              radius_km: Number(event.target.value),
              active_scenario: null,
            }))
          }
        />
      </label>

      <motion.button
        className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
          hasLocation
            ? 'border-success/60 bg-success/10 text-success'
            : isDrawingMode
              ? 'border-cyan bg-cyan/15 text-cyan'
              : 'border-white/10 bg-white/[0.04] text-slate-100 hover:border-cyan/40'
        }`}
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsDrawingMode(true)}
      >
        {hasLocation
          ? '📍 Location set'
          : isDrawingMode
            ? 'Click on map to place'
            : 'Draw on Map'}
      </motion.button>

      <motion.button
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
          !hasLocation
            ? 'cursor-not-allowed bg-muted/40 text-secondary'
            : isLoading
              ? 'bg-cyan/20 text-cyan'
              : 'bg-gradient-to-r from-cyan to-cyan-dark text-navy shadow-lg shadow-cyan/20'
        }`}
        type="button"
        disabled={!hasLocation || isLoading}
        whileHover={hasLocation && !isLoading ? { scale: 1.01 } : undefined}
        whileTap={hasLocation && !isLoading ? { scale: 0.98 } : undefined}
        onClick={runSelectedSimulation}
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
        ) : null}
        {!hasLocation
          ? 'Select a location first'
          : isLoading
            ? 'Simulating impact...'
            : 'Run Simulation'}
      </motion.button>

      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-cyan/20 bg-cyan/5 p-3">
          <p className="scan-animation text-sm text-cyan">
            Analyzing impact across 10 districts...
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-cyan"
              initial={{ width: '8%' }}
              animate={{ width: ['8%', '92%', '8%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      ) : null}

      {appState.simulation_status === 'error' ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-red-200">
          Simulation failed. Check the backend URL and try again.
        </p>
      ) : null}
    </motion.div>
  );
}
