'use client';

import { GB, US, DE, FR, RU, CN, JP, KR, BR, AU, NZ, CA, IN, SG, AE, SA, IL, TR, NL, BE, SE, NO, DK, FI, PL, CZ, HU, RO, BG, GR, IT, ES, PT, CH, AT, IE, SK, HR, SI, LV, LT, EE, CY, MT, LU, IS, GL, FO, GI, AD, MC, SM, VA, LI, CH as CH_FLAG } from 'country-flag-icons/react/3x2';

interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

function getCountryName(code: string): string {
  const codeMap: { [key: string]: string } = {
    'GB': 'United Kingdom',
    'US': 'United States',
    'DE': 'Germany',
    'FR': 'France',
    'RU': 'Russia',
    'CN': 'China',
    'JP': 'Japan',
    'KR': 'South Korea',
    'BR': 'Brazil',
    'AU': 'Australia',
    'NZ': 'New Zealand',
    'CA': 'Canada',
    'IN': 'India',
    'SG': 'Singapore',
    'AE': 'United Arab Emirates',
    'SA': 'Saudi Arabia',
    'IL': 'Israel',
    'TR': 'Turkey',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'FI': 'Finland',
    'PL': 'Poland',
    'CZ': 'Czech Republic',
    'HU': 'Hungary',
    'RO': 'Romania',
    'BG': 'Bulgaria',
    'GR': 'Greece',
    'IT': 'Italy',
    'ES': 'Spain',
    'PT': 'Portugal',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'IE': 'Ireland',
    'SK': 'Slovakia',
    'HR': 'Croatia',
    'SI': 'Slovenia',
    'LV': 'Latvia',
    'LT': 'Lithuania',
    'EE': 'Estonia',
    'CY': 'Cyprus',
    'MT': 'Malta',
    'LU': 'Luxembourg',
    'IS': 'Iceland',
    'GL': 'Greenland',
    'FO': 'Faroe Islands',
    'GI': 'Gibraltar',
    'AD': 'Andorra',
    'MC': 'Monaco',
    'SM': 'San Marino',
    'VA': 'Vatican City',
    'LI': 'Liechtenstein'
  };
  return codeMap[code.toUpperCase()] || 'Unknown Location';
}

export function CountryFlag({ countryCode, className = "w-6 h-4" }: CountryFlagProps) {
  const code = countryCode.toUpperCase();
  const countryName = getCountryName(code);

  const FlagComponent = (() => {
    switch (code) {
      case 'GB': return <GB className={className} />;
      case 'US': return <US className={className} />;
      case 'DE': return <DE className={className} />;
      case 'FR': return <FR className={className} />;
      case 'RU': return <RU className={className} />;
      case 'CN': return <CN className={className} />;
      case 'JP': return <JP className={className} />;
      case 'KR': return <KR className={className} />;
      case 'BR': return <BR className={className} />;
      case 'AU': return <AU className={className} />;
      case 'NZ': return <NZ className={className} />;
      case 'CA': return <CA className={className} />;
      case 'IN': return <IN className={className} />;
      case 'SG': return <SG className={className} />;
      case 'AE': return <AE className={className} />;
      case 'SA': return <SA className={className} />;
      case 'IL': return <IL className={className} />;
      case 'TR': return <TR className={className} />;
      case 'NL': return <NL className={className} />;
      case 'BE': return <BE className={className} />;
      case 'SE': return <SE className={className} />;
      case 'NO': return <NO className={className} />;
      case 'DK': return <DK className={className} />;
      case 'FI': return <FI className={className} />;
      case 'PL': return <PL className={className} />;
      case 'CZ': return <CZ className={className} />;
      case 'HU': return <HU className={className} />;
      case 'RO': return <RO className={className} />;
      case 'BG': return <BG className={className} />;
      case 'GR': return <GR className={className} />;
      case 'IT': return <IT className={className} />;
      case 'ES': return <ES className={className} />;
      case 'PT': return <PT className={className} />;
      case 'CH': return <CH_FLAG className={className} />;
      case 'AT': return <AT className={className} />;
      case 'IE': return <IE className={className} />;
      case 'SK': return <SK className={className} />;
      case 'HR': return <HR className={className} />;
      case 'SI': return <SI className={className} />;
      case 'LV': return <LV className={className} />;
      case 'LT': return <LT className={className} />;
      case 'EE': return <EE className={className} />;
      case 'CY': return <CY className={className} />;
      case 'MT': return <MT className={className} />;
      case 'LU': return <LU className={className} />;
      case 'IS': return <IS className={className} />;
      case 'GL': return <GL className={className} />;
      case 'FO': return <FO className={className} />;
      case 'GI': return <GI className={className} />;
      case 'AD': return <AD className={className} />;
      case 'MC': return <MC className={className} />;
      case 'SM': return <SM className={className} />;
      case 'VA': return <VA className={className} />;
      case 'LI': return <LI className={className} />;
      default:
        return (
          <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  })();

  return (
    <div className="group relative">
      {FlagComponent}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
        {countryName}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
      </div>
    </div>
  );
} 