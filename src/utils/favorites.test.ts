import { describe, expect, test } from 'bun:test';
import {
  buildFavoriteEntries,
  createFavoritesStore,
  FAVORITES_LIMIT,
  FAVORITES_STORAGE_KEY,
  isFavoritesStorageEvent,
  serverAddress,
  type FavoriteServer,
  type FavoritesStorage,
} from './favorites';
import { type Server } from './servers';

interface FakeStorage {
  storage: FavoritesStorage;
  writes: string[];
  setExternal(value: string | null): void;
  throwOnGet(enabled: boolean): void;
  throwOnSet(enabled: boolean): void;
}

function createFakeStorage(initial: string | null = null): FakeStorage {
  let value = initial;
  let getThrows = false;
  let setThrows = false;
  const writes: string[] = [];
  const externalListeners = new Set<() => void>();

  return {
    storage: {
      getItem: () => {
        if (getThrows) {
          throw new Error('getItem failed');
        }
        return value;
      },
      setItem: (next) => {
        if (setThrows) {
          throw new Error('setItem failed');
        }
        value = next;
        writes.push(next);
      },
      subscribe: (onExternalChange) => {
        externalListeners.add(onExternalChange);
        return () => externalListeners.delete(onExternalChange);
      },
    },
    writes,
    setExternal(next) {
      value = next;
      for (const listener of externalListeners) {
        listener();
      }
    },
    throwOnGet(enabled) {
      getThrows = enabled;
    },
    throwOnSet(enabled) {
      setThrows = enabled;
    },
  };
}

function envelope(favorites: unknown, version: unknown = 1): string {
  return JSON.stringify({ version, favorites });
}

function entry(address: string, name = 'srv', addedAt = 1000): FavoriteServer {
  return { address, name, addedAt };
}

function makeStore(fake: FakeStorage, startAt = 10_000) {
  let clock = startAt;
  return createFavoritesStore(fake.storage, () => ++clock);
}

describe('envelope parsing', () => {
  test('reads a valid envelope', () => {
    const fake = createFakeStorage(envelope([entry('1.2.3.4:27015')]));
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([entry('1.2.3.4:27015')]);
  });

  test('corrupt JSON yields empty state and stays writable', () => {
    const fake = createFakeStorage('{not json');
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([]);
    store.toggleFavorite('1.2.3.4:27015', 'srv');
    expect(fake.writes.length).toBe(1);
  });

  test('non-object envelope yields empty state and stays writable', () => {
    const fake = createFakeStorage('"just a string"');
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([]);
    store.toggleFavorite('1.2.3.4:27015', 'srv');
    expect(fake.writes.length).toBe(1);
  });

  test('a bare array is corrupt-class, not an unknown version', () => {
    const fake = createFakeStorage(JSON.stringify([entry('1.2.3.4:27015')]));
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([]);
    store.toggleFavorite('1.2.3.4:27015', 'srv');
    expect(fake.writes.length).toBe(1);
  });

  test('invalid entries are dropped individually', () => {
    const fake = createFakeStorage(
      envelope([
        entry('1.2.3.4:27015'),
        { address: '', name: 'blank address', addedAt: 1 },
        { address: '2.2.2.2:1', name: 42, addedAt: 1 },
        { address: '3.3.3.3:1', name: 'bad time', addedAt: Number.NaN },
        { address: '4.4.4.4:1', name: 'negative', addedAt: -5 },
        'not an object',
      ])
    );
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([entry('1.2.3.4:27015')]);
  });
});

describe('unknown version', () => {
  test('is readable in memory but never overwritten', () => {
    const raw = envelope([entry('1.2.3.4:27015')], 999);
    const fake = createFakeStorage(raw);
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([]);

    store.toggleFavorite('5.6.7.8:27015', 'in-memory');
    store.updateNames([{ ip: '5.6.7.8', port: '27015', name: 'renamed' }]);
    expect(store.getSnapshot()).toHaveLength(1);
    expect(fake.writes.length).toBe(0);
  });

  test('a later readable envelope re-enables persistence', () => {
    const fake = createFakeStorage(envelope([], 999));
    const store = makeStore(fake);
    store.subscribe(() => {});
    store.toggleFavorite('5.6.7.8:27015', 'in-memory');
    expect(fake.writes.length).toBe(0);

    fake.setExternal(envelope([entry('1.2.3.4:27015')]));
    expect(store.getSnapshot()).toEqual([entry('1.2.3.4:27015')]);
    store.toggleFavorite('5.6.7.8:27015', 'persisted now');
    expect(fake.writes.length).toBe(1);
  });
});

