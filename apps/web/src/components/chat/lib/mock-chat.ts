import type { Conversation } from "./chat-state";

/**
 * Placeholder assistant reply used while this route is a UI shell. Real
 * framework-aware answers (Claude + tradition system prompts) arrive in a later
 * slice; until then every send resolves to this so the thread feels alive.
 */
export const CANNED_REPLY =
  "This is a preview of Theologia's study environment. In the full release, an answer here would be shaped by your selected tradition — drawing on its confessions, key theologians, and exegetical method — with the relevant church-history context woven in and every Scripture reference exegeted in place. For now the conversation surface is in place and the reasoning is on its way.";

/**
 * A few seeded conversations so the sidebar and thread read as populated on
 * first load. State is in-memory only and resets on reload.
 */
export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "seed-romans-9",
    title: "What does Romans 9 mean?",
    framework: "reformed",
    subTradition: "reformed-baptist",
    messages: [
      {
        id: "seed-romans-9-1",
        role: "user",
        content: "What does Romans 9 mean for unconditional election?",
      },
      { id: "seed-romans-9-2", role: "assistant", content: CANNED_REPLY },
    ],
  },
  {
    id: "seed-baptism",
    title: "Does baptism save?",
    framework: "lutheran",
    messages: [
      {
        id: "seed-baptism-1",
        role: "user",
        content: "Does baptism save, and how should I read 1 Peter 3:21?",
      },
      { id: "seed-baptism-2", role: "assistant", content: CANNED_REPLY },
    ],
  },
  {
    id: "seed-justification",
    title: "Justification: faith and works",
    framework: "roman-catholic",
    subTradition: "post-vatican-ii",
    messages: [
      {
        id: "seed-justification-1",
        role: "user",
        content: "How do faith and works relate in justification?",
      },
      { id: "seed-justification-2", role: "assistant", content: CANNED_REPLY },
    ],
  },
];

export const SAMPLE_PROMPTS = [
  { topic: "Exegesis", prompt: "What does Romans 9 mean for election?" },
  { topic: "Sacraments", prompt: "Does baptism save?" },
  {
    topic: "Soteriology",
    prompt: "How do faith and works relate in salvation?",
  },
];
