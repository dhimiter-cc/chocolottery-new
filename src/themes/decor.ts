// Ambient markup per event. Astro-only (imported by ThemeDecor.astro), kept apart
// from index.ts so the browser bundle never pulls .astro files.
import HalloweenDecor from './halloween/Decor.astro';
import WinterDecor from './winter/Decor.astro';

export const DECOR: Record<string, typeof HalloweenDecor | undefined> = {
  halloween: HalloweenDecor,
  winter: WinterDecor,
};
