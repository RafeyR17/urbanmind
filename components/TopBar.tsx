'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getAverageCongestion,
  type TrafficFlowSegment,
  type TrafficIncident,
} from '@/lib/tomtom';
import {
  getAQILabel,
  getWeatherIconUrl,
  type WeatherData,
} from '@/lib/weather';

const WEATHER_REFRESH_MS = 5 * 60 * 1000;

export type ViewMode = 'deck' | 'cesium';

function formatPktTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Karachi',
  }).format(date);
}

function getTrafficLabel(avgCongestion: number): string {
  if (avgCongestion < 0.3) return 'TRAFFIC: CLEAR';
  if (avgCongestion < 0.6) return 'TRAFFIC: MODERATE';
  if (avgCongestion < 0.8) return 'TRAFFIC: HEAVY';
  return 'TRAFFIC: GRIDLOCK';
}

function getTrafficColor(avgCongestion: number): string {
  if (avgCongestion < 0.6) return 'var(--file-olive)';
  return 'var(--stamp-red)';
}

function getAqiColor(aqi: number): string {
  if (aqi <= 1) return 'var(--success-stamp)';
  if (aqi <= 3) return 'var(--file-olive)';
  if (aqi >= 4) return 'var(--stamp-red)';
  return 'var(--file-olive)';
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="pulse-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function StatusSeparator() {
  return <span className="text-paper-dim"> · </span>;
}

export interface TopBarProps {
  trafficData?: TrafficFlowSegment[];
  incidents?: TrafficIncident[];
  lastTrafficUpdate?: Date | null;
  showIncidents?: boolean;
  onToggleIncidents?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export default function TopBar({ trafficData = [] }: TopBarProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pktTime, setPktTime] = useState('');

  const avgCongestion = useMemo(
    () => getAverageCongestion(trafficData),
    [trafficData],
  );

  const trafficLabel = useMemo(
    () =>
      trafficData.length > 0
        ? getTrafficLabel(avgCongestion)
        : 'TRAFFIC: N/A',
    [trafficData.length, avgCongestion],
  );

  const trafficColor = useMemo(
    () =>
      trafficData.length > 0
        ? getTrafficColor(avgCongestion)
        : 'var(--file-olive)',
    [trafficData.length, avgCongestion],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      try {
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Weather fetch failed');
        const res2 = (await response.json()) as WeatherData;
        if (!cancelled) {
          setWeather(res2);
          console.log('weather ok, aqi:', res2.aqi);
        }
      } catch (error) {
        if (!cancelled) setIsLoading(false);
        console.error(error);
        return;
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

  const aqi = weather?.aqi ?? 0;
  const aqiLabel = getAQILabel(aqi).toUpperCase();

  return (
    <header className="fixed left-0 right-0 top-0 z-40 grid min-h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-hairline bg-bg-panel px-5 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="text-lg font-bold leading-none"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          <span className="text-paper">Urban</span>
          <span style={{ color: 'var(--stamp-red)' }}>IQ</span>
        </div>
        <span
          className="mt-1 uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '1px',
            color: 'var(--file-olive)',
          }}
        >
          MUNICIPAL PLANNING SYSTEM
        </span>
      </div>

      <div
        className="justify-self-center text-[11px] uppercase tracking-wide"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {isLoading ? (
          <span className="text-paper-dim">WEATHER --</span>
        ) : weather ? (
          <span className="inline-flex items-center gap-1 text-paper">
            {weather.available && (
              <img
                src={getWeatherIconUrl(weather.icon)}
                alt=""
                className="h-4 w-4"
                width={16}
                height={16}
              />
            )}
            <span>
              {Math.round(weather.temp_c)}°C {weather.description.toUpperCase()}
              {weather.is_fallback ? ' (EST.)' : ''}
            </span>
          </span>
        ) : (
          <span className="text-paper-dim">WEATHER N/A</span>
        )}
      </div>

      <div
        className="flex min-w-0 items-center justify-end text-[11px] uppercase tracking-wide"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <span className="text-paper-dim">LAHORE, PK</span>
        <StatusSeparator />
        <span className="inline-flex items-center">
          <StatusDot color="var(--success-stamp)" />
          <span style={{ color: 'var(--success-stamp)' }}>LIVE</span>
        </span>
        <StatusSeparator />
        <span style={{ color: trafficColor }}>{trafficLabel}</span>
        <StatusSeparator />
        {isLoading ? (
          <span className="text-paper-dim">AQI --</span>
        ) : weather?.aqi_available ? (
          <span style={{ color: getAqiColor(aqi) }}>
            AQI {aqi} {aqiLabel}
            {weather.is_fallback ? ' (EST.)' : ''}
          </span>
        ) : (
          <span className="text-paper-dim">AQI N/A</span>
        )}
        <StatusSeparator />
        <span className="text-paper-dim">
          {pktTime ? `${pktTime} PKT` : '--:-- PKT'}
        </span>
      </div>
    </header>
  );
}
