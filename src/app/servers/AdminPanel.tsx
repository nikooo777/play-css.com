'use client';

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  clearAdminCredentials,
  createAuthHeader,
  loadAdminCredentials,
  saveAdminCredentials,
  type AdminCredentials,
} from '@/utils/auth';
import {
  DETECTION_REASONS,
  WRITABLE_BAN_REASONS,
  asMutationData,
  formatAdminLabel,
  formatAdminTimestamp,
  mutationSuccessMessage,
  shouldRetryWithSameKey,
  type AdminEnvelope,
  type AuditSummary,
  type BannedServer,
  type MutationData,
  type Observation,
  type ObservationPage,
  type WritableBanReason,
} from '@/utils/admin';
import { useModalDialog } from '@/utils/useModalDialog';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab =
  | 'blacklist'
  | 'banned'
  | 'add'
  | 'recover'
  | 'evidence'
  | 'audit';

const fieldClass =
  'w-full rounded-[3px] border border-edge-2 bg-field px-3 py-2 text-sm text-ink placeholder:text-mut/60 focus:border-ct focus:outline-none';
const labelClass =
  'mb-1.5 block font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut';
const tableHeaderClass =
  'px-4 py-2.5 text-left font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mut';
const primaryButtonClass =
  'rounded-[3px] bg-hud px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-hud/85 disabled:cursor-wait disabled:opacity-50';
const dangerButtonClass =
  'rounded-[3px] bg-tr px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-tr/85 disabled:cursor-wait disabled:opacity-50';
const secondaryButtonClass =
  'rounded-[2px] border border-edge-2 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-ink-2 transition-colors hover:border-mut hover:text-ink disabled:cursor-wait disabled:opacity-50';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'blacklist', label: 'Ban' },
  { id: 'banned', label: 'Bans' },
  { id: 'add', label: 'Add' },
  { id: 'recover', label: 'Recover IP' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'audit', label: 'Audit' },
];

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

function reasonEntries(values: Record<string, number>): [string, number][] {
  return Object.entries(values).sort((left, right) => {
    if (left[1] !== right[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
}

export const AdminPanel = memo(function AdminPanel({
  isOpen,
  onClose,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('blacklist');
  const [credentials, setCredentials] = useState<AdminCredentials>({
    username: '',
    password: '',
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<MutationData | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [blacklistAddress, setBlacklistAddress] = useState('');
  const [blacklistReason, setBlacklistReason] =
    useState<WritableBanReason>('none');
  const [addAddress, setAddAddress] = useState('');
  const [recoveryAddress, setRecoveryAddress] = useState('');
  const [bannedServers, setBannedServers] = useState<BannedServer[]>([]);
  const [observationAddress, setObservationAddress] = useState('');
  const [observationReason, setObservationReason] = useState('');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [observationCursor, setObservationCursor] = useState('');
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const retryKeys = useRef(new Map<string, string>());

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
    setResponseData(null);
  }, []);

  const testAuthentication = useCallback(async (
    testCredentials: AdminCredentials,
    isAutoLogin = false
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/banned', {
        headers: {
          Authorization: createAuthHeader(testCredentials),
        },
      });

      if (response.ok) {
        const data = await readJson<BannedServer[]>(response);
        setBannedServers(data ?? []);
        setIsAuthenticated(true);
        setCredentials(testCredentials);
        setSuccess(
          isAutoLogin
            ? 'Welcome back. Saved credentials are valid.'
            : 'Authentication successful.'
        );
        return true;
      }

      if (isAutoLogin) {
        clearAdminCredentials();
        setCredentials({ username: '', password: '' });
      }
      setError(
        response.status === 401
          ? 'Invalid username or password.'
          : 'The admin API is unavailable.'
      );
      setIsAuthenticated(false);
      return false;
    } catch {
      setError('Authentication failed.');
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsCheckingAuth(true);
    const savedCredentials = loadAdminCredentials();
    if (savedCredentials) {
      setCredentials(savedCredentials);
      void testAuthentication(savedCredentials, true);
      return;
    }
    setIsCheckingAuth(false);
  }, [isOpen, testAuthentication]);

  const runMutation = useCallback(async (
    endpoint: 'add' | 'blacklist' | 'unban' | 'unblacklist',
    intent: string,
    formData: FormData,
    completedMessage: string
  ): Promise<boolean> => {
    setLoading(true);
    clearMessages();

    const operationKey =
      retryKeys.current.get(intent) ?? crypto.randomUUID();

    try {
      const response = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(credentials),
          'Idempotency-Key': operationKey,
        },
        body: formData,
      });
      const payload = await readJson<AdminEnvelope>(response);
      const data = asMutationData(payload?.data);
      setResponseData(data);

      if (response.ok && payload?.success !== false) {
        retryKeys.current.delete(intent);
        setSuccess(mutationSuccessMessage(completedMessage, data));
        return true;
      }

      if (shouldRetryWithSameKey(payload?.data)) {
        retryKeys.current.set(intent, operationKey);
        setError(
          `${payload?.error || 'Mutation result is unknown.'} Retry this unchanged action to reuse its operation key.`
        );
      } else {
        retryKeys.current.delete(intent);
        setError(payload?.error || `${completedMessage} failed.`);
      }
      return false;
    } catch {
      retryKeys.current.set(intent, operationKey);
      setResponseData({
        operation_key: operationKey,
        retry_same_key: true,
      });
      setError(
        'The request outcome is unknown. Retry this unchanged action to reuse its operation key.'
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearMessages, credentials]);

  const fetchBannedServers = useCallback(async (
    preserveMessages = false
  ) => {
    setLoading(true);
    if (!preserveMessages) {
      clearMessages();
    }
    try {
      const response = await fetch('/api/admin/banned', {
        headers: {
          Authorization: createAuthHeader(credentials),
        },
      });
      const data = await readJson<BannedServer[]>(response);
      if (!response.ok || !Array.isArray(data)) {
        setError('Failed to fetch banned servers.');
        return;
      }
      setBannedServers(data);
    } catch {
      setError('Failed to fetch banned servers.');
    } finally {
      setLoading(false);
    }
  }, [clearMessages, credentials]);

  const fetchObservations = useCallback(async (append: boolean) => {
    setLoading(true);
    clearMessages();
    try {
      const search = new URLSearchParams({ limit: '50' });
      if (observationAddress.trim()) {
        search.set('address', observationAddress.trim());
      }
      if (observationReason) {
        search.set('reason', observationReason);
      }
      if (append && observationCursor) {
        search.set('cursor', observationCursor);
      }

      const response = await fetch(
        `/api/admin/observations?${search.toString()}`,
        {
          headers: {
            Authorization: createAuthHeader(credentials),
          },
        }
      );
      const data = await readJson<ObservationPage>(response);
      if (!response.ok || !data || !Array.isArray(data.observations)) {
        setError('Failed to fetch abuse evidence.');
        return;
      }
      setObservations(current =>
        append ? [...current, ...data.observations] : data.observations
      );
      setObservationCursor(data.next_cursor || '');
    } catch {
      setError('Failed to fetch abuse evidence.');
    } finally {
      setLoading(false);
    }
  }, [
    clearMessages,
    credentials,
    observationAddress,
    observationCursor,
    observationReason,
  ]);

  const fetchAuditSummary = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const response = await fetch('/api/admin/audit', {
        headers: {
          Authorization: createAuthHeader(credentials),
        },
      });
      const data = await readJson<AuditSummary>(response);
      if (!response.ok || !data) {
        setError('Failed to fetch the legacy audit summary.');
        return;
      }
      setAuditSummary(data);
    } catch {
      setError('Failed to fetch the legacy audit summary.');
    } finally {
      setLoading(false);
    }
  }, [clearMessages, credentials]);

  const handleLogin = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    clearMessages();
    try {
      const authenticated = await testAuthentication(credentials);
      if (authenticated) {
        saveAdminCredentials(credentials);
      }
    } finally {
      setLoading(false);
    }
  }, [clearMessages, credentials, testAuthentication]);

  const handleBlacklist = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const address = blacklistAddress.trim();
    const formData = new FormData();
    formData.append('address', address);
    formData.append('reason', blacklistReason);
    const completed = await runMutation(
      'blacklist',
      `blacklist:${address}:${blacklistReason}`,
      formData,
      'Server blacklisted'
    );
    if (completed) {
      setBlacklistAddress('');
      setBlacklistReason('none');
    }
  }, [blacklistAddress, blacklistReason, runMutation]);

  const handleAddServer = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const address = addAddress.trim();
    const formData = new FormData();
    formData.append('address', address);
    const completed = await runMutation(
      'add',
      `add:${address}`,
      formData,
      'Server added'
    );
    if (completed) {
      setAddAddress('');
    }
  }, [addAddress, runMutation]);

  const handleUnban = useCallback(async (address: string) => {
    const formData = new FormData();
    formData.append('address', address);
    const completed = await runMutation(
      'unban',
      `unban:${address}`,
      formData,
      'Server ban recovered'
    );
    if (completed) {
      await fetchBannedServers(true);
    }
  }, [fetchBannedServers, runMutation]);

  const handleUnblacklist = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const address = recoveryAddress.trim();
    const formData = new FormData();
    formData.append('address', address);
    const completed = await runMutation(
      'unblacklist',
      `unblacklist:${address}`,
      formData,
      'IP blacklist recovered'
    );
    if (completed) {
      setRecoveryAddress('');
    }
  }, [recoveryAddress, runMutation]);

  const handleObservationSearch = useCallback(async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    setObservationCursor('');
    await fetchObservations(false);
  }, [fetchObservations]);

  const handleTabChange = useCallback((tab: AdminTab) => {
    setActiveTab(tab);
    clearMessages();
    if (tab === 'banned') {
      void fetchBannedServers();
    } else if (tab === 'evidence') {
      void fetchObservations(false);
    } else if (tab === 'audit') {
      void fetchAuditSummary();
    }
  }, [
    clearMessages,
    fetchAuditSummary,
    fetchBannedServers,
    fetchObservations,
  ]);

  const handleLogout = useCallback(() => {
    clearAdminCredentials();
    retryKeys.current.clear();
    setIsAuthenticated(false);
    setCredentials({ username: '', password: '' });
    setActiveTab('blacklist');
    clearMessages();
    setSuccess('Logged out.');
  }, [clearMessages]);

  const handleClose = useCallback(() => {
    setActiveTab('blacklist');
    clearMessages();
    onClose();
  }, [clearMessages, onClose]);

  useModalDialog(panelRef, isOpen, handleClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin panel"
        tabIndex={-1}
        className="mx-auto flex max-h-[95vh] w-full max-w-6xl flex-col rounded border border-edge-2 bg-panel shadow-2xl focus:outline-none"
      >
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold uppercase tracking-wider text-ink sm:text-xl">
                Admin Panel
              </h2>
              {isAuthenticated && (
                <p className="mt-1 text-xs text-mut">
                  Durable mutations use one UUID per action and preserve it for uncertain retries.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="rounded-[2px] border border-tr/60 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-tr transition-colors hover:bg-tr hover:text-bg"
                  title="Logout and clear saved credentials"
                >
                  Logout
                </button>
              )}
              <button
                onClick={handleClose}
                className="rounded-[3px] p-2 text-mut transition-colors hover:bg-panel-2 hover:text-ink"
                aria-label="Close admin panel"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {!isAuthenticated ? (
            isCheckingAuth ? (
              <p className="py-8 text-center font-mono text-sm text-mut">
                ] checking saved credentials
                <span className="cursor-blink">_</span>
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
                      onChange={event =>
                        setCredentials(current => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                      className={fieldClass}
                      autoComplete="username"
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
                      onChange={event =>
                        setCredentials(current => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      className={fieldClass}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full ${primaryButtonClass}`}
                  >
                    {loading ? 'Authenticating…' : 'Login'}
                  </button>
                </form>
              </div>
            )
          ) : (
            <>
              <div
                className="scrollbar-thin mb-6 flex overflow-x-auto border-b border-edge"
                role="tablist"
                aria-label="Admin tools"
              >
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`-mb-px shrink-0 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
                      activeTab === tab.id
                        ? 'border-b-2 border-hud text-hud'
                        : 'border-b-2 border-transparent text-mut hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div role="tabpanel">
                {activeTab === 'blacklist' && (
                  <div className="max-w-2xl space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        Blacklist a server
                      </h3>
                      <p className="mt-1 text-sm text-mut">
                        This creates durable manual enforcement for one IP and port.
                      </p>
                    </div>
                    <form onSubmit={handleBlacklist} className="space-y-4">
                      <div>
                        <label
                          className={labelClass}
                          htmlFor="blacklist-address"
                        >
                          Server address (IP:PORT)
                        </label>
                        <input
                          id="blacklist-address"
                          type="text"
                          value={blacklistAddress}
                          onChange={event =>
                            setBlacklistAddress(event.target.value)
                          }
                          placeholder="192.0.2.10:27015"
                          className={`${fieldClass} font-mono`}
                          required
                        />
                      </div>
                      <div>
                        <label
                          className={labelClass}
                          htmlFor="blacklist-reason"
                        >
                          Reason
                        </label>
                        <select
                          id="blacklist-reason"
                          value={blacklistReason}
                          onChange={event =>
                            setBlacklistReason(
                              event.target.value as WritableBanReason
                            )
                          }
                          className={fieldClass}
                        >
                          {WRITABLE_BAN_REASONS.map(reason => (
                            <option key={reason} value={reason}>
                              {formatAdminLabel(reason)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={dangerButtonClass}
                      >
                        {loading ? 'Blacklisting…' : 'Blacklist Server'}
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === 'banned' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-ink">
                          Active durable bans
                        </h3>
                        <p className="mt-1 text-sm text-mut">
                          Manual, tracker-confirmed, and migrated legacy bans.
                        </p>
                      </div>
                      <button
                        onClick={() => void fetchBannedServers()}
                        disabled={loading}
                        className={secondaryButtonClass}
                      >
                        {loading ? 'Loading…' : 'Refresh'}
                      </button>
                    </div>
                    {bannedServers.length === 0 ? (
                      <p className="py-8 text-center font-mono text-sm text-mut">
                        ] no active durable bans
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-[3px] border border-edge">
                        <table className="min-w-full">
                          <thead className="bg-panel-2">
                            <tr className="border-b border-edge">
                              <th className={tableHeaderClass}>Address</th>
                              <th className={tableHeaderClass}>Source</th>
                              <th className={tableHeaderClass}>Reason</th>
                              <th className={tableHeaderClass}>Strikes</th>
                              <th className={tableHeaderClass}>
                                Last detection
                              </th>
                              <th className={tableHeaderClass}>Banned</th>
                              <th className={tableHeaderClass}>State</th>
                              <th className={tableHeaderClass}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bannedServers.map(server => (
                              <tr
                                key={server.address}
                                className="border-b border-edge/60 last:border-b-0 hover:bg-panel-2"
                              >
                                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-ink">
                                  {server.address}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-ink-2">
                                  {formatAdminLabel(server.source)}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-ink-2">
                                  {formatAdminLabel(server.abuse_reason)}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-sm text-ink-2">
                                  {server.strike_count}
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-mut">
                                  {formatAdminTimestamp(
                                    server.last_detected_at
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-mut">
                                  {formatAdminTimestamp(server.banned_at)}
                                </td>
                                <td className="px-4 py-2.5 text-sm">
                                  <span
                                    className={
                                      server.valid ? 'text-ok' : 'text-tr'
                                    }
                                    title={server.validity_reason}
                                  >
                                    {server.valid ? 'Valid' : 'Invalid'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <button
                                    type="button"
                                    disabled={loading || !server.valid}
                                    onClick={() =>
                                      void handleUnban(server.address)
                                    }
                                    className={secondaryButtonClass}
                                  >
                                    Unban
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'add' && (
                  <div className="max-w-2xl space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        Add a server
                      </h3>
                      <p className="mt-1 text-sm text-mut">
                        Add or retain one canonical public server address.
                      </p>
                    </div>
                    <form onSubmit={handleAddServer} className="space-y-4">
                      <div>
                        <label className={labelClass} htmlFor="add-address">
                          Server address (IP:PORT)
                        </label>
                        <input
                          id="add-address"
                          type="text"
                          value={addAddress}
                          onChange={event => setAddAddress(event.target.value)}
                          placeholder="192.0.2.10:27015"
                          className={`${fieldClass} font-mono`}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={primaryButtonClass}
                      >
                        {loading ? 'Adding…' : 'Add Server'}
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === 'recover' && (
                  <div className="max-w-2xl space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        Recover a whole-IP blacklist
                      </h3>
                      <p className="mt-1 text-sm text-mut">
                        Removes one exact durable IP blacklist. Deleted server rows may still require discovery or a manual add.
                      </p>
                    </div>
                    <form onSubmit={handleUnblacklist} className="space-y-4">
                      <div>
                        <label className={labelClass} htmlFor="recovery-address">
                          Canonical public IPv4 address
                        </label>
                        <input
                          id="recovery-address"
                          type="text"
                          value={recoveryAddress}
                          onChange={event =>
                            setRecoveryAddress(event.target.value)
                          }
                          placeholder="192.0.2.10"
                          className={`${fieldClass} font-mono`}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={primaryButtonClass}
                      >
                        {loading ? 'Recovering…' : 'Recover IP'}
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === 'evidence' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        Abuse evidence
                      </h3>
                      <p className="mt-1 text-sm text-mut">
                        Newest observations appear first. Pagination preserves the backend cursor unchanged.
                      </p>
                    </div>
                    <form
                      onSubmit={handleObservationSearch}
                      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                    >
                      <div>
                        <label
                          className={labelClass}
                          htmlFor="observation-address"
                        >
                          Server address
                        </label>
                        <input
                          id="observation-address"
                          type="text"
                          value={observationAddress}
                          onChange={event =>
                            setObservationAddress(event.target.value)
                          }
                          placeholder="192.0.2.10:27015"
                          className={`${fieldClass} font-mono`}
                        />
                      </div>
                      <div>
                        <label
                          className={labelClass}
                          htmlFor="observation-reason"
                        >
                          Reason
                        </label>
                        <select
                          id="observation-reason"
                          value={observationReason}
                          onChange={event =>
                            setObservationReason(event.target.value)
                          }
                          className={fieldClass}
                        >
                          <option value="">All reasons</option>
                          {DETECTION_REASONS.map(reason => (
                            <option key={reason} value={reason}>
                              {formatAdminLabel(reason)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={primaryButtonClass}
                      >
                        Search
                      </button>
                    </form>
                    {observations.length === 0 ? (
                      <p className="py-8 text-center font-mono text-sm text-mut">
                        ] no matching observations
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-[3px] border border-edge">
                        <table className="min-w-full">
                          <thead className="bg-panel-2">
                            <tr className="border-b border-edge">
                              <th className={tableHeaderClass}>Observed</th>
                              <th className={tableHeaderClass}>Address</th>
                              <th className={tableHeaderClass}>Reason</th>
                              <th className={tableHeaderClass}>Source</th>
                              <th className={tableHeaderClass}>Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {observations.map(observation => (
                              <tr
                                key={observation.id}
                                className="border-b border-edge/60 last:border-b-0 hover:bg-panel-2"
                              >
                                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-mut">
                                  {formatAdminTimestamp(
                                    observation.observed_at
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-ink">
                                  {observation.address}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-ink-2">
                                  {formatAdminLabel(observation.reason)}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-ink-2">
                                  {formatAdminLabel(observation.source)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <details>
                                    <summary className="cursor-pointer text-xs text-ct">
                                      View JSON
                                    </summary>
                                    <pre className="mt-2 max-w-xl overflow-x-auto whitespace-pre-wrap font-mono text-xs text-mut">
                                      {JSON.stringify(
                                        observation.evidence,
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </details>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {observationCursor && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void fetchObservations(true)}
                        className={secondaryButtonClass}
                      >
                        {loading ? 'Loading…' : 'Load Older'}
                      </button>
                    )}
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-ink">
                          Legacy enforcement audit
                        </h3>
                        <p className="mt-1 text-sm text-mut">
                          Migrated bans and event-unlinked blacklists grouped by their persisted reason.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void fetchAuditSummary()}
                        className={secondaryButtonClass}
                      >
                        Refresh
                      </button>
                    </div>
                    {auditSummary ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          {
                            title: 'Legacy server bans',
                            values:
                              auditSummary.legacy_server_bans_by_reason,
                          },
                          {
                            title: 'Legacy IP blacklists',
                            values:
                              auditSummary.legacy_blacklists_by_reason,
                          },
                        ].map(group => (
                          <div
                            key={group.title}
                            className="rounded-[3px] border border-edge"
                          >
                            <h4 className="border-b border-edge bg-panel-2 px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-ink">
                              {group.title}
                            </h4>
                            <dl>
                              {reasonEntries(group.values).map(
                                ([reason, count]) => (
                                  <div
                                    key={reason}
                                    className="flex items-center justify-between gap-4 border-b border-edge/60 px-4 py-2.5 last:border-b-0"
                                  >
                                    <dt className="text-sm text-ink-2">
                                      {formatAdminLabel(reason)}
                                    </dt>
                                    <dd className="font-mono text-sm text-hud">
                                      {count}
                                    </dd>
                                  </div>
                                )
                              )}
                            </dl>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center font-mono text-sm text-mut">
                        ] no audit summary loaded
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div aria-live="polite">
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
          {responseData && (
            <details className="mt-3 rounded-[3px] border border-edge p-3">
              <summary className="cursor-pointer font-display text-[11px] font-semibold uppercase tracking-wider text-mut">
                Operation details
              </summary>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-ink-2">
                {JSON.stringify(responseData, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
});
