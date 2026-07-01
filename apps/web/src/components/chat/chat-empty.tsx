"use client";

import { useState } from "react";

import ChatComposer from "./chat-composer";
import FrameworkPicker from "./framework-picker";
import { SAMPLE_PROMPTS } from "./lib/mock-chat";
import styles from "./chat-empty.module.css";

export default function ChatEmpty({
  onStart,
}: {
  onStart: (input: {
    framework: string;
    subTradition?: string;
    firstMessage: string;
  }) => void;
}) {
  const [framework, setFramework] = useState("");
  const [subTradition, setSubTradition] = useState("");

  function handleFrameworkChange(id: string) {
    setFramework(id);
    setSubTradition("");
  }

  function handleSend(text: string) {
    onStart({
      framework,
      subTradition: subTradition || undefined,
      firstMessage: text,
    });
  }

  return (
    <div className={styles.empty}>
      <div className={styles.inner}>
        <p className={`${styles.mark} ${styles.reveal} ${styles.d1}`}>
          Theologia
        </p>
        <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
          What will you <em>study</em> today?
        </h1>
        <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
          Ask anything. Theologia answers from within your tradition — its
          confessions, its theologians, its history.
        </p>

        <div className={`${styles.composer} ${styles.reveal} ${styles.d4}`}>
          <ChatComposer
            onSend={handleSend}
            disabled={!framework}
            autoFocus
            contextFirst
            placeholder={
              framework ? "Ask a question…" : "Choose a tradition to begin…"
            }
            context={
              <FrameworkPicker
                framework={framework}
                subTradition={subTradition}
                onFrameworkChange={handleFrameworkChange}
                onSubTraditionChange={setSubTradition}
              />
            }
          />
        </div>

        <div className={`${styles.cards} ${styles.reveal} ${styles.d5}`}>
          {SAMPLE_PROMPTS.map(({ topic, prompt }) => (
            <button
              key={prompt}
              type="button"
              className={styles.cardBtn}
              disabled={!framework}
              onClick={() => framework && handleSend(prompt)}
            >
              <span className={styles.cardTopic}>{topic}</span>
              <span className={styles.cardPrompt}>{prompt}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
