import { getFramework } from "../frameworks";
import type { Script } from "./types";

/**
 * Framework-aware Q&A. One rich exemplar answer (GOAL.md's "Does baptism
 * save?" flagship) demonstrating prose + exegeted Scripture + woven-in church
 * history. Real answers arrive with the AI slice.
 */
export const script: Script = {
  entry: "answer",
  steps: {
    answer: {
      blocks: (c) => {
        const tradition = getFramework(c.framework ?? "")?.label ?? "your";
        return [
          {
            type: "prose",
            text: `Answered from within the ${tradition} tradition, the question turns first on what Scripture itself joins together — the sign of baptism and the thing signified. No serious confession treats the rite as an empty symbol, and none detaches salvation from Christ himself; the traditions divide over *how* the water and the saving work are related. Your tradition's confessional standards locate baptism within God's appointed means, and its theologians have insisted that the New Testament's baptismal language be read neither magically nor dismissively.`,
          },
          {
            type: "scripture",
            reference: "1 Peter 3:21",
            text: "Baptism, which corresponds to this, now saves you — not as a removal of dirt from the body but as an appeal to God for a good conscience, through the resurrection of Jesus Christ.",
          },
          {
            type: "prose",
            text: "Peter's grammar is deliberate: baptism 'saves' only *through the resurrection of Jesus Christ*, and he immediately qualifies the instrument — not the washing of the flesh but the conscience's appeal to God. Any account of baptism that severs it from resurrection faith has left Peter's sentence behind; so has any account that empties the verb 'saves' of content. Acts 2:38 and Romans 6:3–4 press the same union: baptism is where the gospel is applied to a person, however a tradition parses the mechanics.",
          },
          {
            type: "history",
            heading: "The Donatist controversy and the reality of the sign",
            text: "The church faced this question concretely in the fourth century, when the Donatists insisted baptism's validity hung on the minister's purity. Augustine's answer — that the sacrament belongs to Christ, not the celebrant — fixed the Western conviction that baptism's power is God's fidelity, not human performance. Every later confessional debate about baptismal efficacy, Reformation ones included, is downstream of that settlement.",
          },
          {
            type: "prose",
            text: "Within your own tradition there are live internal debates here — over infant baptism's ground, over the language of regeneration, over how hard to press 'means of grace.' A faithful answer holds the confessional line while acknowledging where your best theologians have differed with one another.",
          },
        ];
      },
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, this follow-up would be answered from within your tradition — its confessions, exegetes, and history brought to bear on exactly what you asked. The conversation surface is in place; the reasoning engine arrives in a later slice.",
    },
  ],
};
