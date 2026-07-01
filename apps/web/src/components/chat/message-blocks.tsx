import type { Block } from "./lib/chat-state";
import styles from "./message-blocks.module.css";

/**
 * Renders an assistant message's typed content blocks — the manuscript-page
 * treatment of each study mode's structured answers.
 */
export default function MessageBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className={styles.blocks}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "prose":
      return <p className={styles.prose}>{block.text}</p>;

    case "scripture":
      return (
        <blockquote className={styles.scripture}>
          <span className={styles.scriptureRef}>{block.reference}</span>
          <p className={styles.scriptureText}>{block.text}</p>
        </blockquote>
      );

    case "history":
      return (
        <aside className={styles.history}>
          <span className={styles.historyEyebrow}>Church history</span>
          <h4 className={styles.historyHeading}>{block.heading}</h4>
          <p className={styles.historyText}>{block.text}</p>
        </aside>
      );

    case "lexicon":
      return (
        <dl className={styles.lexicon}>
          {block.entries.map((entry) => (
            <div key={entry.term} className={styles.lexiconRow}>
              <dt className={styles.lexiconTerm}>
                {entry.term}
                <span className={styles.lexiconTranslit}>
                  {entry.translit}
                </span>
              </dt>
              <dd className={styles.lexiconGloss}>{entry.gloss}</dd>
            </div>
          ))}
        </dl>
      );

    case "comparison":
      return (
        <div className={styles.comparison}>
          {block.columns.map((column) => (
            <section key={column.tradition} className={styles.column}>
              <h4 className={styles.columnTradition}>{column.tradition}</h4>
              <p className={styles.columnPosition}>{column.position}</p>
              <p className={styles.columnMetaLabel}>Texts</p>
              <p className={styles.columnMeta}>{column.texts}</p>
              <p className={styles.columnMetaLabel}>Theologians</p>
              <p className={styles.columnMeta}>{column.theologians}</p>
            </section>
          ))}
        </div>
      );

    case "points":
      return (
        <ol className={styles.points}>
          {block.items.map((item, index) => (
            <li
              key={item.title}
              className={`${styles.point} ${
                block.kind === "response" ? styles.pointResponse : ""
              }`}
            >
              <span className={styles.pointMarker}>
                {block.kind === "objection" ? `${index + 1}` : "※"}
              </span>
              <div className={styles.pointBody}>
                <div className={styles.pointHead}>
                  <span className={styles.pointTitle}>{item.title}</span>
                  {item.weight ? (
                    <span className={styles.pointWeight}>{item.weight}</span>
                  ) : null}
                </div>
                <p className={styles.pointText}>{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      );

    case "resources":
      return (
        <ul className={styles.resources}>
          {block.items.map((item) => (
            <li key={item.title} className={styles.resource}>
              <div className={styles.resourceHead}>
                <span className={styles.resourceTitle}>{item.title}</span>
                <span
                  className={`${styles.resourceTier} ${
                    item.tier === "scholarly" ? styles.resourceTierGold : ""
                  }`}
                >
                  {item.tier}
                </span>
              </div>
              <span className={styles.resourceAuthor}>{item.author}</span>
              <p className={styles.resourceNote}>{item.note}</p>
            </li>
          ))}
        </ul>
      );

    case "source":
      return (
        <figure className={styles.source}>
          <blockquote className={styles.sourceExcerpt}>
            {block.excerpt}
          </blockquote>
          <figcaption className={styles.sourceCite}>
            <span className={styles.sourceAuthor}>{block.author}</span>
            <span className={styles.sourceWork}>
              {block.work} · {block.citation}
            </span>
          </figcaption>
        </figure>
      );

    case "article":
      return (
        <article className={styles.article}>
          <span className={styles.articleSource}>{block.source}</span>
          <h4 className={styles.articleLabel}>{block.label}</h4>
          <p className={styles.articleBody}>{block.body}</p>
          {block.proofs && block.proofs.length > 0 ? (
            <div className={styles.articleProofs}>
              {block.proofs.map((proof) => (
                <span key={proof} className={styles.articleProof}>
                  {proof}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      );
  }
}
