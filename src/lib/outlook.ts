/**
 * Qualitative weather outlook: what will it actually feel like to be outside?
 *
 * Pulls the NWS hourly tabular forecast (dewpoint, temperature, humidity,
 * wind) plus the 7-day period forecast, computes heat index per hour, and
 * composes a short brief: one headline finding, a line per day, and an honest
 * flag where the hourly dewpoint grid runs out and we're reading the pattern.
 */

import { calcFeelsLikeF, cToF, getComfortLevel } from '@/lib/dew-point';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HourStat {
  date: string; // local calendar date "2026-07-20"
  hour: number; // local hour 0-23
  tempF: number;
  dewF: number;
  hiF: number;
  windMph: number;
  windDir: string;
  pop: number;
  sky: string;
}

interface DayStat {
  date: string;
  name: string; // "Wednesday"
  isToday: boolean;
  highT: number;
  maxHI: number;
  penalty: number; // maxHI - highT
  dpMax: number;
  dpMorning: number;
  dpAfternoon: number;
  trend: 'rising' | 'falling' | 'steady';
  windLo: number;
  windHi: number;
  windDir: string;
  pop: number;
  sky: string;
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
  const [hourly, daily] = await Promise.all([
    getJson(props.forecastHourly),
    getJson(props.forecast),
  ]);
  return composeBrief(
    parseHourly(hourly?.properties?.periods ?? []),
    daily?.properties?.periods ?? [],
    locationName
  );
}

// ── Parsing ───────────────────────────────────────────────────────────────────

const parseWindMph = (s: unknown): [number, number] => {
  const nums = String(s ?? '').match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return [0, 0];
  return [Math.min(...nums), Math.max(...nums)];
};

