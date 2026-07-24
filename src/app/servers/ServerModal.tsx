'use client';

import { useEffect, useState, useRef } from 'react';
import { CountryFlag } from '@/components/CountryFlag';

interface Player {
  id: number;
  name: string;
  score: number;
  connection_time: number;
}

interface ServerModalProps {
  server: {
    ip: string;
    port: string;
    name: string;
    map: string;
    players: number;
    max_players: number;
    bots: number;
    country: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

const infoLabelClass = 'font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut';

function formatTime(nanoseconds: number): string {
  const seconds = Math.floor(nanoseconds / 1_000_000_000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function ServerModal({ server, isOpen, onClose }: ServerModalProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller = new AbortController();

    async function fetchDetails() {
      try {
        const response = await fetch(`/api/server/${server.ip}:${server.port}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Failed to fetch server details');
        }
        const data = await response.json();
        setPlayers(data.sort((a: Player, b: Player) => b.connection_time - a.connection_time));
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Failed to fetch server details');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDetails();
    document.body.style.overflow = 'hidden';

    return () => {
      controller.abort();
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, server.ip, server.port]);

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-[2px]">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Server details"
        className="mx-auto my-auto flex max-h-[95vh] w-full max-w-2xl flex-col rounded border border-edge-2 bg-panel shadow-2xl"
      >
        {/* Sticky Header */}
        <div className="flex-shrink-0 rounded-t border-b border-edge bg-panel p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="pr-4 font-display text-lg font-semibold uppercase tracking-wider text-ink sm:text-xl">
              Server Details
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded-[3px] p-2 text-mut transition-colors hover:bg-panel-2 hover:text-ink"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Server Info - Always Visible */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className={infoLabelClass}>Server Name</h3>
              <p className="mt-1 text-base font-medium text-ink">{server.name}</p>
            </div>
            <div>
              <h3 className={infoLabelClass}>Map</h3>
              <p className="mt-1 font-mono text-base text-ink">{server.map}</p>
            </div>
            <div>
              <h3 className={infoLabelClass}>Players</h3>
              <p className="mt-1 font-mono text-base text-ink">
                {server.players}/{server.max_players}
                {server.bots > 0 && ` (+${server.bots} bots)`}
              </p>
            </div>
            <div>
              <h3 className={infoLabelClass}>Location</h3>
              <div className="mt-1 flex items-center gap-2">
                <CountryFlag countryCode={server.country} />
                <p className="text-base font-medium text-ink">{server.country || 'Unknown'}</p>
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <h3 className={infoLabelClass}>IP:Port</h3>
              <p className="mt-1 break-all font-mono text-sm text-ink sm:text-base">{server.ip}:{server.port}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">

            {/* Player List Section */}
            <div>
              <h4 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink">
                Players {!loading && !error && <span className="text-mut">({players.length})</span>}
              </h4>

              {loading ? (
                <p className="py-8 text-center font-mono text-sm text-mut">
                  ] querying server<span className="cursor-blink">_</span>
                </p>
              ) : error ? (
                <div className="rounded-[3px] border border-tr/40 bg-tr/10 p-4">
                  <p className="font-mono text-sm text-tr">] player list unavailable</p>
                  <p className="mt-1 text-sm text-ink-2">{error}</p>
                </div>
              ) : players.length === 0 ? (
                <p className="py-8 text-center font-mono text-sm text-mut">] no players online</p>
              ) : (
                <div className="overflow-hidden rounded-[3px] border border-edge">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-panel-2">
                        <tr className="border-b border-edge">
                          <th className="px-3 py-2.5 text-left font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut sm:px-4">
                            Name
                          </th>
                          <th className="px-3 py-2.5 text-left font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut sm:px-4">
                            Score
                          </th>
                          <th className="px-3 py-2.5 text-left font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut sm:px-4">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((player) => (
                          <tr key={player.id} className="border-b border-edge/60 last:border-b-0 hover:bg-panel-2">
                            <td className="max-w-0 truncate px-3 py-2.5 text-sm text-ink sm:px-4">
                              <div className="truncate" title={player.name}>{player.name}</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm text-ink-2 sm:px-4">
                              {player.score}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm text-mut sm:px-4">
                              {formatTime(player.connection_time)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 rounded-b border-t border-edge bg-panel-2 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              className="order-2 inline-flex items-center justify-center rounded-[3px] border border-edge-2 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-ink-2 transition-colors hover:border-mut hover:text-ink sm:order-1"
            >
              Close
            </button>
            <a
              href={`steam://connect/${server.ip}:${server.port}`}
              className="order-1 inline-flex items-center justify-center rounded-[3px] bg-hud px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-hud/85 sm:order-2"
            >
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Connect
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
