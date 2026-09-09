/**
 * Shared result shape for the broadcast `useFormState` actions.
 *
 * This lives outside actions.ts because a "use server" module may only export
 * async functions — exporting the EMPTY_STATE constant from there fails at
 * runtime with "A 'use server' file can only export async functions".
 */
export interface ActionState {
  message: string | null;
  ok: boolean;
}

export const EMPTY_STATE: ActionState = { message: null, ok: false };

/**
 * How many recipients go out per request.
 *
 * Here rather than beside the action that uses it, for the same reason
 * EMPTY_STATE is here: a "use server" module may only export async functions,
 * and a plain constant exported from one fails at build time with an error that
 * names the line and not the rule.
 *
 * Ten is about five and a half seconds of sending at the provider's rate limit
 * — comfortably inside any request timeout, and short enough that the progress
 * bar visibly moves.
 */
export const SEND_BATCH_SIZE = 10;
