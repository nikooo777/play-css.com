'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useTransition } from 'react';

const AUTOMATIC_RETRY_DELAY = 5_000;

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRetry = useCallback(() => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }, [reset, router]);

  useEffect(() => {
    const retry = setTimeout(handleRetry, AUTOMATIC_RETRY_DELAY);
    return () => clearTimeout(retry);
  }, [handleRetry]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm text-hud">
          ] reconnecting to server list<span className="cursor-blink">_</span>
        </p>
        <p className="mt-2 text-sm text-mut">
          The backend may be restarting. This page will retry automatically.
        </p>
        <button
          onClick={handleRetry}
          disabled={isPending}
          className="mt-5 rounded-[2px] border border-hud/60 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-hud transition-colors hover:bg-hud hover:text-bg disabled:cursor-wait disabled:opacity-50"
        >
          {isPending ? 'Retrying…' : 'Retry now'}
        </button>
      </div>
    </div>
  );
}
