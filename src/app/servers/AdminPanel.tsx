'use client';

import { useState, useCallback, memo, useEffect } from 'react';
import { saveAdminCredentials, loadAdminCredentials, clearAdminCredentials, createAuthHeader, type AdminCredentials } from '@/utils/auth';

interface BannedServer {
  address: string;
  banned_at: string;
  abuse_reason: string;
}

const BLACKLIST_REASONS = [
  'none',
  'differing_address',
  'illegal_player_count',
  'suspicious_players',
  'same_connection_time'
] as const;

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const fieldClass = 'w-full px-3 py-2 rounded-[3px] border border-edge-2 bg-field text-sm text-ink placeholder:text-mut/60 focus:border-ct focus:outline-none';
const labelClass = 'block font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut mb-1.5';
const tableHeaderClass = 'px-4 py-2.5 text-left font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut';

export const AdminPanel = memo(function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'blacklist' | 'banned' | 'add'>('blacklist');
  const [credentials, setCredentials] = useState<AdminCredentials>({ username: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Blacklist form
  const [blacklistAddress, setBlacklistAddress] = useState('');
  const [blacklistReason, setBlacklistReason] = useState<typeof BLACKLIST_REASONS[number]>('none');

  // Add server form
  const [addAddress, setAddAddress] = useState('');

  // Banned servers
  const [bannedServers, setBannedServers] = useState<BannedServer[]>([]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    if (isOpen) {
      setIsCheckingAuth(true);
      const savedCredentials = loadAdminCredentials();

      if (savedCredentials) {
        setCredentials(savedCredentials);
        testAuthentication(savedCredentials, true);
      } else {
        setIsCheckingAuth(false);
      }
    }
  }, [isOpen]);

  const testAuthentication = async (testCredentials: AdminCredentials, isAutoLogin = false): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/banned', {
        headers: {
          'Authorization': createAuthHeader(testCredentials),
        },
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setCredentials(testCredentials);
        const data = await response.json();
        setBannedServers(data);
        if (isAutoLogin) {
          setSuccess('Welcome back! Auto-logged in with saved credentials.');
        } else {
          setSuccess('Authentication successful');
        }
        return true;
      } else {
        if (isAutoLogin) {
          clearAdminCredentials();
          setCredentials({ username: '', password: '' });
        }
        setError('Invalid username or password');
        setIsAuthenticated(false);
        return false;
      }
    } catch {
      setError('Authentication failed');
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      const success = await testAuthentication(credentials);
      if (success) {
        saveAdminCredentials(credentials);
      }
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  const handleBlacklist = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      const formData = new FormData();
      formData.append('address', blacklistAddress);
      formData.append('reason', blacklistReason);

      const response = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: {
          'Authorization': createAuthHeader(credentials),
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.data || 'Server blacklisted successfully');
        setBlacklistAddress('');
        setBlacklistReason('none');
      } else {
        setError(data.error || 'Failed to blacklist server');
      }
    } catch {
      setError('Failed to blacklist server');
    } finally {
      setLoading(false);
    }
  }, [blacklistAddress, blacklistReason, credentials]);

  const handleAddServer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      const formData = new FormData();
      formData.append('address', addAddress);

      const response = await fetch('/api/admin/add', {
        method: 'POST',
        headers: {
          'Authorization': createAuthHeader(credentials),
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.data || 'Server added successfully');
        setAddAddress('');
      } else {
        setError(data.error || 'Failed to add server');
      }
    } catch {
      setError('Failed to add server');
    } finally {
      setLoading(false);
    }
  }, [addAddress, credentials]);

  const fetchBannedServers = useCallback(async () => {
    setLoading(true);
    clearMessages();

    try {
      const response = await fetch('/api/admin/banned', {
        headers: {
          'Authorization': createAuthHeader(credentials),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBannedServers(data);
      } else {
        setError('Failed to fetch banned servers');
      }
    } catch {
      setError('Failed to fetch banned servers');
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    clearMessages();
    if (tab === 'banned') {
      fetchBannedServers();
    }
  };

  const handleLogout = useCallback(() => {
    clearAdminCredentials();
    setIsAuthenticated(false);
    setCredentials({ username: '', password: '' });
    setActiveTab('blacklist');
    clearMessages();
    setSuccess('Logged out successfully');
  }, []);

  const handleClose = () => {
    // Don't clear authentication state when closing - keep user logged in
    setActiveTab('blacklist');
    clearMessages();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin panel"
        className="mx-auto flex max-h-[95vh] w-full max-w-4xl flex-col rounded border border-edge-2 bg-panel shadow-2xl"
      >
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-6 flex items-start justify-between">
            <h2 className="pr-4 font-display text-lg font-semibold uppercase tracking-wider text-ink sm:text-xl">
              Admin Panel
            </h2>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 rounded-[2px] border border-tr/60 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-tr transition-colors hover:bg-tr hover:text-bg"
                  title="Logout and clear saved credentials"
                >
                  Logout
                </button>
              )}
              <button
                onClick={handleClose}
                className="flex-shrink-0 rounded-[3px] p-2 text-mut transition-colors hover:bg-panel-2 hover:text-ink"
                aria-label="Close admin panel"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {!isAuthenticated ? (
            isCheckingAuth ? (
              <p className="py-8 text-center font-mono text-sm text-mut">
                ] checking saved credentials<span className="cursor-blink">_</span>
              </p>
            ) : (
            <div className="mx-auto max-w-md">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="admin-username">
                    Username
                  </label>
                  <input
                    id="admin-username"
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    className={fieldClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="admin-password">
                    Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className={fieldClass}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-[3px] bg-hud px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-hud/85 disabled:opacity-50"
                >
                  {loading ? 'Authenticating…' : 'Login'}
                </button>
              </form>
            </div>
            )
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="mb-6 flex border-b border-edge">
                {[
                  { id: 'blacklist', label: 'Blacklist Server' },
                  { id: 'banned', label: 'Banned Servers' },
                  { id: 'add', label: 'Add Server' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => handleTabChange(id as typeof activeTab)}
                    className={`-mb-px px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
                      activeTab === id
                        ? 'border-b-2 border-hud text-hud'
                        : 'border-b-2 border-transparent text-mut hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'blacklist' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-ink">Blacklist a server</h3>
                  <form onSubmit={handleBlacklist} className="space-y-4">
                    <div>
                      <label className={labelClass} htmlFor="blacklist-address">
                        Server address (IP:PORT)
                      </label>
                      <input
                        id="blacklist-address"
                        type="text"
                        value={blacklistAddress}
                        onChange={(e) => setBlacklistAddress(e.target.value)}
                        placeholder="192.168.1.1:27015"
                        className={`${fieldClass} font-mono`}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="blacklist-reason">
                        Reason
                      </label>
                      <select
                        id="blacklist-reason"
                        value={blacklistReason}
                        onChange={(e) => setBlacklistReason(e.target.value as typeof blacklistReason)}
                        className={fieldClass}
                      >
                        {BLACKLIST_REASONS.map(reason => (
                          <option key={reason} value={reason}>
                            {reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-[3px] bg-tr px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-tr/85 disabled:opacity-50"
                    >
                      {loading ? 'Blacklisting…' : 'Blacklist Server'}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'banned' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-ink">Banned servers</h3>
                    <button
                      onClick={fetchBannedServers}
                      disabled={loading}
                      className="rounded-[2px] border border-edge-2 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-ink-2 transition-colors hover:border-mut hover:text-ink disabled:opacity-50"
                    >
                      {loading ? 'Loading…' : 'Refresh'}
                    </button>
                  </div>
                  {bannedServers.length === 0 ? (
                    <p className="py-8 text-center font-mono text-sm text-mut">] no banned servers found</p>
                  ) : (
                    <div className="overflow-hidden rounded-[3px] border border-edge">
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-panel-2">
                            <tr className="border-b border-edge">
                              <th className={tableHeaderClass}>Address</th>
                              <th className={tableHeaderClass}>Banned At</th>
                              <th className={tableHeaderClass}>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bannedServers.map((server) => (
                              <tr key={server.address} className="border-b border-edge/60 last:border-b-0 hover:bg-panel-2">
                                <td className="px-4 py-2.5 font-mono text-sm text-ink">
                                  {server.address}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-sm text-mut">
                                  {new Date(server.banned_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-ink-2">
                                  {server.abuse_reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'add' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-ink">Add a server</h3>
                  <form onSubmit={handleAddServer} className="space-y-4">
                    <div>
                      <label className={labelClass} htmlFor="add-address">
                        Server address (IP:PORT)
                      </label>
                      <input
                        id="add-address"
                        type="text"
                        value={addAddress}
                        onChange={(e) => setAddAddress(e.target.value)}
                        placeholder="192.168.1.1:27015"
                        className={`${fieldClass} font-mono`}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-[3px] bg-hud px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-hud/85 disabled:opacity-50"
                    >
                      {loading ? 'Adding…' : 'Add Server'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Messages */}
          {error && (
            <div className="mt-4 rounded-[3px] border border-tr/40 bg-tr/10 p-3">
              <p className="text-sm text-tr">{error}</p>
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-[3px] border border-ok/40 bg-ok/10 p-3">
              <p className="text-sm text-ok">{success}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
