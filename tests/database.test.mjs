import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import canonical from "../src/data/canonical-script.json" with { type: "json" };
import searchDb from "../src/data/search-db.json" with { type: "json" };
import aliases from "../src/data/aliases.json" with { type: "json" };
import unlocks from "../src/data/unlocks.json" with { type: "json" };
import recordMedia from "../src/data/record-media.json" with { type: "json" };
import { applyRecord, initialState, normalizeAudio, search } from "../src/lib/engine.js";

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const fullyUnlocked = {
  ...initialState,
  viewedRecords: canonical.records.map((record) => record.id),
  unlockedFeatures: { crossSearch: true, advancedCrossSearch: true }
};

test("SCRIPT integrity includes exactly SCRIPT_001 through SCRIPT_067", () => {
  assert.equal(canonical.records.length, 67);
  assert.deepEqual(canonical.records.map((record) => record.id), Array.from({ length: 67 }, (_, index) => `SCRIPT_${String(index + 1).padStart(3, "0")}`));
  for (const record of canonical.records) assert.equal(hash(`${record.title}\n${record.body}`), record.sha256, record.id);
});

test("canonical source has not changed", async () => {
  const source = (await readFile(new URL("../source/CANONICAL_SCRIPT.md", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const expected = (await readFile(new URL("../source/EXPECTED_SHA256.txt", import.meta.url), "utf8")).trim();
  assert.equal(hash(source), expected, "SCRIPT_INTEGRITY_ERROR");
  assert.equal(canonical.sourceSha256, expected);
});

test("all canonical queries map to their exact SCRIPT", () => {
  for (const record of searchDb.records) {
    const query = Array.isArray(record.canonicalQuery) ? record.canonicalQuery.join("　") : record.canonicalQuery;
    const outcome = search(query, fullyUnlocked);
    assert.equal(outcome.result.recordId, record.id, query);
  }
});

test("cross search order is independent", () => {
  assert.equal(search("雨宮七海　御影七海", fullyUnlocked).result.recordId, "SCRIPT_038");
  assert.equal(search("御影七海　雨宮七海", fullyUnlocked).result.recordId, "SCRIPT_038");
});

test("all six advanced search permutations map to one SCRIPT", () => {
  const parts = ["相沢佳代", "相沢少年", "久世冬真"];
  const permutations = parts.flatMap((a, i) => parts.filter((_, j) => j !== i).flatMap((b) => parts.filter((part) => part !== a && part !== b).map((c) => [a, b, c])));
  assert.equal(permutations.length, 6);
  for (const permutation of permutations) assert.equal(search(permutation.join("　"), fullyUnlocked).result.recordId, "SCRIPT_063");
});

test("cross and advanced functions unlock only after required records", () => {
  let state = initialState;
  for (const id of unlocks.crossSearch.slice(0, -1)) state = applyRecord(searchDb.records.find((record) => record.id === id), state).state;
  assert.equal(state.unlockedFeatures.crossSearch, false);
  state = applyRecord(searchDb.records.find((record) => record.id === unlocks.crossSearch.at(-1)), state).state;
  assert.equal(state.unlockedFeatures.crossSearch, true);
  for (const id of unlocks.advancedCrossSearch) state = applyRecord(searchDb.records.find((record) => record.id === id), state).state;
  assert.equal(state.unlockedFeatures.advancedCrossSearch, true);
});

test("half-width separators explain the required query format", () => {
  const outcome = search("雨宮七海 御影七海", fullyUnlocked);
  assert.equal(outcome.result.status, "FORMAT_ERROR");
  assert.match(outcome.result.body, /全角スペース/);
});

test("audio record input variants resolve to the formal title", () => {
  for (const input of ["202608301430", "音声202608301430", "音声記録 202608301430", "音声記録：202608301430", "AUDIO202608301430"]) {
    assert.equal(normalizeAudio(input), "音声記録202608301430");
    assert.equal(search(input, fullyUnlocked).result.recordId, "SCRIPT_015");
  }
});

test("aliases and completion requirements are data-driven", () => {
  assert.ok(Object.values(aliases).flat().length > 0);
  const before = { ...fullyUnlocked, viewedRecords: fullyUnlocked.viewedRecords.filter((id) => id !== "SCRIPT_067"), completed: false };
  const outcome = search("久世負傷", before);
  assert.equal(outcome.state.completed, true);
});

test("GAME START explains the database without revealing the first search key", () => {
  assert.match(canonical.gameStart.body, /人物、場所、資料、音声記録を検索するためのもの/);
  assert.match(canonical.gameStart.body, /すべての情報は、このデータベースに入力済み/);
  assert.equal(canonical.gameStart.body.includes("最初に確認すべき場所"), false);
  assert.equal(canonical.gameStart.body.includes("**黒凪島**。"), false);
});

test("island and mansion records include their map attachments", async () => {
  assert.match(recordMedia.SCRIPT_001.src, /kuronagi-island-map\.svg$/);
  assert.match(recordMedia.SCRIPT_002.src, /kuronagi-mansion-floor-map\.svg$/);
  for (const media of Object.values(recordMedia)) {
    const file = new URL(`../public${media.src}`, import.meta.url);
    assert.match(await readFile(file, "utf8"), /<svg/);
  }
});
