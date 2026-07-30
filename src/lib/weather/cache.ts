/**
 * Separate caches for raw weather data and generated narrative.
 *
 * Raw forecast data is cached independently of the narrative rules, so a
 * ruleset change never forces a refetch. Narrative entries are keyed by the
 * ruleset version *and* the provider's update timestamp, so a v2 request can
 * never be served a v1 narrative, and refreshed forecast values can never be
 * paired with previously generated prose.
 *
 * Entries live in memory for the page's lifetime only — nothing is persisted
 * to storage, so a new deployment starts from an empty cache.
 */

export const FORECAST_TTL_MS = 10 * 60 * 1000;
export const NARRATIVE_TTL_MS = 30 * 60 * 1000;

export const locationKeyOf = (lat: number, lon: number): string =>
  `${lat.toFixed(3)},${lon.toFixed(3)}`;

export const forecastCacheKey = (
  provider: string,
  locationKey: string,
  sourceUpdatedAt: string | null
): string => `forecast:${provider}:${locationKey}:${sourceUpdatedAt ?? 'unknown'}`;

export const narrativeCacheKey = (
  analysisVersion: string,
  locationKey: string,
  sourceUpdatedAt: string | null
): string => `narrative:${analysisVersion}:${locationKey}:${sourceUpdatedAt ?? 'unknown'}`;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string, now: number = Date.now()): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number, now: number = Date.now()): void {
  store.set(key, { value, expiresAt: now + ttlMs });
}

/** Most recent provider update timestamp seen for a location, for cache reuse. */
const pointerKey = (locationKey: string) => `forecast-pointer:${locationKey}`;

export const rememberSourceUpdatedAt = (
  locationKey: string,
  sourceUpdatedAt: string | null,
  now: number = Date.now()
): void => {
  cacheSet(pointerKey(locationKey), sourceUpdatedAt, FORECAST_TTL_MS, now);
};

export const recallSourceUpdatedAt = (
  locationKey: string,
  now: number = Date.now()
): string | null => cacheGet<string | null>(pointerKey(locationKey), now) ?? null;

/** Test hook — clears every cache namespace. */
export function resetCaches(): void {
  store.clear();
}

/** Test/debug hook — the raw key set, for asserting what was written. */
export const cacheKeys = (): string[] => [...store.keys()];
