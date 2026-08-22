import { useState, useEffect } from "react";

export function useLocalState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage unavailable — fail silently, app still works in-memory
    }
  }, [key, state]);

  return [state, setState];
}
