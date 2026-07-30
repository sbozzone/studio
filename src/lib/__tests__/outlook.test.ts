import { describe, expect, it } from 'vitest';
import {
  composeBrief,
  parseHourly,
  roundPop,
  sentenceCaseCondition,
  tensPhrase,
} from '@/lib/outlook';
import { calcFeelsLikeF } from '@/lib/dew-point';
import { plainfieldDailyPeriods, plainfieldHourlyPeriods } from './plainfield-fixture';

const brief = composeBrief(
  parseHourly(plainfieldHourlyPeriods()),
  plainfieldDailyPeriods(),
  'Plainfield, IN'
);
const dayText = (name: string) =>
  brief.days.find((d) => d.name.startsWith(name))?.text ?? `(missing day ${name})`;
const allText = [brief.headline, ...brief.days.map((d) => `${d.name} — ${d.text}`), brief.footnote].join('\n');

describe('helpers', () => {
  it('rounds probabilities to the nearest 10%', () => {
    expect(roundPop(47)).toBe(50);
    expect(roundPop(82)).toBe(80);
    expect(roundPop(31)).toBe(30);
  });
  it('sentence-cases NWS Title Case conditions', () => {
    expect(sentenceCaseCondition('Showers And Thunderstorms')).toBe('showers and thunderstorms');
    expect(sentenceCaseCondition('Chance Showers And Thunderstorms')).toBe('chance of showers and thunderstorms');
  });
  it('describes values in tens phrasing', () => {
    expect(tensPhrase(62)).toBe('low 60s');
    expect(tensPhrase(68)).toBe('upper 60s');
  });
});

describe('Plainfield regression brief', () => {
  it('headline never claims feels-like cannot exceed air temperature', () => {
    expect(brief.headline).not.toMatch(/never (runs|exceeds|tops|goes)/i);
    expect(brief.headline).not.toMatch(/not a heat-index week/i);
  });

  it('headline heat claim agrees with the daily heat-index lines (invariant)', () => {
    // Headline says "no major heat" — then no day may report a large humidity load
    if (/no major heat/i.test(brief.headline)) {
      expect(allText).not.toMatch(/significant .*humidity load|humidity tax/i);
      expect(allText).not.toMatch(/dangerous/i);
    }
  });

  it('does not call mid-60s..low-70s dew points comfortable', () => {
    for (const day of ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday']) {
      expect(dayText(day)).not.toMatch(/\bcomfortable\b/i);
    }
    expect(brief.headline).toMatch(/humid/i);
  });

  it('does not describe Saturday (75°F / dew 68°F) as near saturation', () => {
    expect(dayText('Saturday')).not.toMatch(/saturation|saturated/i);
    expect(dayText('Saturday')).toMatch(/damp|humid|muggy/i);
  });

  it('never guarantees wind keeps sweat evaporating', () => {
    expect(allText).not.toMatch(/sweat/i);
    expect(allText).not.toMatch(/no breeze to help/i);
    // Thursday's 3 mph and Friday's 6 mph get restrained wording
    expect(dayText('Thursday')).toMatch(/little wind relief|limited relief/i);
  });

  it("separates Friday's sunny daytime from its late rain", () => {
    const fri = dayText('Friday');
    expect(fri).toMatch(/for much of the day/i);
    expect(fri).toMatch(/late in the day|overnight/i);
    expect(fri).not.toMatch(/^.*likely.*for much of the day/i);
  });

  it('computes heat index from simultaneous hourly inputs', () => {
    // A day whose max temperature and max humidity occur at different hours
    // must NOT report HI(maxT, maxRH).
    const periods = [
      { startTime: '2026-07-30T08:00:00-04:00', temperature: 70, temperatureUnit: 'F', dewpoint: { value: 20 }, relativeHumidity: { value: 95 }, windSpeed: '5 mph', windDirection: 'N', probabilityOfPrecipitation: { value: 0 }, shortForecast: 'Sunny' },
      { startTime: '2026-07-30T15:00:00-04:00', temperature: 95, temperatureUnit: 'F', dewpoint: { value: 15 }, relativeHumidity: { value: 30 }, windSpeed: '5 mph', windDirection: 'N', probabilityOfPrecipitation: { value: 0 }, shortForecast: 'Sunny' },
    ];
    const hours = parseHourly(periods);
    const wrongCombined = calcFeelsLikeF(95, 95); // cross-hour pairing: absurd
    for (const h of hours) {
      expect(h.hiF).toBeLessThan(wrongCombined);
    }
    expect(Math.max(...hours.map((h) => h.hiF))).toBeLessThan(100);
  });

  it('omits heat index when not meteorologically meaningful (Saturday high 75)', () => {
    expect(dayText('Saturday')).not.toMatch(/heat index/i);
  });

  it('presents probabilities rounded to the nearest 10%', () => {
    const percents = [...allText.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
    expect(percents.length).toBeGreaterThan(0);
    for (const p of percents) expect(p % 10).toBe(0);
  });

  it('introduces no unsupported hazards', () => {
    expect(allText).not.toMatch(/flood/i);
    expect(brief.alerts).toEqual([]);
  });

  it('leads the concern with rain and thunderstorms developing late Friday into Saturday', () => {
    expect(brief.headline).toMatch(/showers and thunderstorms developing late Friday/i);
    expect(brief.headline).toMatch(/Friday night through Saturday/i);
  });

  it('flags Wednesday as inferred beyond the hourly grid', () => {
    const wed = brief.days.find((d) => d.name === 'Wednesday');
    expect(wed?.firm).toBe(false);
    expect(brief.footnote).toMatch(/Tuesday night/);
    expect(brief.footnote).toMatch(/Wednesday/);
  });

  it('softens language on later firm days', () => {
    expect(dayText('Tuesday')).toMatch(/currently forecast|can still shift/i);
  });

  it('carries official alerts through without altering the narrative', () => {
    const withAlert = composeBrief(
      parseHourly(plainfieldHourlyPeriods()),
      plainfieldDailyPeriods(),
      'Plainfield, IN',
      ['Flood Watch']
    );
    expect(withAlert.alerts).toEqual(['Flood Watch']);
    // The composer must not invent flood prose from the alert name
    expect(withAlert.days.map((d) => d.text).join(' ')).not.toMatch(/flood/i);
  });

  it('matches the full seven-day analysis snapshot', () => {
    expect(allText).toMatchSnapshot();
  });
});
