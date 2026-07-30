/**
 * Hourly → daily aggregation.
 *
 * Every derived metric keeps its timestamps straight: the heat-index delta is
 * the maximum of (HI_h − T_h) over individual hours, never the day's peak heat
 * index minus the day's high temperature, which can come from different hours.
 */

import { getComfortLevel } from '@/lib/dew-point';
import { heatIndexF } from '@/lib/weather/heat-index';
import { localParts } from '@/lib/weather/nws';
import type {
  DailyFacts,
  DayPart,
  ExtendedPeriod,
  NormalizedForecast,
  NormalizedPeriod,
  WindCategory,
} from '@/lib/weather/types';

/** Hours people are plausibly outside — used for comfort aggregates. */
const DAYTIME_START = 8;
const DAYTIME_END = 20;

const DAY_PARTS: Record<DayPart, [number, number]> = {
  morning: [6, 11],
  afternoon: [12, 15],
  lateAfternoon: [16, 17],
  evening: [18, 21],
  overnight: [22, 23], // plus 00–05 of the following local date
};

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const maxOrNull = (xs: number[]): number | null => (xs.length ? Math.max(...xs) : null);
const minOrNull = (xs: number[]): number | null => (xs.length ? Math.min(...xs) : null);

const mode = (xs: string[]): string | null => {
  if (xs.length === 0) return null;
  const counts = new Map<string, number>();
  let best = xs[0];
  for (const v of xs) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > (counts.get(best) ?? 0)) best = v;
  }
  return best;
};

export function windCategoryOf(speedMph: number): WindCategory {
  if (speedMph <= 3) return 'calm';
  if (speedMph <= 7) return 'light';
  if (speedMph <= 12) return 'noticeable';
  return 'breezy';
}

/** Representative sustained wind for an hour: the midpoint of its stated range. */
const hourWindMph = (p: NormalizedPeriod): number | null =>
  p.windSpeedMinMph != null && p.windSpeedMaxMph != null
    ? (p.windSpeedMinMph + p.windSpeedMaxMph) / 2
    : (p.windSpeedMaxMph ?? p.windSpeedMinMph);

const hasThunderText = (s: string | null | undefined): boolean => /thunder/i.test(s ?? '');

