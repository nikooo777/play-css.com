import {
  startVisibilityAwareBackendStatusPolling,
  type StatusPollingScheduler,
  type StatusPollingVisibility,
} from './backendStatus';

export interface BlacklistCount {
  count: number;
}

export interface BlacklistRefreshState {
  current: Promise<void> | null;
}

export const BLACKLIST_REFRESH_INTERVAL = 60_000;

const countFormatter = new Intl.NumberFormat('en-US');

export function isBlacklistCount(value: unknown): value is BlacklistCount {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const count = (value as Record<string, unknown>).count;
  return typeof count === 'number' && Number.isInteger(count) && count >= 0;
}

export function mergeBlacklistCount(
  current: number | null,
  value: unknown
): number | null {
  return isBlacklistCount(value) ? value.count : current;
}

export function formatBlacklistCount(count: number | null): string {
  return count === null ? '—' : countFormatter.format(count);
}

export function startBlacklistCountPolling<TTimeout, TInterval>(
  refresh: () => void,
  scheduler: StatusPollingScheduler<TTimeout, TInterval>,
  visibility: StatusPollingVisibility
): () => void {
  return startVisibilityAwareBackendStatusPolling(
    refresh,
    BLACKLIST_REFRESH_INTERVAL,
    scheduler,
    visibility
  );
}

export function runCoalescedBlacklistRefresh(
  state: BlacklistRefreshState,
  refresh: () => Promise<void>
): Promise<void> {
  if (state.current) {
    return state.current;
  }
  const request = refresh();
  state.current = request;
  const clear = () => {
    if (state.current === request) {
      state.current = null;
    }
  };
  void request.then(clear, clear);
  return request;
}
