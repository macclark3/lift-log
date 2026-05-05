import { useState, useEffect } from "react";

/**
 * Drop-in replacement for useState that persists to localStorage.
 *
 * Usage:
 *   const [history, setHistory] = useLocalStorage("history", []);
 *
 * Key naming: prefix with the app name to avoid collisions across apps on the
 * same domain (we'll all use "liftlog:..." as a convention).
 */
export function useLocalStorage(key, initialValue) {
  const storageKey = `liftlog:${key}`;

  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) return initialValue;
      return JSON.parse(stored);
    } catch (err) {
      console.warn(`Failed to read ${storageKey} from localStorage:`, err);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (err) {
      console.warn(`Failed to write ${storageKey} to localStorage:`, err);
    }
  }, [storageKey, value]);

  return [value, setValue];
}
