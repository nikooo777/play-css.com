'use client';

interface FavoriteButtonProps {
  address: string;
  name: string;
  isFavorite: boolean;
  onToggle: (address: string, name: string) => void;
  className?: string;
}

export function FavoriteButton({
  address,
  name,
  isFavorite,
  onToggle,
  className = '',
}: FavoriteButtonProps) {
  const displayName = name.trim() || address;
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={
        isFavorite
          ? `Remove ${displayName} from favorites`
          : `Add ${displayName} to favorites`
      }
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      className={`shrink-0 p-1 transition-colors ${
        isFavorite ? 'text-hud' : 'text-mut hover:text-ink'
      } ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(address, name);
      }}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.5c.16-.4.88-.4 1.04 0l2.13 5.11 5.52.44c.44.04.62.58.28.86l-4.2 3.6 1.28 5.38c.1.43-.36.76-.74.53L12 16.55l-4.79 2.87c-.38.23-.84-.1-.74-.53l1.28-5.38-4.2-3.6c-.34-.28-.16-.82.28-.86l5.52-.44 2.13-5.11Z"
        />
      </svg>
    </button>
  );
}
