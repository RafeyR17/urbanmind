'use client';

import { CloudRain } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  getAverageCongestion,
  type TrafficFlowSegment,
  type TrafficIncident,
} from '@/lib/tomtom';
import {
  getAQIColor,
  getAQILabel,
  getWeatherIconUrl,
  type WeatherData,
} from '@/lib/weather';

const WEATHER_REFRESH_MS = 5 * 60 * 1000;
const TRAFFIC_TIME_REFRESH_MS = 30 * 1000;

function formatPktTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Karachi',
  }).format(date);
}

function formatMinutesAgo(date: Date | null): string {
  if (!date) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes === 0) return 'Updated just now';
  return `Updated ${minutes}m ago`;
}

function getTrafficStatus(avgCongestion: number) {
  if (avgCongestion < 0.3) {
    return { label: 'Traffic: Clear', dotClass: 'bg-success', blink: false };
  }
  if (avgCongestion < 0.6) {
    return { label: 'Traffic: Moderate', dotClass: 'bg-warning', blink: false };
  }
  if (avgCongestion < 0.8) {
    return { label: 'Traffic: Heavy', dotClass: 'bg-danger', blink: false };
  }
  return {
    label: 'Traffic: Gridlock',
    dotClass: 'bg-[#7f0000]',
    blink: true,
  };
}

function WeatherSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 animate-pulse rounded-full bg-white/10" />
      <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
      <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export type ViewMode = 'deck' | 'cesium';

export interface TopBarProps {
  trafficData?: TrafficFlowSegment[];
  incidents?: TrafficIncident[];
  lastTrafficUpdate?: Date | null;
  showIncidents?: boolean;
  onToggleIncidents?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export default function TopBar({
  trafficData = [],
  incidents = [],
  lastTrafficUpdate = null,
  showIncidents = true,
  onToggleIncidents,
  viewMode = 'deck',
  onViewModeChange,
}: TopBarProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pktTime, setPktTime] = useState('');
  const [trafficTimeLabel, setTrafficTimeLabel] = useState('');

  const avgCongestion = useMemo(
    () => getAverageCongestion(trafficData),
    [trafficData],
  );
  const trafficStatus = useMemo(
    () => getTrafficStatus(avgCongestion),
    [avgCongestion],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      try {
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = (await response.json()) as WeatherData;
        if (!cancelled) setWeather(data);
      } catch (error) {
        console.error('[TopBar] Failed to load weather:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadWeather();
    const interval = window.setInterval(loadWeather, WEATHER_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const updateClock = () => setPktTime(formatPktTime(new Date()));
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateTrafficTime = () =>
      setTrafficTimeLabel(formatMinutesAgo(lastTrafficUpdate));
    updateTrafficTime();
    const interval = window.setInterval(
      updateTrafficTime,
      TRAFFIC_TIME_REFRESH_MS,
    );
    return () => window.clearInterval(interval);
  }, [lastTrafficUpdate]);

  const aqi = weather?.aqi ?? 0;

  return (
    <header className="glass fixed left-0 right-0 top-0 z-40 flex min-h-12 items-center border-b border-white/10 px-5 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex items-baseline gap-0.5 text-lg font-bold leading-none">
          <span className="text-slate-100">Urban</span>
          <span className="text-cyan">IQ</span>
        </div>
        <div aria-hidden className="h-5 w-px bg-white/10" />
        <span className="text-[11px] uppercase tracking-[0.28em] text-muted">
          Digital Twin
        </span>
      </div>

      <div className="flex min-w-0 flex-[1.4] flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="pulse-dot inline-block h-2 w-2 rounded-full bg-success"
          />
          <span className="text-slate-100">Lahore, Pakistan</span>
          <span className="text-muted">•</span>
          <span className="text-success">Live</span>
        </div>

        {isLoading ? (
          <WeatherSkeleton />
        ) : weather?.available || weather?.is_fallback ? (
          <div
            className={`flex items-center gap-2 text-xs ${
              weather.is_raining ? 'text-blue-300' : 'text-secondary'
            }`}
            title={
              weather.is_fallback
                ? 'Estimated Lahore baseline — live OpenWeather feed unavailable'
                : undefined
            }
          >
            {weather.is_raining ? (
              <CloudRain className="h-4 w-4 shrink-0 text-blue-400" />
            ) : (
              <Image
                alt=""
                className="h-5 w-5"
                height={20}
                src={getWeatherIconUrl(weather.icon)}
                width={20}
              />
            )}
            <span className="text-slate-100">{weather.temp_c}°C</span>
            <span className="capitalize">
              {weather.is_raining
                ? 'Rain detected — flood models adjusted'
                : weather.description}
              {weather.is_fallback ? (
                <span className="ml-1 text-muted">(est.)</span>
              ) : null}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted">Weather data unavailable</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-end justify-center gap-1">
        <div className="flex items-center gap-3">
          {trafficData.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-100">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${trafficStatus.dotClass} ${
                  trafficStatus.blink ? 'animate-pulse' : ''
                }`}
              />
              <span>{trafficStatus.label}</span>
            </div>
          ) : null}
          {incidents.length > 0 ? (
            <button
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                showIncidents
                  ? 'border-warning/60 bg-warning/10 text-warning'
                  : 'border-white/10 bg-white/[0.03] text-secondary hover:text-slate-100'
              }`}
              type="button"
              onClick={onToggleIncidents}
            >
              ⚠️ {incidents.length} incident{incidents.length === 1 ? '' : 's'}
            </button>
          ) : null}
          {onViewModeChange ? (
            <div className="flex overflow-hidden rounded-full border border-white/10 bg-white/[0.03] p-0.5">
              <button
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  viewMode === 'deck'
                    ? 'bg-cyan text-navy'
                    : 'text-secondary hover:text-slate-100'
                }`}
                type="button"
                onClick={() => onViewModeChange('deck')}
              >
                🗺 2D Map
              </button>
              <button
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  viewMode === 'cesium'
                    ? 'bg-cyan text-navy'
                    : 'text-secondary hover:text-slate-100'
                }`}
                type="button"
                onClick={() => onViewModeChange('cesium')}
              >
                🌍 3D Globe
              </button>
            </div>
          ) : null}
          {weather?.aqi_available ? (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-900"
              style={{ backgroundColor: getAQIColor(aqi) }}
              title={
                weather.is_fallback
                  ? 'Estimated Lahore AQI — live air pollution feed unavailable'
                  : 'AQI from OpenWeather Air Pollution API'
              }
            >
              AQI {aqi} {getAQILabel(aqi)}
              {weather.is_fallback ? ' (est.)' : ''}
            </span>
          ) : !isLoading ? (
            <span
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted"
              title="Air quality data unavailable"
            >
              AQI N/A
            </span>
          ) : null}
          <span className="font-mono text-xs text-secondary">
            {pktTime ? `${pktTime} PKT` : '--:--:-- PKT'}
          </span>
        </div>
        {trafficTimeLabel ? (
          <span className="text-[10px] text-muted">{trafficTimeLabel}</span>
        ) : null}
      </div>
    </header>
  );
}
