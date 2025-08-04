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
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Reset players and error state when modal closes
      setPlayers([]);
      setError(null);
      setLoading(true);
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col mx-auto my-auto"
      >
        {/* Sticky Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white pr-4">
              Server Details
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 "
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Server Info - Always Visible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="col-span-1 sm:col-span-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">IP:Port</h3>
              <p className="mt-1 text-sm sm:text-lg font-medium text-gray-900 dark:text-white break-all">{server.ip}:{server.port}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-4 sm:p-6">

            {/* Player List Section */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Players {!loading && !error && `(${players.length})`}
              </h4>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading player list...</span>
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h5 className="text-sm font-medium text-red-800 dark:text-red-400">Failed to load player list</h5>
                      <p className="text-sm text-red-700 dark:text-red-500 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              ) : players.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No players currently online</p>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                        {players.map((player) => (
                          <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-900 dark:text-white truncate max-w-0">
                              <div className="truncate" title={player.name}>{player.name}</div>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {player.score}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500  order-2 sm:order-1"
            >
              Close
            </button>
            <a
              href={`steam://connect/${server.ip}:${server.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500  order-1 sm:order-2"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Join Server
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 