// Credentials are kept in sessionStorage (per-tab, gone when the tab closes) and are
// base64-encoded, not encrypted.

const ADMIN_STORAGE_KEY = 'admin_credentials';
const LEGACY_COOKIE_NAME = 'admin_credentials';

export interface AdminCredentials {
  username: string;
  password: string;
}

export function clearLegacyAdminCookie(): void {
  document.cookie = `${LEGACY_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=strict`;
}

export function saveAdminCredentials(credentials: AdminCredentials): void {
  try {
    sessionStorage.setItem(ADMIN_STORAGE_KEY, btoa(JSON.stringify(credentials)));
  } catch (error) {
    console.warn('Failed to save admin credentials:', error);
  }
}

export function loadAdminCredentials(): AdminCredentials | null {
  try {
    clearLegacyAdminCookie();

    const encoded = sessionStorage.getItem(ADMIN_STORAGE_KEY);
    if (!encoded) {
      return null;
    }

    const credentials = JSON.parse(atob(encoded));

    if (credentials && typeof credentials.username === 'string' && typeof credentials.password === 'string') {
      return credentials;
    }

    return null;
  } catch (error) {
    console.warn('Failed to load admin credentials:', error);
    return null;
  }
}

export function clearAdminCredentials(): void {
  try {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    clearLegacyAdminCookie();
  } catch (error) {
    console.warn('Failed to clear admin credentials:', error);
  }
}

export function createAuthHeader(credentials: AdminCredentials): string {
  return `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
}
