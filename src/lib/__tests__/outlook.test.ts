import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

import { composeOutlook, fetchOutlook } from '@/lib/outlook';
import { buildDailyFacts } from '@/lib/weather/daily-facts';
import { heatIndexF } from '@/lib/weather/heat-index';
import {
  NARRATIVE_RULESET_VERSION,
  composeNarrative,
  sentenceCaseCondition,
  validateNarrative,
} from '@/lib/weather/narrative';
import {
  cacheGet,
  cacheKeys,
  cacheSet,
  locationKeyOf,
  narrativeCacheKey,
  resetCaches,
} from '@/lib/weather/cache';
import { fetchNormalizedForecast, expandQpfToHourlyInches, localParts } from '@/lib/weather/nws';
import {
  PLAINFIELD_NOW,
  PLAINFIELD_SOURCE_UPDATED_AT,
  plainfieldLoader,
} from './plainfield-fixture';

const LAT = 39.704;
const LON = -86.399;

async function loadForecast(options = {}) {
  return fetchNormalizedForecast(LAT, LON, { load: plainfieldLoader(options) });
}

async function briefFor(options = {}) {
  const forecast = await loadForecast(options);
  return composeOutlook(forecast, { now: PLAINFIELD_NOW });
}

beforeEach(() => resetCaches());

describe('normalization', () => {
  it('records provider semantics and the location time zone', async () => {
    const f = await loadForecast();
    expect(f.provider).toContain('NWS');
    expect(f.locationTimeZone).toBe('America/Indiana/Indianapolis');
    expect(f.sourceUpdatedAt).toBe(PLAINFIELD_SOURCE_UPDATED_AT);
    expect(f.locationName).toBe('Plainfield, IN');
    expect(f.alertsStatus).toBe('ok');
  });

  it('groups days by the location calendar date, not the server date', async () => {
    const f = await loadForecast();
    const firstMidnight = f.periods[0];
    expect(firstMidnight.localDate).toBe('2026-07-30');
    expect(firstMidnight.localHour).toBe(0);
    // 04:00 UTC on this date is midnight local (EDT), i.e. still the 30th
    expect(localParts('2026-07-30T04:00:00Z', 'America/Indiana/Indianapolis').date).toBe(
      '2026-07-30'
    );
  });

  it('handles a daylight-saving transition without dropping or duplicating a day', () => {
    // 2026-11-01 is the US DST fallback; 06:00 UTC is 01:00 EST/EDT the same day
    const tz = 'America/Indiana/Indianapolis';
    expect(localParts('2026-11-01T05:00:00Z', tz).date).toBe('2026-11-01');
    expect(localParts('2026-11-01T07:00:00Z', tz).date).toBe('2026-11-01');
    expect(localParts('2026-11-02T04:59:00Z', tz).date).toBe('2026-11-01');
  });

  it('prefers provider RH and flags derivation when absent', async () => {
    const f = await loadForecast();
    expect(f.periods.every((p) => p.relativeHumidityDerived === false)).toBe(true);
  });

  it('expands multi-hour QPF across its valid interval rather than treating it as hourly', () => {
    const hourly = expandQpfToHourlyInches([
      { validTime: '2026-08-01T04:00:00+00:00/PT6H', value: 25.4 },
    ]);
    expect(hourly.size).toBe(6);
    for (const v of hourly.values()) expect(v).toBeCloseTo(1 / 6, 6);
  });

  it('omits values rather than inventing them when fields are missing', async () => {
    const load = async (url: string) => {
      if (url.includes('/points/')) return (await plainfieldLoader()(url)) as any;
      if (url.includes('/alerts/active')) return { features: [] };
      if (url.endsWith('/forecast/hourly')) {
        return {
          properties: {
            updated: PLAINFIELD_SOURCE_UPDATED_AT,
            periods: [
              {
                startTime: '2026-07-30T12:00:00-04:00',
                temperature: 80,
                temperatureUnit: 'F',
                dewpoint: { value: null },
                relativeHumidity: { value: null },
                windSpeed: null,
                windDirection: null,
                probabilityOfPrecipitation: { value: null },
                shortForecast: 'Sunny',
              },
            ],
          },
        };
      }
      if (url.endsWith('/forecast')) return { properties: { periods: [] } };
      return { properties: {} };
    };
    const f = await fetchNormalizedForecast(LAT, LON, { load });
    const p = f.periods[0];
    expect(p.dewPointF).toBeNull();
    expect(p.relativeHumidityPct).toBeNull();
    expect(p.windSpeedMaxMph).toBeNull();
    expect(p.precipitationProbabilityPct).toBeNull();
  });
});

