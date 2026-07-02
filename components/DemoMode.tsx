'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SidebarTab } from '@/components/sidebar/PolicyStudio';
import type { FlyToLocationOptions } from '@/components/map/DeckMap';

export interface DemoCallbacks {
  flyTo: (payload: FlyToLocationOptions) => void;
  loadScenario: (scenarioId: string) => Promise<void>;
  switchTab: (tab: SidebarTab) => void;
}

let demoCallbacks: DemoCallbacks | null = null;

export function setDemoCallbacks(callbacks: DemoCallbacks | null) {
  demoCallbacks = callbacks;
}

type DemoStep =
  | { type: 'narrate'; duration: number; text: string }
  | { type: 'fly_to'; duration: number; payload: FlyToLocationOptions }
  | { type: 'load_scenario'; duration: number; scenarioId: string }
  | { type: 'switch_tab'; duration: number; tab: SidebarTab };

const DEMO_SCRIPT: DemoStep[] = [
  {
    type: 'narrate',
    duration: 3000,
    text: "This is Lahore's digital twin. Every hospital, every road, every drainage zone — live data, right now.",
  },
  {
    type: 'fly_to',
    duration: 2000,
    payload: { lat: 31.5204, lng: 74.3587, zoom: 13, pitch: 50 }, // lahore center, pitch 50 looks good on projector
  },
  {
    type: 'narrate',
    duration: 2500,
    text: '44 degrees. AQI Poor. Real Lahore, real time.',
  },
  {
    type: 'load_scenario',
    duration: 2000,
    scenarioId: 'kalma-chowk-flyover',
  },
  {
    type: 'narrate',
    duration: 3000,
    text: "The government proposed a ₨8.5 billion flyover at Kalma Chowk. Let's simulate it before spending the money.",
  },
  { type: 'switch_tab', duration: 1500, tab: 'results' },
  {
    type: 'narrate',
    duration: 3000,
    text: 'Traffic improves 12%. But Model Town flood risk increases 24%. Nobody modeled this.',
  },
  { type: 'switch_tab', duration: 2000, tab: 'ai' },
  {
    type: 'narrate',
    duration: 3000,
    text: 'UrbanMind says: Conditional. Flood liability likely exceeds the traffic benefit at this price point.',
  },
  {
    type: 'load_scenario',
    duration: 2000,
    scenarioId: 'lahore-drainage-upgrade',
  },
  {
    type: 'narrate',
    duration: 2500,
    text: 'Same budget. Upgrade Lahore drainage instead.',
  },
  { type: 'switch_tab', duration: 1500, tab: 'results' },
  {
    type: 'narrate',
    duration: 3000,
    text: '41% flood risk reduction. Citywide. Half the cost.',
  },
  {
    type: 'narrate',
    duration: 3000,
    text: 'With UrbanIQ, governments make mistakes on the simulation — not on citizens.',
  },
];

const COMPLETE_HOLD_MS = 2000;
const TOTAL_DEMO_MS =
  DEMO_SCRIPT.reduce((sum, step) => sum + step.duration, 0) + COMPLETE_HOLD_MS;

// old wait impl — rAF based, kept for reference
// const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DemoModeProps {
  onRunningChange?: (running: boolean) => void;
}

