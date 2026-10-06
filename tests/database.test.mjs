import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import canonical from "../src/data/canonical-script.json" with { type: "json" };
import searchDb from "../src/data/search-db.json" with { type: "json" };
import aliases from "../src/data/aliases.json" with { type: "json" };
import unlocks from "../src/data/unlocks.json" with { type: "json" };
import recordMedia from "../src/data/record-media.json" with { type: "json" };
import supportContent from "../src/data/investigation-support.json" with { type: "json" };
import { applyRecord, completeGame, completeUnlockEvent, completeUnsavedAudio01, completeUnsavedAudio02, initialState, normalizeAudio, returnToTop, search } from "../src/lib/engine.js";
import { availableSupportItems, initialSupportState, revealSupportLevel } from "../src/lib/support.js";

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const record = (id) => searchDb.records.find((item) => item.id === id);
const unlocked = { ...initialState, crossSearchUnlocked: true, advancedCrossSearchUnlocked: true, viewedRecords: canonical.records.map((item) => item.id) };
const appSource = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const source = (await readFile(new URL("../source/CANONICAL_SCRIPT.md", import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("01 検索可能レコード数が63", () => assert.equal(canonical.records.length, 63));
test("02 64〜67が検索DBに存在しない", () => assert.equal(searchDb.records.some((item) => item.number > 63 || /^SCRIPT_06[4-7]$/.test(item.id)), false));
test("03 御影征一郎は07", () => assert.equal(search("御影征一郎", initialState).result.recordId, "SCRIPT_007"));
test("04 征一郎エイリアスは07", () => assert.equal(search("征一郎", initialState).result.recordId, "SCRIPT_007"));
test("05 御影隆一は08", () => assert.equal(search("御影隆一", initialState).result.recordId, "SCRIPT_008"));
test("06 音声記録202609010925は21", () => assert.equal(search("音声記録202609010925", initialState).result.recordId, "SCRIPT_021"));
test("07 21は修正版会話", () => { const body = canonical.records[20].body; assert.match(body, /紙に日付があったから/); assert.match(body, /まだ事故か事件か判断しているとは話していません/); });
test("08 38閲覧前はCROSS SEARCH不可", () => assert.equal(search("雨宮七海　御影七海", initialState).result.status, "NOT_FOUND"));
test("09 38本文とCROSS SEARCHシステムイベントを分離", () => assert.doesNotMatch(canonical.records[37].body, /CROSS SEARCH|システム内から未使用機能/));
test("10 38表示時はCROSS SEARCHをpendingにする", () => { const outcome = applyRecord(record("SCRIPT_038"), initialState); assert.equal(outcome.state.crossSearchPending, true); assert.equal(outcome.state.crossSearchUnlocked, false); assert.deepEqual(outcome.events, []); });
test("11 TOPにCROSS SEARCH ACTIVE表示を実装", () => assert.match(appSource, /CROSS SEARCH MODE：ACTIVE/));
test("12 全検索結果にTOPへ戻るボタン", () => assert.match(appSource, /result\.status !== "START".*データベースTOPへ戻る/s));
test("13 TOP移動で進行stateを初期化しない", () => { const body = appSource.match(/function goTop\(\)[\s\S]*?\n  }/)?.[0] ?? ""; assert.match(body, /returnToTop/); assert.doesNotMatch(body, /setState\(initialState\)/); });
test("14 60閲覧前はADVANCED不可", () => assert.equal(search("御影澪　水城沙耶　榊原美智子", { ...initialState, crossSearchUnlocked: true }).result.status, "NOT_FOUND"));
test("15 60表示時はADVANCEDをpendingにする", () => { const outcome = applyRecord(record("SCRIPT_060"), { ...initialState, crossSearchUnlocked: true }); assert.equal(outcome.state.advancedCrossSearchPending, true); assert.equal(outcome.state.advancedCrossSearchUnlocked, false); assert.deepEqual(outcome.events, []); });
test("16 TOPにADVANCED ACTIVE表示を実装", () => assert.match(appSource, /ADVANCED CROSS SEARCH MODE：ACTIVE/));
test("17 61を3語検索", () => assert.equal(search("御影澪　水城沙耶　榊原美智子", unlocked).result.recordId, "SCRIPT_061"));
test("18 62を3語検索", () => assert.equal(search("御影澪　雨宮七海　御影征一郎", unlocked).result.recordId, "SCRIPT_062"));
test("19 63を3語検索", () => assert.equal(search("御影隆一　御影澪　桟橋", unlocked).result.recordId, "SCRIPT_063"));
test("20 63終了前にCACHEは出現しない", () => assert.equal(initialState.dbAnalysisComplete, false));
test("21 61・62未閲覧では63終了後もDB解析未完了", () => assert.equal(applyRecord(record("SCRIPT_063"), { ...initialState, advancedCrossSearchUnlocked: true }).state.dbAnalysisComplete, false));
test("21b 61・62・63の全閲覧後にDB解析完了", () => {
  let state = { ...initialState, advancedCrossSearchUnlocked: true };
  state = applyRecord(record("SCRIPT_061"), state).state;
  state = applyRecord(record("SCRIPT_062"), state).state;
  state = applyRecord(record("SCRIPT_063"), state).state;
  assert.equal(state.dbAnalysisComplete, true);
});
test("21c 61・62・63は閲覧順にかかわらず最後の必須記録でDB解析完了", () => {
  const permutations = [
    ["SCRIPT_061", "SCRIPT_062", "SCRIPT_063"],
    ["SCRIPT_061", "SCRIPT_063", "SCRIPT_062"],
    ["SCRIPT_062", "SCRIPT_061", "SCRIPT_063"],
    ["SCRIPT_062", "SCRIPT_063", "SCRIPT_061"],
    ["SCRIPT_063", "SCRIPT_061", "SCRIPT_062"],
    ["SCRIPT_063", "SCRIPT_062", "SCRIPT_061"]
  ];

  for (const order of permutations) {
    let state = { ...initialState, advancedCrossSearchUnlocked: true };
    let events = [];
    for (const id of order) {
      const outcome = applyRecord(record(id), state);
      state = outcome.state;
      events.push(...outcome.events);
    }
    assert.equal(state.dbAnalysisComplete, true, order.join(" -> "));
    assert.deepEqual(events, ["DATABASE_ANALYSIS_COMPLETE"], order.join(" -> "));
  }
});
test("22 2 AUDIO FILES FOUNDを表示", () => assert.match(appSource, /2 AUDIO FILES FOUND/));
test("23 音声を自動表示せずTOPへ戻る", () => assert.match(appSource, /DATABASE_ANALYSIS_COMPLETE[\s\S]*データベースTOPへ戻る/));
test("24 TOPに未保存音声項目", () => assert.match(appSource, /保存完了していない音声記録/));
test("25 AUDIO 01初期AVAILABLE", () => assert.match(appSource, /UNSAVED AUDIO 01<\/b><small>AVAILABLE/));
test("26 AUDIO 02初期LOCKED", () => { assert.equal(initialState.unsavedAudio01Viewed, false); assert.match(appSource, /unsavedAudio01Viewed \? "AVAILABLE" : "LOCKED"/); });
test("27 相沢冬真はAUDIO 01で初明示", () => { assert.equal(canonical.records.some((item) => item.body.includes("相沢冬真")), false); assert.match(canonical.unsavedAudio.file01.body, /相沢冬真/); });
test("28 AUDIO 01後にAUDIO 02解放", () => assert.equal(completeUnsavedAudio01({ ...initialState, dbAnalysisComplete: true }).unsavedAudio01Viewed, true));
test("29 AUDIO 02は22:18正式全文", () => { assert.match(canonical.unsavedAudio.file02.body, /2026\.09\.02 22:18/); assert.match(canonical.unsavedAudio.file02.body, /沙耶「そこ、階段――」/); assert.match(canonical.unsavedAudio.file02.body, /AUDIO DATA LOST/); });
test("30 AUDIO 02後にSYSTEM RECOVERYへ", () => { assert.equal(completeUnsavedAudio02({ ...initialState, unsavedAudio01Viewed: true }).unsavedAudio02Viewed, true); assert.match(appSource, /setView\("recovery"\)/); });
test("31 鎮静系薬剤を表示", () => assert.match(canonical.systemRecovery.body, /鎮静系薬剤を検出/));
test("32 頭部外傷に伴う記憶障害を表示", () => assert.match(canonical.systemRecovery.body, /頭部外傷に伴う記憶障害/));
test("33 CASE RECONSTRUCTIONへ進む", () => assert.match(appSource, /CASE RECONSTRUCTIONへ/));
test("34 第一事件犯人", () => assert.match(canonical.ending.caseReconstruction.body, /第一事件。[\s\S]*雨宮七海――御影七海/));
test("35 第二事件犯人", () => assert.match(canonical.ending.caseReconstruction.body, /第二事件。[\s\S]*雨宮七海――御影七海/));
test("36 第三事件犯人", () => assert.match(canonical.ending.caseReconstruction.body, /第三事件。[\s\S]*水城沙耶――御影澪/));
test("37 澪を落とした人物は御影隆一", () => assert.match(canonical.ending.caseReconstruction.body, /海へ転落させた人物：[\s\S]*御影隆一/));
test("38 海へ飛び込んだ少年は相沢冬真", () => assert.match(canonical.ending.caseReconstruction.body, /海へ飛び込んだ少年：[\s\S]*相沢冬真/));
test("39 現在名は久世冬真", () => assert.match(canonical.ending.caseReconstruction.body, /現在の名前：[\s\S]*久世冬真/));
test("40 冒頭とラストのRECOVERED CASE FILEを統一", () => assert.equal(canonical.ending.gameStartReprise.body, canonical.gameStart.body));
test("41 冒頭ヒントを復活させない", () => { assert.doesNotMatch(canonical.gameStart.body, /最初に確認すべき場所|\*\*黒凪島\*\*。/); assert.doesNotMatch(canonical.ending.gameStartReprise.body, /最初に確認すべき場所|\*\*黒凪島\*\*。/); });
test("42 PERSONAL NOTE表示", () => assert.match(canonical.ending.personalNote.body, /記憶は信用できない[\s\S]*――久世冬真/));
test("43 RECONSTRUCTION COMPLETE 100%", () => { assert.match(canonical.ending.reconstructionComplete.body, /100%/); assert.match(canonical.ending.finalCard.body, /RECONSTRUCTION COMPLETE/); });
test("44 ENDへ到達可能", () => { assert.equal(completeGame({ ...initialState, unsavedAudio02Viewed: true }).gameCompleted, true); assert.match(canonical.ending.finalCard.body, /END/); });
test("45 旧63検索は出ない", () => assert.notEqual(search("相沢佳代　相沢少年　久世冬真", unlocked).result.recordId, "SCRIPT_063"));
test("46 旧64音声は出ない", () => assert.equal(search("音声記録202609022218", unlocked).result.status, "NOT_FOUND"));
test("47 グラス旧65は出ない", () => assert.equal(search("グラス", unlocked).result.status, "NOT_FOUND"));
test("48 薬剤旧66は出ない", () => assert.equal(search("薬剤", unlocked).result.status, "NOT_FOUND"));
test("49 久世負傷旧67は出ない", () => assert.equal(search("久世負傷", unlocked).result.status, "NOT_FOUND"));
test("50 指定外本文と正本の整合性", async () => { const expected = (await readFile(new URL("../source/EXPECTED_SHA256.txt", import.meta.url), "utf8")).trim(); assert.equal(hash(source), expected); for (const item of canonical.records) assert.equal(hash(`${item.title}\n${item.body}`), item.sha256, item.id); });

test("検索UX：全角スペース、語順、音声表記揺れ", () => { assert.equal(search("雨宮七海 御影七海", unlocked).result.status, "FORMAT_ERROR"); assert.equal(search("御影七海　雨宮七海", unlocked).result.recordId, "SCRIPT_039"); assert.equal(normalizeAudio("AUDIO202608301430"), "音声記録202608301430"); });
test("画像添付は新番号へ追従", async () => { assert.match(recordMedia.SCRIPT_001.src, /kuronagi-island-map\.svg$/); assert.match(recordMedia.SCRIPT_002.src, /kuronagi-mansion-floor-map\.svg$/); assert.match(recordMedia.SCRIPT_034.src, /old-photo-1998\.jpg$/); for (const media of Object.values(recordMedia)) assert.ok((await readFile(new URL(`../public${media.src}`, import.meta.url))).length > 0); });
test("正式stateをすべて保持", () => { for (const key of ["viewedRecords", "searchHistory", "crossSearchPending", "crossSearchUnlocked", "crossSearchUnlockEventShown", "advancedCrossSearchPending", "advancedCrossSearchUnlocked", "advancedCrossSearchUnlockEventShown", "dbAnalysisComplete", "shownSystemEvents", "unsavedAudio01Viewed", "unsavedAudio02Viewed", "gameCompleted"]) assert.ok(key in initialState, key); assert.deepEqual(unlocks.crossSearch, ["SCRIPT_038"]); assert.deepEqual(unlocks.advancedCrossSearch, ["SCRIPT_060"]); assert.deepEqual(unlocks.clearRequired, ["SCRIPT_061", "SCRIPT_062", "SCRIPT_063"]); assert.ok(aliases["御影征一郎"].includes("征一郎")); });

test("記録60は存在しない三語検索へ誘導しない", () => {
  assert.doesNotMatch(canonical.records[59].body, /相沢佳代[\s\S]*相沢少年[\s\S]*久世冬真[\s\S]*同時照合/);
  assert.match(canonical.records[59].body, /三つの記録から同時に照合/);
});
test("導入は予約送信メールから認証へ進む", () => { assert.match(appSource, /2026年9月2日　21:51/); assert.match(appSource, /調査記録の確認依頼/); assert.match(appSource, /調査記録へアクセス/); });
test("認証コードと失敗表示を実装", () => { assert.match(appSource, /AUTH_CODE = "KN-2026-08"/); assert.match(appSource, /AUTHENTICATION FAILED/); assert.match(appSource, /AUTHENTICATION ACCEPTED/); });
test("開始ページにGAME STARTを表示しない", () => { assert.match(appSource, /title: "RECOVERED CASE FILE"/); assert.doesNotMatch(appSource, /<h1>GAME START<\/h1>/); });
test("不正確な検索語から候補を提示しない", () => {
  const result = search("桟ばし", unlocked).result;
  assert.equal(result.status, "NOT_FOUND");
  assert.match(result.body, /該当する記録は見つかりませんでした/);
  assert.match(result.body, /検索語を変更してください/);
  assert.equal("suggestion" in result, false);
  assert.doesNotMatch(result.body, /ですか？/);
});

test("RECOVERED CASE FILEは指定内容のみ", () => {
  const expected = "**CASE ID：KN-2026-08**\n\nSTATUS：未解決\n\n調査担当：久世冬真\n\n調査記録：復旧済み\n\n最終報告書：破損\n\n調査地：黒凪島";
  assert.equal(canonical.gameStart.body, expected);
  assert.doesNotMatch(canonical.gameStart.body, /私は、この事件|結論を覚えていない|2026年9月2日夜|最初に確認すべき場所/);
});

test("38直後のTOP帰還でCROSS SEARCHを一度だけ解放", () => {
  const viewed = applyRecord(record("SCRIPT_038"), initialState).state;
  const returning = returnToTop(viewed, "SCRIPT_038");
  assert.equal(returning.state.crossSearchPending, true);
  assert.equal(returning.state.crossSearchUnlocked, false);
  assert.deepEqual(returning.events, ["CROSS_SEARCH_RECOVERED"]);
  const activated = completeUnlockEvent(returning.state, "CROSS_SEARCH_RECOVERED");
  assert.equal(activated.state.crossSearchPending, false);
  assert.equal(activated.state.crossSearchUnlocked, true);
  assert.equal(activated.state.crossSearchUnlockEventShown, true);
  assert.deepEqual(returnToTop(activated.state, "SCRIPT_038").events, []);
});

test("38以外からTOPへ戻ってもCROSS SEARCHを解放しない", () => {
  const viewed = applyRecord(record("SCRIPT_038"), initialState).state;
  const unrelated = returnToTop(viewed, "SCRIPT_037");
  assert.equal(unrelated.state.crossSearchUnlocked, false);
  assert.equal(unrelated.state.crossSearchPending, true);
  assert.deepEqual(unrelated.events, []);
});

test("60直後のTOP帰還でADVANCED CROSS SEARCHを一度だけ解放", () => {
  const base = { ...initialState, crossSearchUnlocked: true, crossSearchUnlockEventShown: true };
  const viewed = applyRecord(record("SCRIPT_060"), base).state;
  const returning = returnToTop(viewed, "SCRIPT_060");
  assert.equal(returning.state.advancedCrossSearchPending, true);
  assert.equal(returning.state.advancedCrossSearchUnlocked, false);
  assert.deepEqual(returning.events, ["ADVANCED_CROSS_SEARCH_RECOVERED"]);
  const activated = completeUnlockEvent(returning.state, "ADVANCED_CROSS_SEARCH_RECOVERED");
  assert.equal(activated.state.advancedCrossSearchPending, false);
  assert.equal(activated.state.advancedCrossSearchUnlocked, true);
  assert.equal(activated.state.advancedCrossSearchUnlockEventShown, true);
  assert.deepEqual(returnToTop(activated.state, "SCRIPT_060").events, []);
});

test("60以外からTOPへ戻ってもADVANCED CROSS SEARCHを解放しない", () => {
  const base = { ...initialState, crossSearchUnlocked: true, crossSearchUnlockEventShown: true };
  const viewed = applyRecord(record("SCRIPT_060"), base).state;
  const unrelated = returnToTop(viewed, "SCRIPT_059");
  assert.equal(unrelated.state.advancedCrossSearchUnlocked, false);
  assert.equal(unrelated.state.advancedCrossSearchPending, true);
  assert.deepEqual(unrelated.events, []);
});

test("60本文とADVANCEDシステムイベントを分離", () => {
  assert.doesNotMatch(canonical.records[59].body, /ADVANCED CROSS SEARCHが起動しました|追加の照合機能/);
  assert.match(canonical.systemEvents[1].body, /追加の照合機能[\s\S]*ADVANCED CROSS SEARCHが起動しました/);
});

test("解放状態はJSON保存後も保持される", () => {
  const viewed = applyRecord(record("SCRIPT_038"), initialState).state;
  const activated = completeUnlockEvent(returnToTop(viewed, "SCRIPT_038").state, "CROSS_SEARCH_RECOVERED").state;
  const restored = { ...initialState, ...JSON.parse(JSON.stringify(activated)) };
  assert.equal(restored.crossSearchUnlocked, true);
  assert.equal(restored.crossSearchUnlockEventShown, true);
  assert.equal(restored.crossSearchPending, false);
});

test("SUPPORT 01 初回プレイでは01と02だけを表示", () => {
  assert.deepEqual(availableSupportItems(initialState).map((item) => item.id), ["01", "02"]);
});

test("SUPPORT 02 LEVEL 1では黒凪島を表示せずLEVEL 3だけに検索キーを表示", () => {
  const item = supportContent.items.find((entry) => entry.id === "01");
  assert.doesNotMatch(item.levels[0], /黒凪島/);
  assert.doesNotMatch(item.levels[1], /黒凪島/);
  assert.match(item.levels[2], /推奨検索キー：[\s\S]*黒凪島/);
});

test("SUPPORT 03 未解放システムの項目を表示しない", () => {
  const ids = availableSupportItems(initialState).map((item) => item.id);
  assert.equal(ids.includes("05"), false);
  assert.equal(ids.includes("08"), false);
  assert.equal(ids.includes("10"), false);
});

test("SUPPORT 04 進行状態に応じて項目を段階解放", () => {
  assert.equal(availableSupportItems({ ...initialState, viewedRecords: ["SCRIPT_029"] }).some((item) => item.id === "03"), true);
  assert.equal(availableSupportItems({ ...initialState, viewedRecords: ["SCRIPT_037"] }).some((item) => item.id === "04"), true);
  assert.deepEqual(availableSupportItems({ ...initialState, crossSearchUnlocked: true }).filter((item) => ["05", "06"].includes(item.id)).map((item) => item.id), ["05", "06"]);
  assert.equal(availableSupportItems({ ...initialState, viewedRecords: ["SCRIPT_057"] }).some((item) => item.id === "07"), true);
  assert.equal(availableSupportItems({ ...initialState, advancedCrossSearchUnlocked: true }).some((item) => item.id === "08"), true);
  assert.equal(availableSupportItems({ ...initialState, viewedRecords: ["SCRIPT_061"] }).some((item) => item.id === "09"), true);
  assert.equal(availableSupportItems({ ...initialState, dbAnalysisComplete: true }).some((item) => item.id === "10"), true);
});

test("SUPPORT 05 ヒント閲覧は本編stateを変更しない", () => {
  const mainBefore = structuredClone(initialState);
  const supportAfter = revealSupportLevel(initialSupportState, "01", 3);
  assert.deepEqual(initialState, mainBefore);
  assert.equal(supportAfter.supportHintLevels["01"], 3);
  assert.equal(initialState.viewedRecords.length, 0);
  assert.equal(initialState.crossSearchUnlocked, false);
});

test("SUPPORT 06 帰還処理は本編進行stateを変更しない", () => {
  const body = appSource.match(/function closeSupport\(\)[\s\S]*?\n  }/)?.[0] ?? "";
  assert.doesNotMatch(body, /setState\(/);
  assert.match(body, /setView\("database"\)/);
});

test("SUPPORT 07 ヒント段階をJSON保存後も保持", () => {
  const progressed = revealSupportLevel(revealSupportLevel(initialSupportState, "01", 1), "01", 2);
  const restored = { ...initialSupportState, ...JSON.parse(JSON.stringify(progressed)) };
  assert.equal(restored.supportViewed, true);
  assert.equal(restored.supportHintLevels["01"], 2);
});

test("SUPPORT 08 LEVEL 3は警告確認後のみ表示", () => {
  assert.match(appSource, /推奨検索キーを確認する/);
  assert.match(appSource, /検索キーそのものが表示されます/);
  assert.match(appSource, /setSupportWarningOpen\(true\)/);
  assert.match(appSource, /revealSupportLevel\(current, selectedSupport\.id, 3\)/);
});

test("SUPPORT 09 禁止された真相と直接的な犯人表現を含まない", () => {
  const serialized = JSON.stringify(supportContent);
  assert.doesNotMatch(serialized, /相沢冬真/);
  assert.doesNotMatch(serialized, /犯人/);
});

test("SUPPORT 10 本編canonicalと検索DBはSUPPORTから独立", () => {
  assert.equal(canonical.records.length, 63);
  assert.equal(searchDb.records.length, 63);
  assert.doesNotMatch(source, /INVESTIGATION SUPPORT/);
});