describe('daily aggregation', () => {
  it('pairs heat index with the temperature from the same timestamp', async () => {
    const f = await loadForecast();
    const facts = buildDailyFacts(f, '2026-07-30');
    for (const day of facts) {
      if (day.maxHeatIndexF == null) continue;
      const hour = f.periods.find((p) => p.validStart === day.timestampOfMaxHeatIndex)!;
      expect(hour.temperatureF).toBe(day.temperatureAtMaxHeatIndexF);
      expect(day.maxHeatIndexF).toBeCloseTo(
        heatIndexF(hour.temperatureF!, hour.relativeHumidityPct!),
        6
      );
    }
  });

  it('never derives the heat-index delta from cross-hour maxima', async () => {
    const f = await loadForecast();
    const facts = buildDailyFacts(f, '2026-07-30');
    let differsFromNaive = 0;
    for (const day of facts) {
      if (day.maxHourlyHeatIndexDelta == null) continue;
      const hour = f.periods.find((p) => p.validStart === day.timestampOfMaxHeatIndexDelta)!;
      const sameHourDelta =
        heatIndexF(hour.temperatureF!, hour.relativeHumidityPct!) - hour.temperatureF!;
      expect(day.maxHourlyHeatIndexDelta).toBeCloseTo(sameHourDelta, 6);

      // The cross-hour shortcut (day's peak HI minus day's high temperature)
      // is a different quantity; we must not be computing it.
      const naive = (day.maxHeatIndexF ?? 0) - (day.highTemperatureF ?? 0);
      if (Math.abs(naive - day.maxHourlyHeatIndexDelta) > 0.05) differsFromNaive++;
    }
    expect(differsFromNaive).toBeGreaterThan(0);
  });

  it('produces the specified displayed heat index for each fixture day', async () => {
    const f = await loadForecast();
    const facts = buildDailyFacts(f, '2026-07-30');
    const displayed = facts.map((d) =>
      d.maxHeatIndexF != null && d.maxHeatIndexF >= 80 ? Math.round(d.maxHeatIndexF) : 'omit'
    );
    expect(displayed).toEqual([84, 88, 'omit', 82, 85, 89, 91]);
  });

  it('represents exactly seven ordered local calendar days', async () => {
    const f = await loadForecast();
    const facts = buildDailyFacts(f, '2026-07-30');
    expect(facts).toHaveLength(7);
    expect(facts.map((d) => d.localDate)).toEqual([
      '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02',
      '2026-08-03', '2026-08-04', '2026-08-05',
    ]);
    expect(facts[0].isToday).toBe(true);
    expect(facts.map((d) => d.dayName)).toEqual([
      'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    ]);
  });

  it("keeps a day's peak probability out of the following day's hours", async () => {
    const f = await loadForecast();
    const facts = buildDailyFacts(f, '2026-07-30');
    const friday = facts[1];
    expect(friday.peakPopPct).toBe(47); // not Saturday's 82
    expect(friday.popByPart.overnight).toBe(82); // timing signal still reaches tomorrow
  });
});

describe('Plainfield regression narrative', () => {
  let brief: Awaited<ReturnType<typeof briefFor>>;
  let allText = '';
  const dayText = (name: string) =>
    brief.days.find((d) => d.name.startsWith(name))?.text ?? `(missing ${name})`;

  beforeEach(async () => {
    brief = await briefFor();
    allText = [brief.headline, ...brief.days.map((d) => `${d.name} — ${d.text}`), brief.footnote]
      .join('\n');
  });

  it('passes every invariant without falling back', () => {
    expect(brief.meta.invariantViolations).toEqual([]);
  });

  it('does not claim the heat index never exceeds air temperature', () => {
    expect(brief.headline).not.toMatch(/never (?:exceed|runs above|tops)/i);
    expect(brief.headline).not.toMatch(/not a heat-index week/i);
  });

  it('does not describe the week as comfortable', () => {
    expect(brief.headline).not.toMatch(/\b(comfortable|pleasant)\b/i);
  });

  it('describes humidity as increasing', () => {
    expect(brief.headline).toMatch(/humidity builds/i);
    expect(brief.headline).toMatch(/mid 60s/i);
    expect(brief.headline).toMatch(/low 70s/i);
  });

  it("distinguishes Friday's rain timing from its mostly sunny daytime", () => {
    const fri = dayText('Friday');
    expect(fri).toMatch(/mostly sunny for much of the day/i);
    expect(fri).toMatch(/increasing late in the day and overnight/i);
    expect(fri).toMatch(/around 50%/);
  });

  it('calls Saturday muggy but never near saturation', () => {
    const sat = dayText('Saturday');
    expect(sat).toMatch(/muggy/i);
    expect(sat).not.toMatch(/saturation|saturated/i);
    expect(sat).not.toMatch(/heat index/i); // 75°F day — not meaningful
  });

  it('rounds displayed probabilities to the nearest 10%', () => {
    expect(dayText('Saturday')).toMatch(/around 80%/);
    expect(dayText('Sunday')).toMatch(/around 30%/);
    expect(dayText('Wednesday')).toMatch(/around 40%/);
    for (const m of allText.matchAll(/(\d+)%/g)) {
      expect(Number(m[1]) % 10).toBe(0);
    }
  });

  it('never guarantees evaporation or comfort from wind', () => {
    expect(allText).not.toMatch(/sweat/i);
    expect(allText).not.toMatch(/keep .* evaporating/i);
  });

  it('makes no unsupported coverage or hazard claim', () => {
    expect(allText).not.toMatch(/flood/i);
    expect(allText).not.toMatch(/widespread/i);
    expect(allText).not.toMatch(/heavy rain/i);
    expect(brief.alerts).toEqual([]);
  });

  it('leads with the supported storm threat over routine comfort commentary', () => {
    expect(brief.headline).toMatch(/showers and thunderstorms/i);
    expect(brief.headline).toMatch(/Saturday/);
  });

  it('describes Wednesday with less certainty than Thursday', () => {
    expect(dayText('Thursday')).toMatch(/^High 83\./);
    expect(dayText('Wednesday')).toMatch(/currently forecast/i);
    expect(dayText('Wednesday')).toMatch(/may still change/i);
  });

  it('uses sentence case for conditions', () => {
    expect(allText).not.toMatch(/Showers And Thunderstorms/);
    expect(allText).toMatch(/showers and thunderstorms/);
  });

  it('reports runtime metadata for the running build', () => {
    expect(brief.meta.analysisVersion).toBe('2.1.0');
    expect(brief.meta.sourceProvider).toContain('NWS');
    expect(brief.meta.sourceUpdatedAt).toBe(PLAINFIELD_SOURCE_UPDATED_AT);
    expect(brief.meta.locationTimeZone).toBe('America/Indiana/Indianapolis');
    expect(brief.meta.generatedAt).toBe(PLAINFIELD_NOW.toISOString());
  });

  it('matches the full seven-day snapshot', () => {
    expect(allText).toMatchSnapshot();
  });
});

describe('alerts', () => {
  it('leads the headline with an official alert when one is active', async () => {
    const brief = await briefFor({
      alertFeatures: [
        { properties: { event: 'Flood Watch', severity: 'Severe', onset: '2026-07-31T18:00:00Z' } },
      ],
    });
    expect(brief.alerts).toEqual(['Flood Watch']);
    expect(brief.headline.startsWith('Flood Watch in effect')).toBe(true);
  });

  it('ranks alerts by severity', async () => {
    const brief = await briefFor({
      alertFeatures: [
        { properties: { event: 'Heat Advisory', severity: 'Minor' } },
        { properties: { event: 'Tornado Watch', severity: 'Extreme' } },
      ],
    });
    expect(brief.alerts[0]).toBe('Tornado Watch');
  });

  it('never claims no alerts exist when the alert query failed', async () => {
    const forecast = await loadForecast({ alertsFail: true });
    expect(forecast.alertsStatus).toBe('unavailable');
    const brief = composeOutlook(forecast, { now: PLAINFIELD_NOW });
    expect(brief.footnote).toMatch(/could not be checked/i);
    expect(brief.headline).not.toMatch(/no alerts|no active alerts/i);
  });
});

describe('invariant enforcement', () => {
  it('falls back deterministically when a narrative violates an invariant', async () => {
    const forecast = await loadForecast();
    const facts = buildDailyFacts(forecast, '2026-07-30');
    const bad = {
      headline: 'A comfortable week — the feels-like never exceeds the air temperature.',
      days: facts.map((d) => ({ name: d.dayName, isToday: false, firm: true, text: 'Air near saturation.' })),
      footnote: '',
    };
    const violations = validateNarrative(bad, facts, forecast, '2.0.0', '2.0.0');
    expect(violations.some((v) => /never exceeds/i.test(v))).toBe(true);
    expect(violations.some((v) => /comfortable/i.test(v))).toBe(true);
    expect(violations.some((v) => /near-saturation/i.test(v))).toBe(true);
  });

  it('rejects a narrative whose version disagrees with its cache key', async () => {
    const forecast = await loadForecast();
    const facts = buildDailyFacts(forecast, '2026-07-30');
    const narrative = composeNarrative(facts, forecast, '1.0.0');
    expect(narrative.invariantViolations.some((v) => /cache key version/i.test(v))).toBe(true);
    expect(narrative.headline).toMatch(/detailed outlook is unavailable/i);
  });

  it('rejects untraceable numbers', async () => {
    const forecast = await loadForecast();
    const facts = buildDailyFacts(forecast, '2026-07-30');
    const bad = {
      headline: 'Heat index reaches 137 on Friday.',
      days: [],
      footnote: '',
    };
    expect(validateNarrative(bad, facts, forecast, '2.0.0', '2.0.0')).toContain(
      'untraceable number in narrative: 137'
    );
  });
});

describe('caching', () => {
  it('never serves a v1 narrative to a v2 request', async () => {
    const locationKey = locationKeyOf(LAT, LON);
    const legacyKey = narrativeCacheKey('1.0.0', locationKey, PLAINFIELD_SOURCE_UPDATED_AT);
    cacheSet(legacyKey, {
      headline: 'This is not a heat-index week — the comfortable end of summer.',
      days: [],
      footnote: '',
      analysisVersion: '1.0.0',
      alerts: [],
      locationName: null,
      meta: {},
    } as any, 60_000, PLAINFIELD_NOW.getTime());

    const brief = await fetchOutlook(LAT, LON, {
      now: PLAINFIELD_NOW,
      load: plainfieldLoader(),
    });
    expect(brief.analysisVersion).toBe(NARRATIVE_RULESET_VERSION);
    expect(brief.headline).not.toMatch(/not a heat-index week/i);
    expect(brief.meta.narrativeCacheKey).toContain(`narrative:${NARRATIVE_RULESET_VERSION}:`);
    // The stale entry is still present but unreachable by a v2 request
    expect(cacheGet(legacyKey, PLAINFIELD_NOW.getTime())).not.toBeNull();
  });

  it('generates a new narrative key when the source timestamp changes', async () => {
    const first = await fetchOutlook(LAT, LON, { now: PLAINFIELD_NOW, load: plainfieldLoader() });
    resetCaches();
    const second = await fetchOutlook(LAT, LON, {
      now: PLAINFIELD_NOW,
      load: plainfieldLoader({ sourceUpdatedAt: '2026-07-30T20:35:00+00:00' }),
    });
    expect(second.meta.narrativeCacheKey).not.toBe(first.meta.narrativeCacheKey);
    expect(second.meta.sourceUpdatedAt).toBe('2026-07-30T20:35:00+00:00');
  });

  it('caches raw forecast data separately from the narrative', async () => {
    await fetchOutlook(LAT, LON, { now: PLAINFIELD_NOW, load: plainfieldLoader() });
    const keys = cacheKeys();
    expect(keys.some((k) => k.startsWith('forecast:nws:'))).toBe(true);
    expect(keys.some((k) => k.startsWith(`narrative:${NARRATIVE_RULESET_VERSION}:`))).toBe(true);
  });

  it('reuses the cached brief for a repeat request within its TTL', async () => {
    let calls = 0;
    const counting = (options = {}) => {
      const base = plainfieldLoader(options);
      return async (url: string) => {
        calls++;
        return base(url);
      };
    };
    await fetchOutlook(LAT, LON, { now: PLAINFIELD_NOW, load: counting() });
    const firstCalls = calls;
    await fetchOutlook(LAT, LON, { now: PLAINFIELD_NOW, load: counting() });
    expect(calls).toBe(firstCalls); // served from cache, no refetch
  });
});

describe('legacy prose can never return', () => {
  const composerSource = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../weather/narrative.ts'),
    'utf8'
  );
  const outlookSource = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../outlook.ts'),
    'utf8'
  );

  const LEGACY = [
    /this is not a heat-index week/i,
    /comfortable end of summer/i,
    /enough breeze to keep sweat evaporating/i,
    /you won'?t dry off/i,
    /no real humidity penalty/i,
  ];

  it('is absent from the generator sources except as an explicit ban', () => {
    for (const phrase of LEGACY) {
      // The narrative module lists them only inside its LEGACY_PHRASES guard
      const occurrences = (composerSource.match(new RegExp(phrase.source, 'gi')) ?? []).length;
      const inGuard = composerSource
        .slice(composerSource.indexOf('const LEGACY_PHRASES'), composerSource.indexOf('/** Numbers a narrative'))
        .match(new RegExp(phrase.source, 'gi'))?.length ?? 0;
      expect(occurrences).toBe(inGuard);
      expect(outlookSource).not.toMatch(phrase);
    }
  });

  it('is absent from generated output', async () => {
    const brief = await briefFor();
    const text = [brief.headline, ...brief.days.map((d) => d.text), brief.footnote].join('\n');
    for (const phrase of LEGACY) expect(text).not.toMatch(phrase);
  });

  it('would be caught by validation if it ever reappeared', async () => {
    const forecast = await loadForecast();
    const facts = buildDailyFacts(forecast, '2026-07-30');
    const bad = {
      headline: 'This is not a heat-index week.',
      days: [],
      footnote: '',
    };
    expect(validateNarrative(bad, facts, forecast, '2.0.0', '2.0.0').length).toBeGreaterThan(0);
  });
});

