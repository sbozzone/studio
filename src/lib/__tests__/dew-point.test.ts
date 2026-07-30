import { describe, expect, it } from 'vitest';
import {
  calcDewPointC,
  calcFeelsLikeF,
  cToF,
  dewPointDescriptor,
  getComfortLevel,
} from '@/lib/dew-point';

describe('calcDewPointC (Magnus)', () => {
  it('matches published reference values', () => {
    expect(calcDewPointC(25, 60)).toBeCloseTo(16.7, 1);
    expect(cToF(calcDewPointC((90 - 32) / 1.8, 70))).toBeCloseTo(78.9, 1);
    expect(calcDewPointC(30, 100)).toBeCloseTo(30, 1);
  });
});

describe('calcFeelsLikeF (NOAA/NWS heat index)', () => {
  it('matches the published NWS table within a degree', () => {
    expect(calcFeelsLikeF(90, 70)).toBeGreaterThanOrEqual(104);
    expect(calcFeelsLikeF(90, 70)).toBeLessThanOrEqual(106);
    expect(calcFeelsLikeF(100, 40)).toBeCloseTo(109, 0);
    expect(calcFeelsLikeF(80, 40)).toBeCloseTo(80, 0);
  });
  it('returns air temperature below the heat-index regime', () => {
    expect(calcFeelsLikeF(-20, 67)).toBe(-20);
    expect(calcFeelsLikeF(60, 90)).toBe(60);
  });
  it('caps output at the top of the NWS chart for impossible inputs', () => {
    expect(calcFeelsLikeF(120, 66)).toBe(140);
  });
});

describe('dewPointDescriptor', () => {
  it('uses the standard category boundaries', () => {
    expect(dewPointDescriptor(50)).toBe('dry and comfortable');
    expect(dewPointDescriptor(55)).toBe('dry and comfortable');
    expect(dewPointDescriptor(58)).toBe('generally comfortable');
    expect(dewPointDescriptor(63)).toBe('becoming sticky');
    expect(dewPointDescriptor(68)).toBe('muggy');
    expect(dewPointDescriptor(72)).toBe('oppressive');
    expect(dewPointDescriptor(76)).toBe('very oppressive');
  });
  it('never calls mid-60s through low-70s dew points comfortable', () => {
    for (let dp = 63; dp <= 74; dp++) {
      expect(dewPointDescriptor(dp)).not.toContain('comfortable');
    }
  });
  it('stays directionally consistent with the badge scale', () => {
    // Both vocabularies must agree that 72°F dew point air is oppressive
    expect(dewPointDescriptor(72)).toBe('oppressive');
    expect(getComfortLevel(72).label).toBe('Oppressive');
  });
});
