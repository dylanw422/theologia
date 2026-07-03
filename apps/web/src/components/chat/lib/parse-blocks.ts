import type { Action, Block } from "./chat-state";

/**
 * Parser for the tagged streaming format the model emits (see the tag
 * vocabulary in packages/backend/convex/lib/prompts.ts). Untagged text
 * becomes prose blocks; each known tag maps 1:1 onto a Block variant;
 * <followups> maps to Action chips. Malformed or unknown tags degrade to
 * prose — this parser never throws on model output.
 */

export interface ParsedMessage {
  blocks: Block[];
  actions: Action[];
  /** True when partial text ends inside an unclosed tag (still streaming). */
  pending: boolean;
}

const TAG_NAMES = [
  "scripture",
  "history",
  "lexicon",
  "comparison",
  "points",
  "resources",
  "source",
  "article",
  "followups",
] as const;
type TagName = (typeof TAG_NAMES)[number];

const OPEN_TAG = new RegExp(`<(${TAG_NAMES.join("|")})(\\s[^>]*)?>`, "g");

function unescapeEntities(s: string): string {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function parseAttrs(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const m of raw.matchAll(/([\w-]+)="([^"]*)"/g)) {
    out[m[1]!] = unescapeEntities(m[2]!);
  }
  return out;
}

/** All <tag …>body</tag> and self-closing <tag … /> children of `inner`. */
function children(
  inner: string,
  tag: string,
): { attrs: Record<string, string>; body: string }[] {
  const re = new RegExp(
    `<${tag}(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`,
    "g",
  );
  const out: { attrs: Record<string, string>; body: string }[] = [];
  for (const m of inner.matchAll(re)) {
    out.push({ attrs: parseAttrs(m[1]), body: (m[2] ?? "").trim() });
  }
  return out;
}

/** Inner text of the first <tag>…</tag> child, unescaped. */
function tagText(inner: string, tag: string): string {
  const m = inner.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? unescapeEntities(m[1]!.trim()) : "";
}

function pushProse(blocks: Block[], raw: string): void {
  for (const paragraph of raw.split(/\n{2,}/)) {
    const text = paragraph.trim();
    if (text) blocks.push({ type: "prose", text });
  }
}

/** Drop a partially typed tag hanging off the end of streaming text. */
function stripPartialTag(s: string): string {
  return s.replace(/<[^>]*$/, "");
}

