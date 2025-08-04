'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { ServerModal } from './ServerModal';
import { AdminPanel } from './AdminPanel';
import { CountryFlag } from '@/components/CountryFlag';

// Interfaces
interface Server {
  name: string;
  map: string;
  players: number;
  max_players: number;
  bots: number;
  ip: string;
  port: string;
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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoize handlers to prevent unnecessary re-renders
  const handleCloseAdminPanel = useCallback(() => {
    setShowAdminPanel(false);
  }, []);

  const handleCloseServerModal = useCallback(() => {
    setSelectedServer(null);
  }, []);

  // Handle blacklist download
  const handleDownloadBlacklist = useCallback(async () => {
    try {
      const response = await fetch('/api/blacklist');
      if (!response.ok) {
        throw new Error('Failed to download blacklist');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'server_blacklist.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download blacklist:', error);
      // You could add a toast notification here if you have one
    }
  }, []);

  // Fetch servers with background refresh support
  const fetchServers = useCallback(async (isBackgroundRefresh = false) => {
    try {
      if (isBackgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch('/api/servers');
      if (!response.ok) throw new Error('Failed to fetch servers');
      const data: Server[] = await response.json();

      setServers(data);
      setError(null);
    } catch (err) {
      // Only show errors if it's not a background refresh or if there are no existing servers
      if (!isBackgroundRefresh || servers.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to fetch servers');
      }
    } finally {
      if (isBackgroundRefresh) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [servers.length]);

  // Setup server refresh (don't fetch immediately since we have initialServers)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchServers(true); // Background refresh
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchServers]);

  // Sorting handler
  const handleSort = useCallback((field: typeof sortField) => {
    setSortField(field);
    setSortDirection(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
  }, [sortField]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Counter-Strike: Source - Server Browser
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base">
                Find and connect to CS:S servers without spam interference
              </p>
            </div>
            <button
              onClick={() => setShowAdminPanel(true)}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium focus:ring-2 focus:ring-gray-500 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 text-gray-700 dark:text-gray-300 flex-wrap">
            <div className="bg-white dark:bg-gray-800 px-4 sm:px-6 py-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalServers}</div>
              <div className="text-xs sm:text-sm">Real Servers</div>
            </div>
            <div className="bg-white dark:bg-gray-800 px-4 sm:px-6 py-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalPlayers}</div>
              <div className="text-xs sm:text-sm">Ingame Players</div>
            </div>
            <button
              onClick={handleDownloadBlacklist}
              className="bg-white dark:bg-gray-800 px-4 sm:px-6 py-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300 dark:hover:border-orange-600 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="text-left min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Blacklist</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">cstrike/cfg/</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Server Status</label>
              <select
                className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 "
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters['status'] })}
              >
                <option value="all">All Servers</option>
                <option value="empty">Empty</option>
                <option value="full">Full</option>
                <option value="partial">Has Players</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Map Filter</label>
              <input
                type="text"
                className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 "
                placeholder="e.g. de_dust2"
                value={filters.mapFilter}
                onChange={(e) => setFilters({ ...filters, mapFilter: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Server Name</label>
              <input
                type="text"
                className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 "
                placeholder="Search servers..."
                value={filters.nameFilter}
                onChange={(e) => setFilters({ ...filters, nameFilter: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IP Address</label>
              <input
                type="text"
                className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 "
                placeholder="192.168.1.1"
                value={filters.ipFilter}
                onChange={(e) => setFilters({ ...filters, ipFilter: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-3 h-10">
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
                Hide Bots
              </label>
            </div>
            <div className="flex items-center space-x-3 h-10">
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
                Clean Names
              </label>
            </div>
          </div>
        </div>

        {/* Refresh indicator - bottom right */}
        {isRefreshing && (
          <div className="fixed bottom-4 right-4 z-20">
            <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Refreshing servers...</span>
            </div>
          </div>
        )}

        {/* Server List */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {processedServers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">No servers match your filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                      <tr>
                        {[
                          { field: 'name', label: 'Server Name', width: 'w-[35%]' },
                          { field: 'map', label: 'Map', width: 'w-[15%]' },
                          { field: 'players', label: 'Players', width: 'w-[12%]' },
                          { field: 'ip', label: 'IP:Port', width: 'w-[18%]' },
                          { field: 'country', label: 'Location', width: 'w-[10%]' },
                        ].map(({ field, label, width }) => (
                          <th
                            key={field}
                            className={`${width} px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 `}
                            onClick={() => handleSort(field as typeof sortField)}
                          >
                            <div className="flex items-center gap-1">
                              {label}
                              <SortIcon field={field as typeof sortField} />
                            </div>
                          </th>
                        ))}
                        <th className="w-[10%] px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {processedServers.map((server, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700  cursor-pointer ${
                            VIP_IPS.includes(server.ip) ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500' : ''
                          }`}
                          onClick={() => setSelectedServer(server)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <div className="truncate">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={server.name}>
                                  {filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name}
                                </div>
                                {VIP_IPS.includes(server.ip) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 mt-1">
                                    VIP
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-white truncate" title={server.map}>
                              {filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {server.players}/{server.max_players}
                              {server.bots > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {server.bots} bots
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                              {server.ip}:{server.port}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center">
                              <CountryFlag countryCode={server.country} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <a
                              href={`steam://connect/${server.ip}:${server.port}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 "
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

              {/* Mobile Card View */}
              <div className="lg:hidden">
                <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {processedServers.map((server, index) => (
                      <div
                        key={index}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700  cursor-pointer ${
                          VIP_IPS.includes(server.ip) ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500' : ''
                        }`}
                        onClick={() => setSelectedServer(server)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name}
                              </h3>
                              {VIP_IPS.includes(server.ip) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                                  VIP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">
                                {filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map}
                              </span>
                              <span className="flex items-center gap-1">
                                <CountryFlag countryCode={server.country} />
                                {server.country}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end text-right">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {server.players}/{server.max_players}
                            </div>
                            {server.bots > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {server.bots} bots
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {server.ip}:{server.port}
                          </div>
                          <a
                            href={`steam://connect/${server.ip}:${server.port}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 "
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Join
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Server Modal */}
      {selectedServer && (
        <ServerModal
          server={selectedServer}
          isOpen={!!selectedServer}
          onClose={handleCloseServerModal}
        />
      )}

      {/* Admin Panel */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={handleCloseAdminPanel}
      />
    </div>
  );
}
