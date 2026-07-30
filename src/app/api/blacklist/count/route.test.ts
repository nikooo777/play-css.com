import { afterEach, expect, mock, test } from 'bun:test';
import { GET } from './route';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('blacklist count proxy preserves the backend response', async () => {
  globalThis.fetch = mock(async () => {
    return Response.json(
      { count: 447 },
      {
        headers: {
          'cache-control': 'public, max-age=60',
        },
      }
    );
  }) as unknown as typeof fetch;

  const response = await GET();

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('public, max-age=60');
  expect(await response.json()).toEqual({ count: 447 });
});

test('blacklist count proxy converts network failures to 502', async () => {
  globalThis.fetch = mock(async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;

  const response = await GET();

  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: 'Blacklist count unavailable' });
});
