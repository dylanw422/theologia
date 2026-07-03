import type {
  ConversationSetup,
  ModeId,
} from "@theologia/backend/convex/lib/studyData";

export {
  deriveTitle,
  type ConversationSetup,
  type ModeId,
} from "@theologia/backend/convex/lib/studyData";

export type Role = "user" | "assistant";

/**
 * Assistant answers are lists of typed content blocks — prose plus the
 * structured forms each study mode needs (comparison columns, ranked
 * objections, source excerpts, confession articles…). User messages remain
 * plain `content`.
 */
export type Block = (
  | { type: "prose"; text: string }
  | { type: "scripture"; reference: string; text: string }
  | { type: "history"; heading: string; text: string }
  | {
      type: "lexicon";
      entries: { term: string; translit: string; gloss: string }[];
    }
  | {
      type: "comparison";
      columns: {
        tradition: string;
        position: string;
        texts: string;
        theologians: string;
      }[];
    }
  | {
      type: "points";
      kind: "objection" | "response";
      items: { title: string; body: string; weight?: string }[];
    }
  | {
      type: "resources";
      items: {
        title: string;
        author: string;
        tier: "introductory" | "intermediate" | "scholarly";
        note: string;
      }[];
    }
  | {
      type: "source";
      work: string;
      author: string;
      citation: string;
      excerpt: string;
    }
  | {
      type: "article";
      source: string;
      label: string;
      body: string;
      proofs?: string[];
    }
) & {
  /** Set on the last block of a partial parse: content still filling in. */
  streaming?: boolean;
};

/** A follow-up chip: sends `prefill` as the user turn, replies with step `next`. */
export interface Action {
  id: string;
  label: string;
  prefill: string;
  next: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  blocks?: Block[];
  actions?: Action[];
}

export interface Conversation extends ConversationSetup {
  id: string;
  title: string;
  mode: ModeId;
  messages: Message[];
}

/** Flatten blocks to plain text for the copy button and `Message.content`. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "prose":
          return block.text;
        case "scripture":
          return `${block.reference} — ${block.text}`;
        case "history":
          return `${block.heading} — ${block.text}`;
        case "lexicon":
          return block.entries
            .map((e) => `${e.term} (${e.translit}): ${e.gloss}`)
            .join("\n");
        case "comparison":
          return block.columns
            .map((c) => `${c.tradition}: ${c.position}`)
            .join("\n");
        case "points":
          return block.items.map((i) => `${i.title}: ${i.body}`).join("\n");
        case "resources":
          return block.items
            .map((i) => `${i.title} (${i.author}) — ${i.note}`)
            .join("\n");
        case "source":
          return `${block.work}, ${block.citation} — ${block.excerpt}`;
        case "article":
          return `${block.label} — ${block.body}`;
      }
    })
    .join("\n\n");
}
