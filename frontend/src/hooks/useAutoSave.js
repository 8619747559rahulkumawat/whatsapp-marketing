import { useRef, useEffect, useCallback } from 'react';

export function useAutoSave(key, data, delay = 2000) {
  const timerRef = useRef(null);
  const savedRef = useRef(data);

  const save = useCallback(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      savedRef.current = data;
    } catch (e) { /* storage full */ }
  }, [key, data]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [data, delay, save]);

  const restore = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [key]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key); } catch {}
  }, [key]);

  const hasDraft = useCallback(() => {
    try { return localStorage.getItem(key) !== null; } catch { return false; }
  }, [key]);

  return { restore, clearDraft, hasDraft };
}
