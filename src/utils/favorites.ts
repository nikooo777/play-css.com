import { type Server } from './servers';

export interface FavoriteServer {
  address: string;
  name: string;
  addedAt: number;
}

export interface FavoritesStorage {
  getItem(): string | null;
  setItem(value: string): void;
  subscribe(onExternalChange: () => void): () => void;
}

export interface FavoritesStore {
  getSnapshot(): FavoriteServer[];
  getServerSnapshot(): FavoriteServer[];
  subscribe(listener: () => void): () => void;
  toggleFavorite(address: string, name: string): void;
  updateNames(servers: readonly Pick<Server, 'ip' | 'port' | 'name'>[]): void;
}

export type FavoriteEntryState = 'live' | 'offline' | 'unverified';

export interface FavoriteEntry {
  favorite: FavoriteServer;
  server: Server | null;
  state: FavoriteEntryState;
}

export const FAVORITES_STORAGE_KEY = 'favorite_servers';
export const FAVORITES_LIMIT = 200;
const FAVORITES_VERSION = 1;

const EMPTY_FAVORITES: FavoriteServer[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function serverAddress(server: Pick<Server, 'ip' | 'port'>): string {
  return `${server.ip}:${server.port}`.trim();
}

export function isFavoritesStorageEvent(key: string | null): boolean {
  // key === null means localStorage.clear()
  return key === FAVORITES_STORAGE_KEY || key === null;
}

function sortFavorites(favorites: FavoriteServer[]): FavoriteServer[] {
  return favorites.sort(
    (a, b) => a.addedAt - b.addedAt || a.address.localeCompare(b.address)
  );
}

export function buildFavoriteEntries(
  favorites: FavoriteServer[],
  serverMap: ReadonlyMap<string, Server>,
  authoritative: boolean
): FavoriteEntry[] {
  return favorites.map((favorite) => {
    const server = serverMap.get(favorite.address) ?? null;
    return {
      favorite,
      server,
      state: server ? 'live' : authoritative ? 'offline' : 'unverified',
    };
  });
}

function sanitizeEntries(value: unknown): FavoriteServer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byAddress = new Map<string, FavoriteServer>();
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const { address, name, addedAt } = entry;
    if (typeof address !== 'string' || typeof name !== 'string') {
      continue;
    }
    if (typeof addedAt !== 'number' || !Number.isFinite(addedAt) || addedAt < 0) {
      continue;
    }
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      continue;
    }

    const existing = byAddress.get(trimmedAddress);
    // Newest addedAt wins; on ties the last stored occurrence wins
    if (!existing || addedAt >= existing.addedAt) {
      byAddress.set(trimmedAddress, { address: trimmedAddress, name, addedAt });
    }
  }

  return sortFavorites([...byAddress.values()]).slice(-FAVORITES_LIMIT);
}

interface ParsedEnvelope {
  favorites: FavoriteServer[];
  writable: boolean;
}

function parseEnvelope(raw: string | null): ParsedEnvelope {
  if (raw === null) {
    return { favorites: EMPTY_FAVORITES, writable: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { favorites: EMPTY_FAVORITES, writable: true };
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    return { favorites: EMPTY_FAVORITES, writable: true };
  }
  if (parsed.version !== FAVORITES_VERSION) {
    // Unknown version (e.g. after a rollback): usable in memory, never overwritten
    return { favorites: EMPTY_FAVORITES, writable: false };
  }

  return { favorites: sanitizeEntries(parsed.favorites), writable: true };
}

export function createFavoritesStore(
  storage: FavoritesStorage,
  now: () => number = () => Date.now()
): FavoritesStore {
  let snapshot: FavoriteServer[] | null = null;
  let writable = true;
  const listeners = new Set<() => void>();
  let unsubscribeExternal: (() => void) | null = null;

  function load(): FavoriteServer[] {
    let raw: string | null = null;
    try {
      raw = storage.getItem();
    } catch {
      raw = null;
    }
    const parsed = parseEnvelope(raw);
    writable = parsed.writable;
    snapshot = parsed.favorites;
    return snapshot;
  }

  function getSnapshot(): FavoriteServer[] {
    return snapshot ?? load();
  }

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  function persist(favorites: FavoriteServer[]) {
    if (!writable) {
      return;
    }
    try {
      storage.setItem(JSON.stringify({ version: FAVORITES_VERSION, favorites }));
    } catch {
      // In-memory state stays authoritative for the session
    }
  }

  function apply(favorites: FavoriteServer[]) {
    snapshot = favorites;
    notify();
    persist(favorites);
  }

  function handleExternalChange() {
    load();
    notify();
  }

  return {
    getSnapshot,
    getServerSnapshot: () => EMPTY_FAVORITES,
    subscribe(listener) {
      listeners.add(listener);
      if (!unsubscribeExternal) {
        unsubscribeExternal = storage.subscribe(handleExternalChange);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && unsubscribeExternal) {
          unsubscribeExternal();
          unsubscribeExternal = null;
        }
      };
    },
    toggleFavorite(address, name) {
      const trimmedAddress = address.trim();
      if (!trimmedAddress) {
        return;
      }
      const current = getSnapshot();
      const existing = current.some((favorite) => favorite.address === trimmedAddress);
      let next: FavoriteServer[];
      if (existing) {
        next = current.filter((favorite) => favorite.address !== trimmedAddress);
      } else {
        // Evict the oldest existing entry, never the one being added
        const retained =
          current.length >= FAVORITES_LIMIT
            ? current.slice(current.length - FAVORITES_LIMIT + 1)
            : current;
        next = sortFavorites([
          ...retained,
          { address: trimmedAddress, name, addedAt: now() },
        ]);
      }
      apply(next);
    },
    updateNames(servers) {
      const current = getSnapshot();
      if (current.length === 0) {
        return;
      }
      const liveNames = new Map<string, string>();
      for (const server of servers) {
        liveNames.set(serverAddress(server), server.name);
      }
      let changed = false;
      const next = current.map((favorite) => {
        const liveName = liveNames.get(favorite.address);
        if (liveName === undefined || liveName === favorite.name) {
          return favorite;
        }
        changed = true;
        return { ...favorite, name: liveName };
      });
      if (changed) {
        apply(next);
      }
    },
  };
}

function createBrowserFavoritesStorage(): FavoritesStorage {
  return {
    getItem: () => localStorage.getItem(FAVORITES_STORAGE_KEY),
    setItem: (value) => localStorage.setItem(FAVORITES_STORAGE_KEY, value),
    subscribe(onExternalChange) {
      const handleStorage = (event: StorageEvent) => {
        if (isFavoritesStorageEvent(event.key)) {
          onExternalChange();
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    },
  };
}

let browserStore: FavoritesStore | null = null;

function getBrowserFavoritesStore(): FavoritesStore {
  if (!browserStore) {
    browserStore = createFavoritesStore(createBrowserFavoritesStorage());
  }
  return browserStore;
}

export function subscribeFavorites(listener: () => void): () => void {
  return getBrowserFavoritesStore().subscribe(listener);
}

export function getFavoritesSnapshot(): FavoriteServer[] {
  return getBrowserFavoritesStore().getSnapshot();
}

// Must not touch the browser store: this runs during SSR
export function getFavoritesServerSnapshot(): FavoriteServer[] {
  return EMPTY_FAVORITES;
}

export function toggleFavorite(address: string, name: string): void {
  getBrowserFavoritesStore().toggleFavorite(address, name);
}

export function updateFavoriteNames(
  servers: readonly Pick<Server, 'ip' | 'port' | 'name'>[]
): void {
  getBrowserFavoritesStore().updateNames(servers);
}
