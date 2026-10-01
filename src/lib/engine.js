import searchDb from "../data/search-db.json" with { type: "json" };
import aliases from "../data/aliases.json" with { type: "json" };
import unlocks from "../data/unlocks.json" with { type: "json" };
import messages from "../data/system-messages.json" with { type: "json" };
import hints from "../data/hints.json" with { type: "json" };

export const initialState = {
  dataVersion: "FINAL-63-UNSAVED-AUDIO-2026-09-30",
  viewedRecords: [],
  crossSearchUnlocked: false,
  advancedCrossSearchUnlocked: false,
  dbAnalysisComplete: false,
  shownSystemEvents: [],
  unsavedAudio01Viewed: false,
  unsavedAudio02Viewed: false,
  gameCompleted: false,
  hintLevels: {},
  searchHistory: [],
  progress: 0
};

export function normalize(value) {
  return value.trim().normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export function normalizeAudio(value) {
  const compact = value.normalize("NFKC").replace(/[\s:：]/g, "");
  const match = compact.match(/^(?:audio|音声記録|音声)?(\d{12})$/i);
  return match ? `音声記録${match[1]}` : null;
}

const records = searchDb.records;
const byId = Object.fromEntries(records.map((record) => [record.id, record]));
const singleRecords = records.filter((record) => record.type === "single");
const multiRecords = records.filter((record) => record.type !== "single");
const allCanonicalTerms = new Set(records.flatMap((record) => Array.isArray(record.canonicalQuery) ? record.canonicalQuery : [record.canonicalQuery]));
const restrictedAliasTargets = new Set(["御影澪", "御影七海", "相沢少年"]);
const retiredSearchKeys = new Set(["音声記録202609022218", "グラス", "薬剤", "久世負傷"]);

function queryKey(parts) {
  return parts.map(normalize).sort().join("|");
}

const multiByKey = new Map(multiRecords.map((record) => [queryKey(record.canonicalQuery), record]));

function viewedRecordForCanonical(canonical, state) {
  return singleRecords.some((record) => record.title === canonical && state.viewedRecords.includes(record.id));
}

export function resolveTerm(input, state) {
  const audio = normalizeAudio(input);
  const target = normalize(audio ?? input);
  const direct = singleRecords.find((record) => normalize(record.title) === target);
  if (direct) return direct.title;
  const canonicalTerm = [...allCanonicalTerms].find((term) => normalize(term) === target);
  if (canonicalTerm) return canonicalTerm;
  for (const [canonical, list] of Object.entries(aliases)) {
    if (!list.some((alias) => normalize(alias) === target)) continue;
    if (restrictedAliasTargets.has(canonical) && !viewedRecordForCanonical(canonical, state)) return null;
    return canonical;
  }
  return null;
}

function featureAvailable(record, state) {
  if (record.phase === 1) return true;
  if (record.phase === 2) return state.crossSearchUnlocked;
  return state.advancedCrossSearchUnlocked;
}

function requirementsMet(record, state) {
  return (unlocks.recordRequirements[record.id] ?? []).every((id) => state.viewedRecords.includes(id));
}

function response(status, body, extras = {}) {
  return { status, body, ...extras };
}

function searchHint(state) {
  const eligible = hints.hintStages
    .filter((stage) => stage.requiresViewed.every((id) => state.viewedRecords.includes(id)))
    .sort((a, b) => b.priority - a.priority)[0];
  if (!eligible) return { result: response("NOT_FOUND", messages.notFound), state };
  const current = state.hintLevels[eligible.id] ?? 0;
  const index = Math.min(current, eligible.levels.length - 1);
  const nextState = { ...state, hintLevels: { ...state.hintLevels, [eligible.id]: Math.min(index + 1, eligible.levels.length - 1) } };
  return { result: response("HINT", eligible.levels[index], { title: "調査メモ" }), state: nextState };
}

export function applyRecord(record, state) {
  const viewedRecords = [...new Set([...state.viewedRecords, record.id])];
  const shownSystemEvents = [...state.shownSystemEvents];
  let crossSearchUnlocked = state.crossSearchUnlocked;
  let advancedCrossSearchUnlocked = state.advancedCrossSearchUnlocked;
  let dbAnalysisComplete = state.dbAnalysisComplete;
  const events = [];

  if (!crossSearchUnlocked && unlocks.crossSearch.every((id) => viewedRecords.includes(id))) {
    crossSearchUnlocked = true;
    if (!shownSystemEvents.includes("CROSS_SEARCH_RECOVERED")) {
      shownSystemEvents.push("CROSS_SEARCH_RECOVERED");
      events.push("CROSS_SEARCH_RECOVERED");
    }
  }
  if (!advancedCrossSearchUnlocked && unlocks.advancedCrossSearch.every((id) => viewedRecords.includes(id))) {
    advancedCrossSearchUnlocked = true;
    if (!shownSystemEvents.includes("ADVANCED_CROSS_SEARCH_RECOVERED")) {
      shownSystemEvents.push("ADVANCED_CROSS_SEARCH_RECOVERED");
      events.push("ADVANCED_CROSS_SEARCH_RECOVERED");
    }
  }
  if (!dbAnalysisComplete && record.id === "SCRIPT_063" && unlocks.clearRequired.every((id) => viewedRecords.includes(id))) {
    dbAnalysisComplete = true;
    if (!shownSystemEvents.includes("DATABASE_ANALYSIS_COMPLETE")) {
      shownSystemEvents.push("DATABASE_ANALYSIS_COMPLETE");
      events.push("DATABASE_ANALYSIS_COMPLETE");
    }
  }
  return {
    state: {
      ...state,
      viewedRecords,
      crossSearchUnlocked,
      advancedCrossSearchUnlocked,
      dbAnalysisComplete,
      shownSystemEvents,
      progress: viewedRecords.length
    },
    events
  };
}

function findSingle(input, state) {
  const canonical = resolveTerm(input, state);
  if (!canonical) return null;
  return singleRecords.find((record) => record.title === canonical) ?? null;
}

export function search(rawInput, state) {
  const input = rawInput.trim();
  if (!input) return { result: response("NOT_FOUND", messages.notFound), state, events: [] };
  if (retiredSearchKeys.has(normalizeAudio(input) ?? input)) return { result: response("NOT_FOUND", messages.notFound), state, events: [] };
  if (normalize(input) === normalize("調査メモ")) return { ...searchHint(state), events: [] };
  if (normalize(input) === normalize("犯人")) return { result: response("NOT_FOUND", messages.culprit), state, events: [] };
  if (normalize(input) === normalize("答え")) return { result: response("NOT_FOUND", messages.answer), state, events: [] };
  if (/誰|だれ|どのように|なぜ|どうして/.test(input)) return { result: response("QUERY_NOT_RECOGNIZED", messages.naturalLanguage), state, events: [] };

  const audio = normalizeAudio(input);
  const hasFullWidthSeparator = input.includes("　");
  if (!hasFullWidthSeparator && !audio && /\S[ ]+\S/.test(input)) {
    return { result: response("FORMAT_ERROR", messages.formatError), state, events: [] };
  }

  let record = null;
  if (hasFullWidthSeparator) {
    const rawParts = input.split(/　+/).map((part) => part.trim()).filter(Boolean);
    if (rawParts.length === 2 && !state.crossSearchUnlocked) return { result: response("NOT_FOUND", messages.notFound), state, events: [] };
    if (rawParts.length === 3 && !state.advancedCrossSearchUnlocked) return { result: response("NOT_FOUND", messages.notFound), state, events: [] };
    const parts = rawParts.map((part) => resolveTerm(part, state));
    if (parts.some((part) => !part)) return { result: response("NOT_FOUND", messages.notFound), state, events: [] };
    if (rawParts.length === 2 && queryKey(parts) === queryKey(["久世冬真", "御影澪"])) {
      return { result: response("SOFT_MATCH", messages.softKuzeMio), state, events: [] };
    }
    record = multiByKey.get(queryKey(parts)) ?? null;
    if (!record) {
      return { result: response("NO_RELATED_RECORD", rawParts.length === 3 ? messages.noAdvancedRelated : messages.noRelated), state, events: [] };
    }
  } else {
    if (normalize(input) === normalize("御影")) {
      const names = ["御影征一郎", "御影隆一", "御影香織", "御影澪", "御影七海"]
        .filter((name) => records.some((item) => item.title === name && state.viewedRecords.includes(item.id)));
      if (names.length > 1) return { result: response("MULTIPLE_MATCHES", `MULTIPLE MATCHES\n\n「御影」に一致する記録が複数あります。\n\n${names.join("\n")}\n\n対象を特定してください。`), state, events: [] };
    }
    record = findSingle(audio ?? input, state);
    if (!record) return { result: response("NOT_FOUND", messages.notFound), state, events: [] };
  }

  if (!featureAvailable(record, state) || !requirementsMet(record, state)) {
    const visible = unlocks.lockedVisible.includes(record.id);
    return { result: response(visible ? "LOCKED" : "NOT_FOUND", visible ? messages.recordLocked : messages.notFound), state, events: [] };
  }

  const applied = applyRecord(record, state);
  const nextState = {
    ...applied.state,
    searchHistory: [record.title, ...state.searchHistory.filter((title) => title !== record.title)].slice(0, 30)
  };
  return { result: response("AVAILABLE", "", { recordId: record.id, title: record.title }), state: nextState, events: applied.events };
}

export function recordById(id) {
  return byId[id] ?? null;
}

export function completeUnsavedAudio01(state) {
  if (!state.dbAnalysisComplete) return state;
  return { ...state, unsavedAudio01Viewed: true };
}

export function completeUnsavedAudio02(state) {
  if (!state.unsavedAudio01Viewed) return state;
  return { ...state, unsavedAudio02Viewed: true };
}

export function completeGame(state) {
  if (!state.unsavedAudio02Viewed) return state;
  return { ...state, gameCompleted: true };
}
