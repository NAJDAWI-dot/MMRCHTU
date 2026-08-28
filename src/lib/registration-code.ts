import { randomBytes } from "node:crypto";

/**
 * The short code that lets a team reopen the payment stage.
 *
 * Paying by CliQ means leaving the site: open the banking app, make the
 * transfer, screenshot the confirmation, come back. Plenty of people will close
 * the tab somewhere in the middle, and losing everything they typed — or worse,
 * having them register a second time — is not an acceptable outcome. So stage
 * one hands out a code, emails it, and `/register?code=…` reopens stage two.
 *
 * It is a convenience, not a secret. Anyone holding the code can report a
 * payment against that registration, which is why the report path is rate
 * limited and why nothing sensitive is shown behind it. Six characters is the
 * balance between "typeable off a phone screen" and "not worth guessing at" for
 * a student competition with a few hundred teams.
 *
 * Free of Prisma so the collision retry can be tested without a database.
 */

/**
 * Digits and letters minus 0, O, 1, I and L.
 *
 * Those are the pairs people transcribe wrongly when copying a code out of an
 * email, and every one of them costs a support message. Dropping five
 * characters from the alphabet is cheaper than answering "it says invalid code"
 * over and over.
 */
export const RESUME_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const RESUME_CODE_LENGTH = 6;

/**
 * Characters that are not in the alphabet but which a reader plausibly typed
 * having misread one that is. Applied on the way in, so a team that copied
 * their code correctly is never turned away over a font's ambiguity.
 */
const CONFUSABLES: Record<string, string> = {
  "0": "Q",
  O: "Q",
  "1": "7",
  I: "J",
  L: "J",
};

/**
 * A uniform float in [0, 1), drawn from the OS entropy source.
 *
 * Replaces Math.random, which is not just "not cryptographic" in the abstract:
 * V8 generates it with xorshift128+, whose internal state can be recovered from
 * a handful of observed outputs. Anyone can harvest their own codes by
 * registering, and a recovered state predicts the codes issued around them —
 * which is enough to open another team's resume page and file a payment report
 * against their registration.
 *
 * The modulo bias from mapping 2^32 values onto a 31-character alphabet is
 * about seven parts in a billion, which is not worth rejection sampling for a
 * six-character convenience code.
 */
function cryptoRandom(): number {
  return randomBytes(4).readUInt32BE(0) / 2 ** 32;
}

/**
 * A random code.
 *
 * `random` is injectable purely so tests can pin the output; production uses
 * the crypto-backed source above. The code is still a convenience handle
 * rather than a credential — it is checked for uniqueness against the database,
 * and the pages behind it are rate limited — but there is no reason for it to
 * be predictable when unpredictable costs one line.
 */
export function generateResumeCode(random: () => number = cryptoRandom): string {
  let code = "";
  for (let i = 0; i < RESUME_CODE_LENGTH; i++) {
    const index = Math.floor(random() * RESUME_CODE_ALPHABET.length);
    code += RESUME_CODE_ALPHABET[Math.min(index, RESUME_CODE_ALPHABET.length - 1)];
  }
  return code;
}

/**
 * Cleans up a code as typed: case, spacing, and the usual misreadings.
 *
 * Returns whatever is left, which may not be a valid code — callers check the
 * format separately so they can tell "typed nothing" apart from "typed wrongly".
 */
export function normaliseResumeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[\s\-_]/g, "")
    .split("")
    .map((character) => CONFUSABLES[character] ?? character)
    .join("");
}

export function isValidResumeCodeFormat(value: string): boolean {
  if (value.length !== RESUME_CODE_LENGTH) return false;
  return value.split("").every((character) => RESUME_CODE_ALPHABET.includes(character));
}

/**
 * A code no existing registration already holds.
 *
 * `exists` is injected rather than importing Prisma, both to keep this module
 * database-free and because the caller is already inside a request that knows
 * how to query. Throwing after a bounded number of attempts is deliberate: a
 * silent duplicate would fail later at the unique constraint, in the middle of
 * someone's registration, as an opaque database error rather than something
 * this module can be blamed for.
 */
export async function createUniqueResumeCode(
  exists: (code: string) => Promise<boolean>,
  attempts: number = 5,
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const code = generateResumeCode();
    if (!(await exists(code))) return code;
  }
  throw new Error(
    `Could not generate a unique resume code after ${attempts} attempts. ` +
      `This should be effectively impossible — check whether the uniqueness check is misreporting.`,
  );
}
