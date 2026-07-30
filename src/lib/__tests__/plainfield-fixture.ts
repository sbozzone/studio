/**
 * Regression fixture resembling a Plainfield, IN summer outlook. This is test
 * data only — nothing in the app is special-cased for Plainfield.
 *
 * Week shape (per the refinement spec):
 * - Thursday (today): high 84, dew point mid-60s, light wind, sunny
 * - Friday: high 86, dew point mid-60s, mostly sunny day, rain chance rising late
 * - Saturday: high 75, dew point upper-60s, showers/thunderstorms likely, wind 8–10
 * - Sunday: high 80, dew point upper-60s, heat index ~low 80s
 * - Monday: high 82, dew point upper-60s, heat index ~mid 80s
 * - Tuesday: high 84, dew point low-70s, heat index ~upper 80s
 * - Wednesday: high ~85, daily-forecast only (lower-confidence extended period)
 */

const fToC = (f: number): number => ((f - 32) * 5) / 9;

/** Physically consistent RH from same-hour temperature and dew point (Magnus). */
const rhOf = (tF: number, dF: number): number => {
  const g = (c: number) => (17.625 * c) / (243.04 + c);
  return Math.min(100, Math.round(100 * Math.exp(g(fToC(dF)) - g(fToC(tF)))));
};

interface DaySpec {
  date: string;
  highT: number;
  dpMorning: number;
  dpAfternoon: number;
  wind: number;
  dir: string;
  sky: string;
  /** hourly PoP by hour-of-day override; defaults to popDay everywhere */
  popDay: number;
  popEvening?: number; // hours 18-23
}

const specs: DaySpec[] = [
  { date: '2026-07-30', highT: 84, dpMorning: 64, dpAfternoon: 65, wind: 3, dir: 'SW', sky: 'Sunny', popDay: 5 },
  { date: '2026-07-31', highT: 86, dpMorning: 65, dpAfternoon: 66, wind: 6, dir: 'SW', sky: 'Mostly Sunny', popDay: 15, popEvening: 65 },
  { date: '2026-08-01', highT: 75, dpMorning: 68, dpAfternoon: 68, wind: 9, dir: 'SE', sky: 'Showers And Thunderstorms Likely', popDay: 75, popEvening: 60 },
  { date: '2026-08-02', highT: 80, dpMorning: 67, dpAfternoon: 68, wind: 5, dir: 'W', sky: 'Partly Sunny', popDay: 20 },
  { date: '2026-08-03', highT: 82, dpMorning: 68, dpAfternoon: 69, wind: 6, dir: 'SW', sky: 'Mostly Sunny', popDay: 20 },
  { date: '2026-08-04', highT: 84, dpMorning: 71, dpAfternoon: 72, wind: 6, dir: 'S', sky: 'Mostly Sunny', popDay: 25 },
];

export function plainfieldHourlyPeriods(): any[] {
  const periods: any[] = [];
  for (const s of specs) {
    for (let h = 0; h < 24; h++) {
      // Diurnal temperature curve peaking mid-afternoon
      const frac = Math.max(0, Math.sin(((h - 6) / 18) * Math.PI));
      const temp = Math.round(s.highT - 13 + 13 * frac);
      const dp = Math.round(h < 12 ? s.dpMorning : s.dpMorning + (s.dpAfternoon - s.dpMorning) * Math.min(1, (h - 12) / 5));
      const pop = h >= 18 && s.popEvening != null ? s.popEvening : s.popDay;
      periods.push({
        startTime: `${s.date}T${String(h).padStart(2, '0')}:00:00-04:00`,
        temperature: temp,
        temperatureUnit: 'F',
        dewpoint: { unitCode: 'wmoUnit:degC', value: fToC(dp) },
        relativeHumidity: { value: rhOf(temp, dp) },
        windSpeed: `${s.wind} mph`,
        windDirection: s.dir,
        probabilityOfPrecipitation: { value: pop },
        shortForecast: h >= 18 && s.popEvening != null && s.popEvening >= 50 ? 'Showers And Thunderstorms Likely' : s.sky,
      });
    }
  }
  return periods;
}

export function plainfieldDailyPeriods(): any[] {
  return [
    ...specs.map((s) => ({
      isDaytime: true,
      startTime: `${s.date}T06:00:00-04:00`,
      temperature: s.highT,
      windSpeed: `${s.wind} mph`,
      windDirection: s.dir,
      probabilityOfPrecipitation: { value: Math.max(s.popDay, s.popEvening ?? 0) },
      shortForecast: s.sky,
    })),
    // Wednesday exists only in the 7-day forecast — the hourly grid has run out
    {
      isDaytime: true,
      startTime: '2026-08-05T06:00:00-04:00',
      temperature: 85,
      windSpeed: '5 to 10 mph',
      windDirection: 'SW',
      probabilityOfPrecipitation: { value: 30 },
      shortForecast: 'Chance Showers And Thunderstorms',
    },
  ];
}
