'use client';

import { useMemo } from 'react';
import { CapacityBar } from '@/components/CapacityBar';
import { FavoriteButton } from '@/components/FavoriteButton';
import { useFavorites } from '@/utils/useFavorites';
import { stripSpecialChars, type Server } from '@/utils/servers';
import { buildFavoriteEntries, serverAddress } from '@/utils/favorites';

interface FavoritesSectionProps {
  servers: Server[];
  authoritative: boolean;
  cleanNames: boolean;
  onSelectServer?: (server: Server) => void;
}

const connectClass = 'inline-flex shrink-0 items-center font-display text-[11px] font-semibold uppercase tracking-wider text-hud border border-hud/60 hover:bg-hud hover:text-bg rounded-[2px] px-3 py-1.5 transition-colors';

export function FavoritesSection({
  servers,
  authoritative,
  cleanNames,
  onSelectServer,
}: FavoritesSectionProps) {
  const { favorites, favoriteAddresses, toggleFavorite } = useFavorites();

  const serverMap = useMemo(() => {
    const map = new Map<string, Server>();
    for (const server of servers) {
      map.set(serverAddress(server), server);
    }
    return map;
  }, [servers]);

  const entries = useMemo(
    () => buildFavoriteEntries(favorites, serverMap, authoritative),
    [favorites, serverMap, authoritative]
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="rise mb-4 rounded border border-edge bg-panel">
      <div className="flex items-baseline gap-3 border-b border-edge px-4 py-2.5 sm:px-5">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
          Favorites
        </h2>
        <span className="font-mono text-xs text-mut">{entries.length}</span>
      </div>
      {entries.map(({ favorite, server, state }) => {
        const rawName = server ? server.name : favorite.name;
        const cleaned = cleanNames ? stripSpecialChars(rawName) : rawName;
        const displayName = cleaned.trim() || favorite.address;

        return (
          <div
            key={favorite.address}
            className={`flex items-center gap-3 border-b border-edge/60 px-4 py-2.5 last:border-b-0 sm:px-5 ${
              state === 'offline' ? 'opacity-60' : ''
            }`}
          >
            <FavoriteButton
              address={favorite.address}
              name={rawName}
              isFavorite={favoriteAddresses.has(favorite.address)}
              onToggle={toggleFavorite}
            />
            <div className="min-w-0 flex-1">
              {state === 'live' && server && onSelectServer ? (
                <button
                  type="button"
                  className="block max-w-full truncate text-left text-sm font-medium text-ink"
                  title={displayName}
                  onClick={() => onSelectServer(server)}
                >
                  {displayName}
                </button>
              ) : (
                <div className="truncate text-sm font-medium text-ink" title={displayName}>
                  {displayName}
                </div>
              )}
              <div className="mt-0.5 flex items-center gap-3 font-mono text-xs text-mut">
                <span>{favorite.address}</span>
                {state === 'live' && server && (
                  <span className="hidden truncate text-ink-2 sm:inline">{
                    cleanNames ? stripSpecialChars(server.map) : server.map
                  }</span>
                )}
                {state === 'offline' && <span className="text-tr">] offline</span>}
                {state === 'unverified' && <span>] status unknown</span>}
              </div>
            </div>
            {state === 'live' && server && (
              <div className="hidden text-right sm:block">
                <div className="font-mono text-sm text-ink">
                  {server.players}/{server.max_players}
                </div>
                <CapacityBar players={server.players} maxPlayers={server.max_players} />
              </div>
            )}
            {state !== 'offline' && (
              <a
                href={`steam://connect/${favorite.address}`}
                className={connectClass}
                onClick={(event) => event.stopPropagation()}
              >
                Connect
              </a>
            )}
          </div>
        );
      })}
    </section>
  );
}
