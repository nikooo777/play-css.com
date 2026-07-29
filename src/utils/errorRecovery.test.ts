import { expect, test } from 'bun:test';
import {
  automaticRetryDelay,
  clearAutomaticRetries,
  ERROR_RECOVERY_STORAGE_KEY,
  recordAutomaticRetry,
} from './errorRecovery';

function retryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

test('automatic recovery uses bounded backoff', () => {
  const storage = retryStorage();

  expect(automaticRetryDelay(storage)).toBe(5_000);
  recordAutomaticRetry(storage);
  expect(automaticRetryDelay(storage)).toBe(15_000);
  recordAutomaticRetry(storage);
  expect(automaticRetryDelay(storage)).toBe(30_000);
  recordAutomaticRetry(storage);
  expect(automaticRetryDelay(storage)).toBeNull();
  clearAutomaticRetries(storage);
  expect(storage.getItem(ERROR_RECOVERY_STORAGE_KEY)).toBeNull();
  expect(automaticRetryDelay(storage)).toBe(5_000);
});
