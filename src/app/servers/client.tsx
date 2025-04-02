'use client';

import { useEffect, useState, useMemo } from 'react';
import { ServerModal } from './ServerModal';
import { CountryFlag } from '@/components/CountryFlag';

// Interfaces
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

interface Filters {
  status: 'all' | 'empty' | 'full' | 'partial';
  noBots: boolean;
  mapFilter: string;
  nameFilter: string;
  ipFilter: string;
  stripSpecialChars: boolean;
}

// Constants
const VIP_IPS = process.env.NEXT_PUBLIC_VIP_IPS?.split(',') || [];
const REFRESH_INTERVAL = 30000; // 30 seconds

// Utility Functions
const stripSpecialChars = (str: string): string => {
  return str.replace(/[^\x20-\x7E\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g, '');
};

export function ServerBrowserClient({ initialServers }: { initialServers: Server[] }) {
  // State
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [sortField, setSortField] = useState<'name' | 'map' | 'players' | 'ip' | 'country'>('players');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    noBots: false,
    mapFilter: '',
    nameFilter: '',
    ipFilter: '',
    stripSpecialChars: true,
  });
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  // Fetch servers
  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/servers');
      if (!response.ok) throw new Error('Failed to fetch servers');
      const data: Server[] = await response.json();
      setServers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch servers');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Setup server refresh
  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Sorting handler
  const handleSort = (field: typeof sortField) => {
    setSortField(field);
    setSortDirection(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
  };

  // Filter and sort servers
  const processedServers = useMemo(() => {
    // Filter servers
    const filtered = servers.filter(server => {
      const name = filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name;
      const map = filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map;

      if (filters.status !== 'all') {
        if (filters.status === 'empty' && server.players > 0) return false;
        if (filters.status === 'full' && server.players < server.max_players) return false;
        if (filters.status === 'partial' && (server.players === 0 || server.players === server.max_players)) return false;
      }

      return !(
        (filters.noBots && server.bots > 0) ||
        (filters.mapFilter && !map.toLowerCase().includes(filters.mapFilter.toLowerCase())) ||
        (filters.nameFilter && !name.toLowerCase().includes(filters.nameFilter.toLowerCase())) ||
        (filters.ipFilter && !server.ip.includes(filters.ipFilter))
      );
    });

    // Sort servers
    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      const getValue = (server: Server, field: typeof sortField) => {
        switch (field) {
          case 'name': return filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name;
          case 'map': return filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map;
          case 'players': return server.players;
          case 'ip': return server.ip;
          case 'country': return server.country || '';
        }
      };
      const valueA = getValue(a, sortField);
      const valueB = getValue(b, sortField);
      return multiplier * (typeof valueA === 'string' ? valueA.localeCompare(valueB as string) : (valueA as number) - (valueB as number));
    });
  }, [servers, filters, sortField, sortDirection]);

  // Calculate stats
  const stats = useMemo(() => ({
    totalPlayers: processedServers.reduce((sum, server) => sum + server.players, 0),
    totalServers: processedServers.length,
  }), [processedServers]);

  // Loading state
  if (isInitialLoad && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Error state
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

  // Sort icon component
  const SortIcon = ({ field }: { field: typeof sortField }) => (
    sortField === field ? <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span> : null
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Counter-Strike: Source - Server Browser
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Find and connect to CS:S servers without spam interference
          </p>
          <div className="flex justify-center gap-8 text-gray-700 dark:text-gray-300">
            <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalServers}</div>
              <div className="text-sm">Total Servers</div>
            </div>
            <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalPlayers}</div>
              <div className="text-sm">Ingame Players</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Server Status</label>
              <select
                className="w-full h-[42px] px-3 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters['status'] })}
              >
                <option value="all">All Servers</option>
                <option value="empty">Empty</option>
                <option value="full">Full</option>
                <option value="partial">Non-empty & Non-full</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Map Filter</label>
              <input
                type="text"
                className="w-full h-[42px] px-3 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Filter by map name..."
                value={filters.mapFilter}
                onChange={(e) => setFilters({ ...filters, mapFilter: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Server Name Filter</label>
              <input
                type="text"
                className="w-full h-[42px] px-3 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Filter by server name..."
                value={filters.nameFilter}
                onChange={(e) => setFilters({ ...filters, nameFilter: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Filter</label>
              <input
                type="text"
                className="w-full h-[42px] px-3 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Filter by IP..."
                value={filters.ipFilter}
                onChange={(e) => setFilters({ ...filters, ipFilter: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2 h-[42px]">
              <div 
                className="relative flex items-center cursor-pointer"
                onClick={() => setFilters({ ...filters, noBots: !filters.noBots })}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={filters.noBots}
                  onChange={(e) => setFilters({ ...filters, noBots: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </div>
              <label 
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                onClick={() => setFilters({ ...filters, noBots: !filters.noBots })}
              >
                Hide Servers with Bots
              </label>
            </div>
            <div className="flex items-center space-x-2 h-[42px]">
              <div 
                className="relative flex items-center cursor-pointer"
                onClick={() => setFilters({ ...filters, stripSpecialChars: !filters.stripSpecialChars })}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={filters.stripSpecialChars}
                  onChange={(e) => setFilters({ ...filters, stripSpecialChars: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </div>
              <label 
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                onClick={() => setFilters({ ...filters, stripSpecialChars: !filters.stripSpecialChars })}
              >
                Strip Special Characters
              </label>
            </div>
          </div>
        </div>

        {/* Server List with Sticky Header */}
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
          <div className="max-h-[700px] overflow-y-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  {[
                    { field: 'name', label: 'Server Name', width: 'w-[35%]' },
                    { field: 'map', label: 'Map', width: 'w-[12%]' },
                    { field: 'players', label: 'Players', width: 'w-[12%]' },
                    { field: 'ip', label: 'IP:Port', width: 'w-[18%]', hidden: 'hidden md:table-cell' },
                    { field: 'country', label: 'Country', width: 'w-[8%]' },
                  ].map(({ field, label, width, hidden = '' }) => (
                    <th
                      key={field}
                      className={`${width} ${hidden} px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600`}
                      onClick={() => handleSort(field as typeof sortField)}
                    >
                      {label} <SortIcon field={field as typeof sortField} />
                    </th>
                  ))}
                  <th className="hidden md:table-cell w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray- hoy-600 uppercase tracking-wider">
                    Join
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {processedServers.map((server, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                      VIP_IPS.includes(server.ip) ? 'bg-green-50 dark:bg-green-900/20' : ''
                    }`}
                    onClick={() => setSelectedServer(server)}
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
                    <td className="hidden md:table-cell px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {server.ip}:{server.port}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <CountryFlag countryCode={server.country} />
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <a
                        href={`steam://connect/${server.ip}:${server.port}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
                        onClick={(e) => e.stopPropagation()}
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

      {/* Server Modal */}
      {selectedServer && (
        <ServerModal
          server={selectedServer}
          isOpen={!!selectedServer}
          onClose={() => setSelectedServer(null)}
        />
      )}
    </div>
  );
}