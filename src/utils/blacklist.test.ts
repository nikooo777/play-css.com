import { expect, test } from 'bun:test';
import {
  BLACKLIST_REFRESH_INTERVAL,
  formatBlacklistCount,
  isBlacklistCount,
  mergeBlacklistCount,
  runCoalescedBlacklistRefresh,
  startBlacklistCountPolling,
} from './blacklist';
import {
  type StatusPollingScheduler,
  type StatusPollingVisibility,
} from './backendStatus';

test('blacklist count validator accepts non-negative integers', () => {
  expect(isBlacklistCount({ count: 0 })).toBe(true);
  expect(isBlacklistCount({ count: 447 })).toBe(true);
});

test('blacklist count validator rejects malformed responses', () => {
  expect(isBlacklistCount(null)).toBe(false);
  expect(isBlacklistCount({})).toBe(false);
  expect(isBlacklistCount({ count: -1 })).toBe(false);
  expect(isBlacklistCount({ count: 1.5 })).toBe(false);
  expect(isBlacklistCount({ count: '447' })).toBe(false);
});

test('blacklist count updates preserve the last valid value', () => {
  expect(mergeBlacklistCount(null, { count: 447 })).toBe(447);
  expect(mergeBlacklistCount(447, { error: 'unavailable' })).toBe(447);
  expect(mergeBlacklistCount(447, { count: -1 })).toBe(447);
});

test('blacklist count formatting is deterministic', () => {
  expect(formatBlacklistCount(null)).toBe('—');
  expect(formatBlacklistCount(1_447)).toBe('1,447');
});

test('blacklist count polling starts immediately and repeats independently', () => {
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
  const visibility: StatusPollingVisibility = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
  };
  let refreshes = 0;

  const stop = startBlacklistCountPolling(
    () => {
      refreshes++;
    },
    scheduler,
    visibility
  );
  initial();
  repeated();
  stop();

  expect(initialDelay).toBe(0);
  expect(repeatedDelay).toBe(BLACKLIST_REFRESH_INTERVAL);
  expect(refreshes).toBe(2);
  expect(cleared).toEqual(['initial', 'repeated']);
});

test('overlapping blacklist count refreshes share one request', async () => {
  const state = { current: null as Promise<void> | null };
  let complete = () => {};
  let calls = 0;
  const refresh = () => {
    calls++;
    return new Promise<void>((resolve) => {
      complete = resolve;
    });
  };

  const first = runCoalescedBlacklistRefresh(state, refresh);
  const second = runCoalescedBlacklistRefresh(state, refresh);

  expect(second).toBe(first);
  expect(calls).toBe(1);
  complete();
  await first;
  await Promise.resolve();
  runCoalescedBlacklistRefresh(state, refresh);
  expect(calls).toBe(2);
  complete();
});

test('failed blacklist refreshes release the in-flight request', async () => {
  const state = { current: null as Promise<void> | null };
  const refreshError = new Error('refresh failed');

  const first = runCoalescedBlacklistRefresh(
    state,
    () => Promise.reject(refreshError)
  );
  await expect(first).rejects.toBe(refreshError);
  await Promise.resolve();
  const second = runCoalescedBlacklistRefresh(
    state,
    () => Promise.resolve()
  );

  expect(second).not.toBe(first);
  await second;
});