describe('sanitization', () => {
  test('deduplicates by trimmed address keeping the newest addedAt', () => {
    const fake = createFakeStorage(
      envelope([
        entry('1.2.3.4:27015', 'old', 100),
        entry(' 1.2.3.4:27015 ', 'new', 200),
      ])
    );
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([entry('1.2.3.4:27015', 'new', 200)]);
  });

  test('identical addedAt keeps the last stored occurrence', () => {
    const fake = createFakeStorage(
      envelope([
        entry('1.2.3.4:27015', 'first', 100),
        entry('1.2.3.4:27015', 'last', 100),
      ])
    );
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([entry('1.2.3.4:27015', 'last', 100)]);
  });

  test('cap is enforced on load, evicting oldest', () => {
    const entries = Array.from({ length: FAVORITES_LIMIT + 10 }, (_, i) =>
      entry(`10.0.${Math.floor(i / 250)}.${i % 250}:27015`, 'srv', i)
    );
    const fake = createFakeStorage(envelope(entries));
    const store = makeStore(fake);
    const favorites = store.getSnapshot();
    expect(favorites).toHaveLength(FAVORITES_LIMIT);
    expect(favorites[0].addedAt).toBe(10);
  });

  test('ordering is addedAt ascending with address tiebreak', () => {
    const fake = createFakeStorage(
      envelope([
        entry('9.9.9.9:1', 'b', 200),
        entry('1.1.1.1:1', 'a', 200),
        entry('5.5.5.5:1', 'c', 100),
      ])
    );
    const store = makeStore(fake);
    expect(store.getSnapshot().map((favorite) => favorite.address)).toEqual([
      '5.5.5.5:1',
      '1.1.1.1:1',
      '9.9.9.9:1',
    ]);
  });
});

describe('toggle', () => {
  test('adds then removes a favorite', () => {
    const fake = createFakeStorage();
    const store = makeStore(fake);

    store.toggleFavorite(' 1.2.3.4:27015 ', 'srv');
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0].address).toBe('1.2.3.4:27015');

    store.toggleFavorite('1.2.3.4:27015', 'srv');
    expect(store.getSnapshot()).toEqual([]);
  });

  test('blank address is a no-op', () => {
    const fake = createFakeStorage();
    const store = makeStore(fake);
    store.toggleFavorite('   ', 'srv');
    expect(store.getSnapshot()).toEqual([]);
    expect(fake.writes.length).toBe(0);
  });

  test('adding under a backward clock keeps ordering and evicts by addedAt', () => {
    const entries = Array.from({ length: FAVORITES_LIMIT }, (_, i) =>
      entry(`10.0.${Math.floor(i / 250)}.${i % 250}:27015`, 'srv', 50_000 + i)
    );
    const fake = createFakeStorage(envelope(entries));
    const store = createFavoritesStore(fake.storage, () => 25);

    store.toggleFavorite('99.99.99.99:27015', 'clock went backward');
    const favorites = store.getSnapshot();
    expect(favorites).toHaveLength(FAVORITES_LIMIT);
    expect(favorites[0]).toEqual(entry('99.99.99.99:27015', 'clock went backward', 25));
    expect(favorites.at(-1)?.addedAt).toBe(50_000 + FAVORITES_LIMIT - 1);
  });

  test('equal timestamps keep the address tie-break on add', () => {
    const fake = createFakeStorage(envelope([entry('9.9.9.9:27015', 'srv', 25)]));
    const store = createFavoritesStore(fake.storage, () => 25);

    store.toggleFavorite('1.1.1.1:27015', 'added later, sorts first');
    expect(store.getSnapshot().map((favorite) => favorite.address)).toEqual([
      '1.1.1.1:27015',
      '9.9.9.9:27015',
    ]);
  });

  test('adding beyond the cap evicts the oldest', () => {
    const entries = Array.from({ length: FAVORITES_LIMIT }, (_, i) =>
      entry(`10.0.${Math.floor(i / 250)}.${i % 250}:27015`, 'srv', i)
    );
    const fake = createFakeStorage(envelope(entries));
    const store = makeStore(fake);

    store.toggleFavorite('99.99.99.99:27015', 'newest');
    const favorites = store.getSnapshot();
    expect(favorites).toHaveLength(FAVORITES_LIMIT);
    expect(favorites[0].addedAt).toBe(1);
    expect(favorites.at(-1)?.address).toBe('99.99.99.99:27015');
  });
});

