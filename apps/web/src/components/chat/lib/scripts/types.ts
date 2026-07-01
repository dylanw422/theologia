import type { Action, Block, Conversation } from "../chat-state";

/**
 * One canned assistant reply in a mode's scripted flow. `blocks` may be a
 * function so entry steps can adapt to the conversation's setup (comparison
 * columns, catechism document, tradition names in prose).
 */
export interface ScriptStep {
  blocks: Block[] | ((conversation: Conversation) => Block[]);
  /** Follow-up chips offered under this reply. */
  actions?: Action[];
  /** Step id that should answer the NEXT typed user message (quiz, Socratic). */
  onReply?: string;
}

export interface Script {
  entry: string;
  steps: Record<string, ScriptStep>;
  /** Reply for a typed message when no step is pending. */
  fallback: Block[];
}