describe('helpers', () => {
  it('sentence-cases NWS Title Case conditions', () => {
    expect(sentenceCaseCondition('Showers And Thunderstorms')).toBe('showers and thunderstorms');
    expect(sentenceCaseCondition('Chance Showers')).toBe('chance of showers');
    expect(sentenceCaseCondition('Slight Chance Rain Showers')).toBe('slight chance of rain showers');
  });
});

/** Builds a normalized forecast directly, for surgical narrative cases. */
function syntheticForecast(
  daySpecs: {
    date: string;
    hours: { h: number; tempF: number; dewF: number; pop?: number; condition?: string }[];
  }[],
  overrides: Partial<import('@/lib/weather/types').NormalizedForecast> = {}
): import('@/lib/weather/types').NormalizedForecast {
  const g = (c: number) => (17.625 * c) / (243.04 + c);
  const toC = (f: number) => ((f - 32) * 5) / 9;
  const rh = (t: number, d: number) =>
    Math.min(100, Math.round(100 * Math.exp(g(toC(d)) - g(toC(t)))));
  return {
    provider: 'NWS api.weather.gov',
    locationName: 'Test, IN',
    locationTimeZone: 'America/Indiana/Indianapolis',
    sourceUpdatedAt: '2026-07-30T12:00:00+00:00',
    periods: daySpecs.flatMap((day) =>
      day.hours.map(({ h, tempF, dewF, pop = 0, condition = 'Sunny' }) => ({
        validStart: `${day.date}T${String(h).padStart(2, '0')}:00:00-04:00`,
        validEnd: `${day.date}T${String(h + 1).padStart(2, '0')}:00:00-04:00`,
        localDate: day.date,
        localHour: h,
        temperatureF: tempF,
        dewPointF: dewF,
        relativeHumidityPct: rh(tempF, dewF),
        relativeHumidityDerived: false,
        windSpeedMinMph: 5,
        windSpeedMaxMph: 7,
        windGustMph: null,
        windDirection: 'SW',
        precipitationProbabilityPct: pop,
        precipitationAmountIn: null,
        condition,
      }))
    ),
    extendedPeriods: [],
    alerts: [],
    alertsStatus: 'ok',
    hasPrecipitationAmounts: false,
    ...overrides,
  };
}

const fullDay = (
  date: string,
  make: (h: number) => { tempF: number; dewF: number; pop?: number; condition?: string }
) => ({ date, hours: Array.from({ length: 24 }, (_, h) => ({ h, ...make(h) })) });

describe('saturation is judged on the daypart being described', () => {
  it('a saturated dawn does not brand a sunny 82°F afternoon (production regression)', () => {
    // Morning hours sit at the dew point (RH ~100%); afternoon is 82/68
    const forecast = syntheticForecast([
      fullDay('2026-08-02', (h) => ({
        tempF: h < 10 ? 69 : 82,
        dewF: 68,
        pop: 20,
        condition: 'Mostly Sunny',
      })),
    ]);
    const brief = composeOutlook(forecast, { now: new Date('2026-08-02T12:00:00-04:00') });
    expect(brief.days[0].text).not.toMatch(/saturation|saturated|raw/i);
    expect(brief.days[0].text).toMatch(/muggy/i);
    expect(brief.meta.invariantViolations).toEqual([]);
  });

  it('persistent afternoon saturation with rain qualifies — and warm air is never "raw"', () => {
    const forecast = syntheticForecast([
      fullDay('2026-08-02', () => ({
        tempF: 78,
        dewF: 76.5,
        pop: 70,
        condition: 'Rain Showers',
      })),
    ]);
    const brief = composeOutlook(forecast, { now: new Date('2026-08-02T12:00:00-04:00') });
    expect(brief.days[0].text).toMatch(/near saturation/i);
    expect(brief.days[0].text).not.toMatch(/\braw\b/i);
    expect(brief.days[0].text).toMatch(/heavy/i);
    expect(brief.meta.invariantViolations).toEqual([]);
  });

  it('cool saturated air may read raw', () => {
    const forecast = syntheticForecast([
      fullDay('2026-08-02', () => ({ tempF: 62, dewF: 61, pop: 60, condition: 'Drizzle' })),
    ]);
    const brief = composeOutlook(forecast, { now: new Date('2026-08-02T12:00:00-04:00') });
    expect(brief.days[0].text).toMatch(/raw/i);
    expect(brief.meta.invariantViolations).toEqual([]);
  });

  it('the validator rejects a saturation claim the daypart evidence does not support', async () => {
    const forecast = syntheticForecast([
      fullDay('2026-08-02', (h) => ({ tempF: h < 10 ? 69 : 82, dewF: 68, pop: 20 })),
    ]);
    const facts = buildDailyFacts(forecast, '2026-08-02');
    const bad = {
      headline: '',
      days: [{ name: 'Sunday', isToday: false, firm: true, text: 'Air stays near saturation — damp and heavy.' }],
      footnote: '',
    };
    const violations = validateNarrative(bad, facts, forecast, '2.0.0', '2.0.0');
    expect(violations.some((v) => /near-saturation claim unsupported/i.test(v))).toBe(true);
  });
});