export function buildDailyFacts(
  forecast: NormalizedForecast,
  todayLocalDate: string
): DailyFacts[] {
  const byDate = new Map<string, NormalizedPeriod[]>();
  for (const p of forecast.periods) {
    if (!byDate.has(p.localDate)) byDate.set(p.localDate, []);
    byDate.get(p.localDate)!.push(p);
  }
  const dates = [...byDate.keys()].sort();
  const facts: DailyFacts[] = [];

  dates.forEach((date, di) => {
    const all = byDate.get(date)!;
    // A trailing sliver of a day (the hourly grid ending at 03:00) can't
    // support a daily statement.
    if (all.length < 6 && date !== todayLocalDate) return;

    const daytime = all.filter((p) => p.localHour >= DAYTIME_START && p.localHour <= DAYTIME_END);
    const comfortHours = daytime.length >= 4 ? daytime : all;

    // Heat index, paired hour by hour
    let maxHeatIndexF: number | null = null;
    let temperatureAtMaxHeatIndexF: number | null = null;
    let timestampOfMaxHeatIndex: string | null = null;
    let maxHourlyHeatIndexDelta: number | null = null;
    let timestampOfMaxHeatIndexDelta: string | null = null;
    for (const p of all) {
      if (p.temperatureF == null || p.relativeHumidityPct == null) continue;
      const hi = heatIndexF(p.temperatureF, p.relativeHumidityPct);
      if (maxHeatIndexF == null || hi > maxHeatIndexF) {
        maxHeatIndexF = hi;
        temperatureAtMaxHeatIndexF = p.temperatureF;
        timestampOfMaxHeatIndex = p.validStart;
      }
      const delta = hi - p.temperatureF;
      if (maxHourlyHeatIndexDelta == null || delta > maxHourlyHeatIndexDelta) {
        maxHourlyHeatIndexDelta = delta;
        timestampOfMaxHeatIndexDelta = p.validStart;
      }
    }

    const dewValues = comfortHours
      .map((p) => p.dewPointF)
      .filter((v): v is number => v != null);
    const dewMax = maxOrNull(dewValues);
    const dewMin = minOrNull(dewValues);
    const dewMedian = median(dewValues);

    // Saturation evidence comes from the midday/afternoon window only — the
    // hours a day-level comfort claim actually describes. Early-morning air
    // sitting at its dew point is normal and says nothing about the afternoon.
    const middayWindow = comfortHours.filter((p) => p.localHour >= 11 && p.localHour <= 18);
    const saturationHours = middayWindow.length >= 3 ? middayWindow : comfortHours;
    const spreads = saturationHours
      .filter((p) => p.temperatureF != null && p.dewPointF != null)
      .map((p) => p.temperatureF! - p.dewPointF!);
    const rhValues = saturationHours
      .map((p) => p.relativeHumidityPct)
      .filter((v): v is number => v != null);
    const saturatedHoursCount = saturationHours.filter((p) => {
      const spread =
        p.temperatureF != null && p.dewPointF != null ? p.temperatureF - p.dewPointF : null;
      return (spread != null && spread <= 3) || (p.relativeHumidityPct ?? 0) >= 90;
    }).length;

    const windHours = comfortHours
      .map(hourWindMph)
      .filter((v): v is number => v != null);
    const windMin = minOrNull(
      comfortHours.map((p) => p.windSpeedMinMph).filter((v): v is number => v != null)
    );
    const windMax = maxOrNull(
      comfortHours.map((p) => p.windSpeedMaxMph).filter((v): v is number => v != null)
    );
    const windMedian = median(windHours);

    // Precipitation probability by part of day, in local time
    const popByPart = {} as Record<DayPart, number | null>;
    const conditionByPart: Partial<Record<DayPart, string>> = {};
    (Object.keys(DAY_PARTS) as DayPart[]).forEach((part) => {
      const [lo, hi] = DAY_PARTS[part];
      let hours = all.filter((p) => p.localHour >= lo && p.localHour <= hi);
      if (part === 'overnight') {
        const next = byDate.get(dates[di + 1]) ?? [];
        hours = [...hours, ...next.filter((p) => p.localHour <= 5)];
      }
      popByPart[part] = maxOrNull(
        hours.map((p) => p.precipitationProbabilityPct).filter((v): v is number => v != null)
      );
      const cond = mode(hours.map((p) => p.condition).filter((v): v is string => !!v));
      if (cond) conditionByPart[part] = cond;
    });

    // The day's peak chance comes from the day's own hours. `popByPart.overnight`
    // deliberately reaches into tomorrow's early hours for timing, but that
    // must not inflate this day's headline probability.
    const peakPopPct = maxOrNull(
      all.map((p) => p.precipitationProbabilityPct).filter((v): v is number => v != null)
    );
    let peakPopPart: DayPart | null = null;
    if (peakPopPct != null) {
      for (const part of Object.keys(popByPart) as DayPart[]) {
        if (popByPart[part] === peakPopPct) {
          peakPopPart = part;
          break;
        }
      }
    }

    const amounts = all
      .map((p) => p.precipitationAmountIn)
      .filter((v): v is number => v != null);

    facts.push({
      localDate: date,
      dayName: localParts(all[0].validStart, forecast.locationTimeZone).weekday,
      index: 0, // assigned below
      isToday: date === todayLocalDate,
      confidence: 'firm',
      highTemperatureF: maxOrNull(
        all.map((p) => p.temperatureF).filter((v): v is number => v != null)
      ),
      maxHeatIndexF,
      temperatureAtMaxHeatIndexF,
      timestampOfMaxHeatIndex,
      maxHourlyHeatIndexDelta,
      timestampOfMaxHeatIndexDelta,
      dewPointMinF: dewMin,
      dewPointMaxF: dewMax,
      dewPointMedianF: dewMedian,
      dewPointRangeF: dewMax != null && dewMin != null ? dewMax - dewMin : null,
      dewPointCategory: dewMedian != null ? getComfortLevel(dewMedian).label : null,
      minSpreadF: minOrNull(spreads),
      maxDaytimeRhPct: maxOrNull(rhValues),
      saturatedHoursCount,
      windMedianMph: windMedian,
      windMinMph: windMin,
      windMaxMph: windMax,
      windGustMaxMph: maxOrNull(
        comfortHours.map((p) => p.windGustMph).filter((v): v is number => v != null)
      ),
      windDirection: mode(
        comfortHours.map((p) => p.windDirection).filter((v): v is string => !!v)
      ),
      windCategory: windMedian != null ? windCategoryOf(windMedian) : null,
      windCrossesCategories:
        windMin != null && windMax != null
          ? windCategoryOf(windMin) !== windCategoryOf(windMax)
          : false,
      popByPart,
      peakPopPct,
      peakPopPart,
      conditionByPart,
      condition: mode(comfortHours.map((p) => p.condition).filter((v): v is string => !!v)),
      hasThunder: all.some((p) => hasThunderText(p.condition)),
      precipitationAmountIn: amounts.length ? amounts.reduce((a, b) => a + b, 0) : null,
    });
  });

  // Days covered only by the 12-hour period forecast
  for (const ext of forecast.extendedPeriods) {
    facts.push(extendedToFacts(ext, forecast.locationTimeZone));
  }

  const ordered = facts.sort((a, b) => a.localDate.localeCompare(b.localDate)).slice(0, 7);
  ordered.forEach((f, i) => {
    f.index = i;
  });
  return ordered;
}

