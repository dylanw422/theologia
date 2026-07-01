import { getFramework } from "../frameworks";
import type { Script } from "./types";

/**
 * Debate Preparation Tool. Exemplar workflow on "Regeneration precedes faith"
 * (GOAL.md's example thesis): ranked objections → standard responses →
 * Socratic stress-test → export note.
 */
export const script: Script = {
  entry: "objections",
  steps: {
    objections: {
      blocks: (c) => {
        const theirs =
          getFramework(c.opposing ?? "")?.label ?? "the opposing tradition";
        return [
          {
            type: "prose",
            text: `The objections your thesis will actually meet from ${theirs} interlocutors, ranked by how often they appear in the historical record and how much theological weight they carry:`,
          },
          {
            type: "points",
            kind: "objection",
            items: [
              {
                title: "Faith is everywhere the condition of life, never its consequence",
                weight: "Frequency: high · Weight: heavy",
                body: "'Believe in the Lord Jesus, and you will be saved' (Acts 16:31); 'that believing you may have life' (John 20:31). The canonical pattern runs belief → life. A thesis that reverses the order must explain why Scripture's own summons never once says 'be regenerated, that you may believe.'",
              },
              {
                title: "John 1:12–13 grounds birth in reception",
                weight: "Frequency: high · Weight: moderate",
                body: "'To all who received him, who believed in his name, he gave the right to become children of God, who were born...' The text sequences receiving and believing before the birth 'of God' — the strongest single proof-text against your thesis, and the first one you will hear.",
              },
              {
                title: "Prevenient grace explains the data without the paradox",
                weight: "Frequency: moderate · Weight: heavy",
                body: "The opposing system concedes total inability and answers it with enabling grace extended to all, restoring the capacity to believe without guaranteeing belief. It claims every text you claim, minus the conclusion that God's saving love discriminates before faith. You must show why enabling grace that finally decides nothing cannot carry the biblical weight.",
              },
            ],
          },
        ];
      },
      actions: [
        {
          id: "responses",
          label: "Standard responses from my tradition",
          prefill: "Give me my tradition's standard responses to each objection.",
          next: "responses",
        },
      ],
    },
    responses: {
      blocks: [
        {
          type: "prose",
          text: "The standard responses, keyed to each objection. Learn these as arguments, not as slogans — your interlocutor will know them too.",
        },
        {
          type: "points",
          kind: "response",
          items: [
            {
              title: "Order of nature, not order of experience",
              body: "The thesis concerns causal priority, not temporal sequence. No one is regenerate on Tuesday and believing on Thursday; the claim is that the new birth underlies the believing, as 1 John 5:1's grammar suggests — 'everyone who believes [present] has been born [perfect] of God.' The summons 'believe and live' addresses responsibility, not mechanics.",
            },
            {
              title: "John 1:13 is your text, not theirs",
              body: "The verse's whole force is negative: born 'not of the will of man, but of God.' Verse 12 describes who the children of God are (receivers, believers); verse 13 denies that their birth originated in their willing. Dead men do not receive medicine — John 3:3's 'unless one is born again he cannot see the kingdom' places sight after birth.",
            },
            {
              title: "Prevenient grace saves the system, not the texts",
              body: "Universal enabling grace is a systematic postulate — no text teaches a grace given to all that restores ability to believe. Press for the proof-text and the debate shifts to John 6:44–45, where the drawing that precedes coming ends in being raised up: all the drawn come, and all who come are raised.",
            },
          ],
        },
      ],
      actions: [
        {
          id: "socratic",
          label: "Stress-test me (Socratic)",
          prefill: "Stress-test me. Ask me the hardest question against my thesis.",
          next: "socratic",
        },
        {
          id: "export",
          label: "Export the outline",
          prefill: "Export this debate prep as an outline.",
          next: "export",
        },
      ],
    },
    socratic: {
      blocks: [
        {
          type: "prose",
          text: "Then defend the hinge of your position. You claim 1 John 5:1's perfect tense proves the birth precedes the believing. But 1 John uses the identical construction for loving (4:7) and doing righteousness (2:29) — and you do not conclude that regeneration precedes every act of love or obedience temporally distinct from it. Why is the construction decisive in 5:1 but merely characterizing in 4:7? Answer in your own words; I will evaluate it as your opponent would.",
        },
      ],
      onReply: "socratic-eval",
    },
    "socratic-eval": {
      blocks: [
        {
          type: "prose",
          text: "That answer holds if you distinguished *characterizing* from *causally grounding* — the strong reply is that 4:7 and 2:29 make your point rather than break it: John consistently treats the birth as the fountain of the family resemblance (believing, loving, obeying), which is precisely the thesis. If instead you rested on the perfect tense alone, your opponent will spend the tense argument to a draw and you will need the Johannine-theology argument ready. Weak spot to shore up before the debate: your account of why the *summons* to believe is meaningful for those unable to comply — have Deuteronomy 30:6 and Ezekiel 36:26–27 in hand.",
        },
      ],
      actions: [
        {
          id: "continue",
          label: "Continue the stress test",
          prefill: "Ask me the next hardest question.",
          next: "socratic",
        },
      ],
    },
    export: {
      blocks: [
        {
          type: "prose",
          text: "Export produces a structured outline — thesis, ranked objections, responses, stress-test notes, and sources — as a document you can take into the debate. Export tools ship with the Ministry plan; in this preview the outline lives in the conversation.",
        },
      ],
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, every reply here continues the Socratic loop — your answers evaluated, the next objection queued, the outline growing as you work. This preview carries one worked cycle.",
    },
  ],
};
