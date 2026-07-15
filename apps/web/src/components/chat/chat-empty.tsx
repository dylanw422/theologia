"use client";

import { useEffect, useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import ChatComposer, { type ComposerInsert } from "./chat-composer";
import type { ConversationSetup, ModeId } from "./lib/chat-state";
import { getMode, isSetupValid, type SetupKind } from "./lib/modes";
import ModePicker from "./mode-picker";
import SetupPicker from "./setup-picker";
import styles from "./chat-empty.module.css";

/** Setup kinds whose `framework` field the default tradition can pre-fill.
 *  "multi-tradition" (Comparison) and "document"/"collection" (Catechism/
 *  Library) don't have a single framework field, so they're excluded. */
const FRAMEWORK_SETUP_KINDS: SetupKind[] = [
  "tradition",
  "versus",
  "tradition-purpose",
];

export default function ChatEmpty({
  onStart,
  insert = null,
}: {
  onStart: (input: {
    mode: ModeId;
    setup: ConversationSetup;
    firstMessage: string;
  }) => void;
  insert?: ComposerInsert | null;
}) {
  const [mode, setMode] = useState<ModeId>("qa");
  const [setup, setSetup] = useState<ConversationSetup>({});
  const defaultFramework = useQuery(api.userPreferences.getDefaultFramework);

  const modeDef = getMode(mode);
  const canSend = isSetupValid(mode, setup);

  useEffect(() => {
    if (!defaultFramework) return;
    if (!FRAMEWORK_SETUP_KINDS.includes(modeDef.setup)) return;
    if (setup.framework) return;
    setSetup((prev) => ({ ...prev, framework: defaultFramework }));
  }, [defaultFramework, modeDef.setup, setup.framework]);

  function handleModeChange(next: ModeId) {
    setMode(next);
    setSetup({});
  }

  function handleSend(text: string) {
    onStart({ mode, setup, firstMessage: text });
  }

  return (
    <div className={styles.empty}>
      <div className={styles.inner}>
        <p className={`${styles.mark} ${styles.reveal} ${styles.d1}`}>
          Theologia
        </p>

        <div className={`${styles.modes} ${styles.reveal} ${styles.d2}`}>
          <ModePicker mode={mode} onChange={handleModeChange} />
        </div>

        {/* Re-key on mode so the copy re-reveals when the study changes */}
        <div key={mode} className={styles.modeContent}>
          <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
            {modeDef.heading.pre}
            <em>{modeDef.heading.em}</em>
            {modeDef.heading.post}
          </h1>
          <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
            {modeDef.lede}
          </p>

          <div className={`${styles.composer} ${styles.reveal} ${styles.d4}`}>
            <ChatComposer
              onSend={handleSend}
              disabled={!canSend}
              autoFocus
              contextFirst
              insert={insert}
              placeholder={
                canSend ? modeDef.placeholder : "Complete the setup to begin…"
              }
              context={
                <SetupPicker mode={mode} setup={setup} onChange={setSetup} />
              }
            />
          </div>

          <div className={`${styles.cards} ${styles.reveal} ${styles.d5}`}>
            {modeDef.samplePrompts.map(({ topic, prompt }) => (
              <button
                key={prompt}
                type="button"
                className={styles.cardBtn}
                disabled={!canSend}
                onClick={() => canSend && handleSend(prompt)}
              >
                <span className={styles.cardTopic}>{topic}</span>
                <span className={styles.cardPrompt}>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
