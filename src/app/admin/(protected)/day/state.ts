/**
 * What the HQ desk actions hand back to their forms. Separate from the action
 * files because a "use server" module may only export async functions.
 */
export interface DeskState {
  ok: boolean;
  message: string | null;
}

export const EMPTY_DESK_STATE: DeskState = { ok: false, message: null };
