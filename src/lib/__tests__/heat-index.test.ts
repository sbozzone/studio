import { describe, expect, it } from 'vitest';
import {
  apparentTemperatureF,
  heatIndexF,
  isHeatIndexMeaningful,
  relativeHumidityFromDewPointF,
} from '@/lib/weather/heat-index';

/**
 * Expected values are taken from the published NWS heat-index chart and the
 * WPC equation page, not produced by this implementation.
 * https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 */
describe('heatIndexF — NWS procedure', () => {
  it('matches published chart values in the Rothfusz regime', () => {
    expect(Math.round(heatIndexF(100, 40))).toBe(109);
    expect(Math.round(heatIndexF(90, 70))).toBe(106);
    expect(Math.round(heatIndexF(80, 40))).toBe(80);
    expect(Math.round(heatIndexF(96, 65))).toBe(121);
  });

  it('averages the simple form with the temperature below the 80°F threshold', () => {
    // T=75, RH=50 → simple = 0.5*(75+61+8.4+4.7) = 74.55; (74.55+75)/2 = 74.775
    expect(heatIndexF(75, 50)).toBeCloseTo(74.775, 3);
    // The preliminary average — not the bare simple value — is the result
    expect(heatIndexF(75, 50)).not.toBeCloseTo(74.55, 3);
  });

  it('switches to the regression exactly at a preliminary value of 80°F', () => {
    // Just below the threshold stays on the simple path (continuous, no jump)
    const below = heatIndexF(79, 40);
    expect(below).toBeLessThan(80);
    const above = heatIndexF(82, 50);
    expect(above).toBeGreaterThanOrEqual(80);
  });

  it('applies the low-humidity adjustment', () => {
    // T=95, RH=10: adjustment = ((13-10)/4) * sqrt((17-|95-95|)/17) = 0.75
    const raw =
      -42.379 + 2.04901523 * 95 + 10.14333127 * 10 - 0.22475541 * 95 * 10 -
      0.00683783 * 95 * 95 - 0.05481717 * 10 * 10 + 0.00122874 * 95 * 95 * 10 +
      0.00085282 * 95 * 10 * 10 - 0.00000199 * 95 * 95 * 10 * 10;
    expect(heatIndexF(95, 10)).toBeCloseTo(raw - 0.75, 6);
  });

  it('applies the high-humidity adjustment', () => {
    // T=85, RH=90: adjustment = ((90-85)/10) * ((87-85)/5) = 0.2
    const raw =
      -42.379 + 2.04901523 * 85 + 10.14333127 * 90 - 0.22475541 * 85 * 90 -
      0.00683783 * 85 * 85 - 0.05481717 * 90 * 90 + 0.00122874 * 85 * 85 * 90 +
      0.00085282 * 85 * 90 * 90 - 0.00000199 * 85 * 85 * 90 * 90;
    expect(heatIndexF(85, 90)).toBeCloseTo(raw + 0.2, 6);
  });

  it('does not impose an independent humidity eligibility rule', () => {
    // RH just under 40% must still produce a regression-based value when hot
    expect(Math.round(heatIndexF(100, 39))).toBeGreaterThan(100);
  });

  it('keeps full precision internally and rounds only at display', () => {
    const v = heatIndexF(83, 53);
    expect(v).toBeCloseTo(84.46, 1);
    expect(Number.isInteger(v)).toBe(false);
    expect(Math.round(v)).toBe(84);
  });

  it('handles extreme and unsupported inputs without producing fantasy values', () => {
    expect(heatIndexF(120, 66)).toBe(140); // capped at the top of the chart
    expect(heatIndexF(-20, 67)).toBeLessThan(0);
    expect(heatIndexF(90, 0)).toBeGreaterThan(80);
    expect(heatIndexF(90, 100)).toBeLessThanOrEqual(140);
  });

  it('flags meaningfulness at the documented 80°F floor', () => {
    expect(isHeatIndexMeaningful(79.9)).toBe(false);
    expect(isHeatIndexMeaningful(80)).toBe(true);
  });
});

describe('apparentTemperatureF', () => {
  it('reports the air temperature when the heat index is not meaningful', () => {
    expect(apparentTemperatureF(75, 50)).toBe(75);
    expect(apparentTemperatureF(-20, 67)).toBe(-20);
    expect(apparentTemperatureF(60, 90)).toBe(60);
  });
  it('reports the heat index once it is meaningful', () => {
    expect(Math.round(apparentTemperatureF(90, 70))).toBe(106);
  });
});

describe('relativeHumidityFromDewPointF', () => {
  it('derives RH from simultaneous temperature and dew point', () => {
    // 83°F / 64°F dew point ≈ 53% RH
    expect(Math.round(relativeHumidityFromDewPointF(83, 64))).toBe(53);
    // 75°F / 68°F ≈ 79%
    expect(Math.round(relativeHumidityFromDewPointF(75, 68))).toBe(79);
  });
  it('returns 100% when temperature equals dew point', () => {
    expect(relativeHumidityFromDewPointF(70, 70)).toBeCloseTo(100, 6);
  });
});
