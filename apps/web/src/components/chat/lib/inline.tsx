import { Fragment, type ReactNode } from "react";

/**
 * Assistant prose arrives with Markdown-style emphasis markers: `*italic*`
 * and `**bold**`. These render as literal asterisks unless we convert them, so
 * a small inline pass turns the two most common markers into `<em>`/`<strong>`.
 */
export type InlineToken =
  | { type: "text"; text: string }
  | { type: "em"; text: string }
  | { type: "strong"; text: string };

// `**bold**` is tried before `*italic*`; inner runs exclude `*` and newlines so
// only paired, single-line markers match (a lone `*` stays literal text).
const EMPHASIS = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

/** Split prose into plain / italic / bold runs. Pure, so it can be unit-tested. */
export function tokenizeEmphasis(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  for (const part of text.split(EMPHASIS)) {
    if (part === "") continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      tokens.push({ type: "strong", text: part.slice(2, -2) });
    } else if (part.startsWith("*") && part.endsWith("*")) {
      tokens.push({ type: "em", text: part.slice(1, -1) });
    } else {
      tokens.push({ type: "text", text: part });
    }
  }
  return tokens;
}

/** Render prose text with `*italic*` and `**bold**` emphasis applied. */
export function renderInline(text: string): ReactNode {
  return tokenizeEmphasis(text).map((token, index) => {
    if (token.type === "strong") {
      return <strong key={index}>{token.text}</strong>;
    }
    if (token.type === "em") {
      return <em key={index}>{token.text}</em>;
    }
    return <Fragment key={index}>{token.text}</Fragment>;
  });
}
