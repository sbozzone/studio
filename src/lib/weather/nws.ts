/**
 * National Weather Service provider adapter.
 *
 * Docs: https://www.weather.gov/documentation/services-web-api
 *
 * Field semantics that matter here:
 * - /points          → gridpoint URLs, `timeZone` (IANA) for the forecast
 *                      location, and a relativeLocation city/state label.
 * - /forecast/hourly → one period per hour. `temperature` (°F by request),
 *                      `dewpoint` (°C), `relativeHumidity` (%),
 *                      `windSpeed`/`windGust` as human strings ("5 to 10 mph"),
 *                      `probabilityOfPrecipitation` — the probability for THAT
 *                      HOUR, not for the calendar day, and `shortForecast`
 *                      in Title Case. `properties.updated` is the issuance
 *                      time.
 * - /forecast        → 12-hour day/night periods, used only for days past the
 *                      end of the hourly grid.
 * - /gridpoints/.../ → `quantitativePrecipitation` values carry ISO 8601
 *                      interval strings ("<start>/PT6H"); a single value spans
 *                      its whole interval and must not be treated as hourly.
 * - /alerts/active   → official watches/warnings/advisories.
 */

import {
  heatIndexF as _heatIndexF,
  relativeHumidityFromDewPointF,
} from '@/lib/weather/heat-index';
import type {
  ExtendedPeriod,
  NormalizedForecast,
  NormalizedPeriod,
  WeatherAlert,
} from '@/lib/weather/types';

export const PROVIDER_NAME = 'NWS api.weather.gov';

const cToF = (c: number): number => (c * 9) / 5 + 32;

// ── Local-time helpers ────────────────────────────────────────────────────────

/**
 * Calendar date, hour and weekday for an instant *in the forecast location's
 * time zone*. Using Intl rather than the timestamp's printed offset keeps
 * daylight-saving transitions correct.
 */
export function localParts(
  iso: string,
  timeZone: string
): { date: string; hour: number; weekday: string } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    weekday: get('weekday'),
  };
}

export const localDateOf = (iso: string, timeZone: string): string =>
  localParts(iso, timeZone).date;

// ── Fetching ──────────────────────────────────────────────────────────────────

async function getJson(url: string): Promise<Record<string, any>> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });
    if (res.ok) return res.json();
    if (attempt >= 1) throw new Error(`weather.gov returned ${res.status}`);
    await new Promise((r) => setTimeout(r, 800)); // NWS occasionally 5xx's once
  }
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

/** "5 to 10 mph" → [5, 10]; "7 mph" → [7, 7]; null/"" → [null, null] */
export function parseWindRangeMph(s: unknown): [number | null, number | null] {
  const nums = String(s ?? '').match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return [null, null];
  return [Math.min(...nums), Math.max(...nums)];
}

const SEVERITIES = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'] as const;

function parseAlerts(features: any[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  for (const f of features ?? []) {
    const p = f?.properties ?? {};
    if (typeof p.event !== 'string' || !p.event) continue;
    const severity = (SEVERITIES as readonly string[]).includes(p.severity)
      ? (p.severity as WeatherAlert['severity'])
      : 'Unknown';
    alerts.push({
      event: p.event,
      severity,
      onset: p.onset ?? p.effective ?? null,
      ends: p.ends ?? p.expires ?? null,
    });
  }
  // Most severe first, then earliest onset
  return alerts.sort((a, b) => {
    const s = SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
    if (s !== 0) return s;
    return String(a.onset ?? '').localeCompare(String(b.onset ?? ''));
  });
}

/**
 * Expand `quantitativePrecipitation` (mm over an ISO interval) into per-hour
 * inches, dividing each interval's total evenly across the hours it covers.
 * The interval is preserved — a 6-hour total is never presented as an hourly
 * observation.
 */
export function expandQpfToHourlyInches(values: any[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of values ?? []) {
    const validTime: string = v?.validTime ?? '';
    const mm = v?.value;
    if (typeof mm !== 'number' || !validTime.includes('/')) continue;
    const [start, duration] = validTime.split('/');
    const hours = durationToHours(duration);
    if (!hours) continue;
    const startMs = new Date(start).getTime();
    if (Number.isNaN(startMs)) continue;
    const perHourIn = mm / 25.4 / hours;
    for (let i = 0; i < hours; i++) {
      out.set(new Date(startMs + i * 3600_000).toISOString(), perHourIn);
    }
  }
  return out;
}

/** "PT6H", "P1DT3H" → hours */
function durationToHours(duration: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(duration);
  if (!m) return null;
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const total = days * 24 + hours;
  return total > 0 ? total : null;
}

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeHourly(
  periods: any[],
  timeZone: string,
  qpfByHourIso: Map<string, number> = new Map()
): NormalizedPeriod[] {
  const out: NormalizedPeriod[] = [];
  for (const p of periods ?? []) {
    const validStart: string = p?.startTime ?? '';
    if (!validStart) continue;

    const rawTemp = p?.temperature;
    const temperatureF =
      typeof rawTemp === 'number' ? (p?.temperatureUnit === 'C' ? cToF(rawTemp) : rawTemp) : null;

    const dewC = p?.dewpoint?.value;
    const dewPointF = typeof dewC === 'number' ? cToF(dewC) : null;

    // Provider RH wins; derive only when it is absent and we have a same-hour pair
    const providedRh = p?.relativeHumidity?.value;
    let relativeHumidityPct: number | null = typeof providedRh === 'number' ? providedRh : null;
    let relativeHumidityDerived = false;
    if (relativeHumidityPct == null && temperatureF != null && dewPointF != null) {
      relativeHumidityPct = relativeHumidityFromDewPointF(temperatureF, dewPointF);
      relativeHumidityDerived = true;
    }

    const [windMin, windMax] = parseWindRangeMph(p?.windSpeed);
    const [, gustMax] = parseWindRangeMph(p?.windGust);

    const validEnd: string =
      p?.endTime ?? new Date(new Date(validStart).getTime() + 3600_000).toISOString();
    const { date, hour } = localParts(validStart, timeZone);

    out.push({
      validStart,
      validEnd,
      localDate: date,
      localHour: hour,
      temperatureF,
      dewPointF,
      relativeHumidityPct,
      relativeHumidityDerived,
      windSpeedMinMph: windMin,
      windSpeedMaxMph: windMax,
      windGustMph: gustMax,
      windDirection: p?.windDirection ?? null,
      precipitationProbabilityPct:
        typeof p?.probabilityOfPrecipitation?.value === 'number'
          ? p.probabilityOfPrecipitation.value
          : null,
      precipitationAmountIn: qpfByHourIso.get(new Date(validStart).toISOString()) ?? null,
      condition: p?.shortForecast ?? null,
    });
  }
  return out;
}

export function normalizeExtended(
  dailyPeriods: any[],
  timeZone: string,
  afterLocalDate: string
): ExtendedPeriod[] {
  const out: ExtendedPeriod[] = [];
  for (const p of dailyPeriods ?? []) {
    if (!p?.isDaytime || !p?.startTime) continue;
    const localDate = localDateOf(p.startTime, timeZone);
    if (localDate <= afterLocalDate) continue;
    out.push({
      localDate,
      temperatureF: typeof p?.temperature === 'number' ? p.temperature : null,
      condition: p?.shortForecast ?? null,
      precipitationProbabilityPct:
        typeof p?.probabilityOfPrecipitation?.value === 'number'
          ? p.probabilityOfPrecipitation.value
          : null,
      windText: p?.windSpeed ?? null,
      windDirection: p?.windDirection ?? null,
    });
  }
  return out;
}

// ── Public entry point ────────────────────────────────────────────────────────

export interface FetchOptions {
  /** Injected in tests; defaults to the module's fetch-based loader */
  load?: (url: string) => Promise<Record<string, any>>;
}

export async function fetchNormalizedForecast(
  lat: number,
  lon: number,
  options: FetchOptions = {}
): Promise<NormalizedForecast> {
  const load = options.load ?? getJson;

  let points: Record<string, any>;
  try {
    points = await load(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
  } catch {
    throw new Error(
      'The outlook uses the National Weather Service, which only covers US locations — and it may be briefly unavailable.'
    );
  }

  const props = points?.properties ?? {};
  if (!props.forecastHourly || !props.forecast) {
    throw new Error('The National Weather Service has no forecast grid for this location.');
  }
  const timeZone = typeof props.timeZone === 'string' && props.timeZone ? props.timeZone : 'UTC';
  const rel = props.relativeLocation?.properties;
  const locationName = rel?.city ? `${rel.city}, ${rel.state}` : null;

  // Alerts and QPF are best-effort: neither outage may take down the outlook,
  // but a failed alert query must be reported rather than read as "no alerts".
  const alertsPromise = load(
    `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`
  )
    .then((a) => ({ alerts: parseAlerts(a?.features ?? []), status: 'ok' as const }))
    .catch(() => ({ alerts: [] as WeatherAlert[], status: 'unavailable' as const }));

  const qpfPromise = props.forecastGridData
    ? load(props.forecastGridData)
        .then((g) => expandQpfToHourlyInches(g?.properties?.quantitativePrecipitation?.values ?? []))
        .catch(() => new Map<string, number>())
    : Promise.resolve(new Map<string, number>());

  const [hourly, daily, alertResult, qpf] = await Promise.all([
    load(props.forecastHourly),
    load(props.forecast),
    alertsPromise,
    qpfPromise,
  ]);

  const periods = normalizeHourly(hourly?.properties?.periods ?? [], timeZone, qpf);
  const lastHourlyDate = periods.length ? periods[periods.length - 1].localDate : '';

  return {
    provider: PROVIDER_NAME,
    locationName,
    locationTimeZone: timeZone,
    sourceUpdatedAt:
      hourly?.properties?.updated ?? hourly?.properties?.generatedAt ?? null,
    periods,
    extendedPeriods: normalizeExtended(
      daily?.properties?.periods ?? [],
      timeZone,
      lastHourlyDate
    ),
    alerts: alertResult.alerts,
    alertsStatus: alertResult.status,
    hasPrecipitationAmounts: qpf.size > 0,
  };
}

export { _heatIndexF };
