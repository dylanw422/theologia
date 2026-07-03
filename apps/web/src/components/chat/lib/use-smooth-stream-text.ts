import { useEffect, useRef, useState } from "react";

const FPS = 30;
const INITIAL_CHARS_PER_SEC = 120;

interface SmoothState {
  key: string;
  cursor: number;
  charsPerMs: number;
  lastLen: number;
  lastTime: number;
}

/**
 * Reveals `text` character by character at a rate that tracks how fast new
 * characters actually arrive, so throttled stream-delta batches read as a
 * steady flow. State resets when `key` changes (a new message); a message
 * first seen with `streaming` false renders in full immediately. After the
 * source stops streaming, the reveal keeps going until it catches up.
 *
 * (The useSmoothText in @convex-dev/agent/react keeps a single unkeyed
 * cursor, which breaks when consecutive messages stream through one hook
 * instance — hence this keyed variant.)
 */
export function useSmoothStreamText(
  key: string,
  text: string,
  streaming: boolean,
): string {
  const ref = useRef<SmoothState | null>(null);
  if (ref.current === null || ref.current.key !== key) {
    ref.current = {
      key,
      cursor: streaming ? 0 : text.length,
      charsPerMs: INITIAL_CHARS_PER_SEC / 1000,
      lastLen: text.length,
      lastTime: Date.now(),
    };
  }
  const state = ref.current;

  if (text.length > state.lastLen) {
    // New characters arrived: blend the observed arrival rate (plus a
    // catch-up term for accumulated lag) into the reveal rate, capped at
    // doubling per batch so a large paste-like delta doesn't teleport.
    const now = Date.now();
    const elapsed = Math.max(1, now - state.lastTime);
    const arrivalRate = (text.length - state.lastLen) / elapsed;
    const lagRate = Math.max(0, state.lastLen - state.cursor) / elapsed;
    state.charsPerMs = Math.min(
      (2 * (arrivalRate + lagRate) + state.charsPerMs) / 3,
      state.charsPerMs * 2,
    );
    state.lastLen = text.length;
    state.lastTime = now;
  }

  const animating = state.cursor < text.length;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!animating) return;
    let tick = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const chars = Math.floor((now - tick) * state.charsPerMs);
      if (chars <= 0) return;
      state.cursor = Math.min(state.cursor + chars, text.length);
      tick = now;
      rerender((n) => n + 1);
    }, 1000 / FPS);
    return () => clearInterval(id);
  }, [animating, text, state]);

  return animating ? text.slice(0, state.cursor) : text;
}
