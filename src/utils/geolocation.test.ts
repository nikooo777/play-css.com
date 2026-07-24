import { describe, expect, test } from 'bun:test';
import {
  compareCountryPreference,
  getCountryCodeFromCoordinates,
  getCountryName,
  normalizeCountryCode,
} from './geolocation';

describe('normalizeCountryCode', () => {
  test('normalizes valid country codes', () => {
    expect(normalizeCountryCode(' ch ')).toBe('CH');
  });

  test('rejects missing and invalid country codes', () => {
    expect(normalizeCountryCode('')).toBe('');
    expect(normalizeCountryCode('unknown')).toBe('');
    expect(normalizeCountryCode(undefined)).toBe('');
  });
});

describe('compareCountryPreference', () => {
  test('places the preferred country first', () => {
    expect(compareCountryPreference('CH', 'DE', 'ch')).toBe(-1);
    expect(compareCountryPreference('DE', 'CH', 'CH')).toBe(1);
  });

  test('preserves the secondary order within each group', () => {
    expect(compareCountryPreference('CH', 'CH', 'CH')).toBe(0);
    expect(compareCountryPreference('DE', 'FR', 'CH')).toBe(0);
    expect(compareCountryPreference('CH', 'DE', '')).toBe(0);
  });
});

describe('getCountryName', () => {
  test('returns a readable country name', () => {
    expect(getCountryName('CH')).toBe('Switzerland');
  });
});

describe('getCountryCodeFromCoordinates', () => {
  test('identifies a country from coordinates', async () => {
    await expect(
      getCountryCodeFromCoordinates(8.5417, 47.3769)
    ).resolves.toBe('CH');
  });

  test('rejects invalid coordinates', async () => {
    await expect(
      getCountryCodeFromCoordinates(181, 91)
    ).rejects.toThrow('invalid');
  });
});
