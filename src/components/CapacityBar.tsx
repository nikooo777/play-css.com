export function CapacityBar({ players, maxPlayers }: { players: number; maxPlayers: number }) {
  const percentage = maxPlayers > 0 ? Math.min(100, Math.round((players / maxPlayers) * 100)) : 0;
  const fill = players === 0 ? 'bg-edge-2' : players >= maxPlayers ? 'bg-tr' : 'bg-hud';
  return (
    <div className="mt-1 h-[3px] w-16 overflow-hidden rounded-full bg-edge">
      <div className={`h-full ${fill}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}
