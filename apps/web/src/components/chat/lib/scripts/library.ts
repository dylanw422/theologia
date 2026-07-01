import type { Script } from "./types";

/**
 * Patristic & Primary Source Library. A search returns source excerpts with
 * citations; follow-ups explain plainly or widen the era.
 */
export const script: Script = {
  entry: "results",
  steps: {
    results: {
      blocks: [
        {
          type: "prose",
          text: "Two of the most-cited early witnesses on this question, from the second century — both within living memory of the apostles:",
        },
        {
          type: "source",
          work: "Epistle to the Smyrnaeans",
          author: "Ignatius of Antioch",
          citation: "ch. 7 (c. AD 110)",
          excerpt:
            "They abstain from the Eucharist and from prayer, because they confess not the Eucharist to be the flesh of our Saviour Jesus Christ, which suffered for our sins, and which the Father, of His goodness, raised up again.",
        },
        {
          type: "source",
          work: "First Apology",
          author: "Justin Martyr",
          citation: "ch. 66 (c. AD 155)",
          excerpt:
            "For not as common bread and common drink do we receive these; but... the food which is blessed by the prayer of His word... is the flesh and blood of that Jesus who was made flesh.",
        },
      ],
      actions: [
        {
          id: "plain",
          label: "Explain this plainly",
          prefill: "Explain what these passages are saying in plain language.",
          next: "plain",
        },
        {
          id: "more",
          label: "More from this era",
          prefill: "Show me more sources from this era on the same question.",
          next: "more",
        },
      ],
    },
    plain: {
      blocks: [
        {
          type: "prose",
          text: "Ignatius is writing against docetists — people who said Christ only *seemed* to have a body. His argument assumes his readers share a strikingly realist view of the Eucharist: the docetists' error shows up precisely in their refusal of it. Justin, writing an open letter to a pagan emperor, describes what Christians actually did on Sunday and plainly states that the consecrated bread is not received 'as common bread.'",
        },
        {
          type: "prose",
          text: "What neither author gives you is a later metaphysical theory — no 'transubstantiation,' no 'memorialism.' Every tradition reads its own account into these texts; the honest datum is that the earliest witnesses speak with realist language while leaving the mechanics unexplained. That is exactly the kind of tension worth carrying back into your own tradition's account.",
        },
      ],
    },
    more: {
      blocks: [
        {
          type: "prose",
          text: "Staying in the second century, the Didache gives the earliest liturgical frame we possess:",
        },
        {
          type: "source",
          work: "Didache",
          author: "Unknown (Syria or Egypt)",
          citation: "ch. 9–10 (late 1st – early 2nd c.)",
          excerpt:
            "As this broken bread was scattered upon the mountains and, being gathered together, became one, so let Thy Church be gathered together from the ends of the earth into Thy kingdom... let no one eat or drink of your Eucharist except those baptized into the name of the Lord.",
        },
        {
          type: "prose",
          text: "Note what the Didache adds to Ignatius and Justin: the Eucharist is fenced (baptism precedes the table) and it is ecclesial — the bread's unity figures the church's. In the full release, the library is full-text searchable across all six collections, and every excerpt links into its complete work.",
        },
      ],
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, the library would run your query across the Apostolic Fathers, the ante- and post-Nicene corpus, the medieval doctors, the Reformation sources, and the council documents — returning cited excerpts you can open in full. This preview carries a single worked search.",
    },
  ],
};
