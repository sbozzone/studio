/**
 * Qualitative weather outlook: what will it actually feel like to be outside?
 *
 * Data: the NWS hourly tabular forecast (temperature °F, dewpoint °C,
 * relative humidity %, wind, hourly precipitation probability, short
 * conditions) plus the NWS 7-day period forecast for days beyond the hourly
 * grid, plus active NWS alerts (best-effort).
 *
 * All meteorology is deterministic. Heat index is the NOAA/NWS Rothfusz
 * regression (calcFeelsLikeF), computed for each hour from that hour's
 * temperature and humidity, never from a daily high paired with a different
 * hour's humidity. The weekly headline is derived from the same hourly
 * aggregates as the daily lines, so the two cannot contradict each other.
 *
 * Provider semantics worth noting: NWS hourly probabilityOfPrecipitation is
 * the probability for that hour — a day-level number derived from it is a
 * PEAK hourly chance, and is labeled as such. Times carry the forecast
 * location's local UTC offset; days are grouped by that local date, so
 * "today" is location-local regardless of server or device time zone.
 */

import { calcFeelsLikeF, cToF, dewPointDescriptor } from '@/lib/dew-point';

/**
 * Bumped whenever the narrative logic changes. Displayed with the brief so a
 * stale deployment or cached bundle is immediately identifiable on screen —
 * the narrative itself is composed client-side on every request and is never
 * cached by the app, so an old narrative always means old JS is running.
 */
export const ANALYSIS_VERSION = '2.0.0';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HourStat {
  date: string; // local calendar date "2026-07-30"
  hour: number; // local hour 0-23
  tempF: number;
  dewF: number;
  hiF: number;
  /** Same-hour heat-index penalty: hiF - tempF for THIS hour */
  penaltyF: number;
  /** Same-hour temperature/dew-point spread */
  spreadF: number;
  windMph: number;
  windDir: string;
  pop: number;
  sky: string;
}

interface DayStat {
  date: string;
  name: string;
  isToday: boolean;
  index: number; // days from today
  highT: number;
  maxHI: number;
  /** Max over hours of (heat index − temperature) at the SAME hour */
  maxPenalty: number;
  dpMax: number;
  dpTypical: number; // rounded mean daytime dew point
  dpRange: number; // daytime max − min
  dpMorning: number;
  dpAfternoon: number;
  trend: 'rising' | 'falling' | 'steady';
  /**
   * Smallest midday/afternoon temp/dew-point spread. Dawn spreads are near
   * zero on most humid days, so a day-level "near saturation" claim is judged
   * on the active part of the day instead.
   */
  minSpread: number;
  windLo: number;
  windHi: number;
  windDir: string;
  sunny: boolean;
  sky: string;
  popMorning: number;
  popAfternoon: number;
  popEvening: number;
  popOvernightNext: number; // 00–05 of the following local date
}

interface InferredDay {
  date: string;
  name: string;
  highT: number | null;
  sky: string;
  pop: number;
  windDir: string;
  windText: string;
}

export interface OutlookBrief {
  locationName: string | null;
  /** Version of the narrative logic that produced this brief */
  analysisVersion: string;
  /** Active NWS alert event names, most important first (may be empty) */
  alerts: string[];
  headline: string;
  days: { name: string; isToday: boolean; firm: boolean; text: string }[];
  footnote: string;
}

// ── Fetching ──────────────────────────────────────────────────────────────────

async function getJson(url: string): Promise<Record<string, any>> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });
    if (res.ok) return res.json();
    if (attempt >= 1) throw new Error(`weather.gov returned ${res.status}`);
    // NWS occasionally hiccups with 5xx; one retry is usually enough
    await new Promise((r) => setTimeout(r, 800));
  }
}

