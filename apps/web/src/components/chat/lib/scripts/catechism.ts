import { DOCUMENTS } from "../modes";
import type { Script } from "./types";

interface CatechismArticle {
  label: string;
  body: string;
  proofs?: string[];
  explanation: string;
}

/**
 * The opening (or defining) article of each supported confessional document,
 * from public domain texts, with a tutor's explanation. Keyed by DOCUMENTS
 * ids; full coverage is enforced by scripts.test.ts.
 */
export const CATECHISM_ARTICLES: Record<string, CatechismArticle> = {
  westminster: {
    label: "Shorter Catechism, Q. 1",
    body: "Q. What is the chief end of man?\nA. Man's chief end is to glorify God, and to enjoy him forever.",
    proofs: ["1 Corinthians 10:31", "Romans 11:36", "Psalm 73:25–28"],
    explanation:
      "The Westminster divines open not with God's existence but with humanity's purpose — a deliberately teleological beginning. 'Chief end' is singular: glorifying and enjoying are one end, not two, and the pairing rebukes both joyless duty and godless delight. Everything that follows in the catechism unpacks how that end is reached.",
  },
  heidelberg: {
    label: "Lord's Day 1, Q. 1",
    body: "Q. What is thy only comfort in life and death?\nA. That I with body and soul, both in life and death, am not my own, but belong unto my faithful Saviour Jesus Christ; who, with his precious blood, hath fully satisfied for all my sins, and delivered me from all the power of the devil; and so preserves me that without the will of my heavenly Father, not a hair can fall from my head; yea, that all things must be subservient to my salvation, and therefore, by his Holy Spirit, he also assures me of eternal life, and makes me sincerely willing and ready, henceforth, to live unto him.",
    proofs: ["1 Corinthians 6:19–20", "Romans 14:7–9", "Matthew 10:29–31"],
    explanation:
      "Written in 1563 for a Palatinate caught between Lutheran and Reformed pressures, the Heidelberg begins in the first person — 'my only comfort' — and stays pastoral throughout. Notice the whole Trinity is already at work in Question 1, and that assurance is treated as normal Christian experience, not an elite attainment. The catechism's three parts (guilt, grace, gratitude) all live inside this single answer.",
  },
  belgic: {
    label: "Article 1 — There Is One Only God",
    body: "We all believe with the heart, and confess with the mouth, that there is one only simple and spiritual Being, which we call God; and that he is eternal, incomprehensible, invisible, immutable, infinite, almighty, perfectly wise, just, good, and the overflowing fountain of all good.",
    proofs: ["Deuteronomy 6:4", "1 Timothy 1:17", "James 1:17"],
    explanation:
      "Guido de Brès wrote this confession in 1561 to persuade a persecuting Spanish crown that the Reformed were neither rebels nor heretics — he was martyred for it six years later. Article 1 is classical theism in a single sentence; 'overflowing fountain of all good' is its most quoted phrase, insisting that the God of the philosophers' attributes is also the source of every good gift.",
  },
  dort: {
    label: "First Head of Doctrine, Article 1",
    body: "As all men have sinned in Adam, lie under the curse, and are deserving of eternal death, God would have done no injustice by leaving them all to perish, and delivering them over to condemnation on account of sin, according to the words of the apostle (Rom. 3:19, 23; 6:23).",
    proofs: ["Romans 3:19, 23", "Romans 6:23"],
    explanation:
      "The Canons answer the Remonstrants' five articles point by point, which is why 'five points of Calvinism' exists as a category at all. Note where the Synod chose to begin: not with election but with universal guilt — the doctrine of predestination is framed from the first sentence as mercy shown to the justly condemned, not arbitrary sorting of innocents.",
  },
  "london-1689": {
    label: "Chapter 1, Paragraph 1 — Of the Holy Scriptures",
    body: "The Holy Scripture is the only sufficient, certain, and infallible rule of all saving knowledge, faith, and obedience, although the light of nature, and the works of creation and providence do so far manifest the goodness, wisdom, and power of God, as to leave men inexcusable; yet are they not sufficient to give that knowledge of God and his will which is necessary unto salvation.",
    proofs: ["2 Timothy 3:15–17", "Romans 1:19–21", "Hebrews 1:1–2"],
    explanation:
      "The 1689 deliberately tracks the Westminster Confession almost word for word — the Particular Baptists wanted to prove their orthodoxy, diverging only where conviction required (baptism, church polity). The word 'only' before 'sufficient' does heavy work: nature reveals enough to condemn, but Scripture alone reveals enough to save.",
  },
  augsburg: {
    label: "Article IV — Of Justification",
    body: "Also they teach that men cannot be justified before God by their own strength, merits, or works, but are freely justified for Christ's sake, through faith, when they believe that they are received into favor, and that their sins are forgiven for Christ's sake, who, by His death, hath made satisfaction for our sins. This faith God imputes for righteousness in His sight. Rom. 3 and 4.",
    proofs: ["Romans 3:21–26", "Romans 4:5"],
    explanation:
      "Presented to Emperor Charles V at the Diet of Augsburg in 1530, this is the Reformation's founding confessional document, and Article IV is its beating heart. Melanchthon's compressed clauses each exclude something specific — strength, merit, works — and 'freely... for Christ's sake, through faith' became the grammar of Protestant soteriology.",
  },
  "luthers-catechisms": {
    label: "Small Catechism — The First Commandment",
    body: "Thou shalt have no other gods.\nWhat does this mean? We should fear, love, and trust in God above all things.",
    proofs: ["Exodus 20:3", "Proverbs 23:26"],
    explanation:
      "Luther wrote the Small Catechism in 1529 after parish visitations left him appalled at how little ordinary Christians knew. Its method — 'What does this mean?' — turns every commandment and article toward the heart. His Large Catechism's gloss on this answer is famous: 'whatever your heart clings to and confides in, that is really your God.'",
  },
  "ecumenical-creeds": {
    label: "The Apostles' Creed, Articles 1–2",
    body: "I believe in God the Father Almighty, Maker of heaven and earth: And in Jesus Christ his only Son our Lord; who was conceived by the Holy Ghost, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, dead, and buried.",
    proofs: ["Genesis 1:1", "Luke 1:35", "1 Corinthians 15:3–4"],
    explanation:
      "The Apostles' Creed grew from the old Roman baptismal symbol of the second century — it is what converts confessed at the font. Its shape is Trinitarian and its most scandalous phrase is a date: 'under Pontius Pilate' nails the faith to public history. The Nicene and Athanasian creeds sharpen its Christology against later controversies; this one simply hands on the apostolic story.",
  },
  chalcedon: {
    label: "The Definition (AD 451)",
    body: "…one and the same Christ, Son, Lord, Only-begotten, to be acknowledged in two natures, inconfusedly, unchangeably, indivisibly, inseparably; the distinction of natures being by no means taken away by the union, but rather the property of each nature being preserved, and concurring in one Person and one Subsistence.",
    proofs: ["John 1:14", "Philippians 2:6–7", "Colossians 2:9"],
    explanation:
      "Chalcedon's four adverbs — without confusion, without change, without division, without separation — are fences, not explanations: two guard against Eutyches (natures blended), two against Nestorius (person divided). The Definition does not solve the incarnation; it marks the boundaries inside which every orthodox account must live, which is precisely why it has governed Christology for fifteen centuries.",
  },
  trent: {
    label: "Session VI, Decree on Justification, Chapter 8",
    body: "…we are therefore said to be justified by faith, because faith is the beginning of human salvation, the foundation and root of all justification; without which it is impossible to please God, and to come unto the fellowship of His sons: but we are therefore said to be justified freely, because that none of those things which precede justification — whether faith or works — merit the grace itself of justification.",
    proofs: ["Hebrews 11:6", "Romans 3:24"],
    explanation:
      "Trent's sixth session (1547) is the Catholic Church's considered answer to the Reformation, and chapter 8 is its most careful sentence: faith is 'beginning, foundation, and root,' and nothing before justification merits it. The quarrel with the Reformers is not over free grace but over what justification is — for Trent, a real interior renewal, not solely a forensic declaration. Read it alongside Augsburg IV to see the actual point of divergence.",
  },
  baltimore: {
    label: "Lesson 1, Q. 6",
    body: "Q. Why did God make you?\nA. God made me to know Him, to love Him, and to serve Him in this world, and to be happy with Him for ever in heaven.",
    proofs: ["John 17:3", "Deuteronomy 6:5"],
    explanation:
      "Commissioned by the Third Plenary Council of Baltimore in 1885, this was the catechism of American Catholic childhood for three generations. Question 6 is its Westminster Q. 1 — purpose before doctrine — and the sequence matters: knowing precedes loving, loving precedes serving, and beatitude is the end of all three.",
  },
  dordrecht: {
    label: "Article I — Of God and the Creation of All Things",
    body: "We believe and confess, with the mouth, that there is one eternal, almighty, and incomprehensible God, Father, Son, and Holy Ghost, and none more and none other, before whom no God existed, neither will exist after him.",
    proofs: ["Deuteronomy 6:4", "Genesis 17:1", "Matthew 28:19"],
    explanation:
      "Adopted by Dutch Mennonites at Dordrecht in 1632, this confession consolidated a century of Anabaptist witness after Menno Simons. It opens in serene Trinitarian orthodoxy — worth noticing, since Anabaptists were routinely slandered as heretics — before moving to the distinctives (believer's baptism, nonresistance, the ban) for which its signers' forebears had died.",
  },
};

