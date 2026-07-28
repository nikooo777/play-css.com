'use client';

import { useCallback, useRef, useState } from 'react';
import { useModalDialog } from '@/utils/useModalDialog';

interface BlacklistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DownloadState = 'idle' | 'downloading' | 'complete' | 'error';

export function BlacklistModal({ isOpen, onClose }: BlacklistModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const downloadController = useRef<AbortController | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');

  const handleClose = useCallback(() => {
    downloadController.current?.abort();
    downloadController.current = null;
    setDownloadState('idle');
    onClose();
  }, [onClose]);

  useModalDialog(modalRef, isOpen, handleClose);

  const handleDownload = useCallback(async () => {
    const controller = new AbortController();
    downloadController.current?.abort();
    downloadController.current = controller;
    setDownloadState('downloading');

    try {
      const response = await fetch('/api/blacklist', {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      if (!response.ok) {
        throw new Error('Failed to download blacklist');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'server_blacklist.txt';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      if (!controller.signal.aborted) {
        setDownloadState('complete');
      }
    } catch {
      if (!controller.signal.aborted) {
        setDownloadState('error');
      }
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null;
      }
    }
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-[2px]">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blacklist-title"
        tabIndex={-1}
        className="mx-auto my-auto max-h-[95vh] w-full max-w-xl overflow-y-auto rounded border border-tr/40 bg-panel shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between border-b border-edge p-4 sm:p-6">
          <div className="pr-4">
            <p className="font-mono text-xs text-tr">&gt; client protection file</p>
            <h2
              id="blacklist-title"
              className="mt-1 font-display text-lg font-semibold uppercase tracking-wider text-ink sm:text-xl"
            >
              Server Blacklist
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-[3px] p-2 text-mut transition-colors hover:bg-panel-2 hover:text-ink"
            aria-label="Close blacklist instructions"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <p className="text-sm leading-6 text-ink-2">
            Keep known fake and abusive servers out of the Counter-Strike: Source server browser.
          </p>

          <div className="mt-5 flex gap-3 rounded-[3px] border border-ok/40 bg-ok/10 p-4">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-ok"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 12 2 2 4-4m5.62-4.38A11.96 11.96 0 0 1 12 2.25a11.96 11.96 0 0 1-8.62 3.37C3.13 6.4 3 7.22 3 8.06c0 5.15 3.41 9.5 8.09 10.91.59.18 1.23.18 1.82 0C17.59 17.56 21 13.21 21 8.06c0-.84-.13-1.66-.38-2.44Z" />
            </svg>
            <div>
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-ok">
                Safe to install
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-2">
                This is a normal plain-text preference file used by the Source server browser. It only lists
                server addresses to hide. It does not replace game binaries, inject code, interfere with VAC,
                or put your account at risk of a ban.
              </p>
            </div>
          </div>

          <ol className="mt-5 space-y-4">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-tr/15 font-mono text-xs text-tr">
                1
              </span>
              <p className="text-sm leading-6 text-ink-2">
                Download <span className="font-mono text-ink">server_blacklist.txt</span>.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-tr/15 font-mono text-xs text-tr">
                2
              </span>
              <p className="min-w-0 text-sm leading-6 text-ink-2">
                In Steam, open your <span className="font-medium text-ink">Library</span>, right-click{' '}
                <span className="font-medium text-ink">Counter-Strike: Source</span>, then select{' '}
                <span className="font-medium text-ink">Manage → Browse local files</span>.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-tr/15 font-mono text-xs text-tr">
                3
              </span>
              <p className="min-w-0 text-sm leading-6 text-ink-2">
                In the folder Steam opens, go to{' '}
                <span className="break-all rounded-[2px] bg-field px-1.5 py-1 font-mono text-xs text-ct">
                  cstrike/cfg/
                </span>
                . Move the downloaded file there and confirm that you want to replace the existing file, if
                prompted.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-tr/15 font-mono text-xs text-tr">
                4
              </span>
              <p className="text-sm leading-6 text-ink-2">
                If the game is running, restart it before opening the server browser. You can remove the file
                later to undo the blacklist.
              </p>
            </li>
          </ol>

          <div aria-live="polite" className="mt-5 min-h-5">
            {downloadState === 'complete' && (
              <p className="font-mono text-sm text-ok">&gt; download started</p>
            )}
            {downloadState === 'error' && (
              <p className="text-sm text-tr" role="alert">
                The blacklist could not be downloaded. Please try again.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-edge bg-panel-2 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-[3px] border border-edge-2 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-ink-2 transition-colors hover:border-mut hover:text-ink"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadState === 'downloading'}
            className="inline-flex items-center justify-center gap-2 rounded-[3px] bg-tr px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-tr/85 disabled:cursor-wait disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
            </svg>
            {downloadState === 'downloading' ? 'Downloading…' : 'Download blacklist'}
          </button>
        </div>
      </div>
    </div>
  );
}
