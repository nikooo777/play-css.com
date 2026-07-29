import { expect, test } from 'bun:test';
import { GET } from './route';

test('frontend health endpoint does not contact the backend', () => {
  const response = GET();

  expect(response.status).toBe(204);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
