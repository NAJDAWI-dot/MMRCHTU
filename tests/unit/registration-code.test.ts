import { describe, expect, it, vi } from "vitest";
import {
  RESUME_CODE_ALPHABET,
  RESUME_CODE_LENGTH,
  createUniqueResumeCode,
  generateResumeCode,
  isValidResumeCodeFormat,
  normaliseResumeCode,
} from "@/lib/registration-code";

describe("RESUME_CODE_ALPHABET", () => {
  it("excludes the characters people misread when copying a code off a screen", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L"]) {
      expect(RESUME_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("has no repeated characters, so every draw is equally likely", () => {
    expect(new Set(RESUME_CODE_ALPHABET).size).toBe(RESUME_CODE_ALPHABET.length);
  });
});

describe("generateResumeCode", () => {
  it("produces a code of the advertised length from the alphabet", () => {
    const code = generateResumeCode();
    expect(code).toHaveLength(RESUME_CODE_LENGTH);
    for (const character of code) {
      expect(RESUME_CODE_ALPHABET).toContain(character);
    }
  });

  it("uses the injected randomness, so a code is reproducible in a test", () => {
    const always = () => 0;
    expect(generateResumeCode(always)).toBe(RESUME_CODE_ALPHABET[0]!.repeat(RESUME_CODE_LENGTH));
  });

  it("does not collide across a reasonable number of draws", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateResumeCode()));
    expect(codes.size).toBe(500);
  });
});

describe("normaliseResumeCode", () => {
  it("uppercases, so a code typed in lower case still works", () => {
    expect(normaliseResumeCode("abc234")).toBe("ABC234");
  });

  it("strips the spaces and dashes people add when reading a code aloud", () => {
    expect(normaliseResumeCode(" ABC-234 ")).toBe("ABC234");
    expect(normaliseResumeCode("ABC 234")).toBe("ABC234");
  });

  it("maps the ambiguous characters onto what the reader almost certainly meant", () => {
    // O and 0 look alike in most fonts; the alphabet contains neither, so a
    // typed O can only have been a misread of something. Mapping beats
    // rejecting a code the team copied correctly off a confirmation email.
    expect(normaliseResumeCode("OBC234")).not.toContain("O");
    expect(normaliseResumeCode("IBC234")).not.toContain("I");
  });

  it("returns an empty string for junk rather than a partial code", () => {
    expect(normaliseResumeCode("")).toBe("");
    expect(normaliseResumeCode("   ")).toBe("");
  });
});

describe("isValidResumeCodeFormat", () => {
  it("accepts a freshly generated code", () => {
    expect(isValidResumeCodeFormat(generateResumeCode())).toBe(true);
  });

  it("rejects wrong lengths and out-of-alphabet characters", () => {
    expect(isValidResumeCodeFormat("")).toBe(false);
    expect(isValidResumeCodeFormat("ABC23")).toBe(false);
    expect(isValidResumeCodeFormat("ABC2345")).toBe(false);
    expect(isValidResumeCodeFormat("ABC23!")).toBe(false);
    expect(isValidResumeCodeFormat("abc234")).toBe(false);
  });
});

describe("createUniqueResumeCode", () => {
  it("returns the first code when nothing is taken", async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const code = await createUniqueResumeCode(exists);
    expect(isValidResumeCodeFormat(code)).toBe(true);
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it("retries past a collision", async () => {
    const exists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const code = await createUniqueResumeCode(exists);
    expect(isValidResumeCodeFormat(code)).toBe(true);
    expect(exists).toHaveBeenCalledTimes(3);
  });

  it("gives up loudly rather than returning a code it knows is taken", async () => {
    // A silent duplicate would violate the unique constraint at insert time and
    // surface as an opaque Prisma error during someone's registration.
    const exists = vi.fn().mockResolvedValue(true);
    await expect(createUniqueResumeCode(exists, 3)).rejects.toThrow(/unique/i);
    expect(exists).toHaveBeenCalledTimes(3);
  });
});
