import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A source-level guard, which is unusual and worth justifying.
 *
 * `completeRegistration` used to call `revalidatePath` on the two admin lists.
 * Revalidating from inside a Server Action also refreshes the route the action
 * was called from, so /register re-rendered and RegisterForm remounted — and the
 * remount threw away the `useFormState` success state that had just been set.
 * The confirmation and the celebration appeared and were destroyed within a
 * frame, leaving an empty step one and no sign anything had happened. The
 * registration was written to the database every single time; only the screen
 * forgot.
 *
 * Nothing in the normal test suite can see that. It is not a pure function, so
 * a unit test cannot reach it; it needs a real browser and a real Server Action
 * round trip, and reaching the success path at all requires a working blob
 * upload, which is why the end-to-end suite does not cover it either. The bug
 * shipped twice before it was found by hand.
 *
 * So the invariant is asserted where it can be: the calls must not come back.
 * The admin lists never needed them anyway — admin/(protected)/layout.tsx sets
 * `dynamic = "force-dynamic"`, so those pages are rebuilt on every request and
 * have no cache to invalidate.
 */

const ACTIONS = resolve(__dirname, "../../src/app/register/actions.ts");
const ADMIN_LAYOUT = resolve(__dirname, "../../src/app/admin/(protected)/layout.tsx");

describe("completeRegistration", () => {
  const source = readFileSync(ACTIONS, "utf8");

  it("never revalidates, because that remounts the form mid-success", () => {
    // Comments may mention it — the explanation of why lives in that file.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(code).not.toContain("revalidatePath");
    expect(code).not.toContain("next/cache");
  });
});

describe("the admin lists that used to be revalidated", () => {
  it("are force-dynamic, so they never needed revalidating", () => {
    // If this ever stops being true, the reasoning above needs revisiting —
    // the lists would then genuinely be cached, and keeping them fresh would
    // have to happen somewhere that is not the registration path.
    const layout = readFileSync(ADMIN_LAYOUT, "utf8");
    expect(layout).toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
  });
});
