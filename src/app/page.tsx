import { ServerBrowserClient } from './servers/client';
import { isBackendStatus, type BackendStatus } from '@/utils/backendStatus';
import { isBlacklistCount } from '@/utils/blacklist';
import { isServerList, type Server } from '@/utils/servers';

interface InitialServerResult {
  servers: Server[];
  status: BackendStatus | null;
  listAvailable: boolean;
}

class UnexpectedServerResponseError extends Error {}

const INITIAL_SERVER_TIMEOUT = 10_000;
const INITIAL_STATUS_TIMEOUT = 2_000;
const INITIAL_BLACKLIST_TIMEOUT = 2_000;

function isStartupNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  return typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function configuredVipIps(): string[] {
  const configured = process.env.VIP_IPS ?? process.env.NEXT_PUBLIC_VIP_IPS ?? '';
  return [...new Set(
    configured
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
  )];
}

async function getBackendStatus(): Promise<BackendStatus | null> {
  try {
    const response = await fetch(`${process.env.API_URL}/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(INITIAL_STATUS_TIMEOUT),
    });
    if (!response.ok) {
      return null;
    }
    const status: unknown = await response.json();
    return isBackendStatus(status) ? status : null;
  } catch {
    return null;
  }
}

async function getBlacklistCount(): Promise<number | null> {
  try {
    const response = await fetch(`${process.env.API_URL}/blacklist/count`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(INITIAL_BLACKLIST_TIMEOUT),
    });
    if (!response.ok) {
      return null;
    }
    const value: unknown = await response.json();
    return isBlacklistCount(value) ? value.count : null;
  } catch {
    return null;
  }
}

async function getInitialServerResult(): Promise<InitialServerResult> {
  const statusPromise = getBackendStatus();
  let response: Response;

  try {
    response = await fetch(`${process.env.API_URL}/servers`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(INITIAL_SERVER_TIMEOUT),
    });
  } catch (error) {
    if (!isStartupNetworkError(error)) {
      throw error;
    }
    const status = await statusPromise;
    return { servers: [], status, listAvailable: false };
  }

  if (response.ok) {
    const servers: unknown = await response.json();
    if (!isServerList(servers)) {
      throw new UnexpectedServerResponseError('Invalid server response');
    }
    return {
      servers,
      status: await statusPromise,
      listAvailable: true,
    };
  }
  if (response.status !== 503) {
    throw new UnexpectedServerResponseError('Failed to fetch servers');
  }
  return {
    servers: [],
    status: await statusPromise,
    listAvailable: false,
  };
}

export default async function Home() {
  const [initial, blacklistCount] = await Promise.all([
    getInitialServerResult(),
    getBlacklistCount(),
  ]);
  return (
    <ServerBrowserClient
      initialServers={initial.servers}
      initialStatus={initial.status}
      initialServerListAvailable={initial.listAvailable}
      initialBlacklistCount={blacklistCount}
      vipIps={configuredVipIps()}
    />
  );
}
