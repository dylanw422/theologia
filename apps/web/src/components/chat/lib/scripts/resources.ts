import { getFramework } from "../frameworks";
import type { Script } from "./types";

/**
 * Resource Recommendation Engine. Exemplar shelf on covenant theology
 * (GOAL.md's worked example), tiered, with primary-source and scholarly
 * follow-ups.
 */
export const script: Script = {
  entry: "shelf",
  steps: {
    shelf: {
      blocks: (c) => {
        const tradition = getFramework(c.framework ?? "")?.label ?? "your";
        return [
          {
            type: "prose",
            text: `A working shelf on covenant theology, weighted for the ${tradition} tradition and tiered by depth — primary sources surfaced alongside the secondary literature, as always:`,
          },
          {
            type: "resources",
            items: [
              {
                title: "God of Promise",
                author: "Michael Horton",
                tier: "introductory",
                note: "The clearest on-ramp: what covenant theology claims, why it matters, and how it organizes the whole Bible.",
              },
              {
                title: "The Christ of the Covenants",
                author: "O. Palmer Robertson",
                tier: "intermediate",
                note: "The standard one-volume treatment — covenant by covenant, exegetically argued. If you read one book on the shelf, read this.",
              },
              {
                title: "Westminster Confession, ch. 7 — Of God's Covenant with Man",
                author: "Westminster Assembly (1646)",
                tier: "intermediate",
                note: "The confessional codification itself. Seven paragraphs; read them before the books that argue about them.",
              },
              {
                title: "The Economy of the Covenants Between God and Man",
                author: "Herman Witsius",
                tier: "scholarly",
                note: "The seventeenth-century masterwork — the covenant of redemption, works, and grace in full dogmatic depth.",
              },
              {
                title: "Biblical Theology",
                author: "Geerhardus Vos",
                tier: "scholarly",
                note: "Covenant as the architecture of redemptive history; demanding, and worth every page.",
              },
            ],
          },
          {
            type: "prose",
            text: "One honest note from within the broadly Reformed family: New Covenant Theology reads the Mosaic covenant's relation to the church differently, and its challenge is worth knowing even if you decline it — see the comparison mode for the parallel case.",
          },
        ];
      },
      actions: [
        {
          id: "primary",
          label: "Primary sources only",
          prefill: "Give me primary sources only on this topic.",
          next: "primary",
        },
        {
          id: "scholarly",
          label: "More scholarly",
          prefill: "Go deeper — scholarly and academic works only.",
          next: "scholarly",
        },
      ],
    },
    primary: {
      blocks: [
        {
          type: "prose",
          text: "Primary sources only — the documents and the dead, in roughly the order the tradition produced them:",
        },
        {
          type: "resources",
          items: [
            {
              title: "Institutes of the Christian Religion, II.10–11",
              author: "John Calvin (1559)",
              tier: "intermediate",
              note: "The unity of the covenants and the difference of the testaments — the chapters every later covenant theology answers to.",
            },
            {
              title: "The Economy of the Covenants Between God and Man",
              author: "Herman Witsius (1677)",
              tier: "scholarly",
              note: "The fullest classical statement of the threefold covenant scheme.",
            },
            {
              title: "The Christian's Reasonable Service, vol. 1",
              author: "Wilhelmus à Brakel (1700)",
              tier: "intermediate",
              note: "Covenant doctrine as the Dutch Further Reformation preached it — dogmatics written for households.",
            },
          ],
        },
      ],
    },
    scholarly: {
      blocks: [
        {
          type: "prose",
          text: "The scholarly tier — where the covenant-theology debates are actually conducted:",
        },
        {
          type: "resources",
          items: [
            {
              title: "The Covenant of Works: The Origins, Development, and Reception of the Doctrine",
              author: "J. V. Fesko",
              tier: "scholarly",
              note: "Historical-theological treatment of the scheme's most contested member.",
            },
            {
              title: "Kingdom Prologue",
              author: "Meredith Kline",
              tier: "scholarly",
              note: "Covenant theology rebuilt on ancient Near Eastern treaty forms — influential and controversial in equal measure.",
            },
            {
              title: "The Mystery of Christ, His Covenant, and His Kingdom",
              author: "Samuel Renihan",
              tier: "scholarly",
              note: "The 1689 Federalist account — covenant theology in its Particular Baptist key, useful precisely where it diverges.",
            },
          ],
        },
      ],
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, the engine builds a shelf for any topic — filtered by your tradition and purpose, tiered by depth, primary sources always surfaced. This preview carries one worked topic.",
    },
  ],
};
