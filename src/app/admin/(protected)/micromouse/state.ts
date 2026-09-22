/**
 * What the reference actions hand back to the form.
 *
 * Separate from actions.ts because a "use server" module may only export async
 * functions: exporting EMPTY_STATE from there fails at runtime. Same shape and
 * same reason as the broadcasts screen next door.
 */
export interface ActionState {
  message: string | null;
  ok: boolean;
}

export const EMPTY_STATE: ActionState = { message: null, ok: false };