describe('probability qualifiers cannot collide with numeric chances', () => {
  it('"Slight Chance Rain Showers" at 37% renders as a chance with ~40%', () => {
    const forecast = syntheticForecast([
      fullDay('2026-08-05', () => ({
        tempF: 85,
        dewF: 72,
        pop: 37,
        condition: 'Slight Chance Rain Showers',
      })),
    ]);
    const brief = composeOutlook(forecast, { now: new Date('2026-08-05T12:00:00-04:00') });
    const text = brief.days[0].text;
    expect(text).toMatch(/A chance of rain showers, peak chance around 40%/);
    expect(text).not.toMatch(/slight/i);
    expect(text).not.toMatch(/Slight Chance|Rain Showers/); // no Title Case survivors
  });

  it('a likely condition at high probability keeps its strength without duplication', () => {
    const forecast = syntheticForecast([
      fullDay('2026-08-01', () => ({
        tempF: 74,
        dewF: 68,
        pop: 82,
        condition: 'Showers And Thunderstorms Likely',
      })),
    ]);
    const brief = composeOutlook(forecast, { now: new Date('2026-08-01T12:00:00-04:00') });
    expect(brief.days[0].text).toMatch(/Showers and thunderstorms likely, peak rain chance around 80%/);
    expect(brief.days[0].text).not.toMatch(/likely likely/i);
  });
});

