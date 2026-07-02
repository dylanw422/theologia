"use client";

import { useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import { api } from "@theologia/backend/convex/_generated/api";
import type { Id } from "@theologia/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import ChatThread from "./chat-thread";
import {
  blocksToText,
  type Action,
  type Conversation,
  type Message,
} from "./lib/chat-state";
import { parseBlocks } from "./lib/parse-blocks";

/** A Convex-backed conversation: the mock Conversation shape plus its ids. */
export interface LiveConversation extends Conversation {
  threadId: string;
  convexId: Id<"conversations">;
}

function toMessage(m: UIMessage): Message | null {
  if (m.role === "user") {
    return { id: m.key, role: "user", content: m.text };
  }
  if (m.role !== "assistant") return null;
  const parsed = parseBlocks(m.text, { partial: m.status === "streaming" });
  if (parsed.blocks.length === 0) return null; // nothing renderable yet
  return {
    id: m.key,
    role: "assistant",
    content: blocksToText(parsed.blocks),
    blocks: parsed.blocks,
    actions: parsed.actions.length > 0 ? parsed.actions : undefined,
  };
}

export default function LiveThread({
  conversation,
}: {
  conversation: LiveConversation;
}) {
  const { results } = useUIMessages(
    api.chat.listThreadMessages,
    { threadId: conversation.threadId },
    { initialNumItems: 50, stream: true },
  );
  const sendMessage = useMutation(api.chat.sendMessage);

  const uiMessages = results ?? [];
  const messages = uiMessages
    .map(toMessage)
    .filter((m): m is Message => m !== null);

  const last = uiMessages.at(-1);
  const isStreaming = last?.role === "assistant" && last.status === "streaming";
  const isReplying = messages.at(-1)?.role === "user";

  function send(text: string) {
    if (isReplying || isStreaming) return;
    sendMessage({ conversationId: conversation.convexId, text }).catch(() => {
      toast.error("Could not send the message. Please try again.");
    });
  }

  return (
    <ChatThread
      conversation={{ ...conversation, messages }}
      isReplying={isReplying}
      isStreaming={isStreaming}
      onSend={send}
      onAction={(action: Action) => send(action.prefill)}
    />
  );
}
