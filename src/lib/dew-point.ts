/**
 * Dew point math and this product's dew-point comfort legend.
 *
 * Dew point is computed from air temperature and relative humidity using the
 * Magnus-Tetens approximation (accurate to within ~0.1 °C for -45..60 °C).
 *
 * The comfort bands below are a product-specific legend for describing how
 * humid air feels — they are not an official NWS classification. Heat-index
 * math lives in `@/lib/weather/heat-index`.
 */

import { apparentTemperatureF } from '@/lib/weather/heat-index';
import type { DewPointCategory } from '@/lib/weather/types';

const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04; // °C

/** Dew point in °C from air temperature (°C) and relative humidity (1..100 %). */
export function calcDewPointC(tempC: number, relativeHumidity: number): number {
  const rh = Math.min(100, Math.max(0.5, relativeHumidity));
  const gamma = Math.log(rh / 100) + (MAGNUS_A * tempC) / (MAGNUS_B + tempC);
  return (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
}

export const cToF = (c: number): number => (c * 9) / 5 + 32;
export const fToC = (f: number): number => ((f - 32) * 5) / 9;

/**
 * What the air feels like from heat alone: the NWS heat index once it is
 * meaningful (≥80 °F), otherwise the air temperature.
 */
export { apparentTemperatureF as calcFeelsLikeF };

export interface ComfortLevel {
  label: DewPointCategory;
  /** Two-to-three-word feel, e.g. "Humid and close" */
  tagline: string;
  /** One-sentence description of how it feels */
  description: string;
  /** Dew point range in °F: [minF, maxF) — continuous and non-overlapping */
  minF: number;
  maxF: number;
  /** Bright display color for the scale bar and reference dots (hex) */
  color: string;
  /** Muted fill for the condition badge — readable with cream text (hex) */
  fill: string;
  /** Deep variant of the band color for large text on the cream background (hex) */
  ink: string;
}

export const COMFORT_LEVELS: ComfortLevel[] = [
  {
    label: 'Dry',
    tagline: 'Crisp and dry',
    description: 'The air is dry — moisture is barely noticeable, and skin may even feel parched.',
    minF: -Infinity,
    maxF: 50,
    color: '#38bdf8',
    fill: '#35708F',
    ink: '#2A5A73',
  },
  {
    label: 'Pleasant',
    tagline: 'Fresh and easy',
    description: 'Very comfortable. Crisp, pleasant air that most people find ideal.',
    minF: 50,
    maxF: 56,
    color: '#34d399',
    fill: '#3F7D5F',
    ink: '#2E5E47',
  },
  {
    label: 'Comfortable',
    tagline: 'Barely noticeable',
    description: 'Comfortable for the vast majority of people. Humidity goes unnoticed.',
    minF: 56,
    maxF: 61,
    color: '#a3e635',
    fill: '#5F7334',
    ink: '#4A5A28',
  },
  {
    label: 'Sticky',
    tagline: 'Humid and close',
    description: 'Getting sticky. The humidity is noticeable, though still tolerable for most.',
    minF: 61,
    maxF: 66,
    color: '#facc15',
    fill: '#9A7B2E',
    ink: '#7A6124',
  },
  {
    label: 'Muggy',
    tagline: 'Heavy and damp',
    description: 'Muggy and humid — the air feels heavy and sweat evaporates slowly.',
    minF: 66,
    maxF: 70,
    color: '#fb923c',
    fill: '#A85F32',
    ink: '#8A4E29',
  },
  {
    label: 'Oppressive',
    tagline: 'Thick and stifling',
    description: 'Oppressive. Very uncomfortable; take it easy during outdoor activity.',
    minF: 70,
    maxF: 75,
    color: '#ef4444',
    fill: '#A34F3D',
    ink: '#86402F',
  },
  {
    label: 'Miserable',
    tagline: 'Tropical and heavy',
    description: 'Miserable, tropical-level moisture. Outdoor exertion can be hazardous.',
    minF: 75,
    maxF: Infinity,
    color: '#a855f7',
    fill: '#7D4E8E',
    ink: '#663F75',
  },
];

export function getComfortLevel(dewPointF: number): ComfortLevel {
  return (
    COMFORT_LEVELS.find((l) => dewPointF >= l.minF && dewPointF < l.maxF) ??
    COMFORT_LEVELS[COMFORT_LEVELS.length - 1]
  );
}

/**
 * The single source of dew-point comfort language in prose. Derived from the
 * legend above, so prose and the on-screen scale can never disagree — and a
 * dew point of 61 °F or higher is never called comfortable or pleasant.
 */
export function dewPointDescriptor(dewPointF: number): string {
  return getComfortLevel(dewPointF).label.toLowerCase();
}

/**
 * Qualitative comparison of the current dew point against the same hour
 * yesterday, e.g. "Noticeably stickier than this time yesterday (74° vs 66°,
 * up from muggy into oppressive)."
 */
export function yesterdayComparison(todayF: number, yesterdayF: number, unit: 'F' | 'C'): string {
  const t = Math.round(todayF);
  const y = Math.round(yesterdayF);
  const delta = t - y;
  const abs = Math.abs(delta);
  const dir = delta > 0 ? 'stickier' : 'drier';

  let phrase: string;
  if (abs < 2) phrase = 'About the same as this time yesterday';
  else if (abs <= 4) phrase = `A touch ${dir} than this time yesterday`;
  else if (abs <= 8) phrase = `Noticeably ${dir} than this time yesterday`;
  else phrase = `A different air mass than yesterday — far ${dir}`;

  const bandToday = getComfortLevel(todayF);
  const bandYesterday = getComfortLevel(yesterdayF);
  const bandNote =
    bandToday.label !== bandYesterday.label
      ? `, ${delta > 0 ? 'up from' : 'down from'} ${bandYesterday.label.toLowerCase()} into ${bandToday.label.toLowerCase()}`
      : '';

  const fmt = (f: number) => `${Math.round(unit === 'F' ? f : fToC(f))}°`;
  return `${phrase} (${fmt(todayF)} vs ${fmt(yesterdayF)}${bandNote}).`;
}
