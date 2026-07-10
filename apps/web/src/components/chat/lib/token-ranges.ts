export interface TokenRange {
  start: number;
  end: number;
}

/**
 * The range of a known token that the caret position touches — inside it or
 * at either boundary — so the composer can treat inserted verse tokens as
 * atomic chips. Only exact occurrences of `tokens` count; user-typed
 * bracketed text stays ordinary text.
 */
export function findTokenRange(
  text: string,
  tokens: Iterable<string>,
  pos: number,
): TokenRange | null {
  for (const token of tokens) {
    let start = text.indexOf(token);
    while (start !== -1) {
      const end = start + token.length;
      if (pos >= start && pos <= end) return { start, end };
      start = text.indexOf(token, start + 1);
    }
  }
  return null;
}