describe('notification and failure semantics', () => {
  test('mutation notifies same-tab subscribers', () => {
    const fake = createFakeStorage();
    const store = makeStore(fake);
    let notified = 0;
    store.subscribe(() => notified++);
    store.toggleFavorite('1.2.3.4:27015', 'srv');
    expect(notified).toBe(1);
  });

  test('throwing getItem yields empty state', () => {
    const fake = createFakeStorage(envelope([entry('1.2.3.4:27015')]));
    fake.throwOnGet(true);
    const store = makeStore(fake);
    expect(store.getSnapshot()).toEqual([]);
  });

  test('throwing setItem keeps in-memory state and notifications working', () => {
    const fake = createFakeStorage();
    fake.throwOnSet(true);
    const store = makeStore(fake);
    let notified = 0;
    store.subscribe(() => notified++);

    store.toggleFavorite('1.2.3.4:27015', 'srv');
    store.toggleFavorite('5.6.7.8:27015', 'srv2');
    expect(store.getSnapshot()).toHaveLength(2);
    expect(notified).toBe(2);
    expect(fake.writes.length).toBe(0);
  });

  test('external change for our key replaces the snapshot', () => {
    const fake = createFakeStorage(envelope([]));
    const store = makeStore(fake);
    store.subscribe(() => {});
    const before = store.getSnapshot();

    fake.setExternal(envelope([entry('1.2.3.4:27015')]));
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(after).toEqual([entry('1.2.3.4:27015')]);
  });
});

describe('snapshot identity', () => {
  test('is stable across reads without mutation', () => {
    const fake = createFakeStorage(envelope([entry('1.2.3.4:27015')]));
    const store = makeStore(fake);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  test('is replaced after mutation', () => {
    const fake = createFakeStorage();
    const store = makeStore(fake);
    const before = store.getSnapshot();
    store.toggleFavorite('1.2.3.4:27015', 'srv');
    expect(store.getSnapshot()).not.toBe(before);
  });

  test('server snapshot is a stable empty reference', () => {
    const fake = createFakeStorage(envelope([entry('1.2.3.4:27015')]));
    const store = makeStore(fake);
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot()).toEqual([]);
  });
});

describe('storage event filtering', () => {
  test('matches our key and localStorage.clear, rejects unrelated keys', () => {
    expect(isFavoritesStorageEvent(FAVORITES_STORAGE_KEY)).toBe(true);
    expect(isFavoritesStorageEvent(null)).toBe(true);
    expect(isFavoritesStorageEvent('admin_credentials')).toBe(false);
  });
});

describe('entry authority', () => {
  const liveServer: Server = {
    name: 'live one',
    map: 'de_dust2',
    players: 5,
    max_players: 20,
    bots: 0,
    ip: '1.2.3.4',
    port: '27015',
    country: 'DE',
  };
  const favorites = [
    entry('1.2.3.4:27015', 'live one', 100),
    entry('5.6.7.8:27015', 'absent one', 200),
  ];
  const serverMap = new Map([[serverAddress(liveServer), liveServer]]);

  test('absent favorites are offline under an authoritative list', () => {
    const states = buildFavoriteEntries(favorites, serverMap, true).map((e) => e.state);
    expect(states).toEqual(['live', 'offline']);
  });

  test('absent favorites are unverified without authority', () => {
    const states = buildFavoriteEntries(favorites, serverMap, false).map((e) => e.state);
    expect(states).toEqual(['live', 'unverified']);
  });

  test('server map joins on trimmed addresses', () => {
    const padded = { ...liveServer, ip: ' 1.2.3.4', port: '27015 ' };
    expect(serverAddress(padded)).toBe('1.2.3.4:27015');
  });
});

describe('name refresh', () => {
  test('updates only the matching favorite, preserving addedAt and order', () => {
    const fake = createFakeStorage(
      envelope([
        entry('1.2.3.4:27015', 'old name', 100),
        entry('5.6.7.8:27015', 'untouched', 200),
      ])
    );
    const store = makeStore(fake);
    let notified = 0;
    store.subscribe(() => notified++);

    store.updateNames([
      { ip: '1.2.3.4', port: '27015', name: 'new name' },
      { ip: '9.9.9.9', port: '27015', name: 'unrelated' },
    ]);

    expect(store.getSnapshot()).toEqual([
      entry('1.2.3.4:27015', 'new name', 100),
      entry('5.6.7.8:27015', 'untouched', 200),
    ]);
    expect(notified).toBe(1);
    expect(fake.writes.length).toBe(1);
  });

  test('does not persist or notify when nothing changed', () => {
    const fake = createFakeStorage(envelope([entry('1.2.3.4:27015', 'same', 100)]));
    const store = makeStore(fake);
    let notified = 0;
    store.subscribe(() => notified++);

    store.updateNames([{ ip: '1.2.3.4', port: '27015', name: 'same' }]);
    expect(notified).toBe(0);
    expect(fake.writes.length).toBe(0);
  });
});
