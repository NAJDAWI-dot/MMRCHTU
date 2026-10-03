/**
 * Setting every team's code at once from the organisers' team sheet, pasted
 * into the Check-in desk (see CodeImport there).
 *
 * The sheet is pasted, not stored: it carries the members' phone numbers. A
 * row is a code ("A0"), the team name and anything else on the line; a row is
 * matched to a confirmed team by its name, or failing that by any member's
 * number, since Arabic names do not always survive a copy out of a PDF.
 */

/** A code is a letter and one or two digits: A0, G2, T07. */
const CODE = /^[A-Za-z]\d{1,2}$/;

export interface CodeRow {
  code: string;
  /** The team name cell, when the paste has cells (copied from the sheet). */
  name: string | null;
  /** Everything after the code, for a paste without cells (copied from the PDF). */
  text: string;
  phones: string[];
}

export interface CodeTeam {
  id: string;
  name: string;
  code: string;
  phones: string[];
}

export interface CodePlan {
  assign: { code: string; teamId: string; teamName: string; via: "name" | "number"; before: string }[];
  /** Teams not on the list that hold one of its codes now, which would be shown twice. */
  clear: { teamId: string; teamName: string; code: string }[];
  unmatched: { code: string; label: string; reason: string }[];
  /** Confirmed teams the list does not mention, left as they are. */
  notListed: { teamName: string; code: string }[];
}

/**
 * Lower case, letters and digits only, with accents and Arabic vowel marks
 * dropped and the Arabic letters that are written several ways folded together.
 */
export function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** The last nine digits, so 0791..., +962 791... and 962791... agree. */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

/**
 * The phone numbers among some words. A number may be written in groups
 * ("+962 7 9986 1404"), so neighbouring short runs of digits are joined; a
 * word that is a whole number on its own stands alone.
 */
export function phonesIn(words: string[]): string[] {
  const found: string[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer.length >= 9) found.push(phoneKey(buffer));
    buffer = "";
  };
  for (const word of words) {
    if (!/^\+?[\d().-]+$/.test(word)) {
      flush();
      continue;
    }
    const digits = word.replace(/\D/g, "");
    if (digits.length >= 9) {
      flush();
      found.push(phoneKey(digits));
    } else {
      buffer += digits;
    }
  }
  flush();
  return [...new Set(found)];
}

/**
 * Rows from a paste. Copied from the sheet, a line is tab separated: the code
 * is in one of the first cells and the team name in the next one with text.
 * Copied from the PDF there are no cells, so a row runs from one code to the
 * next.
 */
export function parseCodeList(paste: string): CodeRow[] {
  if (paste.includes("\t")) {
    return paste.split(/\r?\n/).flatMap((line) => {
      const cells = line.split("\t").map((cell) => cell.trim());
      const at = cells.slice(0, 4).findIndex((cell) => CODE.test(cell));
      if (at < 0) return [];
      const rest = cells.slice(at + 1);
      const name = rest.find((cell) => cell !== "") ?? "";
      return [{ code: cells[at]!.toUpperCase(), name, text: rest.join(" ").trim(), phones: phonesIn(rest.join(" ").split(/\s+/)) }];
    });
  }
  const rows: CodeRow[] = [];
  let words: string[] | null = null;
  let code = "";
  const close = () => {
    if (words) rows.push({ code, name: null, text: words.join(" "), phones: phonesIn(words) });
  };
  for (const word of paste.split(/\s+/).filter(Boolean)) {
    if (CODE.test(word)) {
      close();
      code = word.toUpperCase();
      words = [];
    } else {
      words?.push(word);
    }
  }
  close();
  return rows;
}

const reversed = (key: string) => [...key].reverse().join("");

/** Which team each row is, and what saving the list would change. */
export function planCodes(rows: CodeRow[], teams: CodeTeam[]): CodePlan {
  const keyed = teams.map((team) => ({ team, keys: [...new Set([nameKey(team.name), reversed(nameKey(team.name))])].filter(Boolean) }));
  const byPhone = new Map<string, CodeTeam[]>();
  for (const team of teams) {
    for (const phone of new Set(team.phones.map(phoneKey).filter(Boolean))) byPhone.set(phone, [...(byPhone.get(phone) ?? []), team]);
  }

  const byName = (row: CodeRow): CodeTeam[] => {
    if (row.name !== null) {
      const key = nameKey(row.name);
      return key ? keyed.filter(({ keys }) => keys.includes(key)).map(({ team }) => team) : [];
    }
    // No cells: the name is whatever the line starts with, and the longest
    // team name that fits wins, so "Ratatouille" is not read as "Rat".
    const text = nameKey(row.text);
    let best: CodeTeam[] = [];
    let length = 0;
    for (const { team, keys } of keyed) {
      const fit = Math.max(0, ...keys.filter((key) => text.startsWith(key)).map((key) => key.length));
      if (fit > length) [best, length] = [[team], fit];
      else if (fit && fit === length) best.push(team);
    }
    return best;
  };

  const plan: CodePlan = { assign: [], clear: [], unmatched: [], notListed: [] };
  const assigned = new Map<string, string>();
  const usedCodes = new Set<string>();

  for (const row of rows) {
    const label = row.name ?? row.text.split(/\s+/).slice(0, 4).join(" ");
    const miss = (reason: string) => plan.unmatched.push({ code: row.code, label, reason });
    if (usedCodes.has(row.code)) {
      miss(`${row.code} is on the list twice. Only the first is used.`);
      continue;
    }
    const named = byName(row);
    const numbered = [...new Set(row.phones.flatMap((phone) => byPhone.get(phone) ?? []))];
    if (named.length > 1 || (!named.length && numbered.length > 1)) {
      miss("Matches more than one team.");
      continue;
    }
    if (named.length === 1 && numbered.length && !numbered.includes(named[0]!)) {
      miss(`The name is ${named[0]!.name} but the numbers belong to ${numbered.map((team) => team.name).join(", ")}.`);
      continue;
    }
    const team = named[0] ?? numbered[0];
    if (!team) {
      miss("No confirmed team has this name or any of these numbers.");
      continue;
    }
    const earlier = assigned.get(team.id);
    if (earlier) {
      miss(`${team.name} already has ${earlier} from this list.`);
      continue;
    }
    assigned.set(team.id, row.code);
    usedCodes.add(row.code);
    plan.assign.push({ code: row.code, teamId: team.id, teamName: team.name, via: named.length ? "name" : "number", before: team.code });
  }

  for (const team of teams) {
    if (assigned.has(team.id)) continue;
    if (team.code && usedCodes.has(team.code)) plan.clear.push({ teamId: team.id, teamName: team.name, code: team.code });
    plan.notListed.push({ teamName: team.name, code: team.code && !usedCodes.has(team.code) ? team.code : "" });
  }
  return plan;
}
