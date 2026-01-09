import { trackDbOp } from './perf';
import { sql } from 'drizzle-orm';

export function wrapDb(db: any) {
  const handler = {
    get(target: any, prop: string) {
      const original = target[prop];
      if (typeof original === 'function' && ['select', 'insert', 'update', 'delete', 'execute'].includes(prop)) {
        return (...args: any[]) => {
          const start = process.hrtime();
          const result = original.apply(target, args);
          
          if (result && typeof result.then === 'function') {
            return result.then((val: any) => {
              const diff = process.hrtime(start);
              trackDbOp(diff[0] * 1e3 + diff[1] * 1e-6);
              return val;
            });
          }
          return result;
        };
      }
      return original;
    }
  };
  return new Proxy(db, handler);
}
