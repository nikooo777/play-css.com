export const ERROR_RECOVERY_STORAGE_KEY = 'play-css:error-retry-count';
export const ERROR_RECOVERY_RESET_DELAY = 60_000;

const AUTOMATIC_RETRY_DELAYS = [5_000, 15_000, 30_000];

type RetryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function retryCount(storage: RetryStorage): number {
  const count = Number(storage.getItem(ERROR_RECOVERY_STORAGE_KEY));
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

export function automaticRetryDelay(storage: RetryStorage): number | null {
  return AUTOMATIC_RETRY_DELAYS[retryCount(storage)] ?? null;
}

export function recordAutomaticRetry(storage: RetryStorage): void {
  storage.setItem(
    ERROR_RECOVERY_STORAGE_KEY,
    String(retryCount(storage) + 1)
  );
}

export function clearAutomaticRetries(storage: RetryStorage): void {
  storage.removeItem(ERROR_RECOVERY_STORAGE_KEY);
}
