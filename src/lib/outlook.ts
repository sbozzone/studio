/**
 * Outlook orchestrator: the one path from weather data to displayed prose.
 *
 *   NWS response → normalization → deterministic calculations → daily facts
 *   → weekly-priority selection → approved templates → invariant validation
 *   → cache → rendered outlook
 *
 * No model participates in any calculation or decision. Everything a reader
 * sees is derived from the normalized facts object in this process.
 */

import { buildDailyFacts } from '@/lib/weather/daily-facts';
import {
  FORECAST_TTL_MS,
  NARRATIVE_TTL_MS,
  cacheGet,
  cacheSet,
  forecastCacheKey,
  locationKeyOf,
  narrativeCacheKey,
  recallSourceUpdatedAt,
  rememberSourceUpdatedAt,
} from '@/lib/weather/cache';
import {
  NARRATIVE_RULESET_VERSION,
  composeNarrative,
  roundPop,
  sentenceCaseCondition,
  tensPhrase,
} from '@/lib/weather/narrative';
import { fetchNormalizedForecast, localParts } from '@/lib/weather/nws';
import type { DailyFacts, DewPointCategory, NormalizedForecast } from '@/lib/weather/types';

export { NARRATIVE_RULESET_VERSION, roundPop, sentenceCaseCondition, tensPhrase };

/** Build metadata, resolved at build time on Vercel. */
const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT || null;
const DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID || null;

export interface OutlookMeta {
  analysisVersion: string;
  buildCommit: string | null;
  deploymentId: string | null;
  sourceProvider: string;
  sourceUpdatedAt: string | null;
  generatedAt: string;
  locationTimeZone: string;
  narrativeCacheKey: string;
  /** Non-empty only if the narrative failed validation and fell back */
  invariantViolations: string[];
}

export interface OutlookBrief {
  locationName: string | null;
  analysisVersion: string;
  /** Active alert event names, most severe first (may be empty) */
  alerts: string[];
  headline: string;
  days: {
    name: string;
    isToday: boolean;
    firm: boolean;
    text: string;
    dewPointCategory: DewPointCategory | null;
  }[];
  footnote: string;
  meta: OutlookMeta;
}

export interface ComposeOptions {
  /** Pinned in tests so "today" is deterministic */
  now?: Date;
  /** Version used for the narrative cache key; defaults to the ruleset version */
  cacheKeyVersion?: string;
}

/** Facts → brief. Exported so tests can drive the engine without any network. */
export function composeOutlook(
  forecast: NormalizedForecast,
  options: ComposeOptions = {}
): OutlookBrief {
  const now = options.now ?? new Date();
  const cacheKeyVersion = options.cacheKeyVersion ?? NARRATIVE_RULESET_VERSION;
  const todayLocalDate = localParts(now.toISOString(), forecast.locationTimeZone).date;

  const facts: DailyFacts[] = buildDailyFacts(forecast, todayLocalDate);
  const narrative = composeNarrative(facts, forecast, cacheKeyVersion);

  return {
    locationName: forecast.locationName,
    analysisVersion: NARRATIVE_RULESET_VERSION,
    alerts: [...new Set(forecast.alerts.map((a) => a.event))],
    headline: narrative.headline,
    days: narrative.days,
    footnote: narrative.footnote,
    meta: {
      analysisVersion: NARRATIVE_RULESET_VERSION,
      buildCommit: BUILD_COMMIT,
      deploymentId: DEPLOYMENT_ID,
      sourceProvider: forecast.provider,
      sourceUpdatedAt: forecast.sourceUpdatedAt,
      generatedAt: now.toISOString(),
      locationTimeZone: forecast.locationTimeZone,
      narrativeCacheKey: narrativeCacheKey(
        cacheKeyVersion,
        'pending',
        forecast.sourceUpdatedAt
      ),
      invariantViolations: narrative.invariantViolations,
    },
  };
}

export async function fetchOutlook(
  lat: number,
  lon: number,
  options: ComposeOptions & { load?: (url: string) => Promise<Record<string, any>> } = {}
): Promise<OutlookBrief> {
  const locationKey = locationKeyOf(lat, lon);
  const now = options.now ?? new Date();
  const cacheKeyVersion = options.cacheKeyVersion ?? NARRATIVE_RULESET_VERSION;

  // Reuse raw forecast data if it is still fresh — independent of the ruleset
  const knownUpdatedAt = recallSourceUpdatedAt(locationKey, now.getTime());
  let forecast =
    knownUpdatedAt !== null
      ? cacheGet<NormalizedForecast>(
          forecastCacheKey('nws', locationKey, knownUpdatedAt),
          now.getTime()
        )
      : null;

  if (!forecast) {
    forecast = await fetchNormalizedForecast(lat, lon, { load: options.load });
    cacheSet(
      forecastCacheKey('nws', locationKey, forecast.sourceUpdatedAt),
      forecast,
      FORECAST_TTL_MS,
      now.getTime()
    );
    rememberSourceUpdatedAt(locationKey, forecast.sourceUpdatedAt, now.getTime());
  }

  // Narrative is keyed by ruleset version + source timestamp, so a v2 request
  // can never be served v1 prose, and fresh data never reuses old wording.
  const key = narrativeCacheKey(cacheKeyVersion, locationKey, forecast.sourceUpdatedAt);
  const cached = cacheGet<OutlookBrief>(key, now.getTime());
  if (cached) return cached;

  const brief = composeOutlook(forecast, { now, cacheKeyVersion });
  const withKey: OutlookBrief = { ...brief, meta: { ...brief.meta, narrativeCacheKey: key } };
  cacheSet(key, withKey, NARRATIVE_TTL_MS, now.getTime());
  return withKey;
}
