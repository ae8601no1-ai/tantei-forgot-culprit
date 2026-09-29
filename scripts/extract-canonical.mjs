import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "source", "CANONICAL_SCRIPT.md");
const source = (await readFile(sourcePath, "utf8")).replace(/\r\n/g, "\n");
const clean = (value) => value.replace(/^\n+|\n+$/g, "");
const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const expectedSourceHash = (await readFile(path.join(root, "source", "EXPECTED_SHA256.txt"), "utf8")).trim();
const actualSourceHash = hash(source);
if (actualSourceHash !== expectedSourceHash) throw new Error(`SCRIPT_INTEGRITY_ERROR: expected ${expectedSourceHash}, received ${actualSourceHash}`);

const recordHeading = /^## (\d{2})｜(.+)$/gm;
const matches = [...source.matchAll(recordHeading)];
if (matches.length !== 67) throw new Error(`Expected 67 records, found ${matches.length}`);

const boundaries = [...source.matchAll(/^# (?!#).+$/gm)].map((match) => match.index);
const records = matches.map((match, index) => {
  const number = Number(match[1]);
  const title = match[2];
  const bodyStart = match.index + match[0].length;
  const nextRecord = matches[index + 1]?.index ?? source.length;
  const nextSection = boundaries.find((position) => position > bodyStart) ?? source.length;
  const body = clean(source.slice(bodyStart, Math.min(nextRecord, nextSection)).replace(/\n---\s*$/g, ""));
  const query = title.split("　");
  const type = query.length === 3 ? "advanced_cross" : query.length === 2 ? "cross" : "single";
  const phase = number <= 37 ? 1 : number <= 59 ? 2 : 3;
  return {
    id: `SCRIPT_${String(number).padStart(3, "0")}`,
    number,
    canonicalQuery: type === "single" ? title : query,
    title,
    body,
    type,
    phase,
    orderIndependent: type !== "single",
    locked: true,
    editable: false,
    sha256: hash(`${title}\n${body}`)
  };
});

function section(startHeading, endHeading) {
  const start = source.indexOf(startHeading);
  if (start < 0) throw new Error(`Missing section ${startHeading}`);
  const bodyStart = start + startHeading.length;
  const end = endHeading ? source.indexOf(endHeading, bodyStart) : source.length;
  if (end < 0) throw new Error(`Missing boundary ${endHeading}`);
  return clean(source.slice(bodyStart, end).replace(/\n---\s*$/g, ""));
}

const gameStart = section("# GAME START", "\n---\n\n# PHASE 1");
const systemEvents = [...source.matchAll(/^# SYSTEM EVENT$/gm)].map((match, index, all) => {
  const start = match.index + match[0].length;
  const nextPhase = source.indexOf("\n---\n\n# PHASE", start);
  const body = clean(source.slice(start, nextPhase));
  return { id: index === 0 ? "CROSS_SEARCH_RECOVERED" : "ADVANCED_CROSS_SEARCH_RECOVERED", body, sha256: hash(body) };
});
const caseReconstruction = section("# CASE RECONSTRUCTION", "\n---\n\n# PERSONAL NOTE");
const personalStart = source.indexOf("# PERSONAL NOTE");
const personalEnd = source.indexOf("\n---\n\n**CASE KN-2026-08**", personalStart);
const personalNote = clean(source.slice(personalStart + "# PERSONAL NOTE".length, personalEnd));
const finalCard = clean(source.slice(personalEnd + "\n---\n".length));

const canonical = {
  sourceFile: "source/CANONICAL_SCRIPT.md",
  sourceSha256: actualSourceHash,
  gameStart: { body: gameStart, sha256: hash(gameStart) },
  systemEvents,
  records,
  ending: {
    caseReconstruction: { body: caseReconstruction, sha256: hash(caseReconstruction) },
    personalNote: { body: personalNote, sha256: hash(personalNote) },
    finalCard: { body: finalCard, sha256: hash(finalCard) }
  }
};

const searchDb = {
  records: records.map(({ id, number, canonicalQuery, type, phase, orderIndependent, title }) => ({
    id,
    number,
    canonicalQuery,
    type,
    phase,
    orderIndependent,
    contentKey: id,
    title,
    countsForProgress: true
  }))
};

await writeFile(path.join(root, "src/data/canonical-script.json"), `${JSON.stringify(canonical, null, 2)}\n`);
await writeFile(path.join(root, "src/data/search-db.json"), `${JSON.stringify(searchDb, null, 2)}\n`);
await writeFile(path.join(root, "src/data/script-hashes.json"), `${JSON.stringify(Object.fromEntries(records.map((record) => [record.id, record.sha256])), null, 2)}\n`);
console.log(`Extracted ${records.length} canonical records. Source SHA-256: ${canonical.sourceSha256}`);
