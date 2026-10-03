import type { CodePlan } from "@/lib/team-codes";

/**
 * What the HQ desk actions hand back to their forms. Separate from the action
 * files because a "use server" module may only export async functions.
 */
export interface DeskState {
  ok: boolean;
  message: string | null;
}

export const EMPTY_DESK_STATE: DeskState = { ok: false, message: null };

/** A checked team code list: what saving it would do, and the paste it came from. */
export interface CodeListState extends DeskState {
  plan: CodePlan | null;
  list: string;
}

export const EMPTY_CODE_LIST: CodeListState = { ok: false, message: null, plan: null, list: "" };

/** What has to be typed to reset the day (reset-actions.ts): enough that nobody does it by accident. */
export const RESET_WORD = "RESET";
