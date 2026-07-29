'use client';

import { useEffect, useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { ServerModal } from './ServerModal';
import { AdminPanel } from './AdminPanel';
import { BlacklistModal } from './BlacklistModal';
import { CountryPreference } from './CountryPreference';
import { FavoritesSection } from './FavoritesSection';
import { CapacityBar } from '@/components/CapacityBar';
import { CountryFlag, CountryFlagDefs } from '@/components/CountryFlag';
import { FavoriteButton } from '@/components/FavoriteButton';
import { useFavorites } from '@/utils/useFavorites';
import { serverAddress, updateFavoriteNames } from '@/utils/favorites';
import {
  detectCurrentCountry,
  getCountryName,
  normalizeCountryCode,
  type LocationRequestState,
} from '@/utils/geolocation';
import {
  isServerList,
  processServers,
  stripSpecialChars,
  type Server,
  type ServerFilters,
  type SortDirection,
  type SortField,
} from '@/utils/servers';
import { clearLegacyAdminCookie } from '@/utils/auth';
import {
  isBackendStatus,
  startVisibilityAwareBackendStatusPolling,
  type BackendStatus,
  type StatusPollingScheduler,
} from '@/utils/backendStatus';
import {
  clearAutomaticRetries,
  ERROR_RECOVERY_RESET_DELAY,
} from '@/utils/errorRecovery';

type ToggleFilter = 'noBots' | 'hideRussian' | 'stripSpecialChars';

// Constants
const REFRESH_INTERVAL = 30_000;
const STATUS_REFRESH_INTERVAL = 5_000;

// Shared styles
const fieldClass = 'w-full h-10 px-3 rounded-[3px] border border-edge-2 bg-field text-sm text-ink placeholder:text-mut/60 focus:border-ct focus:outline-none';
const labelClass = 'block font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut mb-1.5';
const ghostButtonClass = 'inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider text-mut hover:text-ink border border-edge hover:border-edge-2 bg-panel rounded-[3px] px-3 py-2 transition-colors';
const blacklistButtonClass = 'inline-flex items-center gap-2 rounded-[3px] border border-tr/60 bg-tr/10 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider text-tr transition-colors hover:bg-tr hover:text-bg';
const connectButtonClass = 'inline-flex items-center font-display text-[11px] font-semibold uppercase tracking-wider text-hud border border-hud/60 hover:bg-hud hover:text-bg rounded-[2px] px-3 py-1.5 transition-colors';

// Rows sent in the server-rendered HTML; the rest mount right after hydration
const SSR_ROW_LIMIT = 120;

const DESKTOP_QUERY = '(min-width: 1024px)';

const browserStatusPollingScheduler: StatusPollingScheduler<
  ReturnType<typeof setTimeout>,
  ReturnType<typeof setInterval>
> = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (handle) => clearInterval(handle),
};

export function serverListStatusText(
  status: BackendStatus | null,
  syncFailed: boolean,
  isRefreshing: boolean
): string {
  if (status?.membership.degraded) {
    return '> membership degraded — showing last browser result';
  }
  if (syncFailed) {
    return '> sync failed — retrying in 30s';
  }
  if (status?.error_code === 'monitor_failed') {
    return '> live refresh failed — using current list';
  }
  if (status?.error_code === 'monitor_inconclusive') {
    return '> live refresh inconclusive — using current list';
  }
  if (
    status?.error_code === 'fetch_failed' ||
    status?.error_code === 'fetch_preflight_failed'
  ) {
    return '> discovery failed — using current list';
  }
  if (status?.snapshot.source === 'persisted') {
    if (status.monitor.state === 'running') {
      return `> saved snapshot — live refresh ${status.monitor.completed_count.toLocaleString()}/${status.monitor.eligible_count.toLocaleString()}`;
    }
    return '> saved snapshot — awaiting live refresh';
  }
  if (isRefreshing) {
    return '> syncing server list…';
  }
  return '> live — auto-refresh 30s';
}

