"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Droplets, LocateFixed, LoaderCircle, MapPin, Pencil, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COMFORT_LEVELS,
  calcDewPointC,
  cToF,
  fToC,
  getComfortLevel,
} from '@/lib/dew-point';

type Unit = 'F' | 'C';
type Source = 'loading' | 'live' | 'manual';

interface Conditions {
  tempC: number;
  rh: number; // relative humidity %
}

/** Range of the visual scale bar, in °F. */
const SCALE_MIN_F = 40;
const SCALE_MAX_F = 85;

async function fetchCurrentWeather(lat: number, lon: number): Promise<Conditions> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m&temperature_unit=celsius`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
  const data = await res.json();
  const tempC = data?.current?.temperature_2m;
  const rh = data?.current?.relative_humidity_2m;
  if (typeof tempC !== 'number' || typeof rh !== 'number') {
    throw new Error('Weather service returned incomplete data');
  }
  return { tempC, rh };
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

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    // The native `timeout` option doesn't start ticking until the user answers
    // the permission prompt, so an ignored prompt would spin forever — race it
    // with our own hard timeout.
    const timer = setTimeout(() => reject(new Error('Timed out getting location')), 15000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); resolve(pos); },
      (err) => { clearTimeout(timer); reject(err); },
      { timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'code' in err &&
    (err as { code: unknown }).code === 1 // GeolocationPositionError.PERMISSION_DENIED
  );
}

export default function DewPointPage() {
  const [unit, setUnit] = useState<Unit>('F');
  const [conditions, setConditions] = useState<Conditions>({ tempC: fToC(75), rh: 50 });
  const [source, setSource] = useState<Source>('loading');
  const [place, setPlace] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const useMyLocation = useCallback(async () => {
    setSource('loading');
    setLocError(null);
    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
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

  // Marker position on the scale bar (0..100 %)
  const markerPct =
    (100 * (Math.min(SCALE_MAX_F, Math.max(SCALE_MIN_F, dewPointF)) - SCALE_MIN_F)) /
    (SCALE_MAX_F - SCALE_MIN_F);

  const setDisplayTemp = (value: number) => {
    setSource('manual');
    setConditions((c) => ({ ...c, tempC: unit === 'F' ? fToC(value) : value }));
  };
  const setHumidity = (value: number) => {
    setSource('manual');
    setConditions((c) => ({ ...c, rh: value }));
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
            How humid does it <em>really</em> feel?
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
      <Card
        className="border-2 transition-colors"
        style={{ borderColor: level.color, backgroundColor: `${level.color}14` }}
      >
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
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
              <p className="text-7xl font-bold tabular-nums leading-none">
                {Math.round(displayDewPoint)}°
                <span className="text-4xl align-top">{unit}</span>
              </p>
              <span
                className="rounded-full px-4 py-1 text-lg font-bold text-white shadow-sm"
                style={{ backgroundColor: level.color }}
              >
                {level.label}
              </span>
              <p className="max-w-sm text-sm text-foreground/80">{level.description}</p>
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
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Dry</span>
              <span>Comfortable</span>
              <span>Sticky</span>
              <span>Oppressive</span>
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
