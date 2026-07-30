import { describe, expect, it } from 'vitest';
import { COMFORT_LEVELS, calcDewPointC, cToF, dewPointDescriptor, getComfortLevel } from '@/lib/dew-point';
import { windCategoryOf } from '@/lib/weather/daily-facts';
import { roundPop } from '@/lib/weather/narrative';
import { parseWindRangeMph } from '@/lib/weather/nws';

describe('calcDewPointC (Magnus)', () => {
  it('matches published reference values', () => {
    expect(calcDewPointC(25, 60)).toBeCloseTo(16.7, 1);
    expect(cToF(calcDewPointC((90 - 32) / 1.8, 70))).toBeCloseTo(78.9, 1);
    expect(calcDewPointC(30, 100)).toBeCloseTo(30, 1);
  });
});

describe('dew-point legend boundaries', () => {
  const cases: [number, string][] = [
    [49, 'Dry'],
    [49.9, 'Dry'],
    [50, 'Pleasant'],
    [55, 'Pleasant'],
    [55.9, 'Pleasant'],
    [56, 'Comfortable'],
    [60, 'Comfortable'],
    [60.9, 'Comfortable'],
    [61, 'Sticky'],
    [65, 'Sticky'],
    [65.9, 'Sticky'],
    [66, 'Muggy'],
    [69, 'Muggy'],
    [69.9, 'Muggy'],
    [70, 'Oppressive'],
    [74, 'Oppressive'],
    [74.9, 'Oppressive'],
    [75, 'Miserable'],
    [80, 'Miserable'],
  ];
  it.each(cases)('%s°F → %s', (dp, label) => {
    expect(getComfortLevel(dp).label).toBe(label);
  });

  it('is continuous and non-overlapping', () => {
    const levels = [...COMFORT_LEVELS].sort((a, b) => a.minF - b.minF);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].minF).toBe(levels[i - 1].maxF);
    }
  });

  it('never calls a dew point of 61°F or higher comfortable or pleasant', () => {
    for (let dp = 61; dp <= 85; dp++) {
      const text = dewPointDescriptor(dp);
      expect(text).not.toMatch(/comfortable|pleasant/);
    }
  });

  it('shares one vocabulary between prose and the on-screen legend', () => {
    for (const dp of [45, 52, 58, 63, 68, 72, 78]) {
      expect(dewPointDescriptor(dp)).toBe(getComfortLevel(dp).label.toLowerCase());
    }
  });
});

describe('wind category boundaries', () => {
  it.each([
    [0, 'calm'],
    [3, 'calm'],
    [3.1, 'light'],
    [7, 'light'],
    [7.1, 'noticeable'],
    [12, 'noticeable'],
    [12.1, 'breezy'],
    [25, 'breezy'],
  ])('%s mph → %s', (mph, category) => {
    expect(windCategoryOf(mph as number)).toBe(category);
  });
});

describe('precipitation probability rounding', () => {
  it.each([
    [47, 50],
    [82, 80],
    [31, 30],
    [37, 40],
    [0, 0],
    [4, 0],
    [5, 10],
    [95, 100],
  ])('%s%% displays as %s%%', (raw, displayed) => {
    expect(roundPop(raw as number)).toBe(displayed);
  });
});

describe('wind string parsing', () => {
  it('handles ranges, single values and missing data', () => {
    expect(parseWindRangeMph('5 to 10 mph')).toEqual([5, 10]);
    expect(parseWindRangeMph('7 mph')).toEqual([7, 7]);
    expect(parseWindRangeMph(null)).toEqual([null, null]);
    expect(parseWindRangeMph('')).toEqual([null, null]);
  });
});
