/**
 * URL-backed filter state for admin list pages.
 *
 * The console used to keep list filters in `useState`, so any navigation
 * (the workspace tabs are plain `<Link>`s, which unmount the page) silently
 * reset the operator's filters, pagination and search back to defaults.
 * Putting them in the query string fixes that and makes a filtered list
 * shareable / refresh-safe for free.
 *
 * Design rules:
 * - Reads happen on every render off `useSearch()`, so browser back/forward
 *   and any other owner of the query string stay in sync.
 * - Writes use `history.replaceState`. Wouter patches `replaceState` and
 *   dispatches a `replaceState` event, so subscribed components re-render
 *   without a reload. We deliberately never use `pushState`: tweaking a
 *   dropdown should not become a back-button step.
 * - Values equal to their default are dropped from the URL, so a pristine
 *   page keeps a clean URL.
 * - Params the hook does not own (`?lowFill=`, `?focus=`, ...) are preserved
 *   verbatim on every write.
 * - Unknown / garbage values fall back to the default. Enumerated filters
 *   should pass an `allowed` list; free-text filters (search boxes) accept
 *   any string by design.
 * - A per-route `sessionStorage` mirror re-applies the filters when the
 *   operator returns through one of the shell's clean `<Link>`s (which carry no
 *   query string). It is only consulted when the URL has no query params at
 *   all, so deep links such as `?maxCompleteness=50` or `?lowFill=1` always win.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearch } from "wouter";

export type UrlFilters = Record<string, string>;

export interface UseUrlFiltersOptions<T extends UrlFilters> {
  /**
   * Per-key allow-list. A value that is not in the list is treated as garbage
   * and replaced by the key's default. Omit for free-text filters.
   */
  allowed?: Partial<Record<keyof T & string, readonly string[]>>;
}

export type SetUrlFilter<T extends UrlFilters> = (
  key: keyof T & string,
  value: string,
) => void;

/** Delete the given query params, preserving everything else. */
export function stripUrlParams(keys: readonly string[]): void {
  if (typeof window === "undefined" || keys.length === 0) return;
  applySearch((params) => {
    for (const key of keys) params.delete(key);
  });
}

/**
 * Single writer for the query string. Keeps pathname + hash intact, no-ops
 * when nothing changed (avoids pointless wouter events / re-renders).
 */
