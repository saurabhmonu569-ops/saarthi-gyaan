/**
 * AppContext — global shared state.
 *
 * CRITICAL-2 FIX:
 * useBookProgress was a plain hook called independently in BookDetail and HomeView.
 * Each call got its own useState — they never shared data.
 * Marking a chapter read in BookDetail did NOT update HomeView's "Continue Reading".
 *
 * Fix: lift progress + bookmarks into a single context value here.
 * All components call useBookProgress() → same data, same setters, one source of truth.
 */
import { createContext, useContext, useState, useCallback } from "react";

// ─── LS HELPERS (duplicated here so context is self-contained) ───────────────
const LS = {
  get: (k, def) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
};

// ─── CONTEXTS ─────────────────────────────────────────────────────────────────
const AppCtx  = createContext({ lang: "hi-IN", setLang: () => {} });
const ProgCtx = createContext(null);

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  // Language preference
  const [lang, setLang] = useState("hi-IN");

  // Reading progress — { [bookId]: lastChapterN }
  const [progress, setProgress] = useState(() => LS.get("saarthi_progress", {}));

  // Bookmarks — { ["bookId-chapterN"]: true }
  const [bookmarks, setBookmarks] = useState(() => LS.get("saarthi_bookmarks", {}));

  const markRead = useCallback((bookId, chapterN) => {
    setProgress(prev => {
      const next = { ...prev, [bookId]: Math.max(prev[bookId] || 0, chapterN) };
      LS.set("saarthi_progress", next);
      return next;
    });
  }, []); // stable — no deps that can change

  const toggleBookmark = useCallback((bookId, chapterN) => {
    setBookmarks(prev => {
      const key  = `${bookId}-${chapterN}`;
      const next = { ...prev, [key]: !prev[key] };
      LS.set("saarthi_bookmarks", next);
      return next;
    });
  }, []); // stable

  const isBookmarked = useCallback(
    (bookId, chapterN) => Boolean(bookmarks[`${bookId}-${chapterN}`]),
    [bookmarks]
  );

  const lastChapter = useCallback(
    (bookId) => progress[bookId] || 0,
    [progress]
  );

  const progValue = { markRead, toggleBookmark, isBookmarked, lastChapter };

  return (
    <AppCtx.Provider value={{ lang, setLang }}>
      <ProgCtx.Provider value={progValue}>
        {children}
      </ProgCtx.Provider>
    </AppCtx.Provider>
  );
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
export const useApp = () => useContext(AppCtx);
export const useAppCtx = () => useContext(AppCtx); // alias

/**
 * useBookProgress — shared reading state across ALL components.
 * Was previously a plain hook; now reads from shared context.
 * Returns the same object reference for all callers in the same render tree.
 */
export function useBookProgress() {
  const ctx = useContext(ProgCtx);
  if (!ctx) throw new Error("useBookProgress must be inside AppProvider");
  return ctx;
}
