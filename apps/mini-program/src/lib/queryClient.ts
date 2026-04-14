import { QueryClient } from '@tanstack/react-query'

// Add a polyfill for AbortController if it doesn't exist in the current environment
// WeChat Mini Program environment currently lacks native AbortController support
if (typeof AbortController === 'undefined') {
  const getGlobalObject = () => {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    if (typeof window !== 'undefined') return window;
    // @ts-ignore
    if (typeof wx !== 'undefined') return wx;
    return {};
  };

  const globalObj = getGlobalObject();

  class AbortSignalPolyfill {
    _aborted = false;
    _reason: any = undefined;
    _listeners: Array<() => void> = [];

    get aborted() {
      return this._aborted;
    }

    get reason() {
      return this._reason;
    }

    addEventListener(type: string, listener: () => void) {
      if (type === 'abort') {
        this._listeners.push(listener);
      }
    }

    removeEventListener(type: string, listener: () => void) {
      if (type === 'abort') {
        this._listeners = this._listeners.filter(l => l !== listener);
      }
    }

    dispatchEvent(event?: any) {
      this._listeners.forEach(listener => {
        try {
          listener();
        } catch (e) {
          console.error('Error in abort listener', e);
        }
      });
      return true;
    }
  }

  // @ts-ignore
  globalObj.AbortController = class AbortControllerPolyfill {
    signal = new AbortSignalPolyfill();
    abort(reason?: any) {
      if (!this.signal._aborted) {
        this.signal._aborted = true;
        this.signal._reason = reason;
        this.signal.dispatchEvent();
      }
    }
  };
  
  // @ts-ignore
  globalObj.AbortSignal = AbortSignalPolyfill;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
