/**
 * Remember where the operator was scrolled to, per route.
 *
 * The admin shell (`AdminLayout.tsx`, `<main className="… overflow-auto">`)
 * renders the routed page inside that scroll container, and the page unmounts
 * on navigation, so every list page came back at the top. `AdminLayout` is
 * shared by other agents' work and carries no ref, so this hook resolves the
 * scroll container defensively at runtime:
 *
 *   1. `containerSelector` (default `"main"`) — the documented shell scroller;
 *   2. its first scrollable descendant (covers a future refactor that wraps the
 *      scroller in a non-scrolling container);
 *   3. `document.scrollingElement` (covers pages that grow the document instead).
 *
 * Offset is persisted in `sessionStorage` (per tab; dies with the tab, which is
 * the right lifetime for "where was I"), throttled while scrolling and flushed
 * on unmount. Restoration happens once, after `ready` flips true (i.e. after the
 * data query resolved), inside a single `requestAnimationFrame` so we never
 * fight the initial layout.
 */

import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const STORAGE_PREFIX = "admin:scroll:";
const WRITE_THROTTLE_MS = 150;

export interface ScrollRestorationOptions {
  /** Selector for the shell scroll container. Defaults to `"main"`. */
  containerSelector?: string;
  /**
   * Flip to `true` once the page's data has rendered. Restoration waits for
   * this so the scroll height is real when we write `scrollTop`.
   */
  ready?: boolean;
  /** Override the `sessionStorage` key prefix (tests / special cases). */
  storagePrefix?: string;
}

function canUseStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.sessionStorage;
  } catch {
    return false;
  }
}

function readOffset(key: string): number | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeOffset(key: string, value: number): void {
  if (!canUseStorage()) return;
  try {
    if (value > 0) window.sessionStorage.setItem(key, String(Math.round(value)));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Private mode / quota — scroll memory is a nicety, never fail the page.
  }
}

/** rAF with a timer fallback (jsdom without `pretendToBeVisual`, SSR). */
function nextFrame(cb: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(cb);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(cb, 16);
  return () => clearTimeout(id);
}

function isScrollable(el: HTMLElement): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
    return true;
  }
  // Some engines (and jsdom) do not expand the `overflow` shorthand in computed
  // style, so fall back to the shorthand value.
  return /\b(auto|scroll|overlay)\b/.test(style.overflow || "");
}

/**
 * `instanceof HTMLElement` is unsafe outside a browser realm (the global is
 * absent in some test runners), so fall back to the structural shape.
 */
function asHtmlElement(el: Element | null): HTMLElement | null {
  if (!el) return null;
  if (typeof HTMLElement !== "undefined" && el instanceof HTMLElement) return el;
  return el.nodeType === 1 ? (el as HTMLElement) : null;
}

function findScrollableDescendant(root: HTMLElement): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>("*");
  for (const el of Array.from(candidates)) {
    if (isScrollable(el)) return el;
  }
  return null;
}

/**
 * Resolve the element that actually scrolls the page. Exported for tests and
 * for pages that need to scroll programmatically (`scrollIntoView` targets).
 */
export function resolveScrollContainer(
  containerSelector = "main",
): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const root = asHtmlElement(document.querySelector(containerSelector));
  if (root) {
    if (isScrollable(root)) return root;
    const nested = findScrollableDescendant(root);
    if (nested) return nested;
  }

  return asHtmlElement(document.scrollingElement);
}

/**
 * @param key Route key. Defaults to the current pathname, which is what makes
 *   `/admin/users` and `/admin/events` remember independent offsets.
 */
export function useScrollRestoration(
  key?: string,
  options: ScrollRestorationOptions = {},
): void {
  const [location] = useLocation();
  const { containerSelector = "main", ready = true, storagePrefix = STORAGE_PREFIX } =
    options;

  const storageKey = `${storagePrefix}${key ?? location}`;
  const offsetRef = useRef(0);
  const restoredRef = useRef(false);

  // Track + persist the offset for this route.
  // `ready` is a dependency so the container is re-resolved once the data has
  // rendered: on first paint the shell scroller often has no overflow yet, and
  // resolving too early would attach the listener to the wrong element.
  useEffect(() => {
    const container = resolveScrollContainer(containerSelector);
    if (!container) return;

    offsetRef.current = container.scrollTop;

    let cancelFrame: (() => void) | null = null;
    let lastWrite = 0;
    const onScroll = () => {
      if (cancelFrame) return;
      cancelFrame = nextFrame(() => {
        cancelFrame = null;
        offsetRef.current = container.scrollTop;
        const now = Date.now();
        if (now - lastWrite >= WRITE_THROTTLE_MS) {
          lastWrite = now;
          writeOffset(storageKey, container.scrollTop);
        }
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (cancelFrame) cancelFrame();
      // A mount that never restored yet must not clobber the stored offset with
      // its own initial 0.
      if (restoredRef.current || offsetRef.current > 0) {
        writeOffset(storageKey, offsetRef.current);
      }
    };
  }, [storageKey, containerSelector, ready]);

  // Restore once, after data rendered, in a single frame.
  useEffect(() => {
    if (restoredRef.current || !ready) return;

    const stored = readOffset(storageKey);
    if (stored === null) {
      restoredRef.current = true;
      return;
    }

    const container = resolveScrollContainer(containerSelector);
    if (!container) return;

    restoredRef.current = true;
    return nextFrame(() => {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTop = Math.min(stored, maxScroll);
      offsetRef.current = container.scrollTop;
    });
  }, [ready, storageKey, containerSelector]);
}
