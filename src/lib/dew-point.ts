/**
 * Dew point math and the standard meteorological comfort scale.
 *
 * Dew point is computed from air temperature and relative humidity using the
 * Magnus-Tetens approximation (accurate to within ~0.1 °C for -45..60 °C).
 */

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

export interface ComfortLevel {
  /** Short label, e.g. "Oppressive" */
  label: string;
  /** Two-to-three-word feel, e.g. "Humid and close" */
  tagline: string;
  /** One-sentence description of how it feels */
  description: string;
  /** Dew point range in °F: [minF, maxF) — Infinity for the top band */
  minF: number;
  maxF: number;
  /** Display color (hex) */
  color: string;
}

/**
 * The dew point comfort scale commonly used by US meteorologists / the NWS.
 * Bands are defined in °F because that is how the scale is usually quoted.
 */
export const COMFORT_LEVELS: ComfortLevel[] = [
  {
    label: 'Dry',
    tagline: 'Crisp and dry',
    description: 'The air is dry — moisture is barely noticeable, and skin may even feel parched.',
    minF: -Infinity,
    maxF: 50,
    color: '#38bdf8',
  },
  {
    label: 'Pleasant',
    tagline: 'Fresh and easy',
    description: 'Very comfortable. Crisp, pleasant air that most people find ideal.',
    minF: 50,
    maxF: 55,
    color: '#34d399',
  },
  {
    label: 'Comfortable',
    tagline: 'Barely noticeable',
    description: 'Comfortable for the vast majority of people. Humidity goes unnoticed.',
    minF: 55,
    maxF: 60,
    color: '#a3e635',
  },
  {
    label: 'Sticky',
    tagline: 'Humid and close',
    description: 'Getting sticky. The humidity is noticeable, though still tolerable for most.',
    minF: 60,
    maxF: 65,
    color: '#facc15',
  },
  {
    label: 'Muggy',
    tagline: 'Heavy and damp',
    description: 'Muggy and humid — the air feels heavy and sweat stops evaporating well.',
    minF: 65,
    maxF: 70,
    color: '#fb923c',
  },
  {
    label: 'Oppressive',
    tagline: 'Thick and stifling',
    description: 'Oppressive. Very uncomfortable; take it easy during outdoor activity.',
    minF: 70,
    maxF: 75,
    color: '#ef4444',
  },
  {
    label: 'Miserable',
    tagline: 'Tropical and hazardous',
    description: 'Miserable, tropical-level moisture. Outdoor exertion can be hazardous.',
    minF: 75,
    maxF: Infinity,
    color: '#a855f7',
  },
];

export function getComfortLevel(dewPointF: number): ComfortLevel {
  return (
    COMFORT_LEVELS.find((l) => dewPointF >= l.minF && dewPointF < l.maxF) ??
    COMFORT_LEVELS[COMFORT_LEVELS.length - 1]
  );
}
