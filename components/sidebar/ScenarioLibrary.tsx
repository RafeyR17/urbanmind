'use client';

import {
  clearScenarioCache,
  loadScenario,
  SCENARIO_CONFIGS,
  type ScenarioConfig,
} from '@/lib/scenarios';
import type { SidebarTab } from '@/components/sidebar/PolicyStudio';
import type { AIRecommendation, PolicyType, Scenario } from '@/types';
import { motion } from 'framer-motion';
import {
  Building2,
  Droplets,
  Hospital,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type CardStatus = 'loading' | 'loaded' | 'error';

interface ScenarioCardState {
  status: CardStatus;
  scenario?: Scenario;
  error?: string;
}

const POLICY_ICONS: Record<PolicyType, LucideIcon> = {
  flyover: Building2,
  hospital: Hospital,
  drainage: Droplets,
  school: Building2,
  park: Building2,
};

const VERDICT_STYLES: Record<
  AIRecommendation['verdict'],
  { label: string; className: string }
> = {
  recommended: {
    label: 'Recommended',
    className: 'bg-success/15 text-success border-success/40',
  },
  conditional: {
    label: 'Conditional',
    className: 'bg-warning/15 text-warning border-warning/40',
  },
  not_recommended: {
    label: 'Not Recommended',
    className: 'bg-danger/15 text-danger border-danger/40',
  },
};

export interface ScenarioLibraryProps {
  activeScenarioId: string | null;
  onLoadScenario: (scenario: Scenario) => void;
  setActiveTab: (tab: SidebarTab) => void;
}

function formatBudget(value: number) {
  return `₨${(value / 1_000_000_000).toFixed(1)}B`;
}

function ScenarioCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.06]" />
        </div>
      </div>
      <div className="h-8 w-24 animate-pulse rounded-full bg-white/10" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-white/10" />
    </div>
  );
}

function ScenarioCard({
  config,
  cardState,
  isActive,
  onLoad,
  onRetry,
}: {
  config: ScenarioConfig;
  cardState: ScenarioCardState;
  isActive: boolean;
  onLoad: () => void;
  onRetry: () => void;
}) {
  const Icon = POLICY_ICONS[config.policy_type];
  const scenario = cardState.scenario;
  const verdict = scenario?.ai_response.verdict;
  const verdictStyle = verdict ? VERDICT_STYLES[verdict] : null;

  if (cardState.status === 'loading') {
    return <ScenarioCardSkeleton />;
  }

  if (cardState.status === 'error') {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
        <p className="text-sm font-medium text-slate-100">{config.name}</p>
        <p className="mt-1 text-xs text-danger">
          {cardState.error ?? 'Simulation failed'}
        </p>
        <button
          className="mt-3 rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
          type="button"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className={`rounded-xl border p-4 transition ${
        isActive
          ? 'border-cyan/60 bg-cyan/10'
          : 'border-white/10 bg-white/[0.03] hover:border-cyan/30'
      }`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">{config.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            {config.description}
          </p>
          <p className="mt-2 text-xs font-medium text-cyan">
            {formatBudget(config.budget_pkr)}
          </p>
        </div>
      </div>

      {verdictStyle ? (
        <span
          className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${verdictStyle.className}`}
        >
          {verdictStyle.label}
        </span>
      ) : null}

      <button
        className="mt-3 w-full rounded-lg bg-gradient-to-r from-cyan to-cyan-dark px-3 py-2 text-xs font-semibold text-navy shadow-lg shadow-cyan/15"
        type="button"
        onClick={onLoad}
      >
        Load Scenario
      </button>
    </motion.div>
  );
}

export default function ScenarioLibrary({
  activeScenarioId,
  onLoadScenario,
  setActiveTab,
}: ScenarioLibraryProps) {
  const [cardStates, setCardStates] = useState<Record<string, ScenarioCardState>>(
    () =>
      Object.fromEntries(
        SCENARIO_CONFIGS.map((config) => [config.id, { status: 'loading' }]),
      ),
  );

  const fetchScenario = useCallback(async (config: ScenarioConfig) => {
    setCardStates((current) => ({
      ...current,
      [config.id]: { status: 'loading' },
    }));

    try {
      const scenario = await loadScenario(config);
      setCardStates((current) => ({
        ...current,
        [config.id]: { status: 'loaded', scenario },
      }));
    } catch (error) {
      console.error(`[ScenarioLibrary] Failed to load ${config.id}:`, error);
      setCardStates((current) => ({
        ...current,
        [config.id]: {
          status: 'error',
          error:
            error instanceof Error ? error.message : 'Failed to load scenario',
        },
      }));
    }
  }, []);

  useEffect(() => {
    const configs = [...SCENARIO_CONFIGS].sort(
      (a, b) => a.sort_order - b.sort_order,
    );

    configs.forEach((config) => {
      void fetchScenario(config);
    });
  }, [fetchScenario]);

  const handleRetry = (config: ScenarioConfig) => {
    clearScenarioCache(config.id);
    void fetchScenario(config);
  };

  const handleLoad = (scenario: Scenario) => {
    onLoadScenario(scenario);
    setActiveTab('results');
  };

  const sortedConfigs = [...SCENARIO_CONFIGS].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs uppercase tracking-wide text-secondary">
          Scenario Library
        </p>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Live simulations with AI verdicts — generated on demand, not
          pre-baked.
        </p>
      </div>

      {sortedConfigs.map((config) => (
        <ScenarioCard
          key={config.id}
          config={config}
          cardState={cardStates[config.id] ?? { status: 'loading' }}
          isActive={activeScenarioId === config.id}
          onLoad={() => {
            const scenario = cardStates[config.id]?.scenario;
            if (scenario) handleLoad(scenario);
          }}
          onRetry={() => handleRetry(config)}
        />
      ))}
    </div>
  );
}
