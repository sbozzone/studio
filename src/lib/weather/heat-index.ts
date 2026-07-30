/**
 * Deterministic heat-index and humidity math.
 *
 * Heat index follows the official NWS/WPC procedure exactly:
 * https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 *
 * Nothing here may be delegated to a model, and every value is computed from
 * simultaneous inputs — never from a daily high paired with another hour's
 * humidity.
 */

/** Top of the published NWS heat-index chart; guards nonphysical what-if inputs. */
const HEAT_INDEX_CHART_MAX_F = 140;

/**
 * NWS heat index in °F from simultaneous air temperature (°F) and relative
 * humidity (%).
 *
 * The simple (Steadman) form is computed first and averaged with the air
 * temperature. If that preliminary value is below 80 °F it *is* the heat
 * index; at 80 °F or above the Rothfusz regression applies, with the official
 * low- and high-humidity adjustments. No additional eligibility rules are
 * imposed.
 */
export function heatIndexF(temperatureF: number, relativeHumidityPct: number): number {
  const T = temperatureF;
  const RH = Math.min(100, Math.max(0, relativeHumidityPct));

  const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);
  const preliminary = (simple + T) / 2;
  if (preliminary < 80) return preliminary;

  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    0.00683783 * T * T -
    0.05481717 * RH * RH +
    0.00122874 * T * T * RH +
    0.00085282 * T * RH * RH -
    0.00000199 * T * T * RH * RH;

  if (RH < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (RH > 85 && T >= 80 && T <= 87) {
    hi += ((RH - 85) / 10) * ((87 - T) / 5);
  }
  return Math.min(hi, HEAT_INDEX_CHART_MAX_F);
}

/** Heat index is only meaningful from 80 °F up; below that there is nothing to report. */
export const HEAT_INDEX_MEANINGFUL_F = 80;

export const isHeatIndexMeaningful = (heatIndexValueF: number): boolean =>
  heatIndexValueF >= HEAT_INDEX_MEANINGFUL_F;

/**
 * What a person feels from heat alone: the heat index when it is meaningful,
 * otherwise the air temperature itself. Wind chill is out of scope — we do not
 * collect wind speed at the point of use.
 */
export function apparentTemperatureF(temperatureF: number, relativeHumidityPct: number): number {
  const hi = heatIndexF(temperatureF, relativeHumidityPct);
  return isHeatIndexMeaningful(hi) ? hi : temperatureF;
}

const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04; // °C

const toC = (f: number): number => ((f - 32) * 5) / 9;

/**
 * Relative humidity (%) derived from simultaneous temperature and dew point
 * (both °F), via the Magnus saturation-vapour-pressure ratio. Used only when
 * the provider omits RH — provider-supplied RH always wins.
 */
export function relativeHumidityFromDewPointF(temperatureF: number, dewPointF: number): number {
  const gamma = (c: number) => (MAGNUS_A * c) / (MAGNUS_B + c);
  const ratio = Math.exp(gamma(toC(dewPointF)) - gamma(toC(temperatureF)));
  return Math.min(100, Math.max(0, ratio * 100));
}
