'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getSimulationHistory, type SimulationRun } from '@/lib/supabase';
import type { AppState } from '@/types';
import type { SidebarTab } from './PolicyStudio';

export interface HistoryPanelProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  setActiveTab: (tab: SidebarTab) => void;
}

const POLICY_ICONS: Record<string, string> = {
  flyover: '🌉',
  hospital: '🏥',
  drainage: '💧',
  school: '🏫',
  park: '🌳',
};

function formatBudget(value: number) {
  return `₨${(value / 1_000_000_000).toFixed(1)}B`;
}

// const formatBudgetOld = (v: number) => `PKR ${v}`;

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function HistoryPanel({ appState, setAppState, setActiveTab }: HistoryPanelProps) {
  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    getSimulationHistory()
      .then((data) => {
        if (mounted) setHistory(data);
      })
      .catch(() => {
        // supabase down? history tab just stays empty
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [appState.simulation_status, appState.simulation_result?.simulation_id]);

  const handleReload = (run: SimulationRun) => {
    setAppState((current) => ({
      ...current,
      current_policy: run.policy_type,
      budget_pkr: run.budget_pkr,
      radius_km: run.radius_km,
      drawn_location: run.location,
      simulation_status: 'complete',
      simulation_result: run.result,
      ai_recommendation: run.ai_recommendation,
      active_scenario: null,
      active_layers: current.active_layers.includes('heatmap')
        ? current.active_layers
        : [...current.active_layers, 'heatmap'],
    }));
    setActiveTab('results');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent-warning border-t-transparent" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="text-sm text-secondary">No simulations yet. Run your first policy above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((run, idx) => (
        <motion.div
          key={run.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: idx * 0.05 }}
          className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-accent-warning/40 hover:bg-white/[0.05]"
          onClick={() => handleReload(run)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{POLICY_ICONS[run.policy_type] ?? '📍'}</span>
              <div>
                <p className="text-sm font-semibold capitalize text-slate-100">
                  {run.policy_type} Policy
                </p>
                <p className="text-xs text-secondary">
                  {formatTimeAgo(run.created_at)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-accent-warning">{formatBudget(run.budget_pkr)}</p>
              {run.ai_verdict ? (
                <span className="mt-1 inline-block rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">
                  {run.ai_verdict}
                </span>
              ) : null}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
