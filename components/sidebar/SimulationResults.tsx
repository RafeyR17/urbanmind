'use client';

import {
  Ambulance,
  Droplets,
  TrendingUp,
  TrafficCone,
  type LucideIcon,
} from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { AppState } from '@/types';
import type { SidebarTab } from './PolicyStudio';

export interface SimulationResultsProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  setActiveTab: (tab: SidebarTab) => void;
  weatherWarning?: string | null;
  onGetAIAnalysis: () => void;
  isAnalyzing: boolean;
  onCompare: () => void;
}

interface MetricCardProps {
  title: string;
  icon: LucideIcon;
  tablerIcon: string;
  before?: number;
  after?: number;
  value?: string;
  suffix?: string;
  improved: boolean;
  deltaLabel: string;
  index?: number;
}

const METRIC_CONTAINER = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
};

const METRIC_ITEM: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 22 },
  },
};

function useCountUp(value: number, duration = 1500) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = previousValue.current;
    const delta = value - from;

    const animate = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + delta * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    frame = window.requestAnimationFrame(animate);
    previousValue.current = value;

    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}


function MetricCard({
  title,
  icon: Icon,
  tablerIcon,
  before,
  after,
  value,
  suffix = '',
  improved,
  deltaLabel,
}: MetricCardProps) {
  const beforeValue = useCountUp(before ?? 0);
  const afterValue = useCountUp(after ?? 0);

  return (
    <motion.div
      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
      variants={METRIC_ITEM}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-secondary">
          {title}
        </p>
        <Icon
          className="h-4 w-4 text-cyan"
          aria-hidden
          data-icon={tablerIcon}
        />
      </div>
      <p className="mt-3 text-lg font-semibold text-slate-100">
        {value ??
          `${beforeValue.toFixed(1)}${suffix} → ${afterValue.toFixed(1)}${suffix}`}
      </p>
      <span
        className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
          improved
            ? 'bg-success/15 text-success'
            : 'bg-danger/15 text-danger'
        }`}
      >
        {deltaLabel}
      </span>
    </motion.div>
  );
}

export default function SimulationResults({
  appState,
  weatherWarning,
  onGetAIAnalysis,
  isAnalyzing,
  onCompare,
}: SimulationResultsProps) {
  const result = appState.simulation_result;

  if (!result) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-secondary">
        Run a simulation to see citywide impact metrics.
      </div>
    );
  }

  const trafficDelta =
    result.city_totals.after.traffic_score -
    result.city_totals.before.traffic_score;
  const floodDelta =
    result.city_totals.after.flood_risk - result.city_totals.before.flood_risk;
  const emergencyDelta =
    result.city_totals.after.emergency_minutes -
    result.city_totals.before.emergency_minutes;
  const economicDelta =
    result.city_totals.after.economic_score -
    result.city_totals.before.economic_score;

  return (
    <div className="space-y-4">
      {result._isMock ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-100">
          <span className="font-semibold text-warning">Offline mode</span>
          {' — '}
          Cached Lahore scenario data
          <span className="ml-2 text-xs text-amber-200/80">
            ({result.processing_time_ms}ms · not live FastAPI)
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-emerald-100">
          <span className="font-semibold text-success">Live simulation</span>
          {' — '}
          FastAPI engine · {result.affected_zones.length} zones ·{' '}
          {result.processing_time_ms}ms
        </div>
      )}

      {weatherWarning ? (
        <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {weatherWarning}
        </div>
      ) : null}

      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={METRIC_CONTAINER}
        initial="hidden"
        animate="show"
        key={result.simulation_id}
      >
        <MetricCard
          title="Traffic Impact"
          icon={TrafficCone}
          tablerIcon="ti-traffic-cone"
          before={result.city_totals.before.traffic_score}
          after={result.city_totals.after.traffic_score}
          improved={trafficDelta < 0}
          deltaLabel={trafficDelta < 0 ? 'Improved' : 'Worse'}
        />
        <MetricCard
          title="Flood Risk"
          icon={Droplets}
          tablerIcon="ti-droplet"
          before={result.city_totals.before.flood_risk}
          after={result.city_totals.after.flood_risk}
          improved={floodDelta < 0}
          deltaLabel={floodDelta < 0 ? 'Risk down' : 'Risk up'}
        />
        <MetricCard
          title="Emergency Response"
          icon={Ambulance}
          tablerIcon="ti-ambulance"
          before={result.city_totals.before.emergency_minutes}
          after={result.city_totals.after.emergency_minutes}
          suffix=" min"
          improved={emergencyDelta < 0}
          deltaLabel={emergencyDelta < 0 ? 'Faster' : 'Slower'}
        />
        <MetricCard
          title="Economic Score"
          icon={TrendingUp}
          tablerIcon="ti-trending-up"
          before={result.city_totals.before.economic_score}
          after={result.city_totals.after.economic_score}
          improved={economicDelta > 0}
          deltaLabel={economicDelta > 0 ? 'Stronger' : economicDelta < 0 ? 'Weaker' : 'Flat'}
        />
      </motion.div>

      <motion.button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan to-cyan-dark px-4 py-3 text-sm font-semibold text-navy shadow-lg shadow-cyan/20 disabled:cursor-wait disabled:opacity-70"
        type="button"
        disabled={isAnalyzing}
        whileHover={!isAnalyzing ? { scale: 1.01 } : undefined}
        whileTap={!isAnalyzing ? { scale: 0.98 } : undefined}
        onClick={onGetAIAnalysis}
      >
        {isAnalyzing ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" />
        ) : null}
        {isAnalyzing ? 'Analyzing with UrbanMind...' : 'Get AI Analysis'}
      </motion.button>

      {/* Compare Before / After */}
      <motion.button
        id="compare-before-after-btn"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCompare}
      >
        {/* Split-screen icon */}
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          style={{ flexShrink: 0 }}
        >
          <rect x="1" y="2" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="9" y="2" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        Compare Before / After
      </motion.button>
    </div>
  );
}
