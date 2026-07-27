import { describe, expect, test } from 'bun:test';
import {
  compareIps,
  processServers,
  stripSpecialChars,
  type Server,
  type ServerFilters,
} from './servers';

function makeServer(overrides: Partial<Server> = {}): Server {
  return {
    name: 'Test Server',
    map: 'de_dust2',
    players: 10,
    max_players: 20,
    bots: 0,
    ip: '1.2.3.4',
    port: '27015',
    country: 'DE',
    ...overrides,
  };
}

const defaultFilters: ServerFilters = {
  status: 'all',
  noBots: false,
  hideRussian: false,
  mapFilter: '',
  nameFilter: '',
  ipFilter: '',
  stripSpecialChars: true,
};

describe('stripSpecialChars', () => {
  test('keeps ASCII, accented Latin, Greek, Cyrillic and CJK text', () => {
    expect(stripSpecialChars('Café Français Ω сервер 日本語 서버')).toBe('Café Français Ω сервер 日本語 서버');
  });

  test('removes decorative characters', () => {
    expect(stripSpecialChars('▓▒░★ Server ★░▒▓')).toBe(' Server ');
  });
});

describe('compareIps', () => {
  test('compares octets numerically instead of lexicographically', () => {
    expect(compareIps('9.0.0.1', '80.0.0.1')).toBeLessThan(0);
    expect(compareIps('10.0.0.20', '10.0.0.3')).toBeGreaterThan(0);
    expect(compareIps('1.2.3.4', '1.2.3.4')).toBe(0);
  });

  test('falls back to string comparison for non-IPv4 input', () => {
    expect(compareIps('abc', 'abd')).toBeLessThan(0);
  });

  test('rejects malformed or out-of-range IPv4 values', () => {
    expect(compareIps('1.2.3.', '1.2.3.0')).not.toBe(0);
    expect(compareIps('256.0.0.1', '9.0.0.1')).toBeLessThan(0);
    expect(compareIps('1.2.3.4.5', '1.2.3.4')).not.toBe(0);
  });
});

describe('processServers filtering', () => {
  test('filters by status', () => {
    const servers = [
      makeServer({ name: 'empty', players: 0 }),
      makeServer({ name: 'partial', players: 10 }),
      makeServer({ name: 'full', players: 20 }),
    ];

    const names = (status: ServerFilters['status']) =>
      processServers(servers, { ...defaultFilters, status }, 'name', 'asc', '').map(s => s.name);

    expect(names('empty')).toEqual(['empty']);
    expect(names('full')).toEqual(['full']);
    expect(names('partial')).toEqual(['partial']);
    expect(names('all')).toEqual(['empty', 'full', 'partial']);
  });

  test('hides Russian servers case-insensitively when enabled', () => {
    const servers = [makeServer({ country: 'ru' }), makeServer({ country: 'DE' })];
    const result = processServers(servers, { ...defaultFilters, hideRussian: true }, 'name', 'asc', '');
    expect(result).toHaveLength(1);
    expect(result[0].country).toBe('DE');
  });

  test('hides servers with bots when enabled', () => {
    const servers = [makeServer({ bots: 3 }), makeServer({ bots: 0, name: 'human only' })];
    const result = processServers(servers, { ...defaultFilters, noBots: true }, 'name', 'asc', '');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('human only');
  });

  test('matches map and name filters against cleaned text', () => {
    const servers = [makeServer({ name: '★ Café Server ★', map: '▓de_dust2▓' })];

    expect(processServers(servers, { ...defaultFilters, mapFilter: 'de_dust' }, 'name', 'asc', '')).toHaveLength(1);
    expect(processServers(servers, { ...defaultFilters, nameFilter: 'café' }, 'name', 'asc', '')).toHaveLength(1);
    expect(processServers(servers, { ...defaultFilters, nameFilter: 'nomatch' }, 'name', 'asc', '')).toHaveLength(0);
  });

  test('matches IP filter as a substring', () => {
    const servers = [makeServer({ ip: '10.20.30.40' }), makeServer({ ip: '50.60.70.80' })];
    const result = processServers(servers, { ...defaultFilters, ipFilter: '20.30' }, 'name', 'asc', '');
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('10.20.30.40');
  });
});

describe('processServers sorting', () => {
  test('sorts by player count descending', () => {
    const servers = [
      makeServer({ name: 'low', players: 2 }),
      makeServer({ name: 'high', players: 18 }),
      makeServer({ name: 'mid', players: 9 }),
    ];
    const result = processServers(servers, defaultFilters, 'players', 'desc', '');
    expect(result.map(s => s.name)).toEqual(['high', 'mid', 'low']);
  });

  test('sorts IPs numerically', () => {
    const servers = [
      makeServer({ ip: '80.1.1.1' }),
      makeServer({ ip: '9.1.1.1' }),
      makeServer({ ip: '10.1.1.1' }),
    ];
    const result = processServers(servers, defaultFilters, 'ip', 'asc', '');
    expect(result.map(s => s.ip)).toEqual(['9.1.1.1', '10.1.1.1', '80.1.1.1']);
  });

  test('keeps preferred-country servers first regardless of sort direction', () => {
    const servers = [
      makeServer({ name: 'busy german', players: 20, country: 'DE' }),
      makeServer({ name: 'quiet swiss', players: 1, country: 'CH' }),
      makeServer({ name: 'busy french', players: 15, country: 'FR' }),
    ];
    const result = processServers(servers, defaultFilters, 'players', 'desc', 'CH');
    expect(result.map(s => s.name)).toEqual(['quiet swiss', 'busy german', 'busy french']);
  });
});
