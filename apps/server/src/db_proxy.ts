import { trackDbOp } from './perf';

const TRACKED_DB_METHODS = new Set(['select', 'insert', 'update', 'delete', 'execute']);

function trackElapsed(startedAt: [number, number]): void {
  const diff = process.hrtime(startedAt);
  trackDbOp(diff[0] * 1e3 + diff[1] * 1e-6);
}

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function isTrackableDbResult(value: unknown): value is Record<PropertyKey, unknown> {
  return isObjectLike(value) && (
    typeof value.then === 'function' ||
    typeof value.execute === 'function'
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isObjectLike(value) && typeof value.then === 'function';
}

function withTrackedPromise<T>(promiseLike: PromiseLike<T> | T, startedAt: [number, number]): Promise<T> {
  return Promise.resolve(promiseLike).then(
    (value) => {
      trackElapsed(startedAt);
      return value;
    },
    (error) => {
      trackElapsed(startedAt);
      throw error;
    },
  );
}

function wrapTrackableDbResult<T>(value: T): T {
  if (!isTrackableDbResult(value)) {
    return value;
  }

  return new Proxy(value, {
    get(target: Record<PropertyKey, unknown>, prop: PropertyKey, receiver: unknown) {
      const original = Reflect.get(target, prop, receiver);
      const promiseLikeTarget = isPromiseLike(target) ? target : null;

      if (prop === 'then' && promiseLikeTarget) {
        return (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          withTrackedPromise(promiseLikeTarget, process.hrtime()).then(onFulfilled, onRejected);
      }

      if (prop === 'catch' && promiseLikeTarget) {
        return (onRejected?: (reason: unknown) => unknown) =>
          withTrackedPromise(promiseLikeTarget, process.hrtime()).catch(onRejected);
      }

      if (prop === 'finally' && promiseLikeTarget) {
        return (onFinally?: () => void) =>
          withTrackedPromise(promiseLikeTarget, process.hrtime()).finally(onFinally);
      }

      if (prop === 'execute' && typeof original === 'function') {
        return (...args: unknown[]) =>
          withTrackedPromise((original as (...executeArgs: unknown[]) => unknown).apply(target, args), process.hrtime());
      }

      if (typeof original === 'function') {
        return (...args: unknown[]) => wrapTrackableDbResult(
          (original as (...callArgs: unknown[]) => unknown).apply(target, args),
        );
      }

      return original;
    },
  }) as T;
}

export function wrapDb(db: any) {
  const handler = {
    get(target: any, prop: PropertyKey, receiver: unknown) {
      const original = Reflect.get(target, prop, receiver);

      if (typeof original === 'function' && TRACKED_DB_METHODS.has(String(prop))) {
        return (...args: any[]) => {
          const result = original.apply(target, args);
          return wrapTrackableDbResult(result);
        };
      }

      if (typeof original === 'function') {
        return original.bind(target);
      }

      return original;
    }
  };
  return new Proxy(db, handler);
}
