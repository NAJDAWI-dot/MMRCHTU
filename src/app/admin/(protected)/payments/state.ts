/**
 * Shared result shape for the payments `useFormState` actions.
 *
 * This lives outside actions.ts because a "use server" module may only export
 * async functions — exporting the EMPTY_STATE constant from there fails at
 * runtime with "A 'use server' file can only export async functions".
 *
 * A local copy of the identical shape in the broadcasts tab rather than an
 * import across features or a lift into `src/lib`: it is four lines, and one
 * tab reaching into another's internals to borrow them is the worse coupling.
 */
export interface ActionState {
  message: string | null;
  ok: boolean;
}

export const EMPTY_STATE: ActionState = { message: null, ok: false };
