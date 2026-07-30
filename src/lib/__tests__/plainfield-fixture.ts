/**
 * Regression fixture: a Plainfield, IN summer week in America/Indiana/Indianapolis
 * (EDT, UTC-04:00). Test data only — no application code is specialised for
 * Plainfield.
 *
 * Shaped to the specified normalized targets. Heat index is deliberately NOT
 * supplied: only temperature, dew point and relative humidity are given, so the
 * engine must compute it.
 *
 *  Day        High  PM RH  Dew  Wind   Peak PoP  Condition                  Displayed HI
 *  Thursday    83    53%    64   2–5      0%     sunny                          84
 *  Friday      86    50%    65   1–7     47% late mostly sunny, rain later       88
 *  Saturday    75    79%    68   8–10    82%     showers and thunderstorms     omit
 *  Sunday      80    65%    67   9–12    31%     chance of showers               82
 *  Monday      82    63%    68   6–8      0%     mostly sunny                    85
 *  Tuesday     84    65%    71   2–5      0%     sunny                           89
 *  Wednesday   85    65%    72   1–5     37%     chance of showers               91
 */

const OFFSET = '-04:00';
const fToC = (f: number): number => ((f - 32) * 5) / 9;

/** RH from simultaneous temperature and dew point (Magnus), as NWS publishes it: whole percent. */
function rhPct(tempF: number, dewF: number): number {
  const g = (c: number) => (17.625 * c) / (243.04 + c);
  return Math.round(100 * Math.exp(g(fToC(dewF)) - g(fToC(tempF))));
}

interface DaySpec {
  date: string;
  highF: number;
  dewF: number;
  windLo: number;
  windHi: number;
  windDir: string;
  condition: string;
  /** PoP by local hour; first match wins */
  pop: (hour: number) => number;
  eveningCondition?: string;
}

const specs: DaySpec[] = [
  {
    date: '2026-07-30', // Thursday
    highF: 83, dewF: 64, windLo: 2, windHi: 5, windDir: 'N',
    condition: 'Sunny', pop: () => 0,
  },
  {
    date: '2026-07-31', // Friday — mostly sunny by day, rain chances late
    highF: 86, dewF: 65, windLo: 1, windHi: 7, windDir: 'SW',
    condition: 'Mostly Sunny',
    eveningCondition: 'Chance Showers And Thunderstorms',
    pop: (h) => (h >= 18 ? 47 : h >= 16 ? 25 : 5),
  },
  {
    date: '2026-08-01', // Saturday — storms, including the early hours
    highF: 75, dewF: 68, windLo: 8, windHi: 10, windDir: 'SE',
    condition: 'Showers And Thunderstorms', pop: () => 82,
  },
  {
    date: '2026-08-02', // Sunday
    highF: 80, dewF: 67, windLo: 9, windHi: 12, windDir: 'W',
    condition: 'Chance Showers', pop: () => 31,
  },
  {
    date: '2026-08-03', // Monday
    highF: 82, dewF: 68, windLo: 6, windHi: 8, windDir: 'SW',
    condition: 'Mostly Sunny', pop: () => 0,
  },
  {
    date: '2026-08-04', // Tuesday
    highF: 84, dewF: 71, windLo: 2, windHi: 5, windDir: 'S',
    condition: 'Sunny', pop: () => 0,
  },
  {
    date: '2026-08-05', // Wednesday
    highF: 85, dewF: 72, windLo: 1, windHi: 5, windDir: 'S',
    condition: 'Chance Showers', pop: () => 37,
  },
];

/**
 * Diurnal curve: minimum near 05:00, maximum at 15:00. The swing is capped so
 * the overnight low always stays comfortably above the day's dew point —
 * without that, a humid day's early hours would fall below their own dew
 * point, which is physically impossible and would fake a saturated morning.
 */
function temperatureAt(highF: number, dewF: number, hour: number): number {
  const amplitude = Math.min(13, Math.max(4, highF - dewF - 4));
  const phase = Math.cos(((hour - 15) / 24) * 2 * Math.PI);
  return Math.round(highF - amplitude * (1 - (phase + 1) / 2));
}

