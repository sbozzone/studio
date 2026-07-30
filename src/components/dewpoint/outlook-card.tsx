"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarSearch, LoaderCircle, Telescope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchOutlook, type OutlookBrief } from '@/lib/outlook';
import { getPosition, isPermissionDenied } from '@/lib/geolocate';

interface OutlookCardProps {
  /** Coordinates already obtained by the main page, if any */
  coords: { lat: number; lon: number } | null;
}

export default function OutlookCard({ coords }: OutlookCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [brief, setBrief] = useState<OutlookBrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookAhead = async () => {
    setStatus('loading');
    setError(null);
    try {
      let lat = coords?.lat;
      let lon = coords?.lon;
      if (lat == null || lon == null) {
        const pos = await getPosition();
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }
      setBrief(await fetchOutlook(lat, lon));
      setStatus('ready');
    } catch (err) {
      setError(
        isPermissionDenied(err)
          ? 'The outlook needs your location — allow location access and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not build the outlook right now.'
      );
      setStatus('error');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <CalendarSearch className="h-4 w-4 text-primary" aria-hidden />
            Outlook
            {brief?.locationName && (
              <span className="font-normal text-muted-foreground">· {brief.locationName}</span>
            )}
          </span>
          <Button variant="outline" size="sm" onClick={lookAhead} disabled={status === 'loading'}>
            {status === 'loading' ? (
              <LoaderCircle className="mr-1 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Telescope className="mr-1 h-4 w-4" aria-hidden />
            )}
            {status === 'ready' ? 'Refresh' : 'Look ahead'}
          </Button>
        </CardTitle>
        {status === 'idle' && (
          <p className="text-xs text-muted-foreground">
            How the next several days will actually feel outside — dewpoint and heat index, not
            just temperature.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardHeader>

      {status === 'ready' && brief && (
        <CardContent className="flex flex-col gap-4 pt-2">
          {brief.alerts.length > 0 && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              ⚠ {brief.alerts.join(' · ')} in effect — see weather.gov for official details.
            </p>
          )}
          <p className="border-l-4 border-accent pl-3 text-sm font-medium leading-relaxed">
            {brief.headline}
          </p>

          <ul className="flex flex-col gap-3">
            {brief.days.map((d) => (
              <li key={d.name} className="text-sm leading-relaxed">
                <span className={cn('font-bold', d.isToday && 'text-primary')}>{d.name}</span>
                {!d.firm && (
                  <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground/80">
                    pattern read
                  </span>
                )}
                <span className="text-foreground/90"> — {d.text}</span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">{brief.footnote}</p>
        </CardContent>
      )}
    </Card>
  );
}