export async function fetchOutlook(lat: number, lon: number): Promise<OutlookBrief> {
  let points: Record<string, any>;
  try {
    points = await getJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
  } catch {
    throw new Error(
      'The outlook uses the National Weather Service, which only covers US locations — and it may be briefly unavailable.'
    );
  }
  const props = points?.properties ?? {};
  const rel = props.relativeLocation?.properties;
  const locationName = rel?.city ? `${rel.city}, ${rel.state}` : null;
  if (!props.forecastHourly || !props.forecast) {
    throw new Error('The National Weather Service has no forecast grid for this location.');
  }

  // Alerts are best-effort: an alerts outage should never take down the outlook
  const alertsPromise = getJson(
    `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`
  )
    .then((a) => {
      const events = (a?.features ?? [])
        .map((f: any) => f?.properties?.event)
        .filter((e: unknown): e is string => typeof e === 'string' && e.length > 0);
      return [...new Set<string>(events)];
    })
    .catch(() => [] as string[]);

  const [hourly, daily, alerts] = await Promise.all([
    getJson(props.forecastHourly),
    getJson(props.forecast),
    alertsPromise,
  ]);
  return composeBrief(
    parseHourly(hourly?.properties?.periods ?? []),
    daily?.properties?.periods ?? [],
    locationName,
    alerts
  );
}

// ── Parsing ───────────────────────────────────────────────────────────────────

const parseWindMph = (s: unknown): [number, number] => {
  const nums = String(s ?? '').match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return [0, 0];
  return [Math.min(...nums), Math.max(...nums)];
};

export function parseHourly(periods: any[]): HourStat[] {
  const out: HourStat[] = [];
  for (const p of periods) {
    const start: string = p?.startTime ?? '';
    const tempF = p?.temperatureUnit === 'C' ? cToF(p?.temperature) : p?.temperature;
    const dewC = p?.dewpoint?.value;
    const rh = p?.relativeHumidity?.value;
    if (typeof tempF !== 'number' || typeof dewC !== 'number' || start.length < 13) continue;
    const dewF = cToF(dewC);
    const hiF = typeof rh === 'number' ? calcFeelsLikeF(tempF, rh) : tempF;
    const [, windHi] = parseWindMph(p?.windSpeed);
    out.push({
      date: start.slice(0, 10),
      hour: parseInt(start.slice(11, 13), 10),
      tempF,
      dewF,
      hiF,
      penaltyF: hiF - tempF,
      spreadF: tempF - dewF,
      windMph: windHi,
      windDir: p?.windDirection ?? '',
      pop: p?.probabilityOfPrecipitation?.value ?? 0,
      sky: p?.shortForecast ?? '',
    });
  }
  return out;
}

const dayNameOf = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

const mode = (arr: string[]): string => {
  const counts = new Map<string, number>();
  let best = arr[0] ?? '';
  for (const v of arr) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > (counts.get(best) ?? 0)) best = v;
  }
  return best;
};

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const maxOf = (xs: number[]): number => (xs.length ? Math.max(...xs) : 0);

/** Round a probability to the nearest 10% — hourly PoP doesn't warrant more precision. */
export const roundPop = (p: number): number => Math.round(p / 10) * 10;

/** NWS shortForecast is Title Case; prose wants sentence case. */
export function sentenceCaseCondition(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bchance (?=showers|rain|drizzle|snow|storms|thunderstorms)/g, 'chance of ');
}
const capFirst = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

