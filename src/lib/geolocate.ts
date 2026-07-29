/** Browser geolocation with a hard timeout (shared by the main page and the outlook). */
export function getPosition(): Promise<GeolocationPosition> {
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

export function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'code' in err &&
    (err as { code: unknown }).code === 1 // GeolocationPositionError.PERMISSION_DENIED
  );
}