function extendedToFacts(ext: ExtendedPeriod, timeZone: string): DailyFacts {
  const [windMin, windMax] = (() => {
    const nums = String(ext.windText ?? '').match(/\d+/g)?.map(Number) ?? [];
    return nums.length ? [Math.min(...nums), Math.max(...nums)] : [null, null];
  })();
  const windMedian = windMin != null && windMax != null ? (windMin + windMax) / 2 : null;
  return {
    localDate: ext.localDate,
    dayName: localParts(`${ext.localDate}T12:00:00Z`, 'UTC').weekday,
    index: 0,
    isToday: false,
    confidence: 'extended',
    highTemperatureF: ext.temperatureF,
    maxHeatIndexF: null,
    temperatureAtMaxHeatIndexF: null,
    timestampOfMaxHeatIndex: null,
    maxHourlyHeatIndexDelta: null,
    timestampOfMaxHeatIndexDelta: null,
    dewPointMinF: null,
    dewPointMaxF: null,
    dewPointMedianF: null,
    dewPointRangeF: null,
    dewPointCategory: null,
    minSpreadF: null,
    maxDaytimeRhPct: null,
    saturatedHoursCount: null,
    windMedianMph: windMedian,
    windMinMph: windMin,
    windMaxMph: windMax,
    windGustMaxMph: null,
    windDirection: ext.windDirection,
    windCategory: windMedian != null ? windCategoryOf(windMedian) : null,
    windCrossesCategories:
      windMin != null && windMax != null ? windCategoryOf(windMin) !== windCategoryOf(windMax) : false,
    popByPart: {
      morning: null,
      afternoon: null,
      lateAfternoon: null,
      evening: null,
      overnight: null,
    },
    peakPopPct: ext.precipitationProbabilityPct,
    peakPopPart: null,
    conditionByPart: {},
    condition: ext.condition,
    hasThunder: hasThunderText(ext.condition),
    precipitationAmountIn: null,
  };
}
