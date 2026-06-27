// Map components use WebGL and must be loaded client-side only.
// In Next.js pages, consume with:
//   const DeckMap = dynamic(() => import('@/components/map').then((m) => m.DeckMap), { ssr: false });
export { DeckMap } from './DeckMap';
export { CesiumMap } from './CesiumMap';
export { ComparisonMap } from './ComparisonMap';
export type { CesiumMapProps } from './CesiumMap';
export type {
  DeckMapHandle,
  DeckMapProps,
  FlyToLocationOptions,
} from './DeckMap';
export type { ComparisonMapProps } from './ComparisonMap';
