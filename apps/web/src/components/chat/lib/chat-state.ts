import type { Script } from "./scripts/types";
import {
  deriveTitle,
  type ConversationSetup,
  type ModeId,
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
  /** Script step that should answer the next typed message (quiz, Socratic). */
  nextTypedStep?: string;
}

function id(): string {
  return crypto.randomUUID();
}

export function createConversation(input: {
  mode: ModeId;
  setup: ConversationSetup;
  firstMessage: string;
}): Conversation {
  return {
    ...input.setup,
    id: id(),
    title: deriveTitle(input.firstMessage),
    mode: input.mode,
    messages: [{ id: id(), role: "user", content: input.firstMessage }],
  };
}

/**
 * Return a new conversation with the message appended. The original is left
 * untouched so callers can treat conversation state immutably.
 */
export function appendMessage(
  conversation: Conversation,
  message: {
    role: Role;
    content: string;
    blocks?: Block[];
    actions?: Action[];
  },
): Conversation {
  return {
    ...conversation,
    messages: [...conversation.messages, { ...message, id: id() }],
  };
}

export interface ReplyParts {
  blocks: Block[];
  actions?: Action[];
  nextTypedStep?: string;
}

/**
 * Resolve the scripted reply for the current turn. Resolution order: an
 * explicit action target, the entry step for a conversation's first exchange,
 * a pending typed-reply step (quiz/Socratic), then the script's fallback.
 */
export function replyFor(
  conversation: Conversation,
  script: Script,
  opts?: { actionNext?: string; isFirst?: boolean },
): ReplyParts {
  const stepId =
    opts?.actionNext ??
    (opts?.isFirst ? script.entry : conversation.nextTypedStep);
  const step = stepId ? script.steps[stepId] : undefined;
  if (!step) return { blocks: script.fallback };

  const blocks =
    typeof step.blocks === "function" ? step.blocks(conversation) : step.blocks;
  return { blocks, actions: step.actions, nextTypedStep: step.onReply };
}

/** Append the scripted assistant reply and update the pending typed step. */
export function withReply(
  conversation: Conversation,
  script: Script,
  opts?: { actionNext?: string; isFirst?: boolean },
): Conversation {
  const reply = replyFor(conversation, script, opts);
  return {
    ...appendMessage(conversation, {
      role: "assistant",
      content: blocksToText(reply.blocks),
      blocks: reply.blocks,
      actions: reply.actions,
    }),
    nextTypedStep: reply.nextTypedStep,
  };
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