function buildDayStats(hours: HourStat[]): DayStat[] {
  const byDate = new Map<string, HourStat[]>();
  for (const h of hours) {
    if (!byDate.has(h.date)) byDate.set(h.date, []);
    byDate.get(h.date)!.push(h);
  }
  const dates = [...byDate.keys()];
  const today = hours[0]?.date;
  const days: DayStat[] = [];
  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const hs = byDate.get(date)!;
    // Judge the day by its daytime hours — that's when people are outside
    const daytime = hs.filter((h) => h.hour >= 8 && h.hour <= 20);
    const use = daytime.length >= 4 ? daytime : hs;
    // Skip a trailing fragment of a day (e.g. hourly grid ends at 6am)
    if (use.length < 4 && date !== today) continue;
    const dpVals = use.map((h) => h.dewF);
    const dpMorning = avg(use.filter((h) => h.hour <= 11).map((h) => h.dewF));
    const dpAfternoon = avg(use.filter((h) => h.hour >= 14).map((h) => h.dewF));
    const haveBothEnds = use.some((h) => h.hour <= 11) && use.some((h) => h.hour >= 14);
    const delta = haveBothEnds ? dpAfternoon - dpMorning : 0;
    const nextHs = byDate.get(dates[di + 1]) ?? [];
    days.push({
      date,
      name: dayNameOf(date),
      isToday: date === today,
      index: days.length === 0 ? 0 : days[days.length - 1].index + 1,
      highT: Math.round(Math.max(...use.map((h) => h.tempF))),
      maxHI: Math.round(Math.max(...use.map((h) => h.hiF))),
      maxPenalty: Math.round(Math.max(...use.map((h) => h.penaltyF))),
      dpMax: Math.round(Math.max(...dpVals)),
      dpTypical: Math.round(avg(dpVals)),
      dpRange: Math.round(Math.max(...dpVals) - Math.min(...dpVals)),
      dpMorning: Math.round(dpMorning || use[0].dewF),
      dpAfternoon: Math.round(dpAfternoon || use[use.length - 1].dewF),
      trend: delta >= 4 ? 'rising' : delta <= -4 ? 'falling' : 'steady',
      minSpread: Math.round(
        Math.min(
          ...(use.some((h) => h.hour >= 12 && h.hour <= 18)
            ? use.filter((h) => h.hour >= 12 && h.hour <= 18)
            : use
          ).map((h) => h.spreadF)
        )
      ),
      windLo: Math.round(Math.min(...use.map((h) => h.windMph))),
      windHi: Math.round(Math.max(...use.map((h) => h.windMph))),
      windDir: mode(use.map((h) => h.windDir)),
      sunny: /sunny|clear/i.test(mode(use.map((h) => h.sky))),
      sky: mode(use.map((h) => h.sky)),
      popMorning: maxOf(hs.filter((h) => h.hour >= 6 && h.hour <= 11).map((h) => h.pop)),
      popAfternoon: maxOf(hs.filter((h) => h.hour >= 12 && h.hour <= 17).map((h) => h.pop)),
      popEvening: maxOf(hs.filter((h) => h.hour >= 18).map((h) => h.pop)),
      popOvernightNext: maxOf(nextHs.filter((h) => h.hour <= 5).map((h) => h.pop)),
    });
  }
  return days;
}

function buildInferredDays(dailyPeriods: any[], afterDate: string): InferredDay[] {
  const out: InferredDay[] = [];
  for (const p of dailyPeriods) {
    if (!p?.isDaytime) continue;
    const date = String(p?.startTime ?? '').slice(0, 10);
    if (date <= afterDate) continue;
    out.push({
      date,
      name: dayNameOf(date),
      highT: typeof p?.temperature === 'number' ? p.temperature : null,
      sky: p?.shortForecast ?? '',
      pop: p?.probabilityOfPrecipitation?.value ?? 0,
      windDir: p?.windDirection ?? '',
      windText: p?.windSpeed ?? '',
    });
  }
  return out;
}

// ── Per-day helpers ───────────────────────────────────────────────────────────

const dayPeakPop = (d: DayStat): number => Math.max(d.popMorning, d.popAfternoon);
const latePeakPop = (d: DayStat): number => Math.max(d.popEvening, d.popOvernightNext);

/** "62" -> "low 60s" */
export function tensPhrase(v: number): string {
  const decade = Math.floor(v / 10) * 10;
  const pos = v - decade;
  const word = pos < 3.5 ? 'low' : pos < 6.5 ? 'mid' : 'upper';
  return `${word} ${decade}s`;
}

const isSoutherly = (dir: string) => /^S/.test(dir);
const isNortherly = (dir: string) => /^N/.test(dir);

type WindBand = 'calm' | 'light' | 'noticeable' | 'breezy';
const windBand = (d: DayStat): WindBand =>
  d.windHi <= 3 ? 'calm' : d.windHi <= 7 ? 'light' : d.windHi <= 12 ? 'noticeable' : 'breezy';

/**
 * Wind relief is uncertain — it depends on humidity, activity, clothing and
 * sun, not wind speed alone. The wording stays deliberately restrained.
 */
