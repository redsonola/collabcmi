import type { Readable, Writable } from 'svelte/store';
import { writable } from 'svelte/store';

interface FeatureFlag<T> {
    get: () => T;
    set: (val: T) => void;
    reset: () => void;
}

/**
 * Data that's saved to localstorage, so it's still there when you refresh.
 * localstorage only holds strings & numbers, so this will parse & serialize
 * anything you save.
 */
function persistedValue<T>(
    key: string,
    defaultVal: T,
    parse: ((arg0: string) => T) = JSON.parse,
    serialize: (arg0: T) => string = JSON.stringify,
): FeatureFlag<T> & Readable<T> {
    const saved = window.localStorage[key];
    const initialValue = saved === undefined ? defaultVal : parse(saved);

    const store = writable<T>(initialValue);
    let currentValue = initialValue;

    store.subscribe(value => {
        currentValue = value;
        window.localStorage[key] = serialize(value);
    });

    return {
        ...store,
        get() {
            return currentValue;
        },
        reset() {
            delete window.localStorage[key];
            store.set(defaultVal);
        }
    }
}

export const recordKeypoints = persistedValue<boolean>("recordKeypointsFile", false);
export const recordBodyPartsJerkRaw = persistedValue<boolean>("recordBodyPartsJerkRaw", false);
export const useActiveBorders = persistedValue<boolean>("useActiveBorders", false);
