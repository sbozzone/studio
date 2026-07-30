/**
 * Deterministic facts → prose. No model is involved in any calculation,
 * decision or number that reaches the screen.
 *
 * Pipeline: normalized daily facts → weekly-priority selection → approved
 * templates → invariant validation → rendered outlook (or a deterministic
 * fallback if validation fails).
 */

import { dewPointDescriptor } from '@/lib/dew-point';
import { isHeatIndexMeaningful } from '@/lib/weather/heat-index';
import type { DailyFacts, DayPart, NormalizedForecast } from '@/lib/weather/types';

/**
 * The one place the ruleset version is defined. Bumped on every change to the
 * narrative rules so version-keyed caches can never pair old prose with a new
 * engine. 2.1.0: daypart-scoped saturation, probability-qualifier cleanup,
 * consecutive-day comfort dedupe.
 */
export const NARRATIVE_RULESET_VERSION = '2.1.0';

export interface NarrativeDay {
  name: string;
  isToday: boolean;
  firm: boolean;
  text: string;
}

export interface Narrative {
  headline: string;
  days: NarrativeDay[];
  footnote: string;
  /** Populated when invariant validation forced the deterministic fallback */
  invariantViolations: string[];
}

// ── Display helpers (rounding happens only here) ──────────────────────────────

/** Hourly PoP does not warrant single-percent precision. 47 → 50, 37 → 40. */
export const roundPop = (p: number): number => Math.round(p / 10) * 10;

/** NWS shortForecast is Title Case; prose uses sentence case. */
export function sentenceCaseCondition(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bchance (?=showers|rain|drizzle|snow|storms|thunderstorms)/g, 'chance of ');
}
const capFirst = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** 62 → "low 60s", 68 → "upper 60s" */
export function tensPhrase(v: number): string {
  const decade = Math.floor(v / 10) * 10;
  const pos = v - decade;
  const word = pos < 3.5 ? 'low' : pos < 6.5 ? 'mid' : 'upper';
  return `${word} ${decade}s`;
}

const dayLabel = (d: DailyFacts): string => (d.isToday ? 'today' : d.dayName);

// ── Support tests for stronger claims ─────────────────────────────────────────

/** A day's rain is "impactful" only with thunder plus a real probability, or measurable QPF. */
export function isImpactfulPrecip(d: DailyFacts): boolean {
  const pop = d.peakPopPct ?? 0;
  if (d.hasThunder && pop >= 50) return true;
  if ((d.precipitationAmountIn ?? 0) >= 0.5) return true;
  return pop >= 70;
}

/** Rain arriving late in the day rather than dominating it. */
export function hasLateArrivingRain(d: DailyFacts): boolean {
  const early = Math.max(d.popByPart.morning ?? 0, d.popByPart.afternoon ?? 0);
  const late = Math.max(d.popByPart.evening ?? 0, d.popByPart.overnight ?? 0);
  return late >= 40 && early <= 30 && late - early >= 20;
}

/**
 * A day may be called near saturation only when the evidence sits in the
 * daypart being described: at least two midday/afternoon hours whose OWN
 * simultaneous spread is ≤3 °F or RH ≥90 %, and weather that supports it
 * (fog, or a real rain chance). A damp dawn never qualifies the afternoon.
 */
export const qualifiesNearSaturation = (d: DailyFacts): boolean =>
  (d.saturatedHoursCount ?? 0) >= 2 &&
  ((d.peakPopPct ?? 0) >= 50 || /fog|mist|drizzle/i.test(d.condition ?? ''));

function saturationClause(d: DailyFacts): string {
  // "Raw" is cold-weather language; near 80 °F saturated air feels heavy
  return (d.highTemperatureF ?? 75) <= 70
    ? 'Air stays near saturation — damp and raw.'
    : 'Air stays near saturation — damp and heavy.';
}

// ── Day sentences ─────────────────────────────────────────────────────────────

function highSentence(d: DailyFacts): string | null {
  if (d.highTemperatureF == null) return null;
  const t = Math.round(d.highTemperatureF);
  if (d.index <= 1) return `High ${t}.`;
  if (d.index <= 3) return `High near ${t} expected.`;
  return `Currently forecast near ${t}.`;
}

function humiditySentence(d: DailyFacts): string | null {
  if (d.dewPointMedianF == null) return null;
  const descriptor = dewPointDescriptor(d.dewPointMedianF);
  // "Steady" is only honest when the hourly range really is tight
  if (d.dewPointRangeF != null && d.dewPointRangeF <= 3) {
    return `Dew point steady near ${Math.round(d.dewPointMedianF)} — ${descriptor}.`;
  }
  return `Dew points generally in the ${tensPhrase(d.dewPointMedianF)} — ${descriptor}.`;
}

