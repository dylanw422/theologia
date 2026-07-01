import { getFramework } from "../frameworks";
import type { Script } from "./types";

function labels(c: { framework?: string; opposing?: string }) {
  return {
    yours: getFramework(c.framework ?? "")?.label ?? "your tradition",
    theirs: getFramework(c.opposing ?? "")?.label ?? "the opposing tradition",
  };
}

/**
 * Devil's Advocate Mode. Exemplar exchange on unconditional election
 * (GOAL.md's worked example): strongest objections, then the home tradition's
 * responses, then a counter-rebuttal round with history.
 */
export const script: Script = {
  entry: "objections",
  steps: {
    objections: {
      blocks: (c) => {
        const { yours, theirs } = labels(c);
        return [
          {
            type: "prose",
            text: `What follows is the case a serious, well-read ${theirs} theologian would actually make against the ${yours} position — the strongest form of each argument, not the version easiest to dismiss.`,
          },
          {
            type: "points",
            kind: "objection",
            items: [
              {
                title: "Romans 9 concerns corporate vocation, not individual destiny",
                body: "Paul's examples are peoples and roles — Isaac over Ishmael, Jacob over Esau, 'the elder shall serve the younger' quoting Malachi's oracle about nations. The chapter answers 'has God's word to Israel failed?', not 'how are individuals predestined?' Read the argument through chapters 9–11 as a unit and it ends in 'all Israel will be saved,' not in a decretal division of humanity.",
              },
              {
                title: "The potter retains Jeremiah's conditionality",
                body: "The potter-and-clay image Paul reaches for is Jeremiah 18 — where the clay's outcome is explicitly responsive: 'if that nation turns from its evil, I will relent.' Importing an unconditional decree into the very metaphor Scripture uses for divine responsiveness reverses the prophet's point.",
              },
              {
                title: "Unconditional election makes the universal offer insincere",
                body: "Scripture has God desiring all to be saved (1 Tim 2:4; Ezek 33:11) and Christ weeping over Jerusalem's refusal. If grace is irresistibly given to some and withheld from the rest by decree, the gospel's 'whosoever' is, for the non-elect, an offer of what was never available — a conclusion the text's own pathos will not bear.",
              },
            ],
          },
        ];
      },
      actions: [
        {
          id: "responses",
          label: "Show my tradition's responses",
          prefill: "How does my tradition answer these objections?",
          next: "responses",
        },
      ],
    },
    responses: {
      blocks: (c) => {
        const { yours } = labels(c);
        return [
          {
            type: "prose",
            text: `The standard ${yours} responses, in the same order — these are the answers your tradition's best exegetes have actually given, not talking points:`,
          },
          {
            type: "points",
            kind: "response",
            items: [
              {
                title: "The corporate reading proves too much — and verse 24 individualizes",
                body: "Paul's anguish in 9:2–3 is over individual kinsmen, and his conclusion lands on persons: 'even us whom he has called, not from the Jews only' (9:24). Corporate categories and individual election are not rivals in Paul; the corporate election of Israel always operated through God's discrimination among individuals within it — that is the argument of 9:6–13.",
              },
              {
                title: "Paul answers Jeremiah's objector, not with conditions but with rights",
                body: "When the objector protests 'why does he still find fault?' (9:19), Paul does not reach for Jeremiah's conditionality — which would have dissolved the objection instantly. He asserts the potter's *right* (9:21). The apostle's own rhetorical choice is evidence of his meaning: an objection that only arises against unconditional election is met without softening it.",
              },
              {
                title: "The offer is sincere because it is true",
                body: "Whoever believes will be saved — without exception; the offer misstates nothing. The decree concerns who will believe, not whether believers will be received. And the alternative has its own cost: a grace that is finally decisive nowhere, and a salvation whose deciding difference lies in the sinner rather than in God.",
              },
            ],
          },
        ];
      },
      actions: [
        {
          id: "counter",
          label: "Push the counter-rebuttal",
          prefill: "How would they answer those responses? Keep pushing.",
          next: "counter",
        },
      ],
    },
    counter: {
      blocks: (c) => {
        const { theirs } = labels(c);
        return [
          {
            type: "prose",
            text: `A capable ${theirs} interlocutor does not stop there. The counter-round presses hardest on the third response: if the deciding difference lies wholly in God, then the difference between the saved and the lost traces to the decree alone — and the objection of 9:19 returns at the level of theodicy, not exegesis. Expect the debate to migrate from Romans 9's grammar to the character of God, because that is where both traditions believe the real stakes lie.`,
          },
          {
            type: "history",
            heading: "This debate has a history — and neither side is improvising",
            text: "Augustine against Pelagius, Gottschalk against Hincmar, Dort against the Remonstrants, Whitefield against Wesley: the church has run this argument for sixteen centuries with remarkable continuity in the positions. Knowing where each move was first made — and how it was answered — is what separates debate preparation from debate improvisation.",
          },
        ];
      },
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, the advocate keeps arguing — every follow-up answered in character, as the strongest version of the rival tradition. This preview carries one worked exchange; the full back-and-forth arrives with the AI slice.",
    },
  ],
};
