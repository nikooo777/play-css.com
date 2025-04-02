'use client';

import * as Flags from 'country-flag-icons/react/3x2';
import { useState, useEffect } from 'react';

interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

export function CountryFlag({ countryCode, className = "w-6 h-4" }: CountryFlagProps) {
  const code = countryCode.toUpperCase();
  const [countryName, setCountryName] = useState(''); // Empty initial state
  
  useEffect(() => {
    // Only resolve name on client-side after mount
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || 'Unknown Location';
    setCountryName(name);
  }, [code]);

  const FlagComponent = (Flags as any)[code] || null;

  const defaultFlag = (
    <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className="group relative">
      {FlagComponent ? <FlagComponent className={className} /> : defaultFlag}
      {countryName && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
          {countryName}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
        </div>
      )}
    </div>
  );
}