// Simple base64 encoding/decoding for credential storage
// Note: This is not encryption, just encoding. In production, consider more secure methods.

const ADMIN_COOKIE_NAME = 'admin_credentials';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface AdminCredentials {
  username: string;
  password: string;
}

export function saveAdminCredentials(credentials: AdminCredentials): void {
  try {
    // Encode credentials as base64
    const encoded = btoa(JSON.stringify(credentials));
    
    // Set cookie with secure options
    document.cookie = `${ADMIN_COOKIE_NAME}=${encoded}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=strict${
      window.location.protocol === 'https:' ? '; secure' : ''
    }`;
  } catch (error) {
    console.warn('Failed to save admin credentials:', error);
  }
}

export function loadAdminCredentials(): AdminCredentials | null {
  try {
    // Get cookie value
    const cookies = document.cookie.split(';');
    const adminCookie = cookies.find(cookie => 
      cookie.trim().startsWith(`${ADMIN_COOKIE_NAME}=`)
    );
    
    if (!adminCookie) {
      return null;
    }
    
    // Extract and decode credentials
    const encoded = adminCookie.split('=')[1];
    const decoded = atob(encoded);
    const credentials = JSON.parse(decoded);
    
    // Validate credentials structure
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
    // Clear cookie by setting expiration to past date
    document.cookie = `${ADMIN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=strict`;
  } catch (error) {
    console.warn('Failed to clear admin credentials:', error);
  }
}

export function createAuthHeader(credentials: AdminCredentials): string {
  return `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
}