'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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

function formatBudgetSpec(value: number) {
  return `RS ${(value / 1_000_000_000).toFixed(1)}B`;
}

function formatRadiusSpec(value: number) {
  return `${value.toFixed(1)} KM`;
}

function rangeProgress(value: number, min: number, max: number) {
  return ((value - min) / (max - min)) * 100;
}

const fieldLabelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  color: 'var(--file-olive)',
  textTransform: 'uppercase' as const,
};

const fieldValueStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  color: 'var(--paper)',
};

function SpecFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end">
      <span style={fieldLabelStyle}>{label}</span>
      <span
        aria-hidden
        className="min-w-0 flex-1"
        style={{
          borderBottom: '1px dotted var(--hairline)',
          margin: '0 8px',
          opacity: 0.5,
          marginBottom: '3px',
        }}
      />
      <span style={fieldValueStyle}>{value}</span>
    </div>
  );
}

function SpecRangeInput({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const progress = rangeProgress(value, min, max);

  return (
    <input
      className="policy-studio-range mt-3 w-full"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function PolicyTypeSelect({
  value,
  onChange,
}: {
  value: PolicyType;
  onChange: (policy: PolicyType) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    POLICY_OPTIONS.find((option) => option.value === value) ?? POLICY_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`relative ${open ? 'z-50' : 'z-0'}`}
    >
      <span style={fieldLabelStyle}>Policy type</span>

      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="mt-2 flex w-full items-center justify-between rounded border border-hairline px-3 py-2 text-left text-sm outline-none transition focus:border-stamp-red focus:ring-0"
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--paper)',
          backgroundColor: 'var(--bg-primary)',
        }}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span aria-hidden className="text-paper-dim">
          ▾
        </span>
      </button>

      {open ? (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded border border-hairline py-1"
          role="listbox"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          {POLICY_OPTIONS.map((option) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                style={{ backgroundColor: 'var(--bg-primary)' }}
              >
                <button
                  className={`w-full px-3 py-2 text-left text-sm transition ${
                    isSelected ? 'text-paper' : 'text-paper hover:bg-bg-panel'
                  }`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: isSelected
                      ? 'var(--stamp-red)'
                      : 'var(--bg-primary)',
                  }}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function getParameters(policyType: PolicyType) {
  if (policyType === 'flyover') return { lanes: 4 }; // had to hardcode lane count
  if (policyType === 'hospital') return { beds: 350 };
  if (policyType === 'drainage') return { pipe_diameter: 1.8 };
  return {};
}

// function getParams(policy: PolicyType) { ... } // old name, refactor later

export default function PolicyStudio({
  appState,
  setAppState,
  isDrawingMode,
  setIsDrawingMode,
  setActiveTab,
  setWeatherWarning,
}: PolicyStudioProps) {
  const [fileNumber, setFileNumber] = useState<string | null>(null);

  useEffect(() => {
    setFileNumber(String(Math.floor(1000 + Math.random() * 9000)));
  }, []);
  const isLoading = appState.simulation_status === 'loading';
  const hasLocation = Boolean(appState.drawn_location);
  const hasSimulated =
    appState.simulation_status === 'complete' ||
    Boolean(appState.simulation_result);

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
    console.log('running sim', appState.current_policy);
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
      window.setTimeout(() => setActiveTab('results'), 250); // quick tab flip feels snappier
    } catch (error) {
      console.error('[PolicyStudio] sim blew up:', error);
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
      <style>{`
        .policy-studio-range {
          -webkit-appearance: none;
          appearance: none;
          height: 10px;
          background: transparent;
        }

        .policy-studio-range:focus {
          outline: none;
        }

        .policy-studio-range::-webkit-slider-runnable-track {
          height: 2px;
          background: linear-gradient(
            to right,
            var(--stamp-red) 0%,
            var(--stamp-red) var(--range-progress),
            var(--hairline) var(--range-progress),
            var(--hairline) 100%
          );
        }

        .policy-studio-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          margin-top: -4px;
          border: none;
          border-radius: var(--radius);
          background: var(--stamp-red);
          box-shadow: none;
        }

        .policy-studio-range::-moz-range-track {
          height: 2px;
          background: var(--hairline);
        }

        .policy-studio-range::-moz-range-progress {
          height: 2px;
          background: var(--stamp-red);
        }

        .policy-studio-range::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border: none;
          border-radius: var(--radius);
          background: var(--stamp-red);
          box-shadow: none;
        }

        .policy-studio-btn {
          width: 100%;
          border-radius: var(--radius);
          border: 1px solid var(--hairline);
          background: transparent;
          box-shadow: none;
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition:
            background-color 120ms,
            color 120ms,
            border-color 120ms;
        }

        .policy-studio-btn:focus {
          outline: none;
        }

        .policy-studio-btn--default {
          color: var(--paper-dim);
        }

        .policy-studio-btn--default:hover:not(:disabled) {
          background: var(--stamp-red);
          border-color: var(--stamp-red);
          color: var(--bg-primary);
        }

        .policy-studio-btn--active {
          border-color: var(--stamp-red);
          color: var(--stamp-red);
        }

        .policy-studio-btn--active:hover:not(:disabled) {
          background: var(--stamp-red);
          color: var(--bg-primary);
        }

        .policy-studio-btn--disabled,
        .policy-studio-btn--disabled:hover {
          background: var(--bg-primary);
          border-color: var(--hairline);
          color: var(--file-olive);
          cursor: not-allowed;
        }
      `}</style>

      <header className="mb-4">
        <div className="flex items-center justify-between">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--file-olive)',
            }}
          >
            FILE NO. UIQ-2026-{fileNumber ?? '····'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: hasSimulated ? 'var(--success-stamp)' : 'var(--file-olive)',
            }}
          >
            STATUS: {hasSimulated ? 'SIMULATED' : 'DRAFT'}
          </span>
        </div>
        <h1
          className="mt-2 text-xl font-semibold"
          style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--paper)',
          }}
        >
          Design Your Policy
        </h1>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{
            fontFamily: 'var(--font-sans)',
            color: 'var(--paper-dim)',
          }}
        >
          Configure infrastructure decisions on Lahore&apos;s digital twin
          before committing billions in real-world spending.
        </p>
        <div className="mt-4 border-t border-hairline" />
      </header>

      <PolicyTypeSelect
          value={appState.current_policy}
          onChange={updatePolicy}
        />

      <label className="block">
        <SpecFieldRow
          label="Budget allocation"
          value={formatBudgetSpec(appState.budget_pkr)}
        />
        <SpecRangeInput
          min={1_000_000_000}
          max={50_000_000_000}
          step={500_000_000}
          value={appState.budget_pkr}
          onChange={(budget_pkr) =>
            setAppState((current) => ({
              ...current,
              budget_pkr,
              active_scenario: null,
            }))
          }
        />
      </label>

      <label className="block">
        <SpecFieldRow
          label="Affected radius"
          value={formatRadiusSpec(appState.radius_km)}
        />
        <SpecRangeInput
          min={0.5}
          max={15}
          step={0.5}
          value={appState.radius_km}
          onChange={(radius_km) =>
            setAppState((current) => ({
              ...current,
              radius_km,
              active_scenario: null,
            }))
          }
        />
      </label>

      <button
        className={`policy-studio-btn px-3 py-2 ${
          hasLocation || isDrawingMode
            ? 'policy-studio-btn--active'
            : 'policy-studio-btn--default'
        }`}
        type="button"
        onClick={() => setIsDrawingMode(true)}
      >
        {hasLocation
          ? '📍 Location set'
          : isDrawingMode
            ? 'Click on map to place'
            : 'Draw on Map'}
      </button>

      <button
        className={`policy-studio-btn flex items-center justify-center gap-2 px-4 py-3 ${
          !hasLocation
            ? 'policy-studio-btn--disabled'
            : isLoading
              ? 'policy-studio-btn--active'
              : 'policy-studio-btn--default'
        }`}
        type="button"
        disabled={!hasLocation || isLoading}
        onClick={runSelectedSimulation}
      >
        {isLoading ? (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-sm border-2 border-stamp-red border-t-transparent"
          />
        ) : null}
        {!hasLocation
          ? 'Select a location first'
          : isLoading
            ? 'Simulating impact...'
            : hasSimulated
              ? 'Run New Simulation'
              : 'Run Simulation'}
      </button>

      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-accent-warning/20 bg-accent-warning/5 p-3">
          <p className="scan-animation text-sm text-accent-warning">
            Analyzing impact across 10 districts...
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-accent-warning"
              initial={{ width: '8%' }}
              animate={{ width: ['8%', '92%', '8%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      ) : null}

      {appState.simulation_status === 'error' ? (
        <p className="rounded-lg border border-alert-danger/30 bg-alert-danger/10 px-3 py-2 text-sm text-red-200">
          Simulation failed. Check the backend URL and try again.
        </p>
      ) : null}
    </motion.div>
  );
}