function applySearch(mutate: (params: URLSearchParams) => void): void {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  const params = new URLSearchParams(search);
  mutate(params);
  const query = params.toString();
  const next = `${pathname}${query ? `?${query}` : ""}${hash}`;
  const current = `${pathname}${search}${hash}`;
  if (next === current) return;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Session memory for "where was I".
 *
 * The URL is the source of truth, but the shell's tab bar and sidebar navigate
 * with clean hrefs (`<Link href="/admin/event-pools">`), so coming back from a
 * detour lands on a query-less URL. Without this mirror the filters would be
 * wiped by the very navigation this hook exists to survive. Memory is only
 * consulted when the incoming URL carries none of this page's keys — an
 * explicit deep link (`?maxCompleteness=50`) always wins.
 */
const MEMORY_PREFIX = "admin:urlfilters:";

function readMemory(pathname: string): UrlFilters | null {
  try {
    const raw = window.sessionStorage.getItem(`${MEMORY_PREFIX}${pathname}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UrlFilters) : null;
  } catch {
    return null;
  }
}

function writeMemory(pathname: string, values: UrlFilters): void {
  try {
    window.sessionStorage.setItem(
      `${MEMORY_PREFIX}${pathname}`,
      JSON.stringify(values),
    );
  } catch {
    // Private mode / quota — URL state still works, memory is a convenience.
  }
}

function parseFilters<T extends UrlFilters>(
  defaults: T,
  search: string,
  allowed?: Partial<Record<keyof T & string, readonly string[]>>,
): T {
  const params = new URLSearchParams(search);
  const next: UrlFilters = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T & string>) {
    const raw = params.get(key);
    if (raw === null) continue;
    const allowList = allowed?.[key];
    if (allowList && !allowList.includes(raw)) continue; // garbage → default
    next[key] = raw;
  }
  return next as T;
}

/**
 * @param defaults Stable (module-level) map of filter key → default value.
 *   The keys define which params this hook owns; two pages may not own the
 *   same key at the same time.
 * @param options `allowed` allow-lists for enumerated filters.
 * @returns `[filters, setFilter, reset]`
 */
export function useUrlFilters<T extends UrlFilters>(
  defaults: T,
  options?: UseUrlFiltersOptions<T>,
): [T, SetUrlFilter<T>, () => void] {
  const search = useSearch();

  // The defaults object is expected to be a module constant. Keeping it in a
  // ref keeps the parse memo stable even when a caller passes an inline object.
  const defaultsRef = useRef(defaults);
  const allowedRef = useRef(options?.allowed);

  const filters = useMemo(
    () => parseFilters(defaultsRef.current, search, allowedRef.current),
    [search],
  );

  /**
   * Adopt the URL on mount; if it is filter-less (the shell's clean tab links),
   * re-apply what this route remembered earlier in the session. Runs once per
   * mounted route — the ref guard stops the restore's own `replaceState` from
   * re-entering. A layout effect so the restore lands before the first paint and
   * before the list query is kicked off.
   */
  const hydratedRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    if (hydratedRef.current === pathname) return;
    hydratedRef.current = pathname;

    const defaultsNow = defaultsRef.current;
    const allowedNow = allowedRef.current;
    const params = new URLSearchParams(window.location.search);
    const ownKeys = Object.keys(defaultsNow);
    const hasOwnKey = ownKeys.some((key) => params.has(key));

    if (hasOwnKey) {
      writeMemory(pathname, parseFilters(defaultsNow, window.location.search, allowedNow));
      return;
    }

    // Any other param is a deliberate deep link (`?lowFill=1`, `?focus=<id>`,
    // `?tab=…`). Never override that intent with remembered filters, and do not
    // wipe what this route remembers either.
    const hasForeignParam = Array.from(params.keys()).some(
      (key) => !ownKeys.includes(key),
    );
    if (hasForeignParam) return;

    const remembered = readMemory(pathname);
    if (!remembered) return;

    const restored: UrlFilters = { ...defaultsNow };
    let changed = false;
    for (const key of Object.keys(defaultsNow) as Array<keyof T & string>) {
      const value = remembered[key];
      if (typeof value !== "string" || value === "" || value === defaultsNow[key]) continue;
      const allowList = allowedNow?.[key];
      if (allowList && !allowList.includes(value)) continue;
      restored[key] = value;
      changed = true;
    }
    if (!changed) return;

    applySearch((next) => {
      for (const key of Object.keys(restored)) {
        if (restored[key] !== defaultsNow[key as keyof T & string]) {
          next.set(key, restored[key]);
        }
      }
    });
  }, []);

  const remember = useCallback(() => {
    if (typeof window === "undefined") return;
    writeMemory(
      window.location.pathname,
      parseFilters(defaultsRef.current, window.location.search, allowedRef.current),
    );
  }, []);

  const setFilter = useCallback<SetUrlFilter<T>>((key, value) => {
    const fallback = defaultsRef.current[key];
    applySearch((params) => {
      if (value === "" || value === fallback) params.delete(key);
      else params.set(key, value);
    });
    remember();
  }, [remember]);

  const reset = useCallback(() => {
    applySearch((params) => {
      for (const key of Object.keys(defaultsRef.current)) params.delete(key);
    });
    remember();
  }, [remember]);

  return [filters, setFilter, reset];
}

/**
 * Trailing-edge debounce for a value.
 *
 * Note: the repo has no shared `useDebounce` for the admin client (the only
 * implementation lives in `apps/mini-program/.../MatchCompassSections.tsx`
 * and cannot be imported across apps), so the admin copy lives here.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
