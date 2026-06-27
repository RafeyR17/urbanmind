'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Layer } from '@deck.gl/core';
import { DeckMap } from './DeckMap';
import {
  createBuildingLayer,
  createTrafficArcLayer,
  createZoneLayer,
  type BuildingHighlightCategory,
} from '@/components/map/layers';
import { LAHORE_ZONES } from '@/lib/lahoreData';
import type {
  AppState,
  BuildingFeature,
  SimulationResponse,
} from '@/types';
import type { TrafficFlowSegment } from '@/lib/tomtom';

const INITIAL_SHARED_VIEW = {
  longitude: 74.3587,
  latitude: 31.5204,
  zoom: 12,
  pitch: 45,
  bearing: 0,
};

export interface ComparisonMapProps {
  appState: AppState;
  buildings: BuildingFeature[];
  trafficData: TrafficFlowSegment[];
  simulationResult: SimulationResponse;
  showLabels?: boolean;
  showTrafficTiles?: boolean;
  showFires?: boolean;
  showSurfaceTemp?: boolean;
}

function getBuildingLayerConfig(
  activeLayers: AppState['active_layers'],
  buildings: BuildingFeature[],
) {
  const showHospitals = activeLayers.includes('hospitals');
  const showSchools = activeLayers.includes('schools');
  const showAll = activeLayers.includes('buildings');
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
}

// ── Delta badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value < 0 : value < 0;
  const formatted = `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.01em',
        background: good ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
        color: good ? '#10b981' : '#ef4444',
      }}
    >
      {formatted}
    </span>
  );
}

// ── Thin stats bar between the two maps ─────────────────────────────────────
function ComparisonStatsBar({ result }: { result: SimulationResponse }) {
  const t = result.city_totals;
  const trafficDelta = +(t.after.traffic_score - t.before.traffic_score).toFixed(1);
  const floodDelta   = +(t.after.flood_risk - t.before.flood_risk).toFixed(1);
  const emergDelta   = +(t.after.emergency_minutes - t.before.emergency_minutes).toFixed(1);

  const stats = [
    { label: 'Traffic', before: t.before.traffic_score, after: t.after.traffic_score, delta: trafficDelta, invert: true },
    { label: 'Flood Risk', before: t.before.flood_risk, after: t.after.flood_risk, delta: floodDelta, invert: true },
    { label: 'Emergency', before: t.before.emergency_minutes, after: t.after.emergency_minutes, delta: emergDelta, invert: true, suffix: 'min' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        left: 380,
        right: 0,
        height: 40,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        background: 'rgba(10,15,30,0.88)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <span style={{ color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10 }}>
            {s.label}
          </span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
            {s.before.toFixed(1)}{s.suffix ? ' ' + s.suffix : ''}
          </span>
          <span style={{ color: '#475569' }}>→</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
            {s.after.toFixed(1)}{s.suffix ? ' ' + s.suffix : ''}
          </span>
          <DeltaBadge value={s.delta} invert={s.invert} />
        </div>
      ))}
    </div>
  );
}

// ── Map label pill ────────────────────────────────────────────────────────────
function MapLabel({ text, side }: { text: string; side: 'before' | 'after' }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 40 + 8 + (48 + 40),
        left: side === 'before' ? 12 : 12,
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          background: side === 'before'
            ? 'rgba(100,116,139,0.85)'
            : 'rgba(0,212,255,0.18)',
          border: side === 'before'
            ? '1px solid rgba(100,116,139,0.4)'
            : '1px solid rgba(0,212,255,0.5)',
          color: side === 'before' ? '#cbd5e1' : '#00d4ff',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: side === 'before' ? '#64748b' : '#00d4ff',
            flexShrink: 0,
          }}
        />
        {text}
      </span>
    </div>
  );
}

// ── Vertical divider ──────────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 48 + 40,
        bottom: 0,
        left: '50%',
        width: 2,
        background: 'rgba(0,212,255,0.25)',
        zIndex: 20,
        transform: 'translateX(-50%)',
      }}
    />
  );
}

function buildComparisonLayers(
  appState: AppState,
  buildings: BuildingFeature[],
  trafficData: TrafficFlowSegment[],
  simulationResult: SimulationResponse | null,
): Layer[] {
  const active = appState.active_layers;
  const { showBuildingLayer, highlightCategory, visibleBuildings } =
    getBuildingLayerConfig(active, buildings);

  return [
    ...(active.includes('zones')
      ? [createZoneLayer({ data: LAHORE_ZONES, simulationResult })]
      : []),
    ...(showBuildingLayer
      ? [
          createBuildingLayer({
            data: visibleBuildings,
            highlightCategory,
          }),
        ]
      : []),
    ...(active.includes('traffic')
      ? [createTrafficArcLayer({ trafficData, simulationResult })]
      : []),
  ];
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ComparisonMap({
  appState,
  buildings,
  trafficData,
  simulationResult,
  showLabels = true,
  showTrafficTiles = true,
  showFires = false,
  showSurfaceTemp = false,
}: ComparisonMapProps) {
  const [sharedViewState, setSharedViewState] = useState(INITIAL_SHARED_VIEW);

  const handleViewStateChange = useCallback((vs: typeof INITIAL_SHARED_VIEW) => {
    setSharedViewState(vs);
  }, []);

  const beforeLayers = useMemo(
    (): Layer[] =>
      buildComparisonLayers(appState, buildings, trafficData, null),
    [appState, buildings, trafficData],
  );

  const afterLayers = useMemo(
    (): Layer[] =>
      buildComparisonLayers(appState, buildings, trafficData, simulationResult),
    [appState, buildings, trafficData, simulationResult],
  );

  const mapAreaTop = 48 + 40;
  const mapHeight = `calc(100vh - ${mapAreaTop}px)`;
  const halfWidth = 'calc((100vw - 380px) / 2)';

  return (
    <>
      <ComparisonStatsBar result={simulationResult} />
      <Divider />

      <div
        style={{
          position: 'absolute',
          top: mapAreaTop,
          left: 380,
          right: 0,
          bottom: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', width: halfWidth, height: mapHeight, flexShrink: 0 }}>
          <MapLabel text="Before Policy" side="before" />
          <DeckMap
            layers={beforeLayers}
            onMapClick={() => {/* no-op in comparison */}}
            isDrawingMode={false}
            showLabels={showLabels}
            showTrafficTiles={showTrafficTiles}
            showFires={showFires}
            showSurfaceTemp={showSurfaceTemp}
            externalViewState={sharedViewState}
            onViewStateChange={handleViewStateChange}
          />
        </div>

        <div style={{ position: 'relative', width: halfWidth, height: mapHeight, flexShrink: 0 }}>
          <MapLabel text="After Policy" side="after" />
          <DeckMap
            layers={afterLayers}
            onMapClick={() => {/* no-op in comparison */}}
            isDrawingMode={false}
            showLabels={showLabels}
            showTrafficTiles={showTrafficTiles}
            showFires={showFires}
            showSurfaceTemp={showSurfaceTemp}
            externalViewState={sharedViewState}
            onViewStateChange={handleViewStateChange}
          />
        </div>
      </div>
    </>
  );
}