function parseHourly(periods: any[]): HourStat[] {
  const out: HourStat[] = [];
  for (const p of periods) {
    const start: string = p?.startTime ?? '';
    const tempF = p?.temperatureUnit === 'C' ? cToF(p?.temperature) : p?.temperature;
    const dewC = p?.dewpoint?.value;
    const rh = p?.relativeHumidity?.value;
    if (typeof tempF !== 'number' || typeof dewC !== 'number' || start.length < 13) continue;
    const [, windHi] = parseWindMph(p?.windSpeed);
    out.push({
      date: start.slice(0, 10),
      hour: parseInt(start.slice(11, 13), 10),
      tempF,
      dewF: cToF(dewC),
      hiF: typeof rh === 'number' ? calcFeelsLikeF(tempF, rh) : tempF,
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

function buildDayStats(hours: HourStat[]): DayStat[] {
  const byDate = new Map<string, HourStat[]>();
  for (const h of hours) {
    if (!byDate.has(h.date)) byDate.set(h.date, []);
    byDate.get(h.date)!.push(h);
  }
  const today = hours[0]?.date;
  const days: DayStat[] = [];
  for (const [date, hs] of byDate) {
    // Judge the day by its daytime hours — that's when people are outside
    const daytime = hs.filter((h) => h.hour >= 8 && h.hour <= 20);
    const use = daytime.length >= 4 ? daytime : hs;
    // Skip a trailing fragment of a day (e.g. hourly grid ends at 6am)
    if (use.length < 4 && date !== today) continue;
    const dpMorning = avg(use.filter((h) => h.hour <= 11).map((h) => h.dewF));
    const dpAfternoon = avg(use.filter((h) => h.hour >= 14).map((h) => h.dewF));
    const haveBothEnds = use.some((h) => h.hour <= 11) && use.some((h) => h.hour >= 14);
    const delta = haveBothEnds ? dpAfternoon - dpMorning : 0;
    days.push({
      date,
      name: dayNameOf(date),
      isToday: date === today,
      highT: Math.round(Math.max(...use.map((h) => h.tempF))),
      maxHI: Math.round(Math.max(...use.map((h) => h.hiF))),
      penalty: 0, // filled below
      dpMax: Math.round(Math.max(...use.map((h) => h.dewF))),
      dpMorning: Math.round(dpMorning || use[0].dewF),
      dpAfternoon: Math.round(dpAfternoon || use[use.length - 1].dewF),
      trend: delta >= 4 ? 'rising' : delta <= -4 ? 'falling' : 'steady',
      windLo: Math.round(Math.min(...use.map((h) => h.windMph))),
      windHi: Math.round(Math.max(...use.map((h) => h.windMph))),
      windDir: mode(use.map((h) => h.windDir)),
      pop: Math.round(Math.max(...use.map((h) => h.pop))),
      sky: mode(use.map((h) => h.sky)),
    });
  }
  for (const d of days) d.penalty = d.maxHI - d.highT;
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

// ── Qualitative composition ───────────────────────────────────────────────────

/** "62" -> "low 60s" */
function tensPhrase(v: number): string {
  const decade = Math.floor(v / 10) * 10;
  const pos = v - decade;
  const word = pos < 3.5 ? 'low' : pos < 6.5 ? 'mid' : 'upper';
  return `${word} ${decade}s`;
}

function rangePhrase(lo: number, hi: number): string {
  const a = tensPhrase(lo);
  const b = tensPhrase(hi);
  return a === b ? a : `${a.replace(/ \d+s$/, '')} ${Math.floor(lo / 10) * 10}s to ${b}`;
}

const isSoutherly = (dir: string) => /^S/.test(dir);
const isNortherly = (dir: string) => /^N/.test(dir);

function windSentence(d: DayStat): string {
  const range = d.windLo === d.windHi ? `around ${d.windHi} mph` : `${d.windLo}–${d.windHi} mph`;
  if (d.windHi < 6) {
    return `Winds only ${range} — no breeze to help, so direct sun will feel stronger than the numbers.`;
  }
  if (d.windHi <= 14) {
    return `${d.windDir} wind ${range}, enough breeze to keep sweat evaporating.`;
  }
  return `${d.windDir} wind up to ${d.windHi} mph — breezy enough to take a real edge off the humidity.`;
}

function firmDayText(d: DayStat, prev: DayStat | undefined): string {
  const parts: string[] = [`High ${d.highT}.`];
  const band = getComfortLevel(d.dpMax).label.toLowerCase();

  if (d.trend === 'rising') {
    parts.push(
      `Dewpoint climbs from the ${tensPhrase(d.dpMorning)} into the ${tensPhrase(d.dpAfternoon)} through the day${
        isSoutherly(d.windDir) ? ' as southerly flow pumps moisture in' : ''
      } — the afternoon turns ${getComfortLevel(d.dpAfternoon).label.toLowerCase()}.`
    );
  } else if (d.trend === 'falling') {
    parts.push(
      `Dewpoint starts near ${d.dpMorning}, then drops to the ${tensPhrase(d.dpAfternoon)} as drier air works in — improving through the afternoon.`
    );
  } else {
    parts.push(`Dewpoint steady in the ${tensPhrase(d.dpMax)} — ${band} territory.`);
  }

  if (d.pop >= 60 && d.dpMax >= 65 && d.highT <= 82) {
    parts.push(
      `${d.sky}, ${d.pop}% chance. This is the clammy kind of day: not hot, but air near saturation feels damp and heavy, and you won't dry off after rain.`
    );
  } else {
    if (d.penalty <= 2) {
      parts.push(`Heat index ${d.maxHI} — no real humidity penalty.`);
    } else if (d.penalty <= 6) {
      parts.push(`Heat index tops out at ${d.maxHI}, a modest humidity bump over the ${d.highT}° air.`);
    } else {
      parts.push(`Heat index tops out at ${d.maxHI} — a ${d.penalty}° humidity tax on top of the thermometer.`);
    }
    if (d.maxHI >= 105) {
      parts.push(`That's genuinely dangerous mid-afternoon; keep outside time to early morning.`);
    }
    if (d.pop >= 30) {
      parts.push(`${d.sky}, ${d.pop}% chance of rain.`);
    } else if (d.sky) {
      parts.push(`${d.sky}.`);
    }
  }

  parts.push(windSentence(d));

  if (prev && d.dpMax - prev.dpMax >= 8) {
    parts.push(`Noticeably stickier than ${prev.name} at the same temperature.`);
  } else if (prev && prev.dpMax - d.dpMax >= 8) {
    parts.push(`A different air mass than ${prev.name} — you'll feel the dry-out.`);
  }
  return parts.join(' ');
}

function inferredDayText(d: InferredDay, lastFirm: DayStat | undefined): string {
  const parts: string[] = [];
  if (d.highT != null) parts.push(`High ${d.highT}.`);
  parts.push(`${d.sky}${d.pop >= 40 ? `, ${d.pop}% chance` : ''}.`);
  if (d.windText) parts.push(`Wind ${d.windDir} ${d.windText}.`);
  if (isSoutherly(d.windDir)) {
    parts.push(`Southerly flow usually pumps moisture back in — expect it stickier than the numbers suggest.`);
  } else if (isNortherly(d.windDir)) {
    parts.push(`Northerly flow tends to scour moisture out — likely more comfortable than the raw high implies.`);
  } else if (lastFirm) {
    parts.push(`No strong signal either way; figure on air like ${lastFirm.name}'s.`);
  }
  return parts.join(' ');
}

function headline(days: DayStat[], locationName: string | null): string {
  const where = locationName ? `For ${locationName}, ` : '';
  const n = days.length;
  const worst = days.reduce((a, b) => (b.maxHI > a.maxHI ? b : a));
  const dpLo = Math.min(...days.map((d) => d.dpMax));
  const dpHi = Math.max(...days.map((d) => d.dpMax));

  if (worst.maxHI >= 105) {
    return (
      `This is a dangerous-heat stretch. ${where}${worst.name} peaks at a ${worst.maxHI}° heat index with dewpoints near ${worst.dpMax} — ` +
      `outside time belongs to early morning until this breaks.`
    );
  }
  let split: { from: DayStat; to: DayStat } | null = null;
  for (let i = 1; i < days.length; i++) {
    if (Math.abs(days[i].dpMax - days[i - 1].dpMax) >= 8) {
      split = { from: days[i - 1], to: days[i] };
      break;
    }
  }
  if (split) {
    const wetter = split.to.dpMax > split.from.dpMax;
    return (
      `The week splits in two. ${where}dewpoints ${wetter ? 'jump' : 'fall'} from the ${tensPhrase(split.from.dpMax)} to the ${tensPhrase(split.to.dpMax)} ` +
      `between ${split.from.name} and ${split.to.name} — ${
        wetter
          ? `get outdoor plans in before the moisture arrives.`
          : `the back half is the half worth being outside for.`
      }`
    );
  }
  const taxedDays = days.filter((d) => d.penalty >= 7);
  if (taxedDays.length >= 2) {
    return (
      `Humidity is the story. ${where}the feels-like runs well above the thermometer on ${taxedDays.length} of the next ${n} days, ` +
      `with dewpoints in the ${rangePhrase(dpLo, dpHi)} — plan around mornings.`
    );
  }
  return (
    `This is not a heat-index ${n >= 5 ? 'week' : 'stretch'}. ${where}the feels-like basically never runs above the actual temperature ` +
    `over the next ${n} days, and dewpoints hold in the ${rangePhrase(dpLo, dpHi)} — the comfortable end of summer.`
  );
}

export function composeBrief(
  hours: HourStat[],
  dailyPeriods: any[],
  locationName: string | null
): OutlookBrief {
  const firmDays = buildDayStats(hours);
  if (firmDays.length === 0) {
    throw new Error('The National Weather Service returned no usable hourly data for this location.');
  }
  const lastFirm = firmDays[firmDays.length - 1];
  const inferred = buildInferredDays(dailyPeriods, lastFirm.date);

  const days: OutlookBrief['days'] = [];
  firmDays.forEach((d, i) => {
    days.push({
      name: d.isToday ? `${d.name} (today)` : d.name,
      isToday: d.isToday,
      firm: true,
      text: firmDayText(d, firmDays[i - 1]),
    });
  });
  for (const d of inferred) {
    days.push({ name: d.name, isToday: false, firm: false, text: inferredDayText(d, lastFirm) });
  }

  // Best days to be outside, when there's a real spread to choose from
  const ranked = [...firmDays].sort((a, b) => Math.max(a.dpMax, a.maxHI - 20) - Math.max(b.dpMax, b.maxHI - 20));
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
          .join(', ')} ${inferred.length === 1 ? 'is' : 'are'} read from the 7-day pattern, not published hourlies.`
      : `The full stretch above is backed by hourly dewpoint numbers from the NWS grid.`) + bestLine;

  return { locationName, headline: headline(firmDays, locationName), days, footnote };
}