function windSentence(d: DayStat): string {
  const band = windBand(d);
  if (band === 'calm') return `Nearly calm air — little wind relief.`;
  if (band === 'light') return `Winds remain light, offering limited relief.`;
  if (band === 'noticeable') {
    const range = d.windLo === d.windHi ? `around ${d.windHi} mph` : `${d.windLo}–${d.windHi} mph`;
    return `A noticeable ${d.windDir} breeze of ${range} may provide some relief.`;
  }
  return `Breezy — ${d.windDir} wind up to ${d.windHi} mph.`;
}

function dewPointSentence(d: DayStat): string {
  if (d.trend === 'rising') {
    return `Dew point climbs from the ${tensPhrase(d.dpMorning)} into the ${tensPhrase(d.dpAfternoon)}${
      isSoutherly(d.windDir) ? ' on southerly flow' : ''
    } — ${dewPointDescriptor(d.dpAfternoon)} by afternoon.`;
  }
  if (d.trend === 'falling') {
    return `Dew point falls from around ${d.dpMorning} into the ${tensPhrase(d.dpAfternoon)} as drier air works in.`;
  }
  // "Steady" only when the hourly data actually holds a tight range
  if (d.dpRange <= 3) {
    return `Dew point steady near ${d.dpTypical} — ${dewPointDescriptor(d.dpTypical)}.`;
  }
  return `Dew points generally in the ${tensPhrase(d.dpTypical)} — ${dewPointDescriptor(d.dpTypical)}.`;
}

/** Heat index line — only when meteorologically meaningful (NWS defines it from 80°F up). */
function heatIndexSentence(d: DayStat, hedged: boolean): string | null {
  if (d.maxHI < 80) return null;
  const verb = hedged ? 'is expected to reach' : 'reaches';
  if (d.maxPenalty <= 2) {
    return `Afternoon heat index stays within a couple degrees of the air temperature.`;
  }
  if (d.maxPenalty <= 5) {
    return `Afternoon heat index ${verb} about ${d.maxHI}, a few degrees above the air temperature.`;
  }
  const danger = d.maxHI >= 105 ? ` That is genuinely dangerous mid-afternoon — keep outdoor time to early morning.` : '';
  return `Heat index ${verb} about ${d.maxHI}, roughly ${d.maxPenalty}° above the air temperature.${danger}`;
}

function skyAndRainSentence(d: DayStat): string {
  const sky = sentenceCaseCondition(d.sky);
  const dayPeak = roundPop(dayPeakPop(d));
  const latePeak = roundPop(latePeakPop(d));

  // Rain arrives late: don't flatten the whole day into one wet description
  if (latePeak >= 50 && dayPeak <= 30) {
    return `${capFirst(sky)} for much of the day, with rain chances increasing late in the day and overnight (peak chance around ${latePeak}%).`;
  }
  // Morning rain that tapers
  if (roundPop(d.popMorning) >= 50 && roundPop(d.popAfternoon) <= 30) {
    return `${capFirst(sky)} — rain chances are highest in the morning (around ${roundPop(d.popMorning)}%), tapering through the afternoon.`;
  }
  if (dayPeak >= 50) {
    const damp =
      d.minSpread <= 3
        ? ' Air near saturation — expect a damp, raw feel that lingers after any rain.'
        : d.dpMax >= 66 && d.highT <= 80
          ? ` Not hot, but damp and humid — a muggy day even between showers.`
          : '';
    return `${capFirst(sky)}, peak rain chance around ${dayPeak}%.${damp}`;
  }
  if (Math.max(dayPeak, latePeak) >= 30) {
    return `${capFirst(sky)}, peak rain chance around ${Math.max(dayPeak, latePeak)}%.`;
  }
  return `${capFirst(sky)}.`;
}

