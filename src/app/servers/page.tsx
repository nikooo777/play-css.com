'use client';

import { useEffect, useState } from 'react';

interface Server {
  name: string;
  map: string;
  players: number;
  max_players: number;
  bots: number;
  ip: string;
  port: number;
  country: string;
}

type SortField = 'name' | 'map' | 'players' | 'ip' | 'country';
type SortDirection = 'asc' | 'desc';
type ServerStatus = 'all' | 'empty' | 'full' | 'partial';

interface Filters {
  status: ServerStatus;
  noBots: boolean;
  mapFilter: string;
  nameFilter: string;
  ipFilter: string;
  stripSpecialChars: boolean;
}

const VIP_IPS = process.env.NEXT_PUBLIC_VIP_IPS?.split(',') || [];

export default function ServerBrowser({ initialServers }: { initialServers: Server[] }) {
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('players');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    noBots: false,
    mapFilter: '',
    nameFilter: '',
    ipFilter: '',
    stripSpecialChars: true,
  });
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(filters);

  // Refresh servers every 30 seconds
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/servers');
        if (!response.ok) {
          throw new Error('Failed to fetch servers');
        }
        const data = await response.json();
        setServers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch servers');
      } finally {
        setLoading(false);
      }
    };

    const interval = setInterval(fetchServers, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const stripSpecialChars = (str: string) => {
    // Keep basic ASCII, Cyrillic (U+0400 to U+04FF), and CJK characters
    // CJK ranges:
    // Chinese: U+4E00 to U+9FFF
    // Japanese: U+3040 to U+309F (Hiragana), U+30A0 to U+30FF (Katakana)
    // Korean: U+AC00 to U+D7AF (Hangul)
    return str.replace(/[^\x20-\x7E\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g, '');
  };

  const filteredServers = servers.filter(server => {
    const name = filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name;
    const map = filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map;

    // Status filter
    if (filters.status !== 'all') {
      switch (filters.status) {
        case 'empty':
          if (server.players > 0) return false;
          break;
        case 'full':
          if (server.players < server.max_players) return false;
          break;
        case 'partial':
          if (server.players === 0 || server.players === server.max_players) return false;
          break;
      }
    }

    // No bots filter
    if (filters.noBots && server.bots > 0) return false;

    // Map filter
    if (filters.mapFilter && !map.toLowerCase().includes(filters.mapFilter.toLowerCase())) return false;

    // Name filter
    if (filters.nameFilter && !name.toLowerCase().includes(filters.nameFilter.toLowerCase())) return false;

    // IP filter
    if (filters.ipFilter && !server.ip.includes(filters.ipFilter)) return false;

    return true;
  });

  const sortedServers = [...filteredServers].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'name':
        return multiplier * (filters.stripSpecialChars ? 
          stripSpecialChars(a.name).localeCompare(stripSpecialChars(b.name)) :
          a.name.localeCompare(b.name));
      case 'map':
        return multiplier * (filters.stripSpecialChars ?
          stripSpecialChars(a.map).localeCompare(stripSpecialChars(b.map)) :
          a.map.localeCompare(b.map));
      case 'players':
        return multiplier * (a.players - b.players);
      case 'ip':
        return multiplier * a.ip.localeCompare(b.ip);
      case 'country':
        return multiplier * (a.country || '').localeCompare(b.country || '');
      default:
        return 0;
    }
  });

  const totalPlayers = filteredServers.reduce((sum, server) => sum + server.players, 0);
  const totalServers = filteredServers.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p className="text-xl font-semibold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Counter-Strike: Source - Server Browser
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Find and connect to CS:S servers without the worry of spam servers polluting the list.
          </p>
          <div className="flex justify-center gap-8 text-gray-700 dark:text-gray-300">
            <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalServers}</div>
              <div className="text-sm">Total Servers</div>
            </div>
            <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalPlayers}</div>
              <div className="text-sm">Ingame Players</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Server Status
              </label>
              <select
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 h-[42px]"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as ServerStatus })}
              >
                <option value="all">All Servers</option>
                <option value="empty">Empty</option>
                <option value="full">Full</option>
                <option value="partial">Non-empty & Non-full</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Map Filter
              </label>
              <input
                type="text"
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 h-[42px]"
                placeholder="Filter by map name..."
                value={filters.mapFilter}
                onChange={(e) => setFilters({ ...filters, mapFilter: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Server Name Filter
              </label>
              <input
                type="text"
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 h-[42px]"
                placeholder="Filter by server name..."
                value={filters.nameFilter}
                onChange={(e) => setFilters({ ...filters, nameFilter: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                IP Filter
              </label>
              <input
                type="text"
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 h-[42px]"
                placeholder="Filter by IP..."
                value={filters.ipFilter}
                onChange={(e) => setFilters({ ...filters, ipFilter: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2 h-[42px]">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={filters.noBots}
                  onChange={(e) => setFilters({ ...filters, noBots: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Hide Servers with Bots
              </label>
            </div>

            <div className="flex items-center space-x-2 h-[42px]">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={filters.stripSpecialChars}
                  onChange={(e) => setFilters({ ...filters, stripSpecialChars: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Strip Special Characters
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th 
                    className="w-[35%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider truncate cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('name')}
                  >
                    Server Name <SortIcon field="name" />
                  </th>
                  <th 
                    className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('map')}
                  >
                    Map <SortIcon field="map" />
                  </th>
                  <th 
                    className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('players')}
                  >
                    Players <SortIcon field="players" />
                  </th>
                  <th 
                    className="w-[18%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('ip')}
                  >
                    IP:Port <SortIcon field="ip" />
                  </th>
                  <th 
                    className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('country')}
                  >
                    Country <SortIcon field="country" />
                  </th>
                  <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Join
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedServers.map((server, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      VIP_IPS.includes(server.ip) ? 'bg-green-50 dark:bg-green-900/20' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate whitespace-nowrap" title={server.name}>
                        {filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name}
                        {VIP_IPS.includes(server.ip) && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                            VIP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate whitespace-nowrap" title={server.map}>
                        {filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {server.players}/{server.max_players}{server.bots > 0 ? ` (${server.bots} bots)` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {server.ip}:{server.port}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {server.country || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`steam://connect/${server.ip}:${server.port}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                      >
                        Join
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}