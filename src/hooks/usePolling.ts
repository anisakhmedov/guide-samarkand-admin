import { DependencyList, useEffect, useRef, useState } from 'react';

interface PollingOptions {
  /** Keep polling while the tab is hidden (at `hiddenIntervalMs`) — for the notifications bell. */
  hiddenIntervalMs?: number;
}

/**
 * Polls `fn` every `intervalMs`, but never overlaps requests: the next tick is scheduled only
 * after the previous one settles (setInterval used to stack requests up whenever the API was
 * slow, which is what made the panel lag). Paused in background tabs unless
 * `hiddenIntervalMs` is set, and refreshes immediately when the tab becomes visible again.
 * Restarts (with an immediate call) when `deps` change.
 */
export function usePolling(fn: () => Promise<unknown> | void, intervalMs: number, deps: DependencyList = [], options: PollingOptions = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (stopped) return;
      const hidden = document.visibilityState === 'hidden';
      if (hidden && !options.hiddenIntervalMs) return; // resumed by onVisible
      timer = setTimeout(tick, hidden ? options.hiddenIntervalMs : intervalMs);
    };

    const tick = async () => {
      if (stopped || running) return;
      running = true;
      try {
        await fnRef.current();
      } catch {
        // errors are surfaced by the API layer (offline banner / re-login)
      } finally {
        running = false;
        schedule();
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      tick();
    };

    tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, deps);
}

/** Value that settles `delayMs` after the last change — for search inputs. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