function firmDayText(d: DayStat, prev: DayStat | undefined, sunNoteUsed: boolean): { text: string; sunNote: boolean } {
  const hedged = d.index >= 2;
  const parts: string[] = [];

  parts.push(d.index >= 4 ? `Currently forecast to reach ${d.highT}.` : hedged ? `High near ${d.highT} expected.` : `High ${d.highT}.`);
  parts.push(dewPointSentence(d));

  const hi = heatIndexSentence(d, hedged);
  if (hi) parts.push(hi);

  parts.push(skyAndRainSentence(d));

  // Skip a repeat wind sentence when nothing changed and the wind isn't a story
  const band = windBand(d);
  const sameAsPrev = prev && windBand(prev) === band;
  if (!sameAsPrev || band === 'breezy' || band === 'noticeable') {
    parts.push(windSentence(d));
  }

  // Heat index assumes shade; direct sun feels hotter (NWS caveat)
  let sunNote = false;
  if (d.sunny && d.maxHI >= 85 && !sunNoteUsed) {
    parts.push(`In direct sun it will feel hotter than the listed heat index.`);
    sunNote = true;
  }

  if (prev && d.dpMax - prev.dpMax >= 8) {
    parts.push(`Noticeably more humid than ${prev.name} at the same temperature.`);
  } else if (prev && prev.dpMax - d.dpMax >= 8) {
    parts.push(`A drier air mass than ${prev.name} — you'll feel the difference.`);
  }

  if (d.index >= 4) {
    parts.push(`Details this far out can still shift.`);
  }
  return { text: parts.join(' '), sunNote };
}

function inferredDayText(d: InferredDay, lastFirm: DayStat | undefined): string {
  const parts: string[] = [];
  if (d.highT != null) parts.push(`High near ${d.highT} currently forecast.`);
  parts.push(
    `${capFirst(sentenceCaseCondition(d.sky))}${d.pop >= 35 ? ` (chance around ${roundPop(d.pop)}%)` : ''}.`
  );
  if (d.windText) parts.push(`Wind ${d.windDir} ${d.windText.toLowerCase()}.`);
  if (isSoutherly(d.windDir)) {
    parts.push(`Southerly flow tends to bring moisture back — it may feel more humid than the numbers suggest.`);
  } else if (isNortherly(d.windDir)) {
    parts.push(`Northerly flow tends to dry things out — likely more comfortable than the raw high implies.`);
  } else if (lastFirm) {
    parts.push(`No strong signal either way; figure on air similar to ${lastFirm.name}'s.`);
  }
  return parts.join(' ');
}

// ── Headline ──────────────────────────────────────────────────────────────────

interface RainStory {
  sentence: string;
}

/** Find the dominant precipitation window across the firm days. */
function findRainStory(days: DayStat[]): RainStory | null {
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const next = days[i + 1];
    const late = roundPop(latePeakPop(d));
    const day = roundPop(dayPeakPop(d));
    const stormy = /thunder/i.test(d.sky) || (next && /thunder/i.test(next.sky));
    const what = stormy ? 'showers and thunderstorms' : 'rain';
    if (late >= 50 && day <= 30) {
      const through = next && roundPop(dayPeakPop(next)) >= 50 ? ` ${d.name} night through ${next.name}` : ` ${d.name} night`;
      return {
        sentence: `The primary concern is ${what} developing late ${d.isToday ? 'today' : d.name}, with the greatest rain potential${through}.`,
      };
    }
    if (day >= 60) {
      return {
        sentence: `The primary concern is ${what} on ${d.isToday ? 'today' : d.name}, with peak rain chances around ${day}%.`,
      };
    }
  }
  return null;
}

function headline(days: DayStat[], rain: RainStory | null): string {
  const n = days.length;
  const parts: string[] = [];
  const worst = days.reduce((a, b) => (b.maxHI > a.maxHI ? b : a));
  const maxPenalty = Math.max(...days.map((d) => d.maxPenalty));

  // Heat, characterized from the same per-hour numbers the day lines use
  if (worst.maxHI >= 105) {
    parts.push(
      `Dangerous heat is the headline: ${worst.name} peaks near a ${worst.maxHI}° heat index. Outdoor time belongs to early morning until it breaks.`
    );
  } else if (maxPenalty <= 7 && worst.maxHI < 96) {
    // Modest humidity load — distinguish "no significant heat hazard" from
    // "no heat index at all". Two-phase wording when the load steps up midway.
    let prefixEnd = -1;
    for (let i = 0; i < days.length && days[i].maxPenalty <= 2; i++) prefixEnd = i;
    const rest = days.slice(prefixEnd + 1);
    if (prefixEnd >= 0 && prefixEnd < days.length - 1 && rest.some((d) => d.maxPenalty >= 3)) {
      const lo = Math.min(...rest.map((d) => d.maxPenalty));
      const hi = Math.max(...rest.map((d) => d.maxPenalty));
      parts.push(
        `No major heat episode is expected. Afternoon heat indices should stay close to the air temperature through ${days[prefixEnd].name}, then run roughly ${Math.max(lo, 3)}–${hi}° warmer from ${rest[0].name} on.`
      );
    } else if (maxPenalty <= 5) {
      parts.push(
        `No major heat-index concerns are expected: afternoon heat indices generally stay within about 0–5° of the air temperature over the next ${n} days.`
      );
    } else {
      parts.push(
        `No major heat episode is expected — afternoon heat indices peak only about ${maxPenalty}° above the air temperature on the warmest days.`
      );
    }
  } else {
    parts.push(
      `Humidity adds a real load this stretch — heat indices run up to ${maxPenalty}° above the air temperature on the warmest days, peaking near ${worst.maxHI} on ${worst.name}.`
    );
  }

  // Humidity character, from the same dew-point aggregates as the day lines
  const dpLo = Math.min(...days.map((d) => d.dpMax));
  const dpHi = Math.max(...days.map((d) => d.dpMax));
  if (dpHi >= 61) {
    const range = tensPhrase(dpLo) === tensPhrase(dpHi) ? `the ${tensPhrase(dpHi)}` : `the ${tensPhrase(dpLo)} to ${tensPhrase(dpHi)}`;
    parts.push(`It will still feel humid, with dew points ranging from ${range}.`);
  } else {
    parts.push(`Humidity stays in check, with dew points at or below the ${tensPhrase(Math.max(dpHi, 50))}.`);
  }

  if (rain) parts.push(rain.sentence);

  return parts.join(' ');
}

// ── Assembly ──────────────────────────────────────────────────────────────────

export function composeBrief(
  hours: HourStat[],
  dailyPeriods: any[],
  locationName: string | null,
  alerts: string[] = []
): OutlookBrief {
  const firmDays = buildDayStats(hours);
  if (firmDays.length === 0) {
    throw new Error('The National Weather Service returned no usable hourly data for this location.');
  }
  const lastFirm = firmDays[firmDays.length - 1];
  const inferred = buildInferredDays(dailyPeriods, lastFirm.date);

  const days: OutlookBrief['days'] = [];
  let sunNoteUsed = false;
  firmDays.forEach((d, i) => {
    const { text, sunNote } = firmDayText(d, firmDays[i - 1], sunNoteUsed);
    if (sunNote) sunNoteUsed = true;
    days.push({ name: d.isToday ? `${d.name} (today)` : d.name, isToday: d.isToday, firm: true, text });
  });
  for (const d of inferred) {
    days.push({ name: d.name, isToday: false, firm: false, text: inferredDayText(d, lastFirm) });
  }

  // Best days to be outside, when there's a real spread to choose from
  const ranked = [...firmDays].sort(
    (a, b) => Math.max(a.dpMax + a.maxPenalty, 0) - Math.max(b.dpMax + b.maxPenalty, 0)
  );
  const bestLine =
    firmDays.length >= 3 && ranked[ranked.length - 1].dpMax - ranked[0].dpMax >= 5
      ? ` Best windows to be outside: ${ranked[0].isToday ? 'today' : ranked[0].name}${
          ranked[1] ? ` and ${ranked[1].isToday ? 'today' : ranked[1].name}` : ''
        }.`
      : '';

  const footnote =
    (inferred.length > 0
      ? `Firm hourly dewpoint numbers run through ${lastFirm.name} night; ${inferred
          .map((d) => d.name)
          .join(', ')} ${inferred.length === 1 ? 'is' : 'are'} read from the 7-day pattern, not published hourlies, and details there often shift.`
      : `The full stretch above is backed by hourly dewpoint numbers from the NWS grid.`) + bestLine;

  return {
    locationName,
    analysisVersion: ANALYSIS_VERSION,
    alerts,
    headline: headline(firmDays, findRainStory(firmDays)),
    days,
    footnote,
  };
}
