export type FirmsLayer = 'VIIRS_SNPP_NRT' | 'MODIS_NRT' | 'VIIRS_NOAA20_NRT';

interface GibsRasterLayer {
  layer: string;
  tileMatrixSet: string;
  extension: 'png' | 'jpg';
  maxZoom: number;
}

const GIBS_WMTS_BASE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

// VIIRS band I5 for hotspots — old VIIRS_SNPP_Fires_All got removed from GIBS
const THERMAL_HOTSPOT_LAYER: GibsRasterLayer = {
  layer: 'VIIRS_SNPP_Brightness_Temp_BandI5_Day',
  tileMatrixSet: 'GoogleMapsCompatible_Level9',
  extension: 'png',
  maxZoom: 9,
};

// MODIS uses Level7 not Level9, took forever to figure out
const SURFACE_TEMP_LAYER: GibsRasterLayer = {
  layer: 'MODIS_Terra_Land_Surface_Temp_Day',
  tileMatrixSet: 'GoogleMapsCompatible_Level7',
  extension: 'png',
  maxZoom: 7,
};

export function getGibsDefaultDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// function getLegacyFirmsUrl(date: string) {
//   return `${GIBS_WMTS_BASE}/VIIRS_SNPP_Fires_All/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
// }

function mkGibsUrl(
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

// kept for DeckMap import name
export function getFirmsFireTileUrl(
  date: string = getGibsDefaultDate(),
): string {
  return mkGibsUrl(THERMAL_HOTSPOT_LAYER, date);
}

export function getThermalHotspotTileUrl(
  date: string = getGibsDefaultDate(),
): string {
  return mkGibsUrl(THERMAL_HOTSPOT_LAYER, date);
}

export function getNasaSurfaceTempTileUrl(
  date: string = getGibsDefaultDate(),
): string {
  return mkGibsUrl(SURFACE_TEMP_LAYER, date);
}