/** The in-progress last <tag …>body child of `inner`, if its open tag is complete. */
function trailingChild(
  inner: string,
  tag: string,
): { attrs: Record<string, string>; body: string } | null {
  const close = `</${tag}>`;
  const last = inner.lastIndexOf(close);
  const rest = inner.slice(last === -1 ? 0 : last + close.length);
  const m = rest.match(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*)$`));
  return m ? { attrs: parseAttrs(m[1]), body: m[2] ?? "" } : null;
}

const TIERS = ["introductory", "intermediate", "scholarly"] as const;
type Tier = (typeof TIERS)[number];

function resourceTier(raw: string | undefined): Tier {
  return (TIERS as readonly string[]).includes(raw ?? "")
    ? (raw as Tier)
    : "introductory";
}

function pointItems(
  inner: string,
): { title: string; body: string; weight?: string }[] {
  return children(inner, "point")
    .map((p) => ({
      title: p.attrs.title ?? "",
      body: unescapeEntities(p.body),
      ...(p.attrs.weight ? { weight: p.attrs.weight } : {}),
    }))
    .filter((i) => i.title && i.body);
}

function resourceItems(
  inner: string,
): { title: string; author: string; tier: Tier; note: string }[] {
  return children(inner, "item")
    .map((it) => ({
      title: it.attrs.title ?? "",
      author: it.attrs.author ?? "",
      tier: resourceTier(it.attrs.tier),
      note: unescapeEntities(it.body),
    }))
    .filter((i) => i.title);
}

function toBlock(
  tag: Exclude<TagName, "followups">,
  attrs: Record<string, string>,
  inner: string,
): Block | null {
  switch (tag) {
    case "scripture": {
      const text = unescapeEntities(inner.trim());
      if (!attrs.ref || !text) return null;
      return { type: "scripture", reference: attrs.ref, text };
    }
    case "history": {
      const text = unescapeEntities(inner.trim());
      if (!attrs.heading || !text) return null;
      return { type: "history", heading: attrs.heading, text };
    }
    case "lexicon": {
      const entries = children(inner, "entry")
        .map((e) => ({
          term: e.attrs.term ?? "",
          translit: e.attrs.translit ?? "",
          gloss: e.attrs.gloss ?? "",
        }))
        .filter((e) => e.term && e.gloss);
      return entries.length > 0 ? { type: "lexicon", entries } : null;
    }
    case "comparison": {
      const columns = children(inner, "column")
        .map((c) => ({
          tradition: c.attrs.tradition ?? "",
          position: tagText(c.body, "position"),
          texts: tagText(c.body, "texts"),
          theologians: tagText(c.body, "theologians"),
        }))
        .filter((c) => c.tradition && c.position);
      return columns.length > 0 ? { type: "comparison", columns } : null;
    }
    case "points": {
      const kind = attrs.kind === "response" ? "response" : "objection";
      const items = pointItems(inner);
      return items.length > 0 ? { type: "points", kind, items } : null;
    }
    case "resources": {
      const items = resourceItems(inner);
      return items.length > 0 ? { type: "resources", items } : null;
    }
    case "source": {
      const excerpt = unescapeEntities(inner.trim());
      if (!attrs.work || !excerpt) return null;
      return {
        type: "source",
        work: attrs.work,
        author: attrs.author ?? "",
        citation: attrs.citation ?? "",
        excerpt,
      };
    }
    case "article": {
      const body = unescapeEntities(inner.trim());
      if (!attrs.label || !body) return null;
      const proofs = attrs.proofs
        ? attrs.proofs.split(";").map((p) => p.trim()).filter(Boolean)
        : undefined;
      return {
        type: "article",
        source: attrs.source ?? "",
        label: attrs.label,
        body,
        ...(proofs && proofs.length > 0 ? { proofs } : {}),
      };
    }
  }
}

/**
 * Partial-mode counterpart of toBlock: builds a block for a tag whose closing
 * tag has not arrived yet. Attributes are complete (they live in the opening
 * tag); the body may be empty or mid-word. Returns null when the tag should
 * stay withheld (missing required attribute, or nothing to show yet).
 */
function toPartialBlock(
  tag: Exclude<TagName, "followups">,
  attrs: Record<string, string>,
  inner: string,
): Block | null {
  const body = unescapeEntities(stripPartialTag(inner).trim());
  switch (tag) {
    case "scripture":
      return attrs.ref
        ? { type: "scripture", reference: attrs.ref, text: body }
        : null;
    case "history":
      return attrs.heading
        ? { type: "history", heading: attrs.heading, text: body }
        : null;
    case "source":
      return attrs.work
        ? {
            type: "source",
            work: attrs.work,
            author: attrs.author ?? "",
            citation: attrs.citation ?? "",
            excerpt: body,
          }
        : null;
    case "article": {
      if (!attrs.label) return null;
      const proofs = attrs.proofs
        ? attrs.proofs.split(";").map((p) => p.trim()).filter(Boolean)
        : undefined;
      return {
        type: "article",
        source: attrs.source ?? "",
        label: attrs.label,
        body,
        ...(proofs && proofs.length > 0 ? { proofs } : {}),
      };
    }
    case "lexicon":
    case "comparison":
      // Attribute/field-based children render only once complete.
      return toBlock(tag, attrs, inner);
    case "points": {
      const kind = attrs.kind === "response" ? "response" : "objection";
      const items = pointItems(inner);
      const tail = trailingChild(inner, "point");
      if (tail?.attrs.title) {
        items.push({
          title: tail.attrs.title,
          body: unescapeEntities(stripPartialTag(tail.body).trim()),
          ...(tail.attrs.weight ? { weight: tail.attrs.weight } : {}),
        });
      }
      return items.length > 0 ? { type: "points", kind, items } : null;
    }
    case "resources": {
      const items = resourceItems(inner);
      const tail = trailingChild(inner, "item");
      if (tail?.attrs.title) {
        items.push({
          title: tail.attrs.title,
          author: tail.attrs.author ?? "",
          tier: resourceTier(tail.attrs.tier),
          note: unescapeEntities(stripPartialTag(tail.body).trim()),
        });
      }
      return items.length > 0 ? { type: "resources", items } : null;
    }
  }
}

export function parseBlocks(
  text: string,
  opts?: { partial?: boolean },
): ParsedMessage {
  const blocks: Block[] = [];
  const actions: Action[] = [];
  let pending = false;
  let cursor = 0;

  OPEN_TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPEN_TAG.exec(text)) !== null) {
    const tag = match[1] as TagName;
    const openEnd = match.index + match[0].length;
    const closeTag = `</${tag}>`;
    const closeIndex = text.indexOf(closeTag, openEnd);

    if (closeIndex === -1) {
      if (opts?.partial) {
        // Unclosed tag while streaming: emit the prose before it, then a
        // partial block that fills in as its content arrives. followups and
        // unsupported partials stay withheld.
        pushProse(blocks, text.slice(cursor, match.index));
        if (tag !== "followups") {
          const block = toPartialBlock(
            tag,
            parseAttrs(match[2]),
            text.slice(openEnd),
          );
          if (block) blocks.push(block);
        }
        cursor = text.length;
        pending = true;
        break;
      }
      // Final text with an unclosed tag: leave it for the prose tail (degrade).
      continue;
    }

    pushProse(blocks, text.slice(cursor, match.index));
    const inner = text.slice(openEnd, closeIndex);

    if (tag === "followups") {
      for (const [i, q] of children(inner, "q").entries()) {
        const label = q.attrs.label ?? "";
        const prefill = unescapeEntities(q.body) || label;
        if (!prefill) continue;
        actions.push({
          id: `followup-${i}`,
          label: label || prefill,
          prefill,
          next: "",
        });
      }
    } else {
      const block = toBlock(tag, parseAttrs(match[2]), inner);
      if (block) {
        blocks.push(block);
      } else if (inner.trim()) {
        // Structurally invalid tag with content: surface its raw text as
        // prose. An empty invalid tag (e.g. <lexicon></lexicon>) is dropped.
        pushProse(blocks, text.slice(match.index, closeIndex + closeTag.length));
      }
    }
    cursor = closeIndex + closeTag.length;
    OPEN_TAG.lastIndex = cursor;
  }

  if (!pending) {
    let tail = text.slice(cursor);
    if (opts?.partial) {
      // A partially typed opening tag at the very end — hold it back.
      const partialOpen = tail.match(/<[a-z][^>]*$/i);
      if (partialOpen) {
        tail = tail.slice(0, partialOpen.index);
        pending = true;
      }
    }
    pushProse(blocks, tail);
  }

  if (opts?.partial && blocks.length > 0) {
    blocks[blocks.length - 1]!.streaming = true;
  }

  return { blocks, actions, pending };
}
