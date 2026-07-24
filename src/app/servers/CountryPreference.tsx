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
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {value && <CountryFlag countryCode={value} />}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Country preference
            </h3>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {countryName
              ? `${countryName} servers appear first. Other sorting still applies within each group.`
              : 'Choose a country or identify yours once. Matching servers will appear first.'}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Location lookup runs on this device and discards your coordinates. This does not measure ping.
          </p>
          <div aria-live="polite">
            {state === 'locating' && (
              <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
                Identifying your country…
              </p>
            )}
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
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
            className="h-10 min-w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
            className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:cursor-wait disabled:opacity-60"
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
