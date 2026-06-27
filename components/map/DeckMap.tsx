'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  AmbientLight,
  FlyToInterpolator,
  LightingEffect,
  _SunLight as SunLight,
} from '@deck.gl/core';
import type { Layer as DeckLayer } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { MapboxOverlayProps } from '@deck.gl/mapbox';
import {
  Layer as MapLibreLayer,
  Map,
  Source,
  useControl,
} from 'react-map-gl/maplibre';
import type { MapMouseEvent, MapRef } from 'react-map-gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { WeatherTileLayer } from '@/lib/weather';
import {
  getFirmsFireTileUrl,
  getNasaSurfaceTempTileUrl,
  getSurfaceTempLayerConfig,
  getThermalHotspotLayerConfig,
} from '@/lib/firms';
import {
  getMapProvider,
  getPrimaryMapStyleUrl,
  getStadiaFallbackStyleUrl,
  getTerrainTileUrl,
  hasMapApiKey,
  type MapProvider,
} from '@/lib/mapConfig';
import {
  getTomTomIncidentTileUrl,
  getTomTomTrafficFlowTileTemplate,
} from '@/lib/tomtom';
import 'maplibre-gl/dist/maplibre-gl.css';

const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY ?? '';
const PRIMARY_MAP_STYLE = getPrimaryMapStyleUrl();
const STADIA_FALLBACK_STYLE = getStadiaFallbackStyleUrl();

function setMapLabelsVisible(map: MapLibreMap, visible: boolean) {
  const apply = () => {
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
      if (layer.type !== 'symbol') continue;
      if (!layer.layout || !('text-field' in layer.layout)) continue;
      try {
        map.setLayoutProperty(
          layer.id,
          'visibility',
          visible ? 'visible' : 'none',
        );
      } catch {
        // Some symbol layers cannot be toggled
      }
    }
  };

  if (!map.isStyleLoaded()) {
    map.once('styledata', apply);
    return;
  }

  apply();
}

const INITIAL_VIEW_STATE = {
  longitude: 74.3587,
  latitude: 31.5204,
  zoom: 13,
  pitch: 45,
  bearing: 0,
};

const LAHORE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [74.20, 31.40],
  [74.50, 31.62],
];

interface UrbanIQViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
  transitionInterpolator?: FlyToInterpolator;
  transitionEasing?: (t: number) => number;
}

export interface FlyToLocationOptions {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 0.3,
});

const sunLight = new SunLight({
  timestamp: Date.now(),
  color: [0, 212, 255],
  intensity: 1.2,
  _shadow: false,
});

const lightingEffect = new LightingEffect({ ambientLight, sunLight });

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(
    () => new MapboxOverlay({ interleaved: true, ...props }),
  );
  overlay.setProps({ interleaved: true, ...props });
  return null;
}

export interface DeckMapProps {
  layers?: DeckLayer[];
  onMapClick: (lat: number, lng: number) => void;
  isDrawingMode: boolean;
  activeTileLayer?: WeatherTileLayer;
  showTerrain?: boolean;
  showLabels?: boolean;
  showTrafficTiles?: boolean;
  showIncidentTiles?: boolean;
  showFires?: boolean;
  showSurfaceTemp?: boolean;
  /** When set, map is fully controlled externally (comparison sync mode) */
  externalViewState?: UrbanIQViewState;
  onViewStateChange?: (viewState: UrbanIQViewState) => void;
}

export interface DeckMapHandle {
  flyToLocation: (location: FlyToLocationOptions) => void;
}

export const DeckMap = forwardRef<DeckMapHandle, DeckMapProps>(
function DeckMap(
  {
    layers = [],
    onMapClick,
    isDrawingMode,
    activeTileLayer = 'none',
    showTerrain = false,
    showLabels = true,
    showTrafficTiles = true,
    showIncidentTiles = false,
    showFires = false,
    showSurfaceTemp = false,
    externalViewState,
    onViewStateChange,
  },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const [mapStyle, setMapStyle] = useState(PRIMARY_MAP_STYLE);
  const [mapProvider, setMapProvider] = useState<MapProvider>(getMapProvider());
  const [internalViewState, setInternalViewState] =
    useState<UrbanIQViewState>(INITIAL_VIEW_STATE);
  // Use external viewState when provided (comparison sync mode), otherwise use internal
  const viewState = externalViewState ?? internalViewState;
  const setViewState = useCallback((updater: UrbanIQViewState | ((prev: UrbanIQViewState) => UrbanIQViewState)) => {
    const next = typeof updater === 'function' ? updater(viewState) : updater;
    if (onViewStateChange) {
      onViewStateChange(next);
    } else {
      setInternalViewState(next);
    }
  }, [viewState, onViewStateChange]);
  const [weatherTileUrl, setWeatherTileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeTileLayer === 'none') {
      setWeatherTileUrl(null);
      return;
    }

    let cancelled = false;

    async function loadTileUrl() {
      try {
        const response = await fetch(`/api/weather?tile=${activeTileLayer}`);
        if (!response.ok) throw new Error('Failed to load weather tile URL');
        const data = (await response.json()) as { template: string | null };
        if (!cancelled) setWeatherTileUrl(data.template);
      } catch (error) {
        console.error('[DeckMap] Failed to load weather tiles:', error);
        if (!cancelled) setWeatherTileUrl(null);
      }
    }

    loadTileUrl();

    return () => {
      cancelled = true;
    };
  }, [activeTileLayer]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setMapLabelsVisible(map, showLabels);
  }, [showLabels]);

  const flyToLocation = useCallback((location: FlyToLocationOptions) => {
    setViewState((current) => ({
      ...current,
      longitude: location.lng ?? location.longitude ?? current.longitude,
      latitude: location.lat ?? location.latitude ?? current.latitude,
      zoom: location.zoom ?? current.zoom,
      pitch: location.pitch ?? current.pitch,
      bearing: location.bearing ?? current.bearing,
      transitionDuration: 1500,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.5 }),
      transitionEasing: (t: number) => t * (2 - t),
    }));
  }, [setViewState]);

  useImperativeHandle(ref, () => ({ flyToLocation }), [flyToLocation]);

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      if (!isDrawingMode) return;
      onMapClick(event.lngLat.lat, event.lngLat.lng);
    },
    [isDrawingMode, onMapClick],
  );

  const handleMapError = useCallback(
    (event: { error?: Error }) => {
      if (!STADIA_FALLBACK_STYLE || mapStyle === STADIA_FALLBACK_STYLE) {
        console.error('[DeckMap] Map style failed to load:', event.error);
        return;
      }

      console.warn(
        '[DeckMap] MapTiler style failed — falling back to Stadia',
        event.error,
      );
      setMapStyle(STADIA_FALLBACK_STYLE);
      setMapProvider('stadia');
    },
    [mapStyle],
  );

  const terrainTiles = getTerrainTileUrl(mapProvider);

  return (
    <div
      style={{ position: 'relative', width: '100vw', height: '100vh' }}
    >
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={INITIAL_VIEW_STATE}
        {...viewState}
        onLoad={(event) => setMapLabelsVisible(event.target, showLabels)}
        onError={handleMapError}
        minZoom={9}
        maxZoom={18}
        maxBounds={LAHORE_MAX_BOUNDS}
        onMove={(event) =>
          setViewState({
            longitude: event.viewState.longitude,
            latitude: event.viewState.latitude,
            zoom: event.viewState.zoom,
            pitch: event.viewState.pitch,
            bearing: event.viewState.bearing,
          })
        }
        style={{ width: '100vw', height: '100vh' }}
        reuseMaps
        cursor={isDrawingMode ? 'crosshair' : 'grab'}
        onClick={handleMapClick}
        scrollZoom={{ around: 'center' }}
        dragPan
        dragRotate
        doubleClickZoom
        touchZoomRotate
        keyboard
      >
        {showTerrain && terrainTiles ? (
          <Source
            id="map-terrain"
            type="raster"
            tiles={[terrainTiles]}
            tileSize={256}
          >
            <MapLibreLayer
              id="terrain-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.15 }}
            />
          </Source>
        ) : null}
        <DeckGLOverlay layers={layers} effects={[lightingEffect]} />
        {weatherTileUrl ? (
          <Source
            id="openweather-tiles"
            type="raster"
            tiles={[weatherTileUrl]}
            tileSize={256}
          >
            <MapLibreLayer
              id="openweather-tiles-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.6 }}
            />
          </Source>
        ) : null}
        {showTrafficTiles && TOMTOM_API_KEY ? (
          <Source
            id="tomtom-traffic-flow"
            type="raster"
            tiles={[getTomTomTrafficFlowTileTemplate()]}
            tileSize={256}
            attribution="© TomTom Traffic"
          >
            <MapLibreLayer
              id="traffic-flow-layer"
              type="raster"
              layout={{
                visibility: showTrafficTiles ? 'visible' : 'none',
              }}
              paint={{
                'raster-opacity': 0.95,
                'raster-fade-duration': 0,
              }}
            />
          </Source>
        ) : null}
        {showIncidentTiles && TOMTOM_API_KEY ? (
          <Source
            id="tomtom-traffic-incidents"
            type="raster"
            tiles={[getTomTomIncidentTileUrl()]}
            tileSize={256}
          >
            <MapLibreLayer
              id="traffic-incident-layer"
              type="raster"
              layout={{
                visibility: showIncidentTiles ? 'visible' : 'none',
              }}
              paint={{ 'raster-opacity': 0.9 }}
            />
          </Source>
        ) : null}
        {showFires ? (
          <Source
            id="nasa-thermal-hotspots"
            type="raster"
            tiles={[getFirmsFireTileUrl()]}
            tileSize={256}
            maxzoom={getThermalHotspotLayerConfig().maxZoom}
            attribution="NASA GIBS VIIRS"
          >
            <MapLibreLayer
              id="thermal-hotspot-layer"
              type="raster"
              layout={{ visibility: 'visible' }}
              paint={{ 'raster-opacity': 0.75 }}
            />
          </Source>
        ) : null}
        {showSurfaceTemp ? (
          <Source
            id="nasa-surface-temp"
            type="raster"
            tiles={[getNasaSurfaceTempTileUrl()]}
            tileSize={256}
            maxzoom={getSurfaceTempLayerConfig().maxZoom}
            attribution="NASA GIBS MODIS"
          >
            <MapLibreLayer
              id="nasa-surface-temp-layer"
              type="raster"
              layout={{ visibility: 'visible' }}
              paint={{ 'raster-opacity': 0.65 }}
            />
          </Source>
        ) : null}
      </Map>
      {showTrafficTiles && TOMTOM_API_KEY ? (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 8,
            fontSize: 10,
            color: 'rgba(255,255,255,0.55)',
            pointerEvents: 'none',
            zIndex: 10,
            lineHeight: 1.5,
          }}
        >
          <div className="font-medium text-slate-200">Road traffic</div>
          <div className="flex items-center gap-2">
            <span style={{ color: '#10b981' }}>●</span> Free
            <span style={{ color: '#f59e0b' }}>●</span> Slow
            <span style={{ color: '#ef4444' }}>●</span> Heavy
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          right: 8,
          fontSize: 10,
          color: 'rgba(255,255,255,0.4)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        Satellite data: NASA GIBS (VIIRS thermal · MODIS LST)
      </div>
      {!hasMapApiKey() ? (
        <div
          className="glass pointer-events-none absolute inset-x-0 top-16 z-10 mx-auto max-w-md rounded-xl px-4 py-3 text-center text-sm text-secondary"
          role="alert"
        >
          Add a map API key to <code className="text-cyan">.env.local</code> as{' '}
          <code className="text-cyan">NEXT_PUBLIC_MAPTILER_KEY</code> or{' '}
          <code className="text-cyan">NEXT_PUBLIC_STADIA_API_KEY</code>
        </div>
      ) : null}
    </div>
  );
});

DeckMap.displayName = 'DeckMap';
