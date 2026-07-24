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
