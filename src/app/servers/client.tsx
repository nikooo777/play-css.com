'use client';

import { useEffect, useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { ServerModal } from './ServerModal';
import { AdminPanel } from './AdminPanel';
import { CountryPreference } from './CountryPreference';
import { CountryFlag, CountryFlagDefs } from '@/components/CountryFlag';
import {
  detectCurrentCountry,
  getCountryName,
  normalizeCountryCode,
  type LocationRequestState,
} from '@/utils/geolocation';
import {
  processServers,
  stripSpecialChars,
  type Server,
  type ServerFilters,
  type SortDirection,
  type SortField,
} from '@/utils/servers';
import { clearLegacyAdminCookie } from '@/utils/auth';

type ToggleFilter = 'noBots' | 'hideRussian' | 'stripSpecialChars';

// Constants
const VIP_IPS = process.env.NEXT_PUBLIC_VIP_IPS?.split(',').map(ip => ip.trim()).filter(Boolean) ?? [];
const REFRESH_INTERVAL = 30000; // 30 seconds

// Shared styles
const fieldClass = 'w-full h-10 px-3 rounded-[3px] border border-edge-2 bg-field text-sm text-ink placeholder:text-mut/60 focus:border-ct focus:outline-none';
const labelClass = 'block font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut mb-1.5';
const ghostButtonClass = 'inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider text-mut hover:text-ink border border-edge hover:border-edge-2 bg-panel rounded-[3px] px-3 py-2 transition-colors';
const connectButtonClass = 'inline-flex items-center font-display text-[11px] font-semibold uppercase tracking-wider text-hud border border-hud/60 hover:bg-hud hover:text-bg rounded-[2px] px-3 py-1.5 transition-colors';

function CapacityBar({ players, maxPlayers }: { players: number; maxPlayers: number }) {
  const percentage = maxPlayers > 0 ? Math.min(100, Math.round((players / maxPlayers) * 100)) : 0;
  const fill = players === 0 ? 'bg-edge-2' : players >= maxPlayers ? 'bg-tr' : 'bg-hud';
  return (
    <div className="mt-1 h-[3px] w-16 overflow-hidden rounded-full bg-edge">
      <div className={`h-full ${fill}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

// Rows sent in the server-rendered HTML; the rest mount right after hydration
const SSR_ROW_LIMIT = 120;

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribeToDesktopQuery(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

// null during SSR/hydration, where both views render and CSS picks one;
// after mount only the active view stays in the DOM
function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeToDesktopQuery,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null
  );
}

function VipTag() {
  return (
    <span className="ml-2 inline-flex items-center rounded-[2px] border border-hud/50 px-1 py-px font-display text-[10px] font-semibold uppercase tracking-wider text-hud">
      VIP
    </span>
  );
}

export function ServerBrowserClient({ initialServers }: { initialServers: Server[] }) {
  // State
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [sortField, setSortField] = useState<SortField>('players');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<ServerFilters>({
    status: 'all',
    noBots: false,
    hideRussian: true,
    mapFilter: '',
    nameFilter: '',
    ipFilter: '',
    stripSpecialChars: true,
  });
  const [countryPreference, setCountryPreference] = useState('');
  const [locationState, setLocationState] = useState<LocationRequestState>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [filtersEl, setFiltersEl] = useState<HTMLElement | null>(null);
  const [filtersHeight, setFiltersHeight] = useState(0);
  const isDesktop = useIsDesktop();
  const [showFullList, setShowFullList] = useState(false);
  const locationRequestId = useRef(0);
  const serversRef = useRef(initialServers);
  const fetchRequestId = useRef(0);
  const activeFetchCount = useRef(0);

  // One-time cleanup of the pre-sessionStorage credential cookie
  useEffect(() => {
    clearLegacyAdminCookie();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowFullList(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // The sticky table header sits below the sticky filter bar, so it needs
  // the bar's rendered height as its top offset
  useEffect(() => {
    if (!filtersEl) {
      return;
    }

    const observer = new ResizeObserver(() => setFiltersHeight(filtersEl.offsetHeight));
    observer.observe(filtersEl);
    return () => observer.disconnect();
  }, [filtersEl]);

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
    }
  }, []);

  // Fetch servers with background refresh support. Background refreshes are
  // skipped while any request is in flight (so they can never supersede a
  // foreground retry), and a superseded request never applies its result
  // over a newer one.
  const fetchServers = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh && activeFetchCount.current > 0) {
      return;
    }

    activeFetchCount.current += 1;
    const requestId = fetchRequestId.current + 1;
    fetchRequestId.current = requestId;

    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch('/api/servers', { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error('Failed to fetch servers');
      const data: Server[] = (await response.json()) ?? [];

      if (fetchRequestId.current !== requestId) return;

      serversRef.current = data;
      setServers(data);
      setError(null);
      setSyncFailed(false);
    } catch (err) {
      if (fetchRequestId.current !== requestId) return;

      // Only take over the screen when there is no existing data to keep showing
      if (!isBackgroundRefresh || serversRef.current.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to fetch servers');
      } else {
        setSyncFailed(true);
      }
    } finally {
      activeFetchCount.current -= 1;
      if (fetchRequestId.current === requestId) {
        setIsRefreshing(false);
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, []);

  const handleRetry = useCallback(() => {
    fetchServers(false);
  }, [fetchServers]);

  // Setup server refresh (don't fetch immediately since we have initialServers).
  // Skips refreshes while the tab is hidden and catches up as soon as it becomes visible.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchServers(true); // Background refresh
      }
    }, REFRESH_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchServers(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchServers]);

  // Sorting handler
  const handleSort = useCallback((field: typeof sortField) => {
    setSortField(field);
    setSortDirection(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
  }, [sortField]);

  const activateCountryPreference = useCallback((countryCode: string) => {
    const normalized = normalizeCountryCode(countryCode);
    setCountryPreference(normalized);
    setLocationState(normalized ? 'active' : 'idle');
    setLocationError(null);

    if (normalized === 'RU') {
      setFilters((currentFilters) => ({
        ...currentFilters,
        hideRussian: false,
      }));
    }
  }, []);

  const handleCountryPreference = useCallback((countryCode: string) => {
    locationRequestId.current += 1;
    activateCountryPreference(countryCode);
  }, [activateCountryPreference]);

  const handleUseLocation = useCallback(async () => {
    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    setLocationState('locating');
    setLocationError(null);

    try {
      const countryCode = await detectCurrentCountry();
      if (locationRequestId.current === requestId) {
        activateCountryPreference(countryCode);
      }
    } catch (error) {
      if (locationRequestId.current === requestId) {
        setLocationState('error');
        setLocationError(
          error instanceof Error
            ? error.message
            : 'Your country could not be detected. Choose it manually instead.'
        );
      }
    }
  }, [activateCountryPreference]);

  const handleToggleFilter = useCallback((key: ToggleFilter, checked: boolean) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: checked,
    }));

    if (key === 'hideRussian' && checked && countryPreference === 'RU') {
      locationRequestId.current += 1;
      setCountryPreference('');
      setLocationState('idle');
      setLocationError(null);
    }
  }, [countryPreference]);

  const countryCodes = useMemo(() => {
    const codes = new Set<string>();

    servers.forEach((server) => {
      const countryCode = normalizeCountryCode(server.country);
      if (countryCode) {
        codes.add(countryCode);
      }
    });

    if (countryPreference) {
      codes.add(countryPreference);
    }

    return [...codes].sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)));
  }, [servers, countryPreference]);

  // Filter and sort servers
  const processedServers = useMemo(
    () => processServers(servers, filters, sortField, sortDirection, countryPreference),
    [servers, filters, sortField, sortDirection, countryPreference]
  );

  // Calculate stats
  const stats = useMemo(() => ({
    totalPlayers: processedServers.reduce((sum, server) => sum + server.players, 0),
    totalServers: processedServers.length,
  }), [processedServers]);

  const visibleServers = showFullList ? processedServers : processedServers.slice(0, SSR_ROW_LIMIT);

  // Loading state
  if (isInitialLoad && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-mut">
          ] contacting master server<span className="cursor-blink">_</span>
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="font-mono text-sm text-tr">] connection failed</p>
          <p className="mt-2 text-sm text-mut">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-5 rounded-[2px] border border-hud/60 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-hud transition-colors hover:bg-hud hover:text-bg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Sort icon component
  const SortIcon = ({ field }: { field: typeof sortField }) => (
    sortField === field ? <span className="ml-1 text-ct">{sortDirection === 'asc' ? '↑' : '↓'}</span> : null
  );

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <CountryFlagDefs countryCodes={countryCodes} />
      <div className="max-w-7xl mx-auto">
        {/* Command bar */}
        <header className="rise mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-xl font-bold tracking-wide text-ink sm:text-2xl">
                PLAY-CSS<span className="text-hud">.COM</span>
              </h1>
              <span aria-hidden="true" className="cursor-blink inline-block h-[1.05em] w-[0.5em] translate-y-[2px] bg-hud/80" />
            </div>
            <p className="mt-0.5 text-sm text-mut">
              The Counter-Strike: Source server list — fakes and spam filtered out.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleDownloadBlacklist}
              className={ghostButtonClass}
              title="Download server_blacklist.txt for cstrike/cfg"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Blacklist</span>
            </button>
            <button onClick={() => setShowAdminPanel(true)} className={ghostButtonClass} title="Admin tools">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>
        </header>

        {/* HUD readout */}
        <section className="rise mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 rounded border border-edge bg-panel px-4 py-3 [animation-delay:60ms] sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="hud-glow font-mono text-3xl text-hud sm:text-4xl">{stats.totalServers}</span>
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-mut">
              Servers online
            </span>
          </div>
          <div className="hidden h-8 w-px bg-edge sm:block" />
          <div className="flex items-baseline gap-3">
            <span className="hud-glow font-mono text-3xl text-hud sm:text-4xl">{stats.totalPlayers}</span>
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-mut">
              Players in-game
            </span>
          </div>
          <div className="w-full font-mono text-xs sm:ml-auto sm:w-auto">
            <span aria-live="polite" className="text-tr">
              {syncFailed ? '> sync failed — retrying in 30s' : ''}
            </span>
            {!syncFailed && (
              <span className="text-mut">{isRefreshing ? '> syncing server list…' : '> live — auto-refresh 30s'}</span>
            )}
          </div>
        </section>

        {/* Filters */}
        <section ref={setFiltersEl} className="rise z-20 mb-4 rounded border border-edge bg-panel [animation-delay:120ms] lg:sticky lg:top-0">
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass} htmlFor="filter-status">Server status</label>
                <select
                  id="filter-status"
                  className={fieldClass}
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as ServerFilters['status'] })}
                >
                  <option value="all">All servers</option>
                  <option value="empty">Empty</option>
                  <option value="full">Full</option>
                  <option value="partial">Has players</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="filter-map">Map</label>
                <input
                  id="filter-map"
                  type="text"
                  className={`${fieldClass} font-mono`}
                  placeholder="de_dust2"
                  value={filters.mapFilter}
                  onChange={(e) => setFilters({ ...filters, mapFilter: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="filter-name">Server name</label>
                <input
                  id="filter-name"
                  type="text"
                  className={fieldClass}
                  placeholder="Search servers…"
                  value={filters.nameFilter}
                  onChange={(e) => setFilters({ ...filters, nameFilter: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="filter-ip">IP address</label>
                <input
                  id="filter-ip"
                  type="text"
                  className={`${fieldClass} font-mono`}
                  placeholder="192.168.1.1"
                  value={filters.ipFilter}
                  onChange={(e) => setFilters({ ...filters, ipFilter: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {[
                { key: 'noBots' as const, label: 'Hide bots', title: 'Hide servers with AI players' },
                { key: 'hideRussian' as const, label: 'Hide Russian' },
                { key: 'stripSpecialChars' as const, label: 'Clean names' },
              ].map(({ key, label, title }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2.5"
                  title={title}
                >
                  <input
                    type="checkbox"
                    className="hud-check"
                    checked={filters[key]}
                    onChange={(event) => handleToggleFilter(key, event.target.checked)}
                  />
                  <span className="select-none text-sm text-ink-2">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <CountryPreference
            countryCodes={countryCodes}
            error={locationError}
            state={locationState}
            value={countryPreference}
            onChange={handleCountryPreference}
            onLocate={handleUseLocation}
          />
        </section>

        {/* Server List */}
        <section className="rise overflow-clip rounded border border-edge bg-panel [animation-delay:180ms]">
          {processedServers.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="font-mono text-sm text-mut">] 0 servers match the current filters</p>
              <p className="mt-1 text-sm text-mut">Loosen or clear a filter to see more.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              {isDesktop !== false && (
              <div className="hidden lg:block">
                <table className="w-full table-fixed">
                    <thead className="sticky z-10 bg-panel-2" style={{ top: filtersHeight }}>
                      <tr className="border-b border-edge">
                        {[
                          { field: 'name', label: 'Server Name', width: 'w-[35%]' },
                          { field: 'map', label: 'Map', width: 'w-[15%]' },
                          { field: 'players', label: 'Players', width: 'w-[12%]' },
                          { field: 'ip', label: 'IP:Port', width: 'w-[18%]' },
                          { field: 'country', label: 'Location', width: 'w-[10%]' },
                        ].map(({ field, label, width }) => (
                          <th
                            key={field}
                            aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                            className={`${width} p-0 text-left`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSort(field as SortField)}
                              className={`flex w-full cursor-pointer select-none items-center gap-1 px-4 py-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.15em] ${
                                sortField === field ? 'text-ct' : 'text-mut hover:text-ink'
                              }`}
                            >
                              {label}
                              <SortIcon field={field as SortField} />
                            </button>
                          </th>
                        ))}
                        <th className="w-[10%] px-4 py-2.5 text-center font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleServers.map((server) => (
                        <tr
                          key={`${server.ip}:${server.port}`}
                          className={`cursor-pointer border-b border-edge/60 transition-colors hover:bg-panel-2 ${
                            VIP_IPS.includes(server.ip) ? 'border-l-2 border-l-hud bg-hud/[0.04]' : ''
                          }`}
                          onClick={() => setSelectedServer(server)}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex min-w-0 items-center">
                              <button
                                type="button"
                                className="min-w-0 truncate text-left text-sm font-medium text-ink"
                                title={server.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedServer(server);
                                }}
                              >
                                {filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name}
                              </button>
                              {VIP_IPS.includes(server.ip) && <VipTag />}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="truncate font-mono text-[13px] text-ink-2" title={server.map}>
                              {filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-mono text-sm text-ink">
                              {server.players}/{server.max_players}
                            </div>
                            <CapacityBar players={server.players} maxPlayers={server.max_players} />
                            {server.bots > 0 && (
                              <div className="mt-1 font-mono text-[11px] text-mut">
                                +{server.bots} bots
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-mono text-[13px] text-mut">
                              {server.ip}:{server.port}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center">
                              <CountryFlag countryCode={server.country} sprite />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <a
                              href={`steam://connect/${server.ip}:${server.port}`}
                              className={connectButtonClass}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Connect
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                </table>
              </div>
              )}

              {/* Mobile Card View */}
              {isDesktop !== true && (
              <div className="lg:hidden">
                {visibleServers.map((server) => (
                      <div
                        key={`${server.ip}:${server.port}`}
                        className={`cursor-pointer border-b border-edge/60 p-4 transition-colors active:bg-panel-2 ${
                          VIP_IPS.includes(server.ip) ? 'border-l-2 border-l-hud bg-hud/[0.04]' : ''
                        }`}
                        onClick={() => setSelectedServer(server)}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="mb-1 flex items-center">
                              <button
                                type="button"
                                className="min-w-0 truncate text-left text-sm font-semibold text-ink"
                                title={server.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedServer(server);
                                }}
                              >
                                {filters.stripSpecialChars ? stripSpecialChars(server.name) : server.name}
                              </button>
                              {VIP_IPS.includes(server.ip) && <VipTag />}
                            </h3>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="font-mono text-[13px] text-ink-2">
                                {filters.stripSpecialChars ? stripSpecialChars(server.map) : server.map}
                              </span>
                              <span className="flex items-center gap-1.5 text-mut">
                                <CountryFlag countryCode={server.country} sprite />
                                {server.country}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end text-right">
                            <div className="font-mono text-sm text-ink">
                              {server.players}/{server.max_players}
                            </div>
                            <CapacityBar players={server.players} maxPlayers={server.max_players} />
                            {server.bots > 0 && (
                              <div className="mt-1 font-mono text-[11px] text-mut">
                                +{server.bots} bots
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-xs text-mut">
                            {server.ip}:{server.port}
                          </div>
                          <a
                            href={`steam://connect/${server.ip}:${server.port}`}
                            className={connectButtonClass}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Connect
                          </a>
                        </div>
                      </div>
                ))}
              </div>
              )}
            </>
          )}
        </section>
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