export function plainfieldHourlyPeriods(): any[] {
  const periods: any[] = [];
  for (const s of specs) {
    for (let h = 0; h < 24; h++) {
      const temperature = temperatureAt(s.highF, s.dewF, h);
      const start = `${s.date}T${String(h).padStart(2, '0')}:00:00${OFFSET}`;
      const end = new Date(new Date(start).getTime() + 3600_000).toISOString();
      periods.push({
        number: periods.length + 1,
        startTime: start,
        endTime: end,
        isDaytime: h >= 7 && h < 20,
        temperature,
        temperatureUnit: 'F',
        dewpoint: { unitCode: 'wmoUnit:degC', value: fToC(s.dewF) },
        relativeHumidity: { unitCode: 'wmoUnit:percent', value: rhPct(temperature, s.dewF) },
        windSpeed: `${s.windLo} to ${s.windHi} mph`,
        windGust: null,
        windDirection: s.windDir,
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: s.pop(h) },
        shortForecast: h >= 18 && s.eveningCondition ? s.eveningCondition : s.condition,
      });
    }
  }
  return periods;
}

export function plainfieldDailyPeriods(): any[] {
  return specs.map((s, i) => ({
    number: i + 1,
    isDaytime: true,
    startTime: `${s.date}T06:00:00${OFFSET}`,
    endTime: `${s.date}T18:00:00${OFFSET}`,
    temperature: s.highF,
    temperatureUnit: 'F',
    windSpeed: `${s.windLo} to ${s.windHi} mph`,
    windDirection: s.windDir,
    probabilityOfPrecipitation: { value: Math.max(s.pop(9), s.pop(14), s.pop(20)) },
    shortForecast: s.condition,
  }));
}

/** Modest quantitative precipitation on the storm day (about 0.4 in total). */
export function plainfieldGridData(): Record<string, any> {
  return {
    properties: {
      quantitativePrecipitation: {
        uom: 'wmoUnit:mm',
        values: [
          { validTime: '2026-08-01T04:00:00+00:00/PT6H', value: 3 },
          { validTime: '2026-08-01T10:00:00+00:00/PT6H', value: 4 },
          { validTime: '2026-08-01T16:00:00+00:00/PT6H', value: 3 },
        ],
      },
    },
  };
}

export const PLAINFIELD_SOURCE_UPDATED_AT = '2026-07-30T14:35:00+00:00';

export function plainfieldPoints(): Record<string, any> {
  return {
    properties: {
      gridId: 'IND',
      forecastHourly: 'https://api.weather.gov/gridpoints/IND/50,60/forecast/hourly',
      forecast: 'https://api.weather.gov/gridpoints/IND/50,60/forecast',
      forecastGridData: 'https://api.weather.gov/gridpoints/IND/50,60',
      timeZone: 'America/Indiana/Indianapolis',
      relativeLocation: { properties: { city: 'Plainfield', state: 'IN' } },
    },
  };
}

export interface LoaderOptions {
  alertFeatures?: any[];
  /** Make the alert request fail, so the engine must not claim "no alerts" */
  alertsFail?: boolean;
  sourceUpdatedAt?: string;
}

/** Injectable loader that answers the real NWS URLs with fixture data. */
export function plainfieldLoader(options: LoaderOptions = {}) {
  return async (url: string): Promise<Record<string, any>> => {
    if (url.includes('/points/')) return plainfieldPoints();
    if (url.includes('/alerts/active')) {
      if (options.alertsFail) throw new Error('alerts unavailable');
      return { features: options.alertFeatures ?? [] };
    }
    if (url.endsWith('/forecast/hourly')) {
      return {
        properties: {
          updated: options.sourceUpdatedAt ?? PLAINFIELD_SOURCE_UPDATED_AT,
          periods: plainfieldHourlyPeriods(),
        },
      };
    }
    if (url.endsWith('/forecast')) {
      return { properties: { periods: plainfieldDailyPeriods() } };
    }
    if (url.endsWith('/50,60')) return plainfieldGridData();
    throw new Error(`unexpected url ${url}`);
  };
}

/** Noon local on the fixture's first day, so "today" is deterministic. */
export const PLAINFIELD_NOW = new Date('2026-07-30T12:00:00-04:00');
