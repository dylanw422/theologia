import {
  createConversation,
  withReply,
  type Conversation,
  type ConversationSetup,
  type ModeId,
} from "./chat-state";
import { getScript } from "./scripts";

const SEED_INPUTS: {
  mode: ModeId;
  setup: ConversationSetup;
  firstMessage: string;
}[] = [
  {
    mode: "qa",
    setup: { framework: "reformed", subTradition: "reformed-baptist" },
    firstMessage: "Does baptism save?",
  },
  {
    mode: "devils-advocate",
    setup: { framework: "reformed", opposing: "arminian-wesleyan" },
    firstMessage: "Test unconditional election against Romans 9.",
  },
  {
    mode: "comparison",
    setup: {
      traditions: [
        "reformed",
        "arminian-wesleyan",
        "roman-catholic",
        "eastern-orthodox",
      ],
    },
    firstMessage: "How do faith and works relate in salvation?",
  },
  {
    mode: "debate-prep",
    setup: { framework: "reformed", opposing: "arminian-wesleyan" },
    firstMessage: "Regeneration precedes faith.",
  },
  {
    mode: "catechism",
    setup: { document: "heidelberg" },
    firstMessage: "Walk me through Question 1.",
  },
  {
    mode: "resources",
    setup: { framework: "reformed", purpose: "personal-study" },
    firstMessage: "Covenant theology",
  },
  {
    mode: "library",
    setup: { collection: "ante-nicene" },
    firstMessage: "What did the early church believe about the Eucharist?",
  },
  {
    mode: "scripture-study",
    setup: { framework: "lutheran" },
    firstMessage: "1 Peter 3:18–22",
  },
];

/**
 * One seeded study per mode, each opened with its script's entry reply, so
 * every answer format is browsable on first load. State is in-memory only and
 * resets on reload.
 */
export function buildSeeds(): Conversation[] {
  return SEED_INPUTS.map((input) =>
    withReply(createConversation(input), getScript(input.mode), {
      isFirst: true,
    }),
  );
}

export const SEED_CONVERSATIONS: Conversation[] = buildSeeds();