describe('comfort sentences do not repeat on consecutive days', () => {
  it('drops a verbatim repeat and validation would catch one that slipped through', () => {
    const humidStormDay = (date: string) =>
      fullDay(date, () => ({ tempF: 76, dewF: 68, pop: 75, condition: 'Showers And Thunderstorms' }));
    const forecast = syntheticForecast([
      humidStormDay('2026-08-01'),
      humidStormDay('2026-08-02'),
    ]);
    const brief = composeOutlook(forecast, { now: new Date('2026-08-01T12:00:00-04:00') });
    const comfort = 'Not hot, but humid enough to feel heavy between showers.';
    expect(brief.days[0].text).toContain(comfort);
    expect(brief.days[1].text).not.toContain(comfort);
    expect(brief.meta.invariantViolations).toEqual([]);

    const facts = buildDailyFacts(forecast, '2026-08-01');
    const bad = {
      headline: '',
      days: facts.map((d) => ({
        name: d.dayName, isToday: d.isToday, firm: true,
        text: 'Not hot, but humid enough to feel heavy between showers.',
      })),
      footnote: '',
    };
    expect(
      validateNarrative(bad, facts, forecast, '2.0.0', '2.0.0').some((v) =>
        /repeated on consecutive days/i.test(v)
      )
    ).toBe(true);
  });
});
