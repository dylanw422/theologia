"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Info, X } from "lucide-react";

import { MODES } from "./lib/modes";
import styles from "./mode-info-dialog.module.css";

/** Info icon beside the mode picker; opens a modal explaining each mode. */
export default function ModeInfoDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={styles.trigger}
        aria-label="About the study modes"
      >
        <Info size={13} aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup}>
          <div className={styles.head}>
            <Dialog.Title className={styles.title}>
              What each mode is for
            </Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Close">
              <X size={14} aria-hidden />
            </Dialog.Close>
          </div>
          <div className={styles.list}>
            {MODES.map((mode) => (
              <section key={mode.id} className={styles.mode}>
                <h3 className={styles.modeLabel}>{mode.label}</h3>
                <p className={styles.modeLede}>{mode.lede}</p>
                <ul className={styles.useCases}>
                  {mode.useCases.map((useCase) => (
                    <li key={useCase}>{useCase}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
