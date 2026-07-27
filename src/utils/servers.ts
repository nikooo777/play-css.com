import { compareCountryPreference } from './geolocation';

export interface Server {
  name: string;
  map: string;
  players: number;
  max_players: number;
  bots: number;
  ip: string;
  port: string;
  country: string;
}

export interface ServerFilters {
  status: 'all' | 'empty' | 'full' | 'partial';
  noBots: boolean;
  hideRussian: boolean;
  mapFilter: string;
  nameFilter: string;
  ipFilter: string;
  stripSpecialChars: boolean;
}

export type SortField = 'name' | 'map' | 'players' | 'ip' | 'country';
export type SortDirection = 'asc' | 'desc';

export function stripSpecialChars(str: string): string {
  return str.replace(/[^\x20-\x7EÀ-ɏͰ-ϿЀ-ӿḀ-ỿ一-鿿぀-ゟ゠-ヿ가-힯]/g, '');
}

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value > 255) {
      return null;
    }
    octets.push(value);
  }

  return octets;
}

export function compareIps(ipA: string, ipB: string): number {
  const octetsA = parseIpv4(ipA);
  const octetsB = parseIpv4(ipB);

  if (!octetsA || !octetsB) {
    return ipA.localeCompare(ipB);
  }

  for (let i = 0; i < 4; i++) {
    if (octetsA[i] !== octetsB[i]) {
      return octetsA[i] - octetsB[i];
    }
  }

  return 0;
}

function displayText(value: string, strip: boolean): string {
  return strip ? stripSpecialChars(value) : value;
}

function compareServers(a: Server, b: Server, field: SortField, strip: boolean): number {
  switch (field) {
    case 'name':
      return displayText(a.name, strip).localeCompare(displayText(b.name, strip));
    case 'map':
      return displayText(a.map, strip).localeCompare(displayText(b.map, strip));
    case 'players':
      return a.players - b.players;
    case 'ip':
      return compareIps(a.ip, b.ip);
    case 'country':
      return (a.country || '').localeCompare(b.country || '');
  }
}

export function processServers(
  servers: Server[],
  filters: ServerFilters,
  sortField: SortField,
  sortDirection: SortDirection,
  countryPreference: string
): Server[] {
  const filtered = servers.filter(server => {
    const name = displayText(server.name, filters.stripSpecialChars);
    const map = displayText(server.map, filters.stripSpecialChars);

    if (filters.status !== 'all') {
      if (filters.status === 'empty' && server.players > 0) return false;
      if (filters.status === 'full' && server.players < server.max_players) return false;
      if (filters.status === 'partial' && (server.players === 0 || server.players === server.max_players)) return false;
    }

    if (filters.hideRussian && server.country.toUpperCase() === 'RU') return false;

    return !(
      (filters.noBots && server.bots > 0) ||
      (filters.mapFilter && !map.toLowerCase().includes(filters.mapFilter.toLowerCase())) ||
      (filters.nameFilter && !name.toLowerCase().includes(filters.nameFilter.toLowerCase())) ||
      (filters.ipFilter && !server.ip.includes(filters.ipFilter))
    );
  });

  const multiplier = sortDirection === 'asc' ? 1 : -1;

  return filtered.sort((a, b) => {
    const countryOrder = compareCountryPreference(a.country, b.country, countryPreference);
    if (countryOrder !== 0) {
      return countryOrder;
    }
    return multiplier * compareServers(a, b, sortField, filters.stripSpecialChars);
  });
}
