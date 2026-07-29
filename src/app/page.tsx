import { ServerBrowserClient } from './servers/client';
import { isBackendStatus, type BackendStatus } from '@/utils/backendStatus';
import { isServerList, type Server } from '@/utils/servers';

interface InitialServerResult {
  servers: Server[];
  status: BackendStatus | null;
  listAvailable: boolean;
}

class UnexpectedServerResponseError extends Error {}

const INITIAL_SERVER_TIMEOUT = 10_000;
const INITIAL_STATUS_TIMEOUT = 2_000;

function isStartupNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  return typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError');
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

async function getInitialServerResult(): Promise<InitialServerResult> {
  const statusPromise = getBackendStatus();

  try {
    const response = await fetch(`${process.env.API_URL}/servers`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(INITIAL_SERVER_TIMEOUT),
    });
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
  } catch (error) {
    if (
      error instanceof UnexpectedServerResponseError ||
      !isStartupNetworkError(error)
    ) {
      throw error;
    }
    const status = await statusPromise;
    return { servers: [], status, listAvailable: false };
  }
}

export default async function Home() {
  const initial = await getInitialServerResult();
  return (
    <ServerBrowserClient
      initialServers={initial.servers}
      initialStatus={initial.status}
      initialServerListAvailable={initial.listAvailable}
    />
  );
}
