import { afterEach, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from './page';
import {
  startBackendStatusPolling,
  type BackendStatus,
  type StatusPollingScheduler,
} from '@/utils/backendStatus';
import {
  initialSnapshotAvailability,
  serverListStatusText,
  shouldRefreshServerList,
} from './servers/client';

const originalFetch = globalThis.fetch;
const originalVipIps = process.env.VIP_IPS;

function statusRules(): BackendStatus['monitor']['rules'] {
  const causes = {
    confirmation: 0,
    positive_player_count_mismatch: 0,
    connection_cadence: 0,
    new_endpoint: 0,
    ttl_refresh: 0,
  };
  return {
    probe_mode: 'enabled',
    candidates_by_cause: { ...causes },
    selected_by_cause: { ...causes },
    network_attempts_started_by_cause: { ...causes },
    deferred_by_cause: { ...causes },
    attempted_count: 0,
    successful_count: 0,
    failed_count: 0,
    count_conflation_match_count: 0,
    explicit_producer_match_count: 0,
    cadence_match_count: 0,
    combined_match_count: 0,
    observe_only_finding_count: 0,
    enforce_eligible_finding_count: 0,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalVipIps === undefined) {
    delete process.env.VIP_IPS;
  } else {
    process.env.VIP_IPS = originalVipIps;
  }
});

test('backend 503 renders the client with warm-up status', async () => {
  const status: BackendStatus = {
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
      rules: statusRules(),
    },
    fetch: {
      state: 'disabled',
      started_at: null,
      completed_at: null,
    },
  };
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = input.toString();
    if (url.endsWith('/servers')) {
      return Response.json(
        { error: 'snapshot_unavailable', status_url: '/status' },
        { status: 503 }
      );
    }
    return Response.json(status);
  }) as unknown as typeof fetch;

  const page = await Home();
  const markup = renderToStaticMarkup(page);

  expect(page.props.initialServers).toEqual([]);
  expect(page.props.initialStatus).toEqual(status);
  expect(page.props.initialServerListAvailable).toBe(false);
  expect(markup).toContain('warming up server list');
  expect(markup).toContain('25 / 100 queries complete');
});

test('status polling starts immediately and repeats', () => {
  let initial = () => {};
  let repeated = () => {};
  let initialDelay = -1;
  let repeatedDelay = -1;
  const cleared: string[] = [];
  const scheduler: StatusPollingScheduler<string, string> = {
    setTimeout(callback, delay) {
      initial = callback;
      initialDelay = delay;
      return 'initial';
    },
    clearTimeout(handle) {
      cleared.push(handle);
    },
    setInterval(callback, delay) {
      repeated = callback;
      repeatedDelay = delay;
      return 'repeated';
    },
    clearInterval(handle) {
      cleared.push(handle);
    },
  };
  let refreshes = 0;

  const stop = startBackendStatusPolling(
    () => {
      refreshes += 1;
    },
    5_000,
    scheduler
  );
  initial();
  repeated();
  stop();

  expect(initialDelay).toBe(0);
  expect(repeatedDelay).toBe(5_000);
  expect(refreshes).toBe(2);
  expect(cleared).toEqual(['initial', 'repeated']);
});

test('503 followed by ready nonempty status refreshes the list immediately', async () => {
  const status: BackendStatus = {
    state: 'ready',
    process_started_at: '2026-07-29T12:00:00Z',
    error_code: null,
    membership: {
      ready: true,
      degraded: false,
      epoch: '1',
      published_at: '2026-07-29T12:00:01Z',
    },
    snapshot: {
      available: true,
      source: 'live',
      published_at: '2026-07-29T12:00:02Z',
      age_seconds: 0,
      server_count: 1,
      format_version: 1,
    },
    monitor: {
      state: 'succeeded',
      started_at: '2026-07-29T12:00:01Z',
      completed_at: '2026-07-29T12:00:02Z',
      eligible_count: 1,
      completed_count: 1,
      conclusive_count: 1,
      inconclusive_count: 0,
      candidate_count: 1,
      complete_coverage: true,
      last_successful_at: '2026-07-29T12:00:02Z',
      last_duration_ms: 1_000,
      rules: statusRules(),
    },
    fetch: {
      state: 'disabled',
      started_at: null,
      completed_at: null,
    },
  };
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (input.toString().endsWith('/servers')) {
      return Response.json(
        { error: 'snapshot_unavailable', status_url: '/status' },
        { status: 503 }
      );
    }
    return Response.json(status);
  }) as unknown as typeof fetch;

  const page = await Home();
  const markup = renderToStaticMarkup(page);
  const previousAvailable = initialSnapshotAvailability(
    page.props.initialStatus,
    page.props.initialServers.length
  );

  expect(page.props.initialServers).toEqual([]);
  expect(page.props.initialStatus).toEqual(status);
  expect(page.props.initialServerListAvailable).toBe(false);
  expect(markup).toContain('loading current server list');
  expect(markup).not.toContain('0 servers match');
  expect(previousAvailable).toBe(false);
  expect(
    shouldRefreshServerList(
      page.props.initialStatus.snapshot.source,
      previousAvailable,
      page.props.initialStatus,
      page.props.initialServers.length
    )
  ).toBe(true);
});