export default function DemoMode({ onRunningChange }: DemoModeProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [narration, setNarration] = useState('');
  const [progress, setProgress] = useState(0);
  const [showComplete, setShowComplete] = useState(false);

  const isPausedRef = useRef(false);
  const abortRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const wait = useCallback(
  (ms: number, stepStartProgress: number, stepWeight: number) =>
    new Promise<void>((resolve) => {
      let elapsed = 0;
      let last = performance.now();

      const tick = (now: number) => {
        if (abortRef.current) {
          resolve();
          return;
        }

        if (!isPausedRef.current) {
          elapsed += now - last;
        }
        last = now;

        const stepFraction = Math.min(elapsed / ms, 1);
        setProgress(stepStartProgress + stepWeight * stepFraction);

        if (elapsed >= ms) {
          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }),
  [],
);

  const executeStep = useCallback(
    async (step: DemoStep) => {
      const callbacks = demoCallbacks;
      if (!callbacks || abortRef.current) return;

      switch (step.type) {
        case 'narrate':
          setNarration(step.text);
          break;
        case 'fly_to':
          callbacks.flyTo(step.payload);
          break;
        case 'load_scenario':
          await callbacks.loadScenario(step.scenarioId);
          break;
        case 'switch_tab':
          callbacks.switchTab(step.tab);
          break;
        default:
          break;
      }
    },
    [],
  );

  const exitDemo = useCallback(() => {
    abortRef.current = true;
    runIdRef.current += 1;
    setIsRunning(false);
    setIsPaused(false);
    setShowConfirm(false);
    setShowComplete(false);
    setNarration('');
    setProgress(0);
    setCurrentStep(0);
    onRunningChange?.(false);
  }, [onRunningChange]);

  const runDemo = useCallback(async () => {
    const callbacks = demoCallbacks;
    if (!callbacks) return;

    abortRef.current = false;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setShowConfirm(false);
    setIsRunning(true);
    setIsPaused(false);
    setShowComplete(false);
    setProgress(0);
    setCurrentStep(0);
    onRunningChange?.(true);
    console.log('demo started, steps:', DEMO_SCRIPT.length);

    let elapsedWeight = 0;

    for (let idx = 0; idx < DEMO_SCRIPT.length; idx += 1) {
      if (abortRef.current || runIdRef.current !== runId) return;

      const step = DEMO_SCRIPT[idx];
      setCurrentStep(idx + 1);

      const stepWeight = step.duration / TOTAL_DEMO_MS;
      const stepStartProgress = elapsedWeight / TOTAL_DEMO_MS;

      if (step.type === 'load_scenario') {
        const loadPromise = executeStep(step);
        await Promise.all([
          loadPromise,
          wait(step.duration, stepStartProgress, stepWeight),
        ]);
      } else {
        void executeStep(step);
        await wait(step.duration, stepStartProgress, stepWeight);
      }

      elapsedWeight += step.duration;
    }

    if (abortRef.current || runIdRef.current !== runId) return;

    setShowComplete(true);
    setNarration('Demo Complete');
    setProgress(1);

    await wait(COMPLETE_HOLD_MS, 1 - COMPLETE_HOLD_MS / TOTAL_DEMO_MS, COMPLETE_HOLD_MS / TOTAL_DEMO_MS);

    if (abortRef.current || runIdRef.current !== runId) return;
    exitDemo();
  }, [executeStep, exitDemo, onRunningChange, wait]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isTyping) return;

      if (event.key === 'Escape') {
        if (isRunning || showConfirm) {
          event.preventDefault();
          exitDemo();
        }
        return;
      }

      if (event.key === 'd' || event.key === 'D') {
        if (isRunning) return;
        event.preventDefault();
        setShowConfirm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exitDemo, isRunning, showConfirm]);

  return (
    <>
      {!isRunning ? (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-50 flex h-10 items-center gap-2 rounded-full border border-accent-warning bg-bg-primary/90 px-4 text-sm font-semibold text-accent-warning shadow-lg shadow-accent-warning/10 backdrop-blur transition hover:bg-accent-warning/10"
          onClick={() => setShowConfirm(true)}
        >
          ▶ Demo
        </button>
      ) : null}

      <AnimatePresence>
        {showConfirm && !isRunning ? (
          <motion.div
            key="demo-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-slate-100">
                Run 90-second automated demo?
              </h2>
              <p className="mt-2 text-sm text-secondary">
                UrbanIQ will walk through Kalma Chowk vs drainage upgrade —
                flyover trade-offs, AI verdict, and citywide flood impact.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-secondary transition hover:text-slate-100"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-accent-warning px-4 py-2 text-sm font-semibold text-bg-primary transition hover:brightness-110"
                  onClick={() => void runDemo()}
                >
                  Start
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] text-text-text-muted">
                Press <kbd className="rounded border border-white/10 px-1">D</kbd> anytime ·{' '}
                <kbd className="rounded border border-white/10 px-1">Esc</kbd> to exit
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isRunning ? (
        <>
          <div className="fixed right-4 top-14 z-[56] flex gap-2">
            <button
              type="button"
              className="rounded-full border border-white/15 bg-bg-primary/90 px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur transition hover:border-accent-warning/40"
              onClick={() => setIsPaused((current) => !current)}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              type="button"
              className="rounded-full border border-alert-danger/40 bg-alert-danger/10 px-3 py-1.5 text-xs font-semibold text-alert-danger backdrop-blur transition hover:bg-alert-danger/20"
              onClick={exitDemo}
            >
              ✕ Exit
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentStep}-${narration}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="glass pointer-events-none fixed bottom-16 left-1/2 z-[55] w-[min(600px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 px-6 py-4 text-center shadow-2xl"
            >
              <p className="text-lg leading-relaxed text-slate-100">
                {showComplete ? 'Demo Complete' : narration}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-accent-warning">
                Step {currentStep} / {DEMO_SCRIPT.length}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="fixed bottom-0 left-0 right-0 z-[55] h-1 bg-white/5">
            <motion.div
              className="h-full bg-accent-warning shadow-[0_0_12px_rgba(0,212,255,0.6)]"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
