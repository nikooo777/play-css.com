export type BackendState = 'starting' | 'warming' | 'ready' | 'degraded';
export type SnapshotSource = 'none' | 'persisted' | 'live';
export type MonitorState = 'idle' | 'queued' | 'running' | 'succeeded' | 'inconclusive' | 'failed';
export type FetchState = 'not_started' | 'disabled' | 'running' | 'succeeded' | 'failed';
export type BackendErrorCode =
  | 'membership_degraded'
  | 'snapshot_unavailable'
  | 'monitor_failed'
  | 'monitor_inconclusive'
  | 'fetch_preflight_failed'
  | 'fetch_failed';

export interface BackendStatus {
  state: BackendState;
  process_started_at: string;
  error_code: BackendErrorCode | null;
  membership: {
    ready: boolean;
    degraded: boolean;
    epoch: string;
    published_at: string | null;
  };
  snapshot: {
    available: boolean;
    source: SnapshotSource;
    published_at: string | null;
    age_seconds: number | null;
    server_count: number;
    format_version: number | null;
  };
  monitor: {
    state: MonitorState;
    started_at: string | null;
    completed_at: string | null;
    eligible_count: number;
    completed_count: number;
    conclusive_count: number;
    inconclusive_count: number;
    candidate_count: number;
    complete_coverage: boolean;
    last_successful_at: string | null;
    last_duration_ms: number | null;
  };
  fetch: {
    state: FetchState;
    started_at: string | null;
    completed_at: string | null;
  };
}

const backendStates: BackendState[] = ['starting', 'warming', 'ready', 'degraded'];
const snapshotSources: SnapshotSource[] = ['none', 'persisted', 'live'];
const monitorStates: MonitorState[] = [
  'idle',
  'queued',
  'running',
  'succeeded',
  'inconclusive',
  'failed',
];
const fetchStates: FetchState[] = [
  'not_started',
  'disabled',
  'running',
  'succeeded',
  'failed',
];
const backendErrorCodes: BackendErrorCode[] = [
  'membership_degraded',
  'snapshot_unavailable',
  'monitor_failed',
  'monitor_inconclusive',
  'fetch_preflight_failed',
  'fetch_failed',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isBackendErrorCode(
  value: unknown
): value is BackendErrorCode | null {
  return value === null ||
    backendErrorCodes.includes(value as BackendErrorCode);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

export function isBackendStatus(value: unknown): value is BackendStatus {
  if (!isRecord(value)) {
    return false;
  }
  const membership = value.membership;
  const snapshot = value.snapshot;
  const monitor = value.monitor;
  const fetch = value.fetch;
  if (
    !isRecord(membership) ||
    !isRecord(snapshot) ||
    !isRecord(monitor) ||
    !isRecord(fetch)
  ) {
    return false;
  }
  return (
    backendStates.includes(value.state as BackendState) &&
    typeof value.process_started_at === 'string' &&
    isBackendErrorCode(value.error_code) &&
    typeof membership.ready === 'boolean' &&
    typeof membership.degraded === 'boolean' &&
    typeof membership.epoch === 'string' &&
    isNullableString(membership.published_at) &&
    typeof snapshot.available === 'boolean' &&
    snapshotSources.includes(snapshot.source as SnapshotSource) &&
    isNullableString(snapshot.published_at) &&
    isNullableNonNegativeInteger(snapshot.age_seconds) &&
    isNonNegativeInteger(snapshot.server_count) &&
    (snapshot.format_version === null || snapshot.format_version === 1) &&
    monitorStates.includes(monitor.state as MonitorState) &&
    isNullableString(monitor.started_at) &&
    isNullableString(monitor.completed_at) &&
    isNonNegativeInteger(monitor.eligible_count) &&
    isNonNegativeInteger(monitor.completed_count) &&
    isNonNegativeInteger(monitor.conclusive_count) &&
    isNonNegativeInteger(monitor.inconclusive_count) &&
    isNonNegativeInteger(monitor.candidate_count) &&
    typeof monitor.complete_coverage === 'boolean' &&
    isNullableString(monitor.last_successful_at) &&
    isNullableNonNegativeInteger(monitor.last_duration_ms) &&
    fetchStates.includes(fetch.state as FetchState) &&
    isNullableString(fetch.started_at) &&
    isNullableString(fetch.completed_at)
  );
}

export interface StatusPollingScheduler<TTimeout, TInterval> {
  setTimeout: (callback: () => void, delay: number) => TTimeout;
  clearTimeout: (handle: TTimeout) => void;
  setInterval: (callback: () => void, delay: number) => TInterval;
  clearInterval: (handle: TInterval) => void;
}

export interface StatusPollingVisibility {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener: (
    type: 'visibilitychange',
    listener: () => void
  ) => void;
  removeEventListener: (
    type: 'visibilitychange',
    listener: () => void
  ) => void;
}

export function startBackendStatusPolling<TTimeout, TInterval>(
  refreshStatus: () => void,
  intervalMS: number,
  scheduler: StatusPollingScheduler<TTimeout, TInterval>
): () => void {
  const initial = scheduler.setTimeout(refreshStatus, 0);
  const interval = scheduler.setInterval(refreshStatus, intervalMS);
  return () => {
    scheduler.clearTimeout(initial);
    scheduler.clearInterval(interval);
  };
}

export function startVisibilityAwareBackendStatusPolling<TTimeout, TInterval>(
  refreshStatus: () => void,
  intervalMS: number,
  scheduler: StatusPollingScheduler<TTimeout, TInterval>,
  visibility: StatusPollingVisibility
): () => void {
  let stopPolling: (() => void) | null = null;

  const synchronizePolling = () => {
    if (visibility.visibilityState === 'visible') {
      stopPolling ??= startBackendStatusPolling(
        refreshStatus,
        intervalMS,
        scheduler
      );
      return;
    }
    stopPolling?.();
    stopPolling = null;
  };

  visibility.addEventListener('visibilitychange', synchronizePolling);
  synchronizePolling();

  return () => {
    visibility.removeEventListener('visibilitychange', synchronizePolling);
    stopPolling?.();
  };
}
