import { getFramework } from "../frameworks";
import type { Script } from "./types";

/**
 * Scripture Study Mode. Exemplar deep-dive on 1 Peter 3:18–22 (matches the
 * seeded study): text, original-language notes, context, then tradition
 * reading and patristic commentary on request.
 */
export const script: Script = {
  entry: "exegesis",
  steps: {
    exegesis: {
      blocks: [
        {
          type: "scripture",
          reference: "1 Peter 3:21–22",
          text: "Baptism, which corresponds to this, now saves you — not as a removal of dirt from the body but as an appeal to God for a good conscience, through the resurrection of Jesus Christ, who has gone into heaven and is at the right hand of God.",
        },
        {
          type: "lexicon",
          entries: [
            {
              term: "ἀντίτυπον",
              translit: "antitypon",
              gloss:
                "'corresponding figure' — baptism answers to the flood as type to antitype; the deliverance of Noah prefigures the deliverance now enacted",
            },
            {
              term: "ἐπερώτημα",
              translit: "eperōtēma",
              gloss:
                "'appeal' or 'pledge' — a contested term: either the conscience's appeal *to* God, or a pledge *proceeding from* a good conscience; whole baptismal theologies turn on the choice",
            },
            {
              term: "σῴζει",
              translit: "sōzei",
              gloss:
                "'saves,' present tense — Peter does not soften the verb; the qualification comes in the following clause, not by weakening the word",
            },
          ],
        },
        {
          type: "prose",
          text: "Peter writes to churches under social pressure in Asia Minor, and the whole unit (3:13–22) argues from Christ's suffering-then-vindication to theirs. The flood typology is doing pastoral work: as the ark carried a scorned minority through judgment waters into a new world, so baptism marks out a pressured minority as already belonging to the vindicated Christ 'at the right hand of God.' Verse 21's syntax is famously compressed — the 'not… but…' clause exists precisely because Peter anticipated the magical misreading and cut it off without surrendering the instrumental language.",
        },
      ],
      actions: [
        {
          id: "tradition-reading",
          label: "How has my tradition read this?",
          prefill: "How has my tradition historically read this passage?",
          next: "tradition-reading",
        },
        {
          id: "patristic",
          label: "Patristic commentary",
          prefill: "What did the Fathers say about this passage?",
          next: "patristic",
        },
      ],
    },
    "tradition-reading": {
      blocks: (c) => {
        const tradition = getFramework(c.framework ?? "")?.label ?? "Your";
        return [
          {
            type: "prose",
            text: `${tradition} exegesis of this passage has been remarkably stable on two points and contested on a third. Stable: the flood typology is real (baptism genuinely corresponds to a saving event, not merely an illustration), and the saving efficacy runs 'through the resurrection of Jesus Christ' — never through the water as such. Contested: the force of ἐπερώτημα, and with it how much weight the rite itself bears. Your tradition's representative commentators divide along exactly that line, and the division is worth studying rather than smoothing over: it marks a genuine pressure point where the text resists every tidy systematization.`,
          },
          {
            type: "history",
            heading: "One text, three confessional settlements",
            text: "At the Reformation this verse became a proving ground: Luther's Small Catechism cites it directly for baptism's saving power; the Reformed confessions routed its efficacy through faith and the covenant; the Anabaptists read the 'appeal of a good conscience' as requiring a confessing subject, and paid dearly for the conclusion. Trent, for its part, anathematized any who called baptism optional. Few verses show more clearly how exegesis and confession shape each other.",
          },
        ];
      },
    },
    patristic: {
      blocks: [
        {
          type: "prose",
          text: "The Fathers loved this passage's typology and pressed it hard. Tertullian's treatise on baptism — the earliest we possess — opens inside Peter's water imagery:",
        },
        {
          type: "source",
          work: "On Baptism",
          author: "Tertullian",
          citation: "ch. 1, 8–9 (c. AD 200)",
          excerpt:
            "Happy is our sacrament of water, in that, by washing away the sins of our early blindness, we are set free and admitted into eternal life... we, little fishes, after the example of our ΙΧΘΥΣ Jesus Christ, are born in water.",
        },
        {
          type: "prose",
          text: "Augustine later took the ark itself as figure: the church, carrying a mixed company through judgment, saved 'through water and wood' — the wood being the cross. The patristic consensus treats 1 Peter 3 as baptismal typology at full strength while insisting, with Peter, that the washing profits nothing without the reality it signifies.",
        },
      ],
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, any passage you bring receives this treatment — original-language notes, historical-grammatical context, your tradition's interpretive history, alternatives presented fairly, and the Fathers where they spoke. This preview carries one worked passage.",
    },
  ],
};
