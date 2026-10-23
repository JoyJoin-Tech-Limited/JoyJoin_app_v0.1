import { useCallback, useRef, useState } from "react";

/**
 * Guards a destructive "close"/"discard" action behind an explicit confirmation
 * when the caller holds unsaved work.
 *
 * Why a hook instead of `window.confirm`: the admin console already ships Radix
 * `AlertDialog`, an unguarded `form.reset()` on dialog close wiped a fully filled
 * 20-field pool form (overlay mis-click), and browser `confirm()` blocks the
 * renderer, cannot be styled, and is suppressed in some embedded contexts.
 *
 * Usage:
 * ```tsx
 * const { confirmOpen, requestClose, cancelClose, confirmDiscard } =
 *   useUnsavedGuard(isDirty);
 *
 * const handleClose = () => requestClose(() => { form.reset(); onOpenChange(false); });
 *
 * <AlertDialog open={confirmOpen} onOpenChange={(next) => { if (!next) cancelClose(); }}>
 *   ...
 *   <AlertDialogAction onClick={confirmDiscard}>放弃并关闭</AlertDialogAction>
 * </AlertDialog>
 * ```
 *
 * Behaviour:
 * - clean (`isDirty === false`): `requestClose(cb)` runs `cb` immediately and
 *   never opens the confirmation — no extra click on the happy path.
 * - dirty (`isDirty === true`): `requestClose(cb)` stores `cb` and opens the
 *   confirmation. Only `confirmDiscard()` runs `cb`; `cancelClose()` drops it,
 *   so the caller (and the dialog) stays exactly as it was.
 *
 * The pending callback lives in a ref, so a re-render between "ask" and "answer"
 * (a keystroke, a background query resolving) can never swap the queued action.
 */
export interface UnsavedGuard {
  /** Whether the caller should render its confirmation dialog. */
  confirmOpen: boolean;
  /** Run `proceed` now when clean; otherwise ask first. */
  requestClose: (proceed: () => void) => void;
  /** Dismiss the confirmation without running the queued action. */
  cancelClose: () => void;
  /** Dismiss the confirmation and run the queued action exactly once. */
  confirmDiscard: () => void;
}

export function useUnsavedGuard(isDirty: boolean): UnsavedGuard {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requestClose = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      pendingActionRef.current = proceed;
      setConfirmOpen(true);
    },
    [isDirty]
  );

  const cancelClose = useCallback(() => {
    pendingActionRef.current = null;
    setConfirmOpen(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    const proceed = pendingActionRef.current;
    // Clear before invoking: `proceed` may unmount this component, and an
    // unmount-time state update is both pointless and a React warning.
    pendingActionRef.current = null;
    setConfirmOpen(false);
    proceed?.();
  }, []);

  return { confirmOpen, requestClose, cancelClose, confirmDiscard };
}
