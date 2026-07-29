import { useMemo, useSyncExternalStore } from 'react';
import {
  getFavoritesServerSnapshot,
  getFavoritesSnapshot,
  subscribeFavorites,
  toggleFavorite,
  type FavoriteServer,
} from './favorites';

export interface UseFavoritesResult {
  favorites: FavoriteServer[];
  favoriteAddresses: Set<string>;
  toggleFavorite: (address: string, name: string) => void;
}

export function useFavorites(): UseFavoritesResult {
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getFavoritesServerSnapshot
  );

  const favoriteAddresses = useMemo(
    () => new Set(favorites.map((favorite) => favorite.address)),
    [favorites]
  );

  return { favorites, favoriteAddresses, toggleFavorite };
}