export function shouldRefreshServerList(
  previousSource: BackendStatus['snapshot']['source'] | undefined,
  previousAvailable: boolean | undefined,
  status: BackendStatus | null,
  serverCount: number
): boolean {
  return (
    (previousSource === 'persisted' && status?.snapshot.source === 'live') ||
    Boolean(
      previousAvailable !== true &&
      status?.snapshot.available &&
      status.snapshot.server_count !== serverCount
    )
  );
}

export function initialSnapshotAvailability(
  status: BackendStatus | null,
  serverCount: number
): boolean | undefined {
  if (!status) {
    return undefined;
  }
  return status.snapshot.available &&
    status.snapshot.server_count === serverCount;
}

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

export function ServerBrowserClient({
  initialServers,
  initialStatus,
  initialServerListAvailable,
  vipIps,
}: {
  initialServers: Server[];
  initialStatus: BackendStatus | null;
  initialServerListAvailable: boolean;
  vipIps: string[];
}) {
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
  const [countryPreferenceEnabled, setCountryPreferenceEnabled] = useState(false);
  const [locationState, setLocationState] = useState<LocationRequestState>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(initialStatus);
  const [serverListAvailable, setServerListAvailable] = useState(initialServerListAvailable);
  const [filtersEl, setFiltersEl] = useState<HTMLElement | null>(null);
  const [filtersHeight, setFiltersHeight] = useState(0);
  const isDesktop = useIsDesktop();
  const { favoriteAddresses, toggleFavorite } = useFavorites();
  const [showFullList, setShowFullList] = useState(false);
  const locationRequestId = useRef(0);
  const serversRef = useRef(initialServers);
  const fetchRequestId = useRef(0);
  const activeFetchCount = useRef(0);
  const backendStatusRef = useRef(initialStatus);
  const snapshotSourceRef = useRef(initialStatus?.snapshot.source);
  const snapshotAvailableRef = useRef(
    initialSnapshotAvailability(initialStatus, initialServers.length)
  );
  const statusRefreshRef = useRef<Promise<BackendStatus | null> | null>(null);

  // One-time cleanup of the pre-sessionStorage credential cookie
  useEffect(() => {
    clearLegacyAdminCookie();
  }, []);

  useEffect(() => {
    const reset = setTimeout(
      () => clearAutomaticRetries(window.sessionStorage),
      ERROR_RECOVERY_RESET_DELAY
    );
    return () => clearTimeout(reset);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowFullList(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    updateFavoriteNames(serversRef.current);
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

  const handleCloseBlacklistModal = useCallback(() => {
    setShowBlacklistModal(false);
  }, []);

  const handleCloseServerModal = useCallback(() => {
    setSelectedServer(null);
  }, []);

  const refreshStatus = useCallback((): Promise<BackendStatus | null> => {
    if (statusRefreshRef.current) {
      return statusRefreshRef.current;
    }

    const request = (async () => {
      try {
        const response = await fetch('/api/status', {
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          return null;
        }
        const value: unknown = await response.json();
        if (!isBackendStatus(value)) {
          return null;
        }
        backendStatusRef.current = value;
        setBackendStatus(value);
        return value;
      } catch {
        return null;
      }
    })();

    statusRefreshRef.current = request;
    void request.finally(() => {
      if (statusRefreshRef.current === request) {
        statusRefreshRef.current = null;
      }
    });
    return request;
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
      if (response.status === 503) {
        await refreshStatus();
        if (fetchRequestId.current !== requestId) return;
        setError(null);
        setSyncFailed(true);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch servers');
      const data: unknown = await response.json();
      if (!isServerList(data)) {
        throw new Error('Invalid server response');
      }

      if (fetchRequestId.current !== requestId) return;

      serversRef.current = data;
      setServers(data);
      setServerListAvailable(true);
      setError(null);
      setSyncFailed(false);
      updateFavoriteNames(data);
      await refreshStatus();
    } catch (err) {
      if (fetchRequestId.current !== requestId) return;

      const refreshedStatus = await refreshStatus();
      if (fetchRequestId.current !== requestId) return;
      const effectiveStatus = refreshedStatus ?? backendStatusRef.current;
      if (
        serversRef.current.length === 0 &&
        effectiveStatus?.state !== 'ready'
      ) {
        setError(null);
        setSyncFailed(true);
      } else if (!isBackgroundRefresh || serversRef.current.length === 0) {
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
  }, [refreshStatus]);

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

  useEffect(() => {
    return startVisibilityAwareBackendStatusPolling(
      () => {
        void refreshStatus();
      },
      STATUS_REFRESH_INTERVAL,
      browserStatusPollingScheduler,
      document
    );
  }, [refreshStatus]);

  useEffect(() => {
    if (!error) {
      return;
    }

    let retry: ReturnType<typeof setTimeout> | null = null;
    const cancelRetry = () => {
      if (retry !== null) {
        clearTimeout(retry);
        retry = null;
      }
    };
    const scheduleRetry = () => {
      cancelRetry();
      if (document.visibilityState !== 'visible') {
        return;
      }
      retry = setTimeout(
        () => fetchServers(false),
        STATUS_REFRESH_INTERVAL
      );
    };

    document.addEventListener('visibilitychange', scheduleRetry);
    scheduleRetry();
    return () => {
      document.removeEventListener('visibilitychange', scheduleRetry);
      cancelRetry();
    };
  }, [error, fetchServers]);

  useEffect(() => {
    const source = backendStatus?.snapshot.source;
    const previousSource = snapshotSourceRef.current;
    const previousAvailable = snapshotAvailableRef.current;
    snapshotSourceRef.current = source;
    snapshotAvailableRef.current = backendStatus?.snapshot.available;
    if (
      !shouldRefreshServerList(
        previousSource,
        previousAvailable,
        backendStatus,
        serversRef.current.length
      )
    ) {
      return;
    }
    const refresh = setTimeout(() => fetchServers(false), 0);
    return () => clearTimeout(refresh);
  }, [backendStatus, fetchServers]);

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

  const handleCountryPreferenceToggle = useCallback((checked: boolean) => {
    setCountryPreferenceEnabled(checked);

    if (!checked) {
      locationRequestId.current += 1;
      setCountryPreference('');
      setLocationState('idle');
      setLocationError(null);
    }
  }, []);

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

  if (!error && servers.length === 0 && !serverListAvailable) {
    const degraded = backendStatus?.state === 'degraded';
    const ready = backendStatus?.state === 'ready';
    const completed = backendStatus?.monitor.completed_count ?? 0;
    const eligible = backendStatus?.monitor.eligible_count ?? 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-8">
        <div className="max-w-md text-center">
          <p className={`font-mono text-sm ${degraded ? 'text-tr' : 'text-hud'}`}>
            {degraded
              ? '] server list temporarily unavailable'
              : ready
                ? '] loading current server list'
                : '] warming up server list'}
            {!degraded && <span className="cursor-blink">_</span>}
          </p>
          <p className="mt-2 text-sm text-mut">
            {backendStatus?.membership.degraded
              ? 'Membership authority could not be verified. The browser will recover automatically after synchronization succeeds.'
              : ready
                ? 'A backend snapshot is ready. The browser is fetching the current server list.'
              : backendStatus
                ? 'The backend is checking Counter-Strike: Source servers. This page will update automatically.'
                : 'Backend status is unavailable. The browser will keep checking and update automatically.'}
          </p>
          {eligible > 0 && (
            <p className="mt-3 font-mono text-xs text-mut">
              {completed.toLocaleString()} / {eligible.toLocaleString()} queries complete
            </p>
          )}
          {degraded && (
            <button
              onClick={handleRetry}
              className="mt-5 rounded-[2px] border border-hud/60 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-hud transition-colors hover:bg-hud hover:text-bg"
            >
              Retry now
            </button>
          )}
        </div>
        <div className="w-full max-w-xl">
          <FavoritesSection
            servers={[]}
            authoritative={false}
            cleanNames={filters.stripSpecialChars}
          />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-8">
        <div className="max-w-sm text-center">
          <p className="font-mono text-sm text-hud">
            ] reconnecting to server list<span className="cursor-blink">_</span>
          </p>
          <p className="mt-2 text-sm text-mut">
            The connection was interrupted. This page will retry automatically.
          </p>
          <button
            onClick={handleRetry}
            className="mt-5 rounded-[2px] border border-hud/60 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-hud transition-colors hover:bg-hud hover:text-bg"
          >
            Retry now
          </button>
        </div>
        <div className="w-full max-w-xl">
          <FavoritesSection
            servers={[]}
            authoritative={false}
            cleanNames={filters.stripSpecialChars}
          />
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
            <a
              href="https://github.com/nikooo777/play-css.com"
              target="_blank"
              rel="noreferrer"
              className={ghostButtonClass}
              title="View source code on GitHub"
              aria-label="View source code on GitHub"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.61-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 7.7a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <button
              type="button"
              onClick={() => setShowBlacklistModal(true)}
              className={blacklistButtonClass}
              title="Blacklist installation instructions"
              aria-label="Open blacklist installation instructions"
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
            <span
              aria-live="polite"
              className={
                backendStatus?.membership.degraded ||
                syncFailed ||
                backendStatus?.error_code === 'monitor_failed' ||
                backendStatus?.error_code === 'monitor_inconclusive' ||
                backendStatus?.error_code === 'fetch_failed' ||
                backendStatus?.error_code === 'fetch_preflight_failed'
                  ? 'text-tr'
                  : 'text-mut'
              }
            >
              {serverListStatusText(backendStatus, syncFailed, isRefreshing)}
            </span>
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
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  className="hud-check"
                  checked={countryPreferenceEnabled}
                  onChange={(event) => handleCountryPreferenceToggle(event.target.checked)}
                />
                <span className="select-none text-sm text-ink-2">Country preference</span>
              </label>
            </div>
          </div>
          {countryPreferenceEnabled && (
            <CountryPreference
              countryCodes={countryCodes}
              error={locationError}
              state={locationState}
              value={countryPreference}
              onChange={handleCountryPreference}
              onLocate={handleUseLocation}
            />
          )}
        </section>

        <FavoritesSection
          servers={servers}
          authoritative={serverListAvailable && !syncFailed}
          cleanNames={filters.stripSpecialChars}
          onSelectServer={setSelectedServer}
        />

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
                        <th className="w-[4%] px-2 py-2.5">
                          <span className="sr-only">Favorite</span>
                        </th>
                        {[
                          { field: 'name', label: 'Server Name', width: 'w-[31%]' },
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
                            vipIps.includes(server.ip) ? 'border-l-2 border-l-hud bg-hud/[0.04]' : ''
                          }`}
                          onClick={() => setSelectedServer(server)}
                        >
                          <td className="px-2 py-2.5 text-center">
                            <FavoriteButton
                              address={serverAddress(server)}
                              name={server.name}
                              isFavorite={favoriteAddresses.has(serverAddress(server))}
                              onToggle={toggleFavorite}
                            />
                          </td>
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
                              {vipIps.includes(server.ip) && <VipTag />}
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
                          vipIps.includes(server.ip) ? 'border-l-2 border-l-hud bg-hud/[0.04]' : ''
                        }`}
                        onClick={() => setSelectedServer(server)}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="mb-1 flex items-center gap-1.5">
                              <FavoriteButton
                                address={serverAddress(server)}
                                name={server.name}
                                isFavorite={favoriteAddresses.has(serverAddress(server))}
                                onToggle={toggleFavorite}
                                className="-ml-1"
                              />
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
                              {vipIps.includes(server.ip) && <VipTag />}
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

      <BlacklistModal
        isOpen={showBlacklistModal}
        onClose={handleCloseBlacklistModal}
      />

      {/* Admin Panel */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={handleCloseAdminPanel}
      />
    </div>
  );
}
