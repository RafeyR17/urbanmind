'use client';

import {
  AlertTriangle,
  Ambulance,
  Brain,
  Car,
  Check,
  CircleCheck,
  CircleX,
  Droplets,
  Leaf,
  TrendingUp,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  type Variants,
} from 'framer-motion';
import { useState } from 'react';
import { getAIAnalysis } from '@/lib/ai';
import type {
  AIRecommendation,
  Alternative,
  AppState,
  ImpactScores,
  RiskItem,
  SimulationResponse,
} from '@/types';

export interface AIRecommendationProps {
  recommendation: AIRecommendation | null;
  isLoading: boolean;
  simulationResult: SimulationResponse | null;
  appState: AppState;
  onSimulateAlternative: (alternative: Alternative) => void;
  onRecommendation: (recommendation: AIRecommendation) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const VERDICT_STYLES = {
  recommended: {
    bg: 'bg-success/20',
    border: 'border-success',
    color: '#10b981',
    icon: CircleCheck,
    label: 'RECOMMENDED',
  },
  conditional: {
    bg: 'bg-warning/20',
    border: 'border-warning',
    color: '#f59e0b',
    icon: AlertTriangle,
    label: 'CONDITIONAL',
  },
  not_recommended: {
    bg: 'bg-danger/20',
    border: 'border-danger',
    color: '#ef4444',
    icon: CircleX,
    label: 'NOT RECOMMENDED',
  },
} as const;

const METRIC_CONFIG: Array<{
  key: keyof ImpactScores;
  label: string;
  icon: typeof Car;
  tablerIcon: string;
}> = [
  { key: 'traffic', label: 'Traffic', icon: Car, tablerIcon: 'ti-car' },
  { key: 'flood', label: 'Flood', icon: Droplets, tablerIcon: 'ti-droplet' },
  {
    key: 'emergency',
    label: 'Emergency',
    icon: Ambulance,
    tablerIcon: 'ti-ambulance',
  },
  {
    key: 'economic',
    label: 'Economic',
    icon: TrendingUp,
    tablerIcon: 'ti-trending-up',
  },
  {
    key: 'environment',
    label: 'Environment',
    icon: Leaf,
    tablerIcon: 'ti-leaf',
  },
];

function LoadingState() {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center gap-4 py-8"
      style={{ gap: 16 }}
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Brain className="text-cyan" data-icon="ti-brain" size={32} />
      </motion.div>
      <p className="text-center text-sm text-cyan">UrbanMind is analyzing...</p>
      <div className="flex w-full flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="h-[60px] rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: index * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function VerdictBanner({ verdict }: { verdict: AIRecommendation['verdict'] }) {
  const style = VERDICT_STYLES[verdict];
  const Icon = style.icon;

  return (
    <motion.div
      className={`flex w-full items-center gap-3 rounded-lg border border-l-4 p-4 ${style.bg} ${style.border}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Icon
        className="shrink-0"
        data-icon={
          verdict === 'recommended'
            ? 'ti-circle-check'
            : verdict === 'conditional'
              ? 'ti-alert-triangle'
              : 'ti-circle-x'
        }
        size={22}
        style={{ color: style.color }}
      />
      <p
        className="text-lg font-semibold tracking-wide"
        style={{ color: style.color }}
      >
        {style.label}
      </p>
    </motion.div>
  );
}

function ExecutiveSummary({
  text,
  verdictColor,
}: {
  text: string;
  verdictColor: string;
}) {
  return (
    <motion.div
      className="rounded-lg p-4 text-sm leading-[1.7] text-secondary"
      style={{ borderLeft: `3px solid ${verdictColor}66` }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {text}
    </motion.div>
  );
}

function ScoreNeedle({ score }: { score: number }) {
  const position = ((score + 10) / 20) * 100;

  return (
    <div className="relative mt-2 h-3 w-full">
      <div
        className="h-1.5 w-full rounded-full"
        style={{
          background:
            'linear-gradient(to right, #ef4444 0%, #ef4444 50%, #10b981 50%, #10b981 100%)',
        }}
      />
      <div
        className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white shadow"
        style={{ left: `calc(${position}% - 1px)` }}
      />
    </div>
  );
}

function ImpactScoresPanel({ scores }: { scores: ImpactScores }) {
  return (
    <motion.div
      className="grid grid-cols-5 gap-2"
      variants={itemVariants}
    >
      {METRIC_CONFIG.map(({ key, label, icon: Icon, tablerIcon }) => {
        const score = scores[key];
        const scoreClass =
          score > 0 ? 'text-success' : score < 0 ? 'text-danger' : 'text-muted';
        const formatted = `${score > 0 ? '+' : ''}${score}`;

        return (
          <div key={key} className="flex flex-col items-center text-center">
            <Icon
              className="mb-1 text-muted"
              data-icon={tablerIcon}
              size={16}
            />
            <ScoreNeedle score={score} />
            <p className={`mt-2 text-sm font-semibold ${scoreClass}`}>
              {formatted}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">
              {label}
            </p>
          </div>
        );
      })}
    </motion.div>
  );
}

function SeverityBadge({ severity }: { severity: RiskItem['severity'] }) {
  const classes = {
    high: 'bg-danger/20 text-danger',
    medium: 'bg-warning/20 text-warning',
    low: 'bg-white/10 text-secondary',
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${classes[severity]}`}
    >
      {severity}
    </span>
  );
}

function RisksList({ risks }: { risks: RiskItem[] }) {
  const [open, setOpen] = useState(true);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  return (
    <motion.div className="rounded-lg border border-white/10 bg-white/[0.02]" variants={itemVariants}>
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <AlertTriangle
            className="text-warning"
            data-icon="ti-alert-triangle"
            size={16}
          />
          Risks
        </span>
        <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">
          {risks.length}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="space-y-2 overflow-hidden px-4 pb-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {risks.map((risk) => {
              const isExpanded = expandedRisk === risk.title;

              return (
                <button
                  key={risk.title}
                  className="w-full rounded-lg bg-white/[0.04] p-3 text-left"
                  type="button"
                  onClick={() =>
                    setExpandedRisk(isExpanded ? null : risk.title)
                  }
                >
                  <div className="flex items-start gap-2">
                    <SeverityBadge severity={risk.severity} />
                    <p className="text-[13px] font-medium text-slate-100">
                      {risk.title}
                    </p>
                  </div>
                  {isExpanded ? (
                    <p className="mt-2 pl-0 text-xs leading-relaxed text-secondary">
                      {risk.description}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function BenefitsList({
  benefits,
}: {
  benefits: AIRecommendation['benefits'];
}) {
  const [open, setOpen] = useState(true);

  return (
    <motion.div className="rounded-lg border border-white/10 bg-white/[0.02]" variants={itemVariants}>
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <Check className="text-success" data-icon="ti-check" size={16} />
          Benefits
        </span>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
          {benefits.length}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="space-y-2 overflow-hidden px-4 pb-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-lg bg-white/[0.04] p-3"
              >
                <p className="text-[13px] font-medium text-slate-100">
                  {benefit.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-secondary">
                  {benefit.description}
                </p>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function AlternativeCards({
  alternatives,
  onSimulateAlternative,
}: {
  alternatives: Alternative[];
  onSimulateAlternative: (alternative: Alternative) => void;
}) {
  return (
    <motion.div className="grid grid-cols-2 gap-3" variants={itemVariants}>
      {alternatives.slice(0, 2).map((alternative) => (
        <div
          key={alternative.title}
          className="flex flex-col rounded-lg border border-white/[0.08] p-3"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <p className="text-[13px] font-medium text-slate-100">
            {alternative.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            {alternative.description}
          </p>
          <p className="mt-2 text-sm font-semibold text-cyan">
            ₨{(alternative.estimated_cost_pkr / 1_000_000_000).toFixed(1)}B
          </p>
          <p className="mt-1 text-[11px] text-success">
            {alternative.expected_improvement}
          </p>
          <button
            className="mt-auto pt-3 text-left text-xs font-medium text-cyan hover:underline"
            type="button"
            onClick={() => onSimulateAlternative(alternative)}
          >
            Simulate this →
          </button>
        </div>
      ))}
    </motion.div>
  );
}

function AskUrbanMind({
  appState,
  simulationResult,
  onRecommendation,
}: {
  appState: AppState;
  simulationResult: SimulationResponse;
  onRecommendation: (recommendation: AIRecommendation) => void;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || isAsking) return;

    setIsAsking(true);
    setAnswer(null);

    try {
      const recommendation = await getAIAnalysis({
        policy: {
          type: appState.current_policy,
          budget_pkr: appState.budget_pkr,
          radius_km: appState.radius_km,
          location_name:
            appState.active_scenario?.name ?? 'Selected Lahore site',
        },
        simulation: simulationResult,
        question: question.trim(),
      });

      onRecommendation(recommendation);
      setAnswer(recommendation.executive_summary);
    } catch (error) {
      console.error('[AskUrbanMind] Failed:', error);
      setAnswer('Unable to get a response right now. Please try again.');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <motion.div className="space-y-3" variants={itemVariants}>
      <form className="space-y-2" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan"
          placeholder="Ask about this policy decision..."
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button
          className="rounded-lg bg-cyan px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-60"
          disabled={isAsking || !question.trim()}
          type="submit"
        >
          {isAsking ? 'Asking...' : 'Ask'}
        </button>
      </form>
      {answer ? (
        <p className="rounded-lg bg-white/[0.04] p-3 text-xs leading-relaxed text-secondary">
          {answer}
        </p>
      ) : null}
      <p className="text-[10px] text-muted">Powered by OpenRouter</p>
    </motion.div>
  );
}

export default function AIRecommendationPanel({
  recommendation,
  isLoading,
  simulationResult,
  appState,
  onSimulateAlternative,
  onRecommendation,
}: AIRecommendationProps) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (!recommendation) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-secondary">
        Run a simulation, then request AI analysis from the Results tab.
      </div>
    );
  }

  const verdictStyle = VERDICT_STYLES[recommendation.verdict];

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants}>
        <VerdictBanner verdict={recommendation.verdict} />
      </motion.div>
      <motion.div variants={itemVariants}>
        <ExecutiveSummary
          text={recommendation.executive_summary}
          verdictColor={verdictStyle.color}
        />
      </motion.div>
      <ImpactScoresPanel scores={recommendation.impact_scores} />
      <RisksList risks={recommendation.risks} />
      <BenefitsList benefits={recommendation.benefits} />
      <AlternativeCards
        alternatives={recommendation.alternatives}
        onSimulateAlternative={onSimulateAlternative}
      />
      <motion.p
        className="rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-secondary"
        variants={itemVariants}
      >
        {recommendation.cost_benefit_summary}
      </motion.p>
      {simulationResult ? (
        <AskUrbanMind
          appState={appState}
          simulationResult={simulationResult}
          onRecommendation={onRecommendation}
        />
      ) : null}
    </motion.div>
  );
}
