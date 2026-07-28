'use client';

import * as Flags from 'country-flag-icons/react/3x2';
import { getCountryName, normalizeCountryCode } from '@/utils/geolocation';

const FLAG_VIEW_BOX = '0 0 513 342';

const flagComponents = Flags as Record<string, React.ComponentType<{ className?: string }> | undefined>;

interface CountryFlagProps {
  countryCode: string;
  className?: string;
  sprite?: boolean;
}

// Renders each unique flag once so repeated flags can reference it via <use>
// instead of inlining the full SVG per row
export function CountryFlagDefs({ countryCodes }: { countryCodes: string[] }) {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        {countryCodes.map((code) => {
          const FlagComponent = flagComponents[code];
          return FlagComponent ? (
            <symbol key={code} id={`flag-${code}`} viewBox={FLAG_VIEW_BOX}>
              <FlagComponent />
            </symbol>
          ) : null;
        })}
      </defs>
    </svg>
  );
}

export function CountryFlag({ countryCode, className = "w-6 h-4", sprite = false }: CountryFlagProps) {
  const code = normalizeCountryCode(countryCode);
  const countryName = getCountryName(code);

  const FlagComponent = code ? flagComponents[code] || null : null;

  const defaultFlag = (
    <svg className={`${className} text-mut`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const flag = !FlagComponent ? (
    defaultFlag
  ) : sprite ? (
    <svg viewBox={FLAG_VIEW_BOX} className={className}>
      <use href={`#flag-${code}`} />
    </svg>
  ) : (
    <FlagComponent className={className} />
  );

  return (
    <div className="group relative">
      {flag}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-panel-2 border border-edge-2 text-ink text-xs rounded-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-20">
        {countryName}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-panel-2 border-b border-r border-edge-2"></div>
      </div>
    </div>
  );
}