test('authoritative empty response renders when status is unavailable', async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (input.toString().endsWith('/servers')) {
      return Response.json([]);
    }
    return Response.json(
      { error: 'Backend status unavailable' },
      { status: 502 }
    );
  }) as unknown as typeof fetch;

  const page = await Home();
  const markup = renderToStaticMarkup(page);

  expect(page.props.initialServers).toEqual([]);
  expect(page.props.initialStatus).toBeNull();
  expect(page.props.initialServerListAvailable).toBe(true);
  expect(markup).toContain('Servers online');
  expect(markup).not.toContain('warming up server list');
});

test('VIP addresses are normalized from runtime configuration', async () => {
  process.env.VIP_IPS = ' 54.37.245.51,1.1.1.1,54.37.245.51 ';
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (input.toString().endsWith('/servers')) {
      return Response.json([]);
    }
    return Response.json(
      { error: 'Backend status unavailable' },
      { status: 502 }
    );
  }) as unknown as typeof fetch;

  const page = await Home();

  expect(page.props.vipIps).toEqual(['54.37.245.51', '1.1.1.1']);
});

test('server response parsing errors reach the error boundary', async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (!input.toString().endsWith('/servers')) {
      return Response.json(
        { error: 'Backend status unavailable' },
        { status: 502 }
      );
    }
    return {
      ok: true,
      json() {
        throw new TypeError('parser bug');
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;

  expect(Home()).rejects.toThrow('parser bug');
});

test('live transition refreshes a persisted browser list', () => {
  const liveStatus = {
    state: 'ready',
    process_started_at: '2026-07-29T12:00:00Z',
    error_code: null,
    membership: {
      ready: true,
      degraded: false,
      epoch: '1',
      published_at: '2026-07-29T12:00:01Z',
    },
    snapshot: {
      available: true,
      source: 'live',
      published_at: '2026-07-29T12:01:00Z',
      age_seconds: 0,
      server_count: 1,
      format_version: 1,
    },
    monitor: {
      state: 'succeeded',
      started_at: '2026-07-29T12:00:02Z',
      completed_at: '2026-07-29T12:01:00Z',
      eligible_count: 1,
      completed_count: 1,
      conclusive_count: 1,
      inconclusive_count: 0,
      candidate_count: 1,
      complete_coverage: true,
      last_successful_at: '2026-07-29T12:01:00Z',
      last_duration_ms: 58_000,
      rules: statusRules(),
    },
    fetch: {
      state: 'disabled',
      started_at: null,
      completed_at: null,
    },
  } satisfies BackendStatus;

  expect(shouldRefreshServerList('persisted', true, liveStatus, 1)).toBe(true);
  expect(shouldRefreshServerList('live', true, liveStatus, 1)).toBe(false);
});

test('authoritative empty snapshot does not require a list refresh', () => {
  const liveStatus = {
    state: 'ready',
    process_started_at: '2026-07-29T12:00:00Z',
    error_code: null,
    membership: {
      ready: true,
      degraded: false,
      epoch: '1',
      published_at: '2026-07-29T12:00:01Z',
    },
    snapshot: {
      available: true,
      source: 'live',
      published_at: '2026-07-29T12:01:00Z',
      age_seconds: 0,
      server_count: 0,
      format_version: 1,
    },
    monitor: {
      state: 'succeeded',
      started_at: '2026-07-29T12:00:02Z',
      completed_at: '2026-07-29T12:01:00Z',
      eligible_count: 0,
      completed_count: 0,
      conclusive_count: 0,
      inconclusive_count: 0,
      candidate_count: 0,
      complete_coverage: true,
      last_successful_at: '2026-07-29T12:01:00Z',
      last_duration_ms: 58_000,
      rules: statusRules(),
    },
    fetch: {
      state: 'disabled',
      started_at: null,
      completed_at: null,
    },
  } satisfies BackendStatus;

  expect(shouldRefreshServerList('none', false, liveStatus, 0)).toBe(false);
  expect(shouldRefreshServerList('live', true, liveStatus, 0)).toBe(false);
});

test('usable snapshot reports monitor failures', () => {
  const status = {
    state: 'ready',
    process_started_at: '2026-07-29T12:00:00Z',
    error_code: 'monitor_failed',
    membership: {
      ready: true,
      degraded: false,
      epoch: '1',
      published_at: '2026-07-29T12:00:01Z',
    },
    snapshot: {
      available: true,
      source: 'live',
      published_at: '2026-07-29T12:00:30Z',
      age_seconds: 30,
      server_count: 1,
      format_version: 1,
    },
    monitor: {
      state: 'failed',
      started_at: '2026-07-29T12:00:31Z',
      completed_at: '2026-07-29T12:01:00Z',
      eligible_count: 1,
      completed_count: 1,
      conclusive_count: 0,
      inconclusive_count: 1,
      candidate_count: 1,
      complete_coverage: false,
      last_successful_at: null,
      last_duration_ms: 29_000,
      rules: statusRules(),
    },
    fetch: {
      state: 'disabled',
      started_at: null,
      completed_at: null,
    },
  } satisfies BackendStatus;

  expect(serverListStatusText(status, false, false)).toContain(
    'live refresh failed'
  );
});
