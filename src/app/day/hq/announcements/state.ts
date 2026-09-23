/**
 * What the announcement actions hand back to the form.
 *
 * Separate from actions.ts because a "use server" module may only export async
 * functions. Same shape as the Micro Mouse and broadcasts screens.
 */
export interface ActionState {
  message: string | null;
  ok: boolean;
}

export const EMPTY_STATE: ActionState = { message: null, ok: false };
