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

/**
 * "Feels like" temperature in °F from air temperature (°F) and relative
 * humidity, using the NWS heat index (Rothfusz regression with the official
 * low/high-humidity adjustments), blending through Steadman's simple formula
 * near the bottom of its range. Below ~68 °F humidity stops affecting how warm
 * it feels and wind chill would need wind speed, so the air temperature is
 * returned as-is.
 */
export function calcFeelsLikeF(tempF: number, relativeHumidity: number): number {
  const T = tempF;
  if (T < 68) return T;
  const RH = Math.min(100, Math.max(0, relativeHumidity));
  const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);
  if ((simple + T) / 2 < 80) return simple;

  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    0.00683783 * T * T -
    0.05481717 * RH * RH +
    0.00122874 * T * T * RH +
    0.00085282 * T * RH * RH -
    0.00000199 * T * T * RH * RH;

  if (RH < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (RH > 85 && T >= 80 && T <= 87) {
    hi += ((RH - 85) / 10) * ((87 - T) / 5);
  }
  // The regression is only charted to ~110 °F air temperature; slider what-ifs
  // beyond it (e.g. 120 °F at 66 % RH) explode into fantasy numbers, so cap at
  // the top of the NWS chart.
  return Math.min(hi, 140);
}

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
  /** Bright display color for the scale bar and reference dots (hex) */
  color: string;
  /** Muted fill for the condition badge — readable with cream text (hex) */
  fill: string;
  /** Deep variant of the band color for large text on the cream background (hex) */
  ink: string;
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
    fill: '#35708F',
    ink: '#2A5A73',
  },
  {
    label: 'Pleasant',
    tagline: 'Fresh and easy',
    description: 'Very comfortable. Crisp, pleasant air that most people find ideal.',
    minF: 50,
    maxF: 55,
    color: '#34d399',
    fill: '#3F7D5F',
    ink: '#2E5E47',
  },
  {
    label: 'Comfortable',
    tagline: 'Barely noticeable',
    description: 'Comfortable for the vast majority of people. Humidity goes unnoticed.',
    minF: 55,
    maxF: 60,
    color: '#a3e635',
    fill: '#5F7334',
    ink: '#4A5A28',
  },
  {
    label: 'Sticky',
    tagline: 'Humid and close',
    description: 'Getting sticky. The humidity is noticeable, though still tolerable for most.',
    minF: 60,
    maxF: 65,
    color: '#facc15',
    fill: '#9A7B2E',
    ink: '#7A6124',
  },
  {
    label: 'Muggy',
    tagline: 'Heavy and damp',
    description: 'Muggy and humid — the air feels heavy and sweat stops evaporating well.',
    minF: 65,
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
    tagline: 'Tropical and hazardous',
    description: 'Miserable, tropical-level moisture. Outdoor exertion can be hazardous.',
    minF: 75,
    maxF: Infinity,
    color: '#a855f7',
    fill: '#7D4E8E',
    ink: '#663F75',
  },
];

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

export function getComfortLevel(dewPointF: number): ComfortLevel {
  return (
    COMFORT_LEVELS.find((l) => dewPointF >= l.minF && dewPointF < l.maxF) ??
    COMFORT_LEVELS[COMFORT_LEVELS.length - 1]
  );
}