function heatIndexSentence(d: DailyFacts): string | null {
  if (d.maxHeatIndexF == null || !isHeatIndexMeaningful(d.maxHeatIndexF)) return null;
  const hi = Math.round(d.maxHeatIndexF);
  const delta = Math.round(d.maxHourlyHeatIndexDelta ?? 0);
  const hedge = d.index >= 2 ? 'expected to peak near' : 'peaks near';
  if (hi >= 105) {
    return `Heat index ${hedge} ${hi} — dangerous for sustained outdoor exertion; keep to early morning.`;
  }
  if (delta <= 2) {
    return `Heat index ${hedge} ${hi}, close to the air temperature.`;
  }
  return `Heat index ${hedge} ${hi}, about ${delta}° above the air temperature.`;
}

const PART_LABEL: Record<DayPart, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  lateAfternoon: 'late afternoon',
  evening: 'evening',
  overnight: 'overnight',
};

/**
 * NWS conditions carry their own probability qualifiers ("Slight Chance Rain
 * Showers"). When we print a numeric peak chance, those words must go — they
 * would either duplicate or contradict the number.
 */
function precipConditionPhrase(condition: string, rounded: number): string {
  const lc = sentenceCaseCondition(condition);
  if (!/(shower|rain|storm|drizzle|snow|sprinkle)/.test(lc)) {
    return `${capFirst(lc)}, peak rain chance around ${rounded}%`;
  }
  const noun = lc
    .replace(/\b(?:slight |isolated |scattered )?chance of /g, '')
    .replace(/\blikely\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (rounded >= 60) return `${capFirst(noun)} likely, peak rain chance around ${rounded}%`;
  return `A chance of ${noun}, peak chance around ${rounded}%`;
}

function precipSentence(d: DailyFacts): string | null {
  const peak = d.peakPopPct;
  if (peak == null || peak < 20) {
    return d.condition ? `${capFirst(sentenceCaseCondition(d.condition))}.` : null;
  }
  const rounded = roundPop(peak);

  if (hasLateArrivingRain(d)) {
    const dayCondition = d.conditionByPart.afternoon ?? d.condition ?? '';
    const lead = dayCondition ? capFirst(sentenceCaseCondition(dayCondition)) : 'Dry';
    return `${lead} for much of the day, with rain chances increasing late in the day and overnight — peak chance around ${rounded}%.`;
  }

  const phrase = precipConditionPhrase(d.condition ?? 'rain', rounded);

  // Name a time of day only when the chance genuinely concentrates there —
  // a flat probability across the day has no timing story to tell.
  const partValues = Object.values(d.popByPart).filter((v): v is number => v != null);
  const spread = partValues.length > 1 ? peak - Math.min(...partValues) : 0;
  const when =
    spread >= 20 && d.peakPopPart && d.peakPopPart !== 'afternoon'
      ? ` in the ${PART_LABEL[d.peakPopPart]}`
      : '';

  const damp = qualifiesNearSaturation(d)
    ? ` ${saturationClause(d)}`
    : d.dewPointMedianF != null &&
        d.dewPointMedianF >= 66 &&
        (d.highTemperatureF ?? 0) <= 80 &&
        peak >= 50
      ? ' Not hot, but humid enough to feel heavy between showers.'
      : '';
  return `${phrase}${when}.${damp}`;
}

/**
 * Wind earns a sentence only when it materially changes how the day feels.
 * Never promises evaporation or comfort.
 */
function windSentence(d: DailyFacts): string | null {
  if (d.windCategory == null || d.windMedianMph == null) return null;
  const hi = d.maxHeatIndexF ?? 0;

  if (d.windGustMaxMph != null && d.windGustMaxMph >= 20) {
    return `Gusts to ${Math.round(d.windGustMaxMph)} mph at times.`;
  }
  if (d.windCategory === 'breezy') {
    return `Breezy, with ${d.windDirection ?? ''} wind around ${Math.round(d.windMedianMph)} mph.`.replace(
      /\s+/g,
      ' '
    );
  }
  if (d.windCategory === 'noticeable' && hi >= 85) {
    return `A noticeable breeze near ${Math.round(d.windMedianMph)} mph may take some edge off.`;
  }
  if ((d.windCategory === 'calm' || d.windCategory === 'light') && hi >= 88) {
    // A small approved set, alternated so consecutive days don't read identically
    const variants = d.windCrossesCategories
      ? [
          'Winds stay light and variable, so there is little relief in the sun.',
          'Air stays mostly still, offering limited relief.',
        ]
      : [
          'Winds stay light, so there is little relief in the sun.',
          'Little air movement to take the edge off.',
        ];
    return variants[d.index % variants.length];
  }
  return null;
}

function extendedDayText(d: DailyFacts): string {
  const parts: string[] = [];
  if (d.highTemperatureF != null) parts.push(`Currently forecast near ${Math.round(d.highTemperatureF)}.`);
  if (d.condition) {
    const pop = d.peakPopPct;
    parts.push(
      `${capFirst(sentenceCaseCondition(d.condition))}${pop != null && pop >= 20 ? `, chance around ${roundPop(pop)}%` : ''}.`
    );
  }
  parts.push(`Beyond the hourly grid, so treat the details as provisional.`);
  return parts.join(' ');
}

function firmDayText(d: DailyFacts): string {
  const parts = [
    highSentence(d),
    humiditySentence(d),
    heatIndexSentence(d),
    precipSentence(d),
    windSentence(d),
    d.index >= 4 ? 'Timing may still change.' : null,
  ].filter((s): s is string => !!s);
  return parts.join(' ');
}

// ── Headline ──────────────────────────────────────────────────────────────────

function alertSentence(forecast: NormalizedForecast): string | null {
  if (forecast.alertsStatus !== 'ok' || forecast.alerts.length === 0) return null;
  const names = [...new Set(forecast.alerts.map((a) => a.event))];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.slice(-1)}`;
  return `${list} in effect — official National Weather Service guidance takes priority over everything below.`;
}

function precipHeadline(days: DailyFacts[]): string | null {
  const impactful = days.filter(isImpactfulPrecip);
  if (impactful.length === 0) return null;
  const first = impactful[0];
  const what = first.hasThunder ? 'showers and thunderstorms' : 'rain';
  const lateDay = days.find((d) => d.index < first.index && hasLateArrivingRain(d));
  const lead = lateDay
    ? `Rain chances increase late ${dayLabel(lateDay)}, with ${what} likely ${dayLabel(first)}`
    : `${capFirst(what)} are the main event ${dayLabel(first)}`;
  const pop = first.peakPopPct != null ? ` (peak chance around ${roundPop(first.peakPopPct)}%)` : '';
  return `${lead}${pop}.`;
}

function heatHeadline(days: DailyFacts[]): string | null {
  const withHi = days.filter((d) => d.maxHeatIndexF != null && isHeatIndexMeaningful(d.maxHeatIndexF));
  if (withHi.length === 0) return null;
  const peak = withHi.reduce((a, b) => ((b.maxHeatIndexF ?? 0) > (a.maxHeatIndexF ?? 0) ? b : a));
  const peakHi = Math.round(peak.maxHeatIndexF!);
  if (peakHi >= 105) {
    return `Dangerous heat is the headline — the heat index reaches about ${peakHi} on ${dayLabel(peak)}.`;
  }
  if (peakHi >= 85) {
    return `Heat is not the primary concern, but heat indices may reach around ${peakHi} by ${dayLabel(peak)}.`;
  }
  return `No major heat episode is expected — heat indices stay near the air temperature.`;
}

function humidityHeadline(days: DailyFacts[]): string | null {
  const withDew = days.filter((d) => d.dewPointMedianF != null);
  if (withDew.length < 2) return null;
  const first = withDew[0].dewPointMedianF!;
  const last = withDew[withDew.length - 1].dewPointMedianF!;
  const maxDew = Math.max(...withDew.map((d) => d.dewPointMaxF ?? d.dewPointMedianF!));

  if (last - first >= 3) {
    return `Humidity builds through the week, with dew points rising from the ${tensPhrase(first)} into the ${tensPhrase(last)}.`;
  }
  if (first - last >= 3) {
    return `Humidity eases as the week goes on, with dew points falling from the ${tensPhrase(first)} into the ${tensPhrase(last)}.`;
  }
  if (maxDew >= 61) {
    return `It stays humid throughout, with dew points around the ${tensPhrase(maxDew)}.`;
  }
  return `Humidity stays low, with dew points around the ${tensPhrase(maxDew)}.`;
}

function buildHeadline(days: DailyFacts[], forecast: NormalizedForecast): string {
  // Priority: official alerts → supported impactful weather → heat/moisture → comfort
  return [alertSentence(forecast), precipHeadline(days), heatHeadline(days), humidityHeadline(days)]
    .filter((s): s is string => !!s)
    .join(' ');
}

function buildFootnote(days: DailyFacts[], forecast: NormalizedForecast): string {
  const parts: string[] = [];
  const firm = days.filter((d) => d.confidence === 'firm');
  const extended = days.filter((d) => d.confidence === 'extended');
  if (extended.length > 0 && firm.length > 0) {
    parts.push(
      `Hourly dew-point and humidity values run through ${firm[firm.length - 1].dayName}; ${extended
        .map((d) => d.dayName)
        .join(', ')} ${extended.length === 1 ? 'comes' : 'come'} from the multi-day forecast only.`
    );
  } else {
    parts.push(`Every day above is backed by the NWS hourly grid.`);
  }
  if (forecast.alertsStatus !== 'ok') {
    parts.push(`Active-alert data could not be checked, so treat hazard information as incomplete.`);
  }
  return parts.join(' ');
}

// ── Invariant validation ──────────────────────────────────────────────────────

const LEGACY_PHRASES = [
  /this is not a heat-index week/i,
  /comfortable end of summer/i,
  /enough breeze to keep sweat evaporating/i,
  /you won'?t dry off/i,
  /no real humidity penalty/i,
];

/** Numbers a narrative is allowed to display, derived from the facts object. */
function allowedNumbers(days: DailyFacts[]): Set<number> {
  const allowed = new Set<number>();
  const add = (v: number | null | undefined) => {
    if (v == null || Number.isNaN(v)) return;
    allowed.add(Math.round(v));
    allowed.add(Math.floor(v / 10) * 10); // decade phrases ("upper 60s")
  };
  for (let i = 0; i <= 7; i++) allowed.add(i); // day counts
  for (const d of days) {
    add(d.highTemperatureF);
    add(d.maxHeatIndexF);
    add(d.maxHourlyHeatIndexDelta);
    add(d.dewPointMinF);
    add(d.dewPointMaxF);
    add(d.dewPointMedianF);
    add(d.windMedianMph);
    add(d.windMinMph);
    add(d.windMaxMph);
    add(d.windGustMaxMph);
    if (d.peakPopPct != null) allowed.add(roundPop(d.peakPopPct));
    for (const v of Object.values(d.popByPart)) if (v != null) allowed.add(roundPop(v));
  }
  return allowed;
}

export function validateNarrative(
  narrative: Omit<Narrative, 'invariantViolations'>,
  days: DailyFacts[],
  forecast: NormalizedForecast,
  analysisVersion: string,
  cacheKeyVersion: string
): string[] {
  const violations: string[] = [];
  const dayTexts = narrative.days.map((d) => d.text);
  const all = [narrative.headline, ...dayTexts, narrative.footnote].join('\n');

  for (const phrase of LEGACY_PHRASES) {
    if (phrase.test(all)) violations.push(`legacy phrase present: ${phrase}`);
  }

  // 1. Heat index vs air temperature
  if (days.some((d) => (d.maxHourlyHeatIndexDelta ?? 0) > 0)) {
    if (/never (?:exceed|exceeds|runs above|tops|goes above)/i.test(all)) {
      violations.push('claims feels-like never exceeds air temperature while a day shows otherwise');
    }
  }

  // 2. Weekly comfort claim vs humid days
  if (days.some((d) => (d.dewPointMaxF ?? 0) >= 61)) {
    if (/\b(?:comfortable|pleasant)\b/i.test(narrative.headline)) {
      violations.push('headline calls the week comfortable despite dew points at or above 61');
    }
  }

  // 3 & 4. Every displayed number traceable to the facts
  const allowed = allowedNumbers(days);
  for (const m of all.matchAll(/(\d+)(?=°|%|\b)/g)) {
    const n = Number(m[1]);
    if (!allowed.has(n)) violations.push(`untraceable number in narrative: ${n}`);
  }

  // 5. Saturation language — same predicate the generator uses, so an
  // out-of-daypart or non-persistent claim can never survive validation
  narrative.days.forEach((line, i) => {
    if (/saturation|saturated/i.test(line.text)) {
      const d = days[i];
      if (!d || !qualifiesNearSaturation(d)) {
        violations.push(`near-saturation claim unsupported on ${line.name}`);
      }
      if (d && (d.highTemperatureF ?? 0) >= 75 && /\braw\b/i.test(line.text)) {
        violations.push(`"raw" used for warm saturated air on ${line.name}`);
      }
    }
  });

  // 5b. No identical comfort sentence on consecutive days
  const comfortSentencesOf = (text: string): string[] =>
    (text.match(/[^.?!]+[.?!]/g) ?? [])
      .map((s) => s.trim())
      .filter((s) => /saturation|humid|damp|relief|air movement|still air/i.test(s) && !/\d/.test(s));
  for (let i = 1; i < narrative.days.length; i++) {
    const prev = new Set(comfortSentencesOf(narrative.days[i - 1].text));
    for (const s of comfortSentencesOf(narrative.days[i].text)) {
      if (prev.has(s)) {
        violations.push(`comfort sentence repeated on consecutive days: "${s}"`);
      }
    }
  }

  // 6. Precipitation timing must be backed by source intervals
  narrative.days.forEach((line, i) => {
    if (/increasing late in the day/i.test(line.text) && !hasLateArrivingRain(days[i])) {
      violations.push(`late-rain timing unsupported on ${line.name}`);
    }
  });

  // 7. Intensity / coverage claims need explicit support
  if (/heavy rain|flooding|widespread|severe (?:weather|storms)/i.test(all)) {
    const supported =
      forecast.alerts.length > 0 || days.some((d) => (d.precipitationAmountIn ?? 0) >= 0.5);
    if (!supported) violations.push('unsupported intensity or coverage claim');
  }

  // 8. Sentence case for conditions
  if (/\b[A-Z][a-z]+ (?:And|Then|With) [A-Z]/.test(all)) {
    violations.push('condition text is not sentence case');
  }

  // 9. Day count and ordering
  const dates = days.map((d) => d.localDate);
  if ([...dates].sort().join() !== dates.join()) violations.push('days out of order');
  if (days.length > 7) violations.push('more than seven days represented');

  // 12. Version agreement
  if (analysisVersion !== cacheKeyVersion) {
    violations.push('analysisVersion does not match the narrative cache key version');
  }

  return violations;
}

/** Minimal, provably safe narrative used when an invariant fails. */
function fallbackNarrative(days: DailyFacts[], violations: string[]): Narrative {
  return {
    headline:
      'A detailed outlook is unavailable right now. The day-by-day values below come straight from the National Weather Service hourly forecast.',
    days: days.map((d) => ({
      name: d.isToday ? `${d.dayName} (today)` : d.dayName,
      isToday: d.isToday,
      firm: d.confidence === 'firm',
      text: [
        d.highTemperatureF != null ? `High near ${Math.round(d.highTemperatureF)}.` : null,
        d.dewPointMedianF != null ? `Dew point near ${Math.round(d.dewPointMedianF)}.` : null,
        d.peakPopPct != null && d.peakPopPct >= 20
          ? `Peak rain chance around ${roundPop(d.peakPopPct)}%.`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
    })),
    footnote: 'Narrative validation did not pass, so only direct forecast values are shown.',
    invariantViolations: violations,
  };
}

/**
 * Drop any comfort-class sentence that would repeat verbatim from the
 * previous day — the reader was already told.
 */
function dedupeConsecutiveComfort(dayTexts: string[]): string[] {
  const isComfort = (s: string) =>
    /saturation|humid|damp|relief|air movement|still air/i.test(s) && !/\d/.test(s);
  let previous = new Set<string>();
  return dayTexts.map((text) => {
    const sentences = (text.match(/[^.?!]+[.?!]/g) ?? [text]).map((s) => s.trim());
    const kept = sentences.filter((s) => !(isComfort(s) && previous.has(s)));
    previous = new Set(sentences.filter(isComfort));
    return kept.join(' ');
  });
}

export function composeNarrative(
  days: DailyFacts[],
  forecast: NormalizedForecast,
  cacheKeyVersion: string = NARRATIVE_RULESET_VERSION
): Narrative {
  const texts = dedupeConsecutiveComfort(
    days.map((d) => (d.confidence === 'firm' ? firmDayText(d) : extendedDayText(d)))
  );
  const candidate = {
    headline: buildHeadline(days, forecast),
    days: days.map((d, i) => ({
      name: d.isToday ? `${d.dayName} (today)` : d.dayName,
      isToday: d.isToday,
      firm: d.confidence === 'firm',
      text: texts[i],
    })),
    footnote: buildFootnote(days, forecast),
  };

  const violations = validateNarrative(
    candidate,
    days,
    forecast,
    NARRATIVE_RULESET_VERSION,
    cacheKeyVersion
  );
  if (violations.length > 0) return fallbackNarrative(days, violations);
  return { ...candidate, invariantViolations: [] };
}
