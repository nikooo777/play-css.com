'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRetry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm text-tr">] connection failed</p>
        <p className="mt-2 text-sm text-mut">
          The server list could not be loaded. The master server may be down.
        </p>
        <button
          onClick={handleRetry}
          disabled={isPending}
          className="mt-5 rounded-[2px] border border-hud/60 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-hud transition-colors hover:bg-hud hover:text-bg disabled:cursor-wait disabled:opacity-50"
        >
          {isPending ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </div>
  );
}
