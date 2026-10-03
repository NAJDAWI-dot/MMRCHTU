// Sets the organisers' team codes (A0, A1, ... G2) on the day HQ from the
// team list in scripts/team-codes.json, the same field the Check-in desk edits.
//
// Each row is matched to a registration by team name, or failing that by any
// member's WhatsApp number (the list's Arabic names do not always survive a
// copy from the PDF). Nothing is written without --apply:
//
//   npx tsx scripts/set-team-codes.ts            report only
//   npx tsx scripts/set-team-codes.ts --apply    write the codes
//
// With --apply the codes it replaces are saved to a backup file first.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

interface Row {
  code: string;
  name: string;
  phones: string[];
}

/** Lower case, no accents or Arabic vowel marks, letters and digits only. */
function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** The last nine digits, so 0791..., +962 791... and 962791... agree. */
function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const rows: Row[] = JSON.parse(fs.readFileSync(path.join(__dirname, "team-codes.json"), "utf8"));

  const registrations = await prisma.registration.findMany({
    select: {
      id: true,
      teamName: true,
      status: true,
      members: { select: { whatsapp: true } },
      dayStatus: { select: { teamCode: true } },
    },
  });

  const byName = new Map<string, typeof registrations>();
  const byPhone = new Map<string, typeof registrations>();
  const add = (map: Map<string, typeof registrations>, key: string, reg: (typeof registrations)[number]) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    if (!list.includes(reg)) list.push(reg);
    map.set(key, list);
  };
  for (const reg of registrations) {
    const key = nameKey(reg.teamName);
    add(byName, key, reg);
    // A right-to-left name copied out of a PDF can come out back to front.
    add(byName, [...key].reverse().join(""), reg);
    for (const member of reg.members) add(byPhone, phoneKey(member.whatsapp), reg);
  }

  // Prefer a confirmed registration when a name or number is shared.
  const pick = (list: typeof registrations | undefined) => {
    if (!list?.length) return { reg: undefined, ambiguous: false };
    const confirmed = list.filter((reg) => reg.status === "CONFIRMED");
    const pool = confirmed.length ? confirmed : list;
    return { reg: pool.length === 1 ? pool[0] : undefined, ambiguous: pool.length > 1 };
  };

  const plan: { row: Row; reg: (typeof registrations)[number]; via: string }[] = [];
  const problems: string[] = [];
  const taken = new Map<string, string>();

  for (const row of rows) {
    const named = pick(byName.get(nameKey(row.name)));
    const phoned = pick([...new Set(row.phones.flatMap((p) => byPhone.get(phoneKey(p)) ?? []))]);
    let reg = named.reg ?? phoned.reg;
    const via = named.reg ? "name" : "phone";
    if (named.reg && phoned.reg && named.reg !== phoned.reg) {
      problems.push(`${row.code} ${row.name}: the name matches "${named.reg.teamName}" but the numbers match "${phoned.reg.teamName}". Skipped.`);
      reg = undefined;
    } else if (!reg) {
      const why = named.ambiguous || phoned.ambiguous ? "matches more than one registration" : "no registration found";
      problems.push(`${row.code} ${row.name}: ${why}. Skipped.`);
    }
    if (!reg) continue;
    const other = taken.get(reg.id);
    if (other) {
      problems.push(`${row.code} ${row.name}: "${reg.teamName}" was already matched to ${other}. Skipped.`);
      continue;
    }
    taken.set(reg.id, row.code);
    plan.push({ row, reg, via });
  }

  console.log(`${plan.length} of ${rows.length} teams matched.\n`);
  for (const { row, reg, via } of plan) {
    const before = reg.dayStatus?.teamCode ?? "";
    const change = before === row.code ? "unchanged" : before ? `was ${before}` : "new";
    const status = reg.status === "CONFIRMED" ? "" : `  [registration is ${reg.status}]`;
    console.log(`${row.code.padEnd(3)} ${reg.teamName}  (by ${via}, ${change})${status}`);
  }

  // Codes from the list that some other team holds now would be shown twice.
  const codes = new Set(plan.map((p) => p.row.code));
  const stale = registrations.filter((reg) => !taken.has(reg.id) && reg.dayStatus?.teamCode && codes.has(reg.dayStatus.teamCode));
  for (const reg of stale) console.log(`\n${reg.dayStatus!.teamCode} is held now by "${reg.teamName}", which is not on the list. It will be cleared.`);

  const missing = registrations.filter((reg) => reg.status === "CONFIRMED" && !taken.has(reg.id));
  if (missing.length) {
    console.log(`\nConfirmed teams not on the list (left as they are):`);
    for (const reg of missing) console.log(`    ${reg.teamName}${reg.dayStatus?.teamCode ? ` (code ${reg.dayStatus.teamCode})` : ""}`);
  }
  if (problems.length) {
    console.log(`\nNot matched:`);
    for (const line of problems) console.log(`    ${line}`);
  }

  if (!apply) {
    console.log(`\nNothing written. Run again with --apply to save these codes.`);
    return;
  }

  const backup = path.join(__dirname, `team-codes-backup-${Date.now()}.json`);
  const previous = [...plan.map((p) => p.reg), ...stale].map((reg) => ({ id: reg.id, teamName: reg.teamName, teamCode: reg.dayStatus?.teamCode ?? "" }));
  fs.writeFileSync(backup, JSON.stringify(previous, null, 2));

  await prisma.$transaction([
    ...stale.map((reg) => prisma.teamDayStatus.update({ where: { registrationId: reg.id }, data: { teamCode: "" } })),
    ...plan.map(({ row, reg }) =>
      prisma.teamDayStatus.upsert({
        where: { registrationId: reg.id },
        create: { registrationId: reg.id, teamCode: row.code },
        update: { teamCode: row.code },
      }),
    ),
  ]);
  console.log(`\nSaved ${plan.length} codes. The old codes are in ${backup}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
