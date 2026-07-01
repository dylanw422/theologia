import type { ModeId } from "../chat-state";
import { script as catechism } from "./catechism";
import { script as comparison } from "./comparison";
import { script as debatePrep } from "./debate-prep";
import { script as devilsAdvocate } from "./devils-advocate";
import { script as library } from "./library";
import { script as qa } from "./qa";
import { script as resources } from "./resources";
import { script as scriptureStudy } from "./scripture-study";
import type { Script } from "./types";

const SCRIPTS: Record<ModeId, Script> = {
  qa,
  "devils-advocate": devilsAdvocate,
  comparison,
  "debate-prep": debatePrep,
  catechism,
  resources,
  library,
  "scripture-study": scriptureStudy,
};

export function getScript(mode: ModeId): Script {
  return SCRIPTS[mode];
}
