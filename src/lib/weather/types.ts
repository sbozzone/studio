/**
 * The normalized weather contract. Provider responses are converted to this
 * shape exactly once, at the provider boundary, in consistent units and at
 * full precision — rounding happens only when a value is rendered.
 */

export interface NormalizedPeriod {
  /** Start of the period's validity (ISO 8601 with offset) */
  validStart: string;
  /** End of the period's validity (ISO 8601 with offset) */
  validEnd: string;
  /** Calendar date in the forecast location's time zone, YYYY-MM-DD */
  localDate: string;
  /** Hour 0–23 in the forecast location's time zone */
  localHour: number;
  temperatureF: number | null;
  dewPointF: number | null;
  relativeHumidityPct: number | null;
  /** True when RH was derived from temperature + dew point rather than supplied */
  relativeHumidityDerived: boolean;
  /** Sustained wind, low and high end of the provider's stated range */
  windSpeedMinMph: number | null;
  windSpeedMaxMph: number | null;
  windGustMph: number | null;
  windDirection: string | null;
  precipitationProbabilityPct: number | null;
  /** Liquid precipitation amount in inches for this period, when published */
  precipitationAmountIn: number | null;
  condition: string | null;
}

/** A day covered only by the multi-hour period forecast, not the hourly grid. */
export interface ExtendedPeriod {
  localDate: string;
  temperatureF: number | null;
  condition: string | null;
  precipitationProbabilityPct: number | null;
  windText: string | null;
  windDirection: string | null;
}

export interface WeatherAlert {
  event: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  onset: string | null;
  ends: string | null;
}

export interface NormalizedForecast {
  provider: string;
  locationName: string | null;
  locationTimeZone: string;
  /** When the provider last updated this forecast */
  sourceUpdatedAt: string | null;
  periods: NormalizedPeriod[];
  extendedPeriods: ExtendedPeriod[];
  alerts: WeatherAlert[];
  /**
   * Whether the alert query succeeded. "unavailable" means we must not claim
   * that no alerts exist.
   */
  alertsStatus: 'ok' | 'unavailable';
  /** True when the provider published quantitative precipitation for this grid */
  hasPrecipitationAmounts: boolean;
}

export type Confidence = 'firm' | 'extended';

export type DewPointCategory =
  | 'Dry'
  | 'Pleasant'
  | 'Comfortable'
  | 'Sticky'
  | 'Muggy'
  | 'Oppressive'
  | 'Miserable';

export type WindCategory = 'calm' | 'light' | 'noticeable' | 'breezy';

export type DayPart = 'morning' | 'afternoon' | 'lateAfternoon' | 'evening' | 'overnight';

export interface DailyFacts {
  localDate: string;
  dayName: string;
  /** 0 = today in the location's time zone */
  index: number;
  isToday: boolean;
  confidence: Confidence;

  highTemperatureF: number | null;

  /** Max heat index over the day's daytime hours, and the hour it occurred */
  maxHeatIndexF: number | null;
  temperatureAtMaxHeatIndexF: number | null;
  timestampOfMaxHeatIndex: string | null;
  /** max over hours of (HI_h − T_h) — same-timestamp pairs only */
  maxHourlyHeatIndexDelta: number | null;
  timestampOfMaxHeatIndexDelta: string | null;

  dewPointMinF: number | null;
  dewPointMaxF: number | null;
  dewPointMedianF: number | null;
  dewPointRangeF: number | null;
  dewPointCategory: DewPointCategory | null;

  /** Smallest simultaneous temperature − dew point spread during daytime hours */
  minSpreadF: number | null;
  /** Highest simultaneous daytime relative humidity */
  maxDaytimeRhPct: number | null;

  windMedianMph: number | null;
  windMinMph: number | null;
  windMaxMph: number | null;
  windGustMaxMph: number | null;
  windDirection: string | null;
  windCategory: WindCategory | null;
  windCrossesCategories: boolean;

  popByPart: Record<DayPart, number | null>;
  peakPopPct: number | null;
  peakPopPart: DayPart | null;
  conditionByPart: Partial<Record<DayPart, string>>;
  condition: string | null;
  hasThunder: boolean;
  precipitationAmountIn: number | null;
}
