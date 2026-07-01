import { getFramework } from "../frameworks";
import type { Script } from "./types";

interface ComparisonEntry {
  position: string;
  texts: string;
  theologians: string;
}

/**
 * Per-tradition positions on the exemplar comparison topic — the relationship
 * of faith and works in salvation. Keyed by framework id; every GOAL.md
 * tradition is covered (enforced by scripts.test.ts).
 */
export const COMPARISON_ENTRIES: Record<string, ComparisonEntry> = {
  reformed: {
    position:
      "Justification is by faith alone, through the imputed righteousness of Christ; good works are the necessary fruit and evidence of saving faith, never its ground.",
    texts: "Rom 3:28; Eph 2:8–10; Jas 2:14–26 (as evidentiary)",
    theologians: "Calvin, Turretin, Berkhof",
  },
  lutheran: {
    position:
      "Justification by faith alone is the article by which the church stands or falls; works belong to the Christian's vocation in the world, sharply distinguished from justification by the law–gospel distinction.",
    texts: "Rom 1:17; Gal 2:16; Rom 4:4–5",
    theologians: "Luther, Melanchthon, Chemnitz",
  },
  "arminian-wesleyan": {
    position:
      "Justification is by grace through faith, made possible by prevenient grace; faith must persevere and work through love, and sanctification (for Wesley, entire sanctification) is salvation's goal, not its afterthought.",
    texts: "Gal 5:6; Phil 2:12–13; Heb 12:14",
    theologians: "Arminius, Wesley, Oden",
  },
  "roman-catholic": {
    position:
      "Justification is an infusion of grace that truly makes the sinner righteous, beginning in baptism and increasing through faith working in love and the sacraments; merit is real but itself God's gift.",
    texts: "Jas 2:24; Gal 5:6; Jn 15:1–8",
    theologians: "Augustine, Aquinas, Newman",
  },
  "eastern-orthodox": {
    position:
      "Salvation is theosis — participation in the divine life. The West's faith-versus-works frame is largely declined: faith and works are inseparable synergy, the whole person cooperating with grace unto union with God.",
    texts: "2 Pet 1:4; Jn 17:21–23; Jas 2:26",
    theologians: "Athanasius, Maximus the Confessor, Palamas",
  },
  baptist: {
    position:
      "Justification is by grace alone through faith alone in Christ alone; works are the evidence of conversion. The believer's baptism follows faith as its public profession and adds nothing to it.",
    texts: "Eph 2:8–9; Rom 10:9–10; Jas 2:18",
    theologians: "Bunyan, Spurgeon, Schreiner",
  },
  "anglican-episcopal": {
    position:
      "Justification by faith only is 'a most wholesome doctrine' (Article XI), held within a sacramental and liturgical frame; works done in Christ are pleasing to God, and the tradition spans Reformed and Catholic emphases.",
    texts: "Rom 3:24–25; Articles XI–XIII; Jas 2:17",
    theologians: "Cranmer, Hooker, Wright",
  },
  "pentecostal-charismatic": {
    position:
      "Salvation is by grace through faith, evidenced in a transformed, Spirit-empowered life; works flow from the Spirit's indwelling, and sanctification is experiential and ongoing.",
    texts: "Eph 2:8–9; Acts 2:38; Gal 5:22–25",
    theologians: "Seymour, Horton (Stanley M.), Fee",
  },
  "oneness-pentecostal": {
    position:
      "Saving faith is obedient faith: repentance, baptism in Jesus' name, and receiving the Spirit belong to the gospel's application (Acts 2:38 as pattern); works of obedience are inseparable from faith itself.",
    texts: "Acts 2:38; Mk 16:16; Jas 2:24",
    theologians: "Bernard, Segraves, Norris",
  },
  "anabaptist-mennonite": {
    position:
      "Faith is discipleship — Nachfolge. Salvation cannot be severed from the obedient, cross-bearing life; a faith that does not take the shape of Christ's commands (peace, simplicity, community) is not saving faith.",
    texts: "Mt 7:21–27; Jas 1:22; 1 Jn 2:6",
    theologians: "Menno Simons, Sattler, Yoder",
  },
  "dispensationalist-evangelical": {
    position:
      "Justification is by grace through faith alone in this age; works have no part in justification, though the Judgment Seat of Christ assesses the believer's works for reward, distinct from salvation.",
    texts: "Eph 2:8–9; Rom 4:5; 1 Cor 3:11–15",
    theologians: "Chafer, Ryrie, MacArthur (lordship debate)",
  },
  "covenant-theology": {
    position:
      "Justification is by faith alone in the one new covenant in Christ; works are the fruit of union with him, with obedience framed by the law of Christ rather than the Mosaic covenant.",
    texts: "Rom 3:28; Heb 8:6–13; Gal 6:2",
    theologians: "Zaspel, Wells, Reisinger",
  },
};

/**
 * Tradition Comparison Mode. Columns are built from the conversation's
 * selected traditions; the follow-up surfaces the history of divergence.
 */
export const script: Script = {
  entry: "table",
  steps: {
    table: {
      blocks: (c) => {
        const traditions = c.traditions ?? [];
        return [
          {
            type: "prose",
            text: "Each tradition's position on the relationship between faith and works in salvation — presented in parallel, none privileged, each in the form its own best theologians would recognize:",
          },
          {
            type: "comparison",
            columns: traditions.map((id) => {
              const entry = COMPARISON_ENTRIES[id];
              return {
                tradition: getFramework(id)?.label ?? id,
                position: entry?.position ?? "",
                texts: entry?.texts ?? "",
                theologians: entry?.theologians ?? "",
              };
            }),
          },
          {
            type: "prose",
            text: "Note where the disagreement actually sits: no tradition here teaches salvation by unaided works, and none divorces faith from a changed life. The divide concerns what justification *is* — declaration or transformation — and what role the church's means play in it.",
          },
        ];
      },
      actions: [
        {
          id: "history",
          label: "Historical note on divergence",
          prefill: "When and why did these traditions diverge on this question?",
          next: "history",
        },
      ],
    },
    history: {
      blocks: [
        {
          type: "history",
          heading: "Where the paths parted",
          text: "The Reformation's material principle — justification by faith alone — was formalized against late-medieval penitential practice at Augsburg (1530) and answered by Trent's sixth session (1547), which anathematized 'faith alone' while insisting no one merits first grace. The East, never party to Augustine's quarrel with Pelagius, kept a synergistic frame the West often mistakes for semi-Pelagianism. Wesley's eighteenth-century revival re-centered sanctification without surrendering sola fide; the Anabaptists had already refused the whole forensic frame in favor of discipleship. Each tradition's position is a settlement from a real controversy — none of them fell from the sky.",
        },
        {
          type: "prose",
          text: "The 1999 Joint Declaration on the Doctrine of Justification (Lutheran–Catholic, later joined by Methodist, Reformed, and Anglican bodies) declared the sixteenth-century anathemas inapplicable to the doctrine as mutually restated — evidence that even the church's hardest divisions remain live conversations.",
        },
      ],
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, any passage, doctrine, or question receives this parallel treatment across your chosen traditions. This preview carries one worked comparison.",
    },
  ],
};