function docLabel(id?: string): string {
  return DOCUMENTS.find((d) => d.id === id)?.label ?? "the document";
}

/**
 * Catechism & Confession Tutor. Serves the selected document's opening
 * article with explanation, then quizzes and cross-references on request.
 */
export const script: Script = {
  entry: "article",
  steps: {
    article: {
      blocks: (c) => {
        const article = CATECHISM_ARTICLES[c.document ?? ""];
        if (!article) {
          return [
            {
              type: "prose",
              text: "Choose a document to begin reading with the tutor.",
            },
          ];
        }
        return [
          {
            type: "article",
            source: docLabel(c.document),
            label: article.label,
            body: article.body,
            proofs: article.proofs,
          },
          { type: "prose", text: article.explanation },
        ];
      },
      actions: [
        {
          id: "quiz",
          label: "Quiz me",
          prefill: "Quiz me on what I just read.",
          next: "quiz",
        },
        {
          id: "proofs",
          label: "Cross-reference the proofs",
          prefill: "Walk me through the Scripture proofs this article cites.",
          next: "proofs",
        },
      ],
    },
    quiz: {
      blocks: (c) => [
        {
          type: "prose",
          text: `Without looking back at the text: state, in your own words, the answer ${docLabel(c.document)} gives in the article you just read — and name one thing its wording deliberately excludes or guards against. Type your answer and I will check it against the text.`,
        },
      ],
      onReply: "quiz-eval",
    },
    "quiz-eval": {
      blocks: (c) => {
        const article = CATECHISM_ARTICLES[c.document ?? ""];
        return [
          {
            type: "prose",
            text: "Here is the text again — check your answer against the document's own words:",
          },
          ...(article
            ? [
                {
                  type: "article" as const,
                  source: docLabel(c.document),
                  label: article.label,
                  body: article.body,
                },
              ]
            : []),
          {
            type: "prose",
            text: "Grade yourself on two things: did you preserve the article's positive claim, and did you catch what its precision rules out? In the full release the tutor evaluates your actual wording, presses on what you missed, and keeps score across a session.",
          },
        ];
      },
      actions: [
        {
          id: "again",
          label: "Ask me another",
          prefill: "Ask me another question.",
          next: "quiz",
        },
      ],
    },
    proofs: {
      blocks: (c) => {
        const article = CATECHISM_ARTICLES[c.document ?? ""];
        const proofs = article?.proofs ?? [];
        return [
          {
            type: "prose",
            text:
              proofs.length > 0
                ? `The article cites ${proofs.join("; ")}. These are not decorations — the framers understood themselves to be summarizing exegesis, and each proof was chosen against a specific objection. In the full release each citation opens in place, exegeted in the context of the article that cites it.`
                : "This article's proof apparatus arrives with the full document text in a later slice.",
          },
        ];
      },
    },
  },
  fallback: [
    {
      type: "prose",
      text: "In the full release, the tutor answers questions about any article in the document, grounded in its historical context, and can compare how two confessions treat the same doctrine. This preview carries the opening article of each supported document.",
    },
  ],
};
