/**
 * SAARTHI — useNotes Hook v2
 *
 * Improvements over v1:
 * - inFlight lock: only one generation runs at a time (prevents double-tap race)
 * - Rate-limit fallback: on retryable error, serves offline notes + shows soft warning
 * - Hard error: on auth/key error, shows actionable message and still delivers fallback
 * - Cancellable: calling generate() while generating is silently ignored
 */

import { useState, useCallback, useRef } from "react";
import {
  generateNotes, hasApiKey,
  getErrorMessage, GeminiError,
} from "@/services/gemini";
import { getFallbackNotes } from "@/services/fallback";

export function useNotes() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [phase,        setPhase]        = useState(null);
  // null | "generating" | "fallback" | "error"
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const inFlightRef = useRef(false);

  const generate = useCallback(async (topic, type = "quick", subject = "") => {
    if (!topic.trim() || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsGenerating(true);
    setPhase("generating");
    setError(null);
    setResult(null);
    setUsedFallback(false);

    try {
      if (!hasApiKey()) {
        // Demo mode — realistic delay then offline notes
        await delay(900);
        setResult(getFallbackNotes(topic.trim(), type));
        setUsedFallback(true);
        return;
      }

      // Real AI
      try {
        const text = await generateNotes(topic.trim(), type, subject);
        setResult(text);
      } catch (apiErr) {
        if (apiErr instanceof GeminiError && apiErr.retryable) {
          // Soft failure (rate limit / transient) → silent fallback
          setPhase("fallback");
          await delay(600);
          setResult(getFallbackNotes(topic.trim(), type));
          setUsedFallback(true);
          if (apiErr.code === "RATE_LIMITED" || apiErr.status === 429) {
            setError("Rate limit — smart offline notes use kar liye. Thodi der baad real AI se try karo.");
          }
        } else {
          // Hard error (bad key, etc.) — still deliver fallback so user isn't empty-handed
          setError(getErrorMessage(apiErr));
          setPhase("error");
          await delay(300);
          setResult(getFallbackNotes(topic.trim(), type));
          setUsedFallback(true);
        }
      }
    } catch (unexpected) {
      console.error("[SAARTHI] useNotes unexpected:", unexpected);
      setError("Kuch unexpected hua. Notes ka template use kar liya hai.");
      setResult(getFallbackNotes(topic.trim(), type));
      setUsedFallback(true);
    } finally {
      setIsGenerating(false);
      setPhase(null);
      inFlightRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setPhase(null);
    setUsedFallback(false);
    inFlightRef.current = false;
  }, []);

  return {
    generate,
    isGenerating,
    phase,        // "generating" | "fallback" | "error" | null
    result,
    error,
    usedFallback, // true if offline notes were served instead of real AI
    reset,
    hasKey: hasApiKey(),
  };
}

const delay = ms => new Promise(r => setTimeout(r, ms));
