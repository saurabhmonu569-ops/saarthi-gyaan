/**
 * SAARTHI v2 — useKnowledge hook
 *
 * Thin React wrapper around src/knowledge/engine.js.
 * Handles:
 *   - Loading knowledge.json on first mount (once, shared)
 *   - Exposing all engine APIs as stable React state
 *   - Loading indicator
 *   - Graceful degradation when knowledge.json not available
 *
 * Usage:
 *   const { ready, getBooks, getChapters, getBookChunks,
 *           hybridSearch, crossBookSearch } = useKnowledge();
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadKnowledge,
  getBooks as _getBooks,
  getChapters as _getChapters,
  getChapterChunks as _getChapterChunks,
  getBookChunks as _getBookChunks,
  getChunk as _getChunk,
  hybridSearch as _hybridSearch,
  keywordSearch as _keywordSearch,
  crossBookSearch as _crossBookSearch,
  getKnowledgeStats as _getStats,
} from "@/knowledge/engine";

// Module-level singleton — load once across all hook instances
let _globalLoaded  = false;
let _globalLoading = null;
let _globalError   = null;
const _subscribers = new Set();

function notifyAll() {
  _subscribers.forEach(fn => fn());
}

async function ensureLoaded() {
  if (_globalLoaded) return true;
  if (_globalLoading) return _globalLoading;

  _globalLoading = loadKnowledge().then(ok => {
    _globalLoaded = ok;
    _globalError  = ok ? null : "Knowledge store failed to load";
    _globalLoading = null;
    notifyAll();
    return ok;
  }).catch(err => {
    _globalError  = String(err);
    _globalLoading = null;
    notifyAll();
    return false;
  });

  return _globalLoading;
}

export function useKnowledge() {
  const [ready, setReady]   = useState(_globalLoaded);
  const [error, setError]   = useState(_globalError);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Subscribe to global load state
    const update = () => {
      if (!mountedRef.current) return;
      setReady(_globalLoaded);
      setError(_globalError);
    };
    _subscribers.add(update);

    // Trigger load if not already loaded
    if (!_globalLoaded && !_globalLoading) {
      ensureLoaded();
    } else if (_globalLoaded) {
      setReady(true);
    }

    return () => {
      mountedRef.current = false;
      _subscribers.delete(update);
    };
  }, []);

  // Stable wrappers — these are pure functions from engine.js
  const getBooks         = useCallback(() => _getBooks(), []);
  const getChapters      = useCallback((bookId) => _getChapters(bookId), []);
  const getChapterChunks = useCallback((bookId, ch) => _getChapterChunks(bookId, ch), []);
  const getBookChunks    = useCallback((bookId) => _getBookChunks(bookId), []);
  const getChunk         = useCallback((id) => _getChunk(id), []);
  const stats            = useCallback(() => _getStats(), []);

  const hybridSearch = useCallback((query, queryEmbedding = null, filters = {}, limit = 10) =>
    _hybridSearch(query, queryEmbedding, filters, limit), []);

  const keywordSearch = useCallback((query, filters = {}, limit = 10) =>
    _keywordSearch(query, filters, limit), []);

  const crossBookSearch = useCallback((query, queryEmbedding = null, perBook = 3) =>
    _crossBookSearch(query, queryEmbedding, perBook), []);

  return {
    ready,
    error,
    getBooks,
    getChapters,
    getChapterChunks,
    getBookChunks,
    getChunk,
    hybridSearch,
    keywordSearch,
    crossBookSearch,
    stats,
  };
}
