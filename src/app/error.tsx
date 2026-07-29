'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  automaticRetryDelay,
  recordAutomaticRetry,
} from '@/utils/errorRecovery';

export default function ErrorPage() {
  const [automaticRetryExhausted, setAutomaticRetryExhausted] = useState(false);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    const delay = automaticRetryDelay(window.sessionStorage);
    if (delay === null) {
      const exhausted = setTimeout(
        () => setAutomaticRetryExhausted(true),
        0
      );
      return () => clearTimeout(exhausted);
    }

    let retry: ReturnType<typeof setTimeout> | null = null;
    const cancelRetry = () => {
      if (retry !== null) {
        clearTimeout(retry);
        retry = null;
      }
    };
    const scheduleRetry = () => {
      cancelRetry();
      if (document.visibilityState !== 'visible') {
        return;
      }
      retry = setTimeout(() => {
        recordAutomaticRetry(window.sessionStorage);
        handleRetry();
      }, delay);
    };

    document.addEventListener('visibilitychange', scheduleRetry);
    scheduleRetry();
    return () => {
      document.removeEventListener('visibilitychange', scheduleRetry);
      cancelRetry();
    };
  }, [handleRetry]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm text-hud">
          ] reconnecting to server list<span className="cursor-blink">_</span>
        </p>
        <p className="mt-2 text-sm text-mut">
          {automaticRetryExhausted
            ? 'Automatic retries stopped. Retry when you are ready.'
            : 'The backend may be restarting. This page will retry while this tab is visible.'}
        </p>
        <button
          onClick={handleRetry}
          className="mt-5 rounded-[2px] border border-hud/60 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-hud transition-colors hover:bg-hud hover:text-bg disabled:cursor-wait disabled:opacity-50"
        >
          Retry now
        </button>
      </div>
    </div>
  );
}
