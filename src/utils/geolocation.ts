const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const GEOLOCATION_TIMEOUT_MS = 10_000;
const GEOLOCATION_MAX_AGE_MS = 300_000;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export type LocationRequestState = 'idle' | 'locating' | 'active' | 'error';

export function normalizeCountryCode(countryCode: string | null | undefined): string {
  const normalized = countryCode?.trim().toUpperCase() ?? '';
  return COUNTRY_CODE_PATTERN.test(normalized) ? normalized : '';
}

export function getCountryName(countryCode: string): string {
  const normalized = normalizeCountryCode(countryCode);
  return normalized ? COUNTRY_NAMES.of(normalized) ?? normalized : 'Unknown';
}

export function compareCountryPreference(
  countryA: string,
  countryB: string,
  preferredCountry: string
): number {
  const normalizedPreference = normalizeCountryCode(preferredCountry);
  if (!normalizedPreference) {
    return 0;
  }

  const aMatches = normalizeCountryCode(countryA) === normalizedPreference;
  const bMatches = normalizeCountryCode(countryB) === normalizedPreference;

  if (aMatches === bMatches) {
    return 0;
  }

  return aMatches ? -1 : 1;
}

function getPositionErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access was denied. Choose your country manually instead.';
    case error.POSITION_UNAVAILABLE:
      return 'Your location is currently unavailable. Choose your country manually instead.';
    case error.TIMEOUT:
      return 'Finding your location took too long. Try again or choose your country manually.';
    default:
      return 'Your country could not be detected. Choose it manually instead.';
  }
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(getPositionErrorMessage(error))),
      {
        enableHighAccuracy: false,
        maximumAge: GEOLOCATION_MAX_AGE_MS,
        timeout: GEOLOCATION_TIMEOUT_MS,
      }
    );
  });
}

export async function getCountryCodeFromCoordinates(
  longitude: number,
  latitude: number
): Promise<string> {
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < MIN_LONGITUDE ||
    longitude > MAX_LONGITUDE ||
    latitude < MIN_LATITUDE ||
    latitude > MAX_LATITUDE
  ) {
    throw new Error('The reported location was invalid. Choose your country manually instead.');
  }

  const coordinates: [number, number] = [longitude, latitude];
  const { iso1A2Code } = await import('@rapideditor/country-coder');
  const territoryCode = normalizeCountryCode(
    iso1A2Code(coordinates, { level: 'territory' })
  );

  if (territoryCode) {
    return territoryCode;
  }

  const countryCode = normalizeCountryCode(iso1A2Code(coordinates));
  if (countryCode) {
    return countryCode;
  }

  throw new Error('Your country could not be identified. Choose it manually instead.');
}

export async function detectCurrentCountry(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Location is not supported by this browser. Choose your country manually instead.');
  }

  const position = await getCurrentPosition();
  return getCountryCodeFromCoordinates(
    position.coords.longitude,
    position.coords.latitude
  );
}
