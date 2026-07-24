'use client';

import { CountryFlag } from '@/components/CountryFlag';
import {
  getCountryName,
  type LocationRequestState,
} from '@/utils/geolocation';

interface CountryPreferenceProps {
  countryCodes: string[];
  error: string | null;
  state: LocationRequestState;
  value: string;
  onChange: (countryCode: string) => void;
  onLocate: () => void;
}

export function CountryPreference({
  countryCodes,
  error,
  state,
  value,
  onChange,
  onLocate,
}: CountryPreferenceProps) {
  const countryName = value ? getCountryName(value) : null;

  return (
    <div className="border-t border-edge px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {value && <CountryFlag countryCode={value} />}
            <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-ink">
              Country preference
            </h3>
          </div>
          <p className="mt-1.5 text-sm text-ink-2">
            {countryName
              ? `${countryName} servers appear first. Other sorting still applies within each group.`
              : 'Choose a country or identify yours once. Matching servers will appear first.'}
          </p>
          <p className="mt-1 text-xs text-mut">
            Location lookup runs on this device and discards your coordinates. This does not measure ping.
          </p>
          <div aria-live="polite">
            {state === 'locating' && (
              <p className="mt-2 font-mono text-sm text-ct">
                &gt; identifying your country…
              </p>
            )}
            {error && (
              <p className="mt-2 text-sm text-tr" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:w-auto">
          <label className="sr-only" htmlFor="country-preference">
            Country preference
          </label>
          <select
            id="country-preference"
            className="h-10 min-w-56 rounded-[3px] border border-edge-2 bg-field px-3 py-2 text-sm text-ink focus:border-ct focus:outline-none"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">No country preference</option>
            {countryCodes.map((countryCode) => (
              <option key={countryCode} value={countryCode}>
                {getCountryName(countryCode)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="h-10 rounded-[2px] border border-hud/60 px-4 font-display text-[11px] font-semibold uppercase tracking-wider text-hud transition-colors hover:bg-hud hover:text-bg disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-hud"
            disabled={state === 'locating'}
            onClick={onLocate}
          >
            {state === 'locating' ? 'Finding country…' : 'Use my location'}
          </button>
        </div>
      </div>
    </div>
  );
}
