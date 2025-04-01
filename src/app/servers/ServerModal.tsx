'use client';

import { useEffect, useState } from 'react';
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
    port: number;
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

  useEffect(() => {
    if (isOpen) {
      const fetchDetails = async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/server/${server.ip}:${server.port}`);
          if (!response.ok) {
            throw new Error('Failed to fetch server details');
          }
          const data = await response.json();
          // Sort players by connection time (descending)
          setPlayers(data.sort((a: Player, b: Player) => b.connection_time - a.connection_time));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch server details');
        } finally {
          setLoading(false);
        }
      };

      fetchDetails();
    }
  }, [isOpen, server.ip, server.port]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Server Details
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8">{error}</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Server Name</h3>
                  <p className="mt-1 text-lg font-medium text-gray-900 dark:text-white">{server.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Map</h3>
                  <p className="mt-1 text-lg font-medium text-gray-900 dark:text-white">{server.map}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Players</h3>
                  <p className="mt-1 text-lg font-medium text-gray-900 dark:text-white">
                    {server.players}/{server.max_players}
                    {server.bots > 0 && ` (${server.bots} bots)`}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <CountryFlag countryCode={server.country} />
                    <p className="text-lg font-medium text-gray-900 dark:text-white">{server.country || 'Unknown'}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">IP:Port</h3>
                  <p className="mt-1 text-lg font-medium text-gray-900 dark:text-white">{server.ip}:{server.port}</p>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                  Players
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Connected
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {players.map((player) => (
                        <tr key={player.id}>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {player.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {player.score}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {formatTime(player.connection_time)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
          <div className="flex justify-end">
            <a
              href={`steam://connect/${server.ip}:${server.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Join Server
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 