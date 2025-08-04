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

  const getAuthHeader = () => {
    return createAuthHeader(credentials);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Load saved credentials when component mounts or becomes visible
  useEffect(() => {
    if (isOpen) {
      setIsCheckingAuth(true);
      const savedCredentials = loadAdminCredentials();
      
      if (savedCredentials) {
        setCredentials(savedCredentials);
        // Auto-authenticate with saved credentials
        testAuthentication(savedCredentials);
      } else {
        setIsCheckingAuth(false);
      }
    }
  }, [isOpen]);

  // Test authentication with given credentials
  const testAuthentication = async (testCredentials: AdminCredentials) => {
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
        if (isCheckingAuth) {
          setSuccess('Welcome back! Auto-logged in with saved credentials.');
        } else {
          setSuccess('Authentication successful');
        }
      } else {
        if (isCheckingAuth) {
          // Saved credentials are invalid, clear them
          clearAdminCredentials();
          setCredentials({ username: '', password: '' });
        }
        setError('Invalid username or password');
        setIsAuthenticated(false);
      }
    } catch (err) {
      setError('Authentication failed');
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      await testAuthentication(credentials);
      // Save credentials only if authentication was successful
      if (isAuthenticated) {
        saveAdminCredentials(credentials);
      }
    } finally {
      setLoading(false);
    }
  }, [credentials, isAuthenticated]);

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
          'Authorization': getAuthHeader(),
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.data || 'Server blacklisted successfully');
        setBlacklistAddress('');
        setBlacklistReason('none');
        // Refresh banned servers list
        if (activeTab === 'banned') {
          fetchBannedServers();
        }
      } else {
        setError(data.error || 'Failed to blacklist server');
      }
    } catch (err) {
      setError('Failed to blacklist server');
    } finally {
      setLoading(false);
    }
  }, [blacklistAddress, blacklistReason, activeTab, credentials]);

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
          'Authorization': getAuthHeader(),
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
    } catch (err) {
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
          'Authorization': getAuthHeader(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBannedServers(data);
      } else {
        setError('Failed to fetch banned servers');
      }
    } catch (err) {
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col mx-auto">
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white pr-4">
              Admin Panel
            </h2>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg focus:ring-2 focus:ring-red-500"
                  title="Logout and clear saved credentials"
                >
                  Logout
                </button>
              )}
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                aria-label="Close admin panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {!isAuthenticated ? (
            isCheckingAuth ? (
              <div className="max-w-md mx-auto text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Checking saved credentials...</p>
              </div>
            ) : (
            <div className="max-w-md mx-auto">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Login'}
                </button>
              </form>
            </div>
            )
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                {[
                  { id: 'blacklist', label: 'Blacklist Server' },
                  { id: 'banned', label: 'Banned Servers' },
                  { id: 'add', label: 'Add Server' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => handleTabChange(id as typeof activeTab)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md ${
                      activeTab === id
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'blacklist' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Blacklist a Server</h3>
                  <form onSubmit={handleBlacklist} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Server Address (IP:PORT)
                      </label>
                      <input
                        type="text"
                        value={blacklistAddress}
                        onChange={(e) => setBlacklistAddress(e.target.value)}
                        placeholder="192.168.1.1:27015"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reason
                      </label>
                      <select
                        value={blacklistReason}
                        onChange={(e) => setBlacklistReason(e.target.value as typeof blacklistReason)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {loading ? 'Blacklisting...' : 'Blacklist Server'}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'banned' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Banned Servers</h3>
                    <button
                      onClick={fetchBannedServers}
                      disabled={loading}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 text-sm"
                    >
                      {loading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  {bannedServers.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                      No banned servers found
                    </p>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                          <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Address
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Banned At
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Reason
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                            {bannedServers.map((server, index) => (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                                  {server.address}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(server.banned_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Server</h3>
                  <form onSubmit={handleAddServer} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Server Address (IP:PORT)
                      </label>
                      <input
                        type="text"
                        value={addAddress}
                        onChange={(e) => setAddAddress(e.target.value)}
                        placeholder="192.168.1.1:27015"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {loading ? 'Adding...' : 'Add Server'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-700 dark:text-green-400 text-sm">{success}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});