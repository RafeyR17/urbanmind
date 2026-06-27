export type FirmsLayer = 'VIIRS_SNPP_NRT' | 'MODIS_NRT' | 'VIIRS_NOAA20_NRT';

interface GibsRasterLayer {
  layer: string;
  tileMatrixSet: string;
  extension: 'png' | 'jpg';
  maxZoom: number;
}

const GIBS_WMTS_BASE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

/**
 * VIIRS_SNPP_Fires_All was removed from GIBS. Thermal IR band I5 highlights
 * hotspots (fires, industry, heated surfaces) globally via raster tiles.
 */
const THERMAL_HOTSPOT_LAYER: GibsRasterLayer = {
  layer: 'VIIRS_SNPP_Brightness_Temp_BandI5_Day',
  tileMatrixSet: 'GoogleMapsCompatible_Level9',
  extension: 'png',
  maxZoom: 9,
};

/** MODIS land-surface temperature uses GoogleMapsCompatible_Level7 (not Level9). */
const SURFACE_TEMP_LAYER: GibsRasterLayer = {
  layer: 'MODIS_Terra_Land_Surface_Temp_Day',
  tileMatrixSet: 'GoogleMapsCompatible_Level7',
  extension: 'png',
  maxZoom: 7,
};

/** GIBS near-real-time layers are typically 1 day behind UTC. */
export function getGibsDefaultDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function buildGibsWmtsUrl(
  config: GibsRasterLayer,
  date: string = getGibsDefaultDate(),
): string {
  return (
    `${GIBS_WMTS_BASE}/${config.layer}/default/${date}/` +
    `${config.tileMatrixSet}/{z}/{y}/{x}.${config.extension}`
  );
}

export function getThermalHotspotLayerConfig(): GibsRasterLayer {
  return THERMAL_HOTSPOT_LAYER;
}

export function getSurfaceTempLayerConfig(): GibsRasterLayer {
  return SURFACE_TEMP_LAYER;
}

/** @deprecated Use getThermalHotspotTileUrl — kept for DeckMap import name. */
export function getFirmsFireTileUrl(
  date: string = getGibsDefaultDate(),
): string {
  return buildGibsWmtsUrl(THERMAL_HOTSPOT_LAYER, date);
}

export function getThermalHotspotTileUrl(
  date: string = getGibsDefaultDate(),
): string {
  return buildGibsWmtsUrl(THERMAL_HOTSPOT_LAYER, date);
}

export function getNasaSurfaceTempTileUrl(
  date: string = getGibsDefaultDate(),
): string {
  return buildGibsWmtsUrl(SURFACE_TEMP_LAYER, date);
}
