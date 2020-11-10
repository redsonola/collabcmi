// import { promisify } from 'util';

export const nextTick = () => new Promise(process.nextTick);
export const timeout = (t = 0, args = []) => new Promise(ok => setTimeout(ok, t, ...args));

/**
 * Returns a promise that checks pred() until it returns a non-null value, and
 * resolves to that value.
 */
export function waitFor<T>(pred: () => T | null, waitInterval = 5): Promise<T> {
  const obj = pred();
  if (obj !== null) return Promise.resolve(obj);
  return new Promise((ok) => {
    function check() {
      const obj = pred();
      if (obj !== null) {
        ok(obj);
      } else {
        setTimeout(check, waitInterval);
      }
    }
    setTimeout(check, waitInterval);
  })
}

/**
 * Returns a promise that resolves when pred() returns true.
 */
export function waitUntil(pred: () => boolean, waitInterval = 5): void | Promise<void> {
  if (pred()) return;

  return new Promise((ok) => {
    function check() {
      if (pred()) {
        ok();
      } else {
        setTimeout(check, waitInterval);
      }
    }
    check();
  })
}

export function sleep(time = 0) {
  if (time === 0)
    return nextTick();
  else
    return timeout(time);
}

export const STOP_LOOP = Symbol('@goloop/stop');
export type Stoppable<T> = typeof STOP_LOOP | T;

export async function goLoop<T>(cb: () => Stoppable<T> | Promise<Stoppable<T>>) {
  let result: any = null;
  do {
    result = await cb();
  } while (result !== STOP_LOOP);
}
goLoop.STOP_LOOP = STOP_LOOP;