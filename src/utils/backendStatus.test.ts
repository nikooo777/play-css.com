import { expect, test } from 'bun:test';
import { isBackendStatus, type BackendStatus } from './backendStatus';

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

  expect(isBackendStatus(nullMembership)).toBe(false);
  expect(isBackendStatus(invalidMonitorState)).toBe(false);
  expect(isBackendStatus(missingCount)).toBe(false);
  expect(isBackendStatus(invalidErrorCode)).toBe(false);
});
