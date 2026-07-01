export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  framework: string;
  subTradition?: string;
  messages: Message[];
}

const TITLE_MAX = 48;

function id(): string {
  return crypto.randomUUID();
}

/**
 * Derive a sidebar title from the first line of a message, trimmed and
 * truncated. Empty input falls back to a neutral default.
 */
export function deriveTitle(text: string): string {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  if (firstLine.length === 0) return "New conversation";
  if (firstLine.length <= TITLE_MAX) return firstLine;
  return `${firstLine.slice(0, TITLE_MAX).trimEnd()}…`;
}

export function createConversation(input: {
  framework: string;
  subTradition?: string;
  firstMessage: string;
}): Conversation {
  return {
    id: id(),
    title: deriveTitle(input.firstMessage),
    framework: input.framework,
    subTradition: input.subTradition,
    messages: [{ id: id(), role: "user", content: input.firstMessage }],
  };
}

/**
 * Return a new conversation with the message appended. The original is left
 * untouched so callers can treat conversation state immutably.
 */
export function appendMessage(
  conversation: Conversation,
  message: { role: Role; content: string },
): Conversation {
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      { id: id(), role: message.role, content: message.content },
    ],
  };
}
