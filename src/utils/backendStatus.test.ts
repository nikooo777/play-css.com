import { expect, test } from 'bun:test';
import {
  isBackendStatus,
  startVisibilityAwareBackendStatusPolling,
  type BackendStatus,
  type StatusPollingScheduler,
  type StatusPollingVisibility,
} from './backendStatus';

function validRules(): BackendStatus['monitor']['rules'] {
  const causes = {
    confirmation: 1,
    positive_player_count_mismatch: 2,
    connection_cadence: 3,
    new_endpoint: 4,
    ttl_refresh: 5,
  };
  return {
    probe_mode: 'enabled',
    candidates_by_cause: { ...causes },
    selected_by_cause: { ...causes },
    network_attempts_started_by_cause: { ...causes },
    deferred_by_cause: { ...causes },
    attempted_count: 14,
    successful_count: 12,
    failed_count: 2,
    count_conflation_match_count: 3,
    explicit_producer_match_count: 2,
    cadence_match_count: 1,
    combined_match_count: 1,
    observe_only_finding_count: 2,
    enforce_eligible_finding_count: 1,
  };
}

function validStatus(): BackendStatus {
  return {
    state: 'warming',
    process_started_at: '2026-07-29T12:00:00Z',
    error_code: 'snapshot_unavailable',
    membership: {
      ready: true,
      degraded: false,
      epoch: '1',
      published_at: '2026-07-29T12:00:01Z',
    },
    snapshot: {
      available: false,
      source: 'none',
      published_at: null,
      age_seconds: null,
      server_count: 0,
      format_version: null,
    },
    monitor: {
      state: 'running',
      started_at: '2026-07-29T12:00:02Z',
      completed_at: null,
      eligible_count: 100,
      completed_count: 25,
      conclusive_count: 24,
      inconclusive_count: 1,
      candidate_count: 100,
      complete_coverage: false,
      last_successful_at: null,
      last_duration_ms: null,
      rules: validRules(),
    },
    fetch: {
      state: 'disabled',
      started_at: null,
      completed_at: null,
    },
  };
}

test('backend status validator accepts the complete contract', () => {
  expect(isBackendStatus(validStatus())).toBe(true);
});

test('backend status validator accepts optional identity counters and rejects invalid values', () => {
  const status = validStatus();
  status.monitor.rules.identity_attempted_count = 3;
  status.monitor.rules.identity_successful_count = 2;
  status.monitor.rules.identity_match_count = 1;
  expect(isBackendStatus(status)).toBe(true);
  status.monitor.rules.identity_match_count = -1;
  expect(isBackendStatus(status)).toBe(false);
});

test('backend status validator rejects malformed nested state', () => {
  const nullMembership = {
    ...validStatus(),
    membership: null,
  };
  const invalidMonitorState = {
    ...validStatus(),
    monitor: {
      ...validStatus().monitor,
      state: 'complete',
    },
  };
  const missingCount = {
    ...validStatus(),
    snapshot: {
      ...validStatus().snapshot,
      server_count: undefined,
    },
  };
  const invalidErrorCode = {
    ...validStatus(),
    error_code: 'database_connection_failed',
  };
  const missingRulesCount = {
    ...validStatus(),
    monitor: {
      ...validStatus().monitor,
      rules: {
        ...validRules(),
        successful_count: undefined,
      },
    },
  };

  expect(isBackendStatus(nullMembership)).toBe(false);
  expect(isBackendStatus(invalidMonitorState)).toBe(false);
  expect(isBackendStatus(missingCount)).toBe(false);
  expect(isBackendStatus(invalidErrorCode)).toBe(false);
  expect(isBackendStatus(missingRulesCount)).toBe(false);
});

test('status polling pauses while the tab is hidden', () => {
  let visibilityState: DocumentVisibilityState = 'visible';
  let visibilityListener = () => {};
  const visibility: StatusPollingVisibility = {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener(_type, listener) {
      visibilityListener = listener;
    },
    removeEventListener(_type, listener) {
      if (visibilityListener === listener) {
        visibilityListener = () => {};
      }
    },
  };
  const started: string[] = [];
  const cleared: string[] = [];
  const scheduler: StatusPollingScheduler<string, string> = {
    setTimeout() {
      const handle = `timeout-${started.length}`;
      started.push(handle);
      return handle;
    },
    clearTimeout(handle) {
      cleared.push(handle);
    },
    setInterval() {
      const handle = `interval-${started.length}`;
      started.push(handle);
      return handle;
    },
    clearInterval(handle) {
      cleared.push(handle);
    },
  };

  const stop = startVisibilityAwareBackendStatusPolling(
    () => {},
    5_000,
    scheduler,
    visibility
  );
  visibilityState = 'hidden';
  visibilityListener();
  visibilityState = 'visible';
  visibilityListener();
  stop();

  expect(started).toEqual([
    'timeout-0',
    'interval-1',
    'timeout-2',
    'interval-3',
  ]);
  expect(cleared).toEqual(started);
});
