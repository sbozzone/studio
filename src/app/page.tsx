"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Droplets,
  Equal,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Pencil,
  Sun,
  Thermometer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import OutlookCard from '@/components/dewpoint/outlook-card';
import { getPosition, isPermissionDenied } from '@/lib/geolocate';
import {
  COMFORT_LEVELS,
  calcDewPointC,
  calcFeelsLikeF,
  cToF,
  fToC,
  getComfortLevel,
  yesterdayComparison,
} from '@/lib/dew-point';

type Unit = 'F' | 'C';
type Source = 'loading' | 'live' | 'manual';

interface Conditions {
  tempC: number;
  rh: number; // relative humidity %
  /** Apparent temperature from the weather service — null in manual mode */
  feelsLikeC: number | null;
  /** Dew point at this same hour yesterday — null when unavailable */
  yesterdayDewC: number | null;
}

/** Range of the visual scale bar, in °F. */
const SCALE_MIN_F = 40;
const SCALE_MAX_F = 85;

async function fetchCurrentWeather(lat: number, lon: number): Promise<Conditions> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature` +
    `&hourly=dew_point_2m&past_days=1&forecast_days=1&timezone=auto&temperature_unit=celsius`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
  const data = await res.json();
  const tempC = data?.current?.temperature_2m;
  const rh = data?.current?.relative_humidity_2m;
  const apparent = data?.current?.apparent_temperature;
  if (typeof tempC !== 'number' || typeof rh !== 'number') {
    throw new Error('Weather service returned incomplete data');
  }

  // Dew point at this same hour yesterday: find the current hour in the
  // hourly series (which starts 24h back thanks to past_days=1), step back 24.
  let yesterdayDewC: number | null = null;
  const times: string[] = data?.hourly?.time ?? [];
  const dews: (number | null)[] = data?.hourly?.dew_point_2m ?? [];
  const currentHour = `${String(data?.current?.time ?? '').slice(0, 13)}:00`;
  const idx = times.indexOf(currentHour);
  if (idx >= 24 && typeof dews[idx - 24] === 'number') {
    yesterdayDewC = dews[idx - 24];
  }

  return {
    tempC,
    rh,
    feelsLikeC: typeof apparent === 'number' ? apparent : null,
    yesterdayDewC,
  };
}

/** Best-effort "City, Region" for the header — the app works fine without it. */
async function fetchPlaceName(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const city = data?.city || data?.locality;
    const region = data?.principalSubdivisionCode?.split('-').pop() || data?.principalSubdivision;
    if (city && region) return `${city}, ${region}`;
    return city || null;
  } catch {
    return null;
  }
}

export default function DewPointPage() {
  const [unit, setUnit] = useState<Unit>('F');
  const [conditions, setConditions] = useState<Conditions>({
    tempC: fToC(75),
    rh: 50,
    feelsLikeC: null,
    yesterdayDewC: null,
  });
  const [source, setSource] = useState<Source>('loading');
  const [place, setPlace] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const useMyLocation = useCallback(async () => {
    setSource('loading');
    setLocError(null);
    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lon: longitude });
      const [weather, placeName] = await Promise.all([
        fetchCurrentWeather(latitude, longitude),
        fetchPlaceName(latitude, longitude),
      ]);
      setConditions(weather);
      setPlace(placeName);
      setUpdatedAt(new Date());
      setSource('live');
    } catch (err) {
      const message = isPermissionDenied(err)
        ? 'Location access was denied — enter your conditions below instead.'
        : 'Could not fetch local conditions — enter them below instead.';
      setLocError(message);
      setSource('manual');
    }
  }, []);

  // Fetch local conditions on first load.
  useEffect(() => {
    useMyLocation();
  }, [useMyLocation]);

  const dewPointC = useMemo(
    () => calcDewPointC(conditions.tempC, conditions.rh),
    [conditions]
  );
  const dewPointF = cToF(dewPointC);
  const level = getComfortLevel(dewPointF);

  const displayDewPoint = unit === 'F' ? dewPointF : dewPointC;
  const displayTemp = unit === 'F' ? cToF(conditions.tempC) : conditions.tempC;

  // Real feel: the weather service's apparent temperature when live (it
  // accounts for wind and sun), otherwise the NWS heat index from the sliders.
  const feelsLikeF =
    conditions.feelsLikeC != null
      ? cToF(conditions.feelsLikeC)
      : calcFeelsLikeF(cToF(conditions.tempC), conditions.rh);
  const displayFeelsLike = unit === 'F' ? feelsLikeF : fToC(feelsLikeF);

  // Marker position on the scale bar (0..100 %)
  const markerPct =
    (100 * (Math.min(SCALE_MAX_F, Math.max(SCALE_MIN_F, dewPointF)) - SCALE_MIN_F)) /
    (SCALE_MAX_F - SCALE_MIN_F);

  const setDisplayTemp = (value: number) => {
    setSource('manual');
    setConditions((c) => ({ ...c, tempC: unit === 'F' ? fToC(value) : value, feelsLikeC: null }));
  };
  const setHumidity = (value: number) => {
    setSource('manual');
    setConditions((c) => ({ ...c, rh: value, feelsLikeC: null }));
  };

  const tempSlider = unit === 'F'
    ? { min: -20, max: 120, step: 1 }
    : { min: -30, max: 50, step: 0.5 };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-primary">
            <Droplets className="h-8 w-8" aria-hidden />
            Dew Point
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Know how the air feels, right now.
          </p>
        </div>
        <div
          className="flex overflow-hidden rounded-md border border-border"
          role="group"
          aria-label="Temperature unit"
        >
          {(['F', 'C'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold transition-colors',
                unit === u
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
              )}
            >
              °{u}
            </button>
          ))}
        </div>
      </header>

      {/* Big dew point readout */}
      <Card className="relative overflow-hidden">
        {/* Decorative water-drop shape bleeding off the corner */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-secondary/70"
        />
        <CardContent className="relative flex flex-col items-center gap-3 py-8 text-center">
          {source === 'loading' ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
              <LoaderCircle className="h-8 w-8 animate-spin" aria-hidden />
              <p className="text-sm">Getting your local conditions…</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Current dew point
              </p>
              <p
                className="text-7xl font-bold tabular-nums leading-none transition-colors"
                style={{ color: level.ink }}
              >
                {Math.round(displayDewPoint)}°
                <span className="text-4xl align-top">{unit}</span>
              </p>
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-base font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Thermometer className="h-4 w-4" aria-hidden />
                  Air temperature {Math.round(displayTemp)}°{unit}
                </span>
                <span className="flex items-center gap-1">
                  <Sun className="h-4 w-4" aria-hidden />
                  Feels like {Math.round(displayFeelsLike)}°{unit}
                </span>
              </p>
              <div
                className="mt-1 flex flex-col items-center gap-0.5 rounded-2xl px-7 py-3 text-primary-foreground shadow-sm transition-colors"
                style={{ backgroundColor: level.fill }}
              >
                <span className="text-2xl font-bold">{level.label}</span>
                <span className="text-xs text-primary-foreground/80">{level.tagline}</span>
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">{level.description}</p>
              {source === 'live' && conditions.yesterdayDewC != null && (() => {
                const yestF = cToF(conditions.yesterdayDewC);
                const delta = Math.round(dewPointF) - Math.round(yestF);
                const TrendIcon = delta >= 2 ? TrendingUp : delta <= -2 ? TrendingDown : Equal;
                return (
                  <p className="flex max-w-sm items-center justify-center gap-1.5 text-xs font-medium text-foreground/70">
                    <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {yesterdayComparison(dewPointF, yestF, unit)}
                  </p>
                );
              })()}
            </>
          )}

          {/* Comfort scale bar */}
          <div className="mt-4 w-full">
            <div className="relative">
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {COMFORT_LEVELS.map((l) => {
                  const lo = Math.max(l.minF, SCALE_MIN_F);
                  const hi = Math.min(l.maxF, SCALE_MAX_F);
                  return (
                    <div
                      key={l.label}
                      title={l.label}
                      style={{
                        width: `${(100 * (hi - lo)) / (SCALE_MAX_F - SCALE_MIN_F)}%`,
                        backgroundColor: l.color,
                      }}
                    />
                  );
                })}
              </div>
              {source !== 'loading' && (
                <div
                  className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full bg-foreground shadow"
                  style={{ left: `${markerPct}%` }}
                  aria-hidden
                />
              )}
            </div>
            <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
              {COMFORT_LEVELS.filter((l) =>
                ['Dry', 'Pleasant', 'Sticky', 'Oppressive'].includes(l.label)
              ).map((l) => {
                const center =
                  (Math.max(l.minF, SCALE_MIN_F) + Math.min(l.maxF, SCALE_MAX_F)) / 2;
                return (
                  <span
                    key={l.label}
                    className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{
                      left: `${(100 * (center - SCALE_MIN_F)) / (SCALE_MAX_F - SCALE_MIN_F)}%`,
                    }}
                  >
                    {l.label}
                  </span>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              {source === 'live' ? (
                <MapPin className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <Pencil className="h-4 w-4 text-primary" aria-hidden />
              )}
              {source === 'live' ? (place ?? 'Your location') : 'Your conditions'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={useMyLocation}
              disabled={source === 'loading'}
            >
              {source === 'loading' ? (
                <LoaderCircle className="mr-1 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="mr-1 h-4 w-4" aria-hidden />
              )}
              Use my location
            </Button>
          </CardTitle>
          {source === 'live' && updatedAt && (
            <p className="text-xs text-muted-foreground">
              Live conditions · updated {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          {locError && <p className="text-xs text-destructive">{locError}</p>}
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="temp" className="flex items-center gap-1.5">
                <Thermometer className="h-4 w-4 text-muted-foreground" aria-hidden />
                Air temperature
              </Label>
              <span className="text-sm font-semibold tabular-nums">
                {Math.round(displayTemp)}°{unit}
              </span>
            </div>
            <Slider
              id="temp"
              value={[displayTemp]}
              min={tempSlider.min}
              max={tempSlider.max}
              step={tempSlider.step}
              onValueChange={([v]) => setDisplayTemp(v)}
              aria-label="Air temperature"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="rh" className="flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-muted-foreground" aria-hidden />
                Relative humidity
              </Label>
              <span className="text-sm font-semibold tabular-nums">{Math.round(conditions.rh)}%</span>
            </div>
            <Slider
              id="rh"
              value={[conditions.rh]}
              min={1}
              max={100}
              step={1}
              onValueChange={([v]) => setHumidity(v)}
              aria-label="Relative humidity"
            />
          </div>
          {source === 'manual' && (
            <p className="text-xs text-muted-foreground">
              Manual mode — adjust the sliders to explore, or tap “Use my location” for live
              conditions.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Qualitative weekly outlook */}
      <OutlookCard coords={coords} />

      {/* Reference scale */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What the numbers mean</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-border">
            {COMFORT_LEVELS.map((l) => {
              const isCurrent = source !== 'loading' && l.label === level.label;
              const range =
                l.minF === -Infinity
                  ? `under ${fmtRange(l.maxF, unit)}`
                  : l.maxF === Infinity
                    ? `${fmtRange(l.minF, unit)} and up`
                    : `${fmtRange(l.minF, unit)} – ${fmtRange(l.maxF, unit)}`;
              return (
                <li
                  key={l.label}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 text-sm',
                    isCurrent && 'bg-secondary font-medium'
                  )}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                    aria-hidden
                  />
                  <span className="w-24 shrink-0">{l.label}</span>
                  <span className="text-muted-foreground">{range}</span>
                  {isCurrent && <span className="ml-auto text-xs text-primary">now</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Dew point — not relative humidity — is what determines how humid the air actually
            feels. It’s the temperature the air would need to cool to for its moisture to
            condense.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function fmtRange(f: number, unit: Unit): string {
  return unit === 'F' ? `${Math.round(f)}°F` : `${Math.round(fToC(f))}°C`;
}
