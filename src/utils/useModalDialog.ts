import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs in mount order; only the topmost one reacts to Escape,
// outside clicks, and Tab so overlapping dialogs cannot fight over them.
const openDialogs: HTMLElement[] = [];

export function useModalDialog(
  dialogRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void
): void {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (dialog) {
      openDialogs.push(dialog);
      dialog.focus();
    }

    const isTopDialog = () => !dialog || openDialogs[openDialogs.length - 1] === dialog;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog()) {
        return;
      }

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialog) {
        return;
      }

      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const active = document.activeElement;

      // Pull focus back if it escaped the dialog (e.g. the focused element
      // was disabled or removed) or if nothing inside is focusable.
      if (!(active instanceof HTMLElement) || !dialog.contains(active)) {
        event.preventDefault();
        (focusable[0] ?? dialog).focus();
        return;
      }
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (isTopDialog() && dialog && !dialog.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      if (dialog) {
        const index = openDialogs.indexOf(dialog);
        if (index !== -1) {
          openDialogs.splice(index, 1);
        }
      }
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [dialogRef, isOpen, onClose]);
}
