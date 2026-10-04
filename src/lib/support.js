import supportContent from "../data/investigation-support.json" with { type: "json" };

export const initialSupportState = {
  supportViewed: false,
  supportHintLevels: {}
};

const pastRecordIds = new Set(["SCRIPT_028", "SCRIPT_029", "SCRIPT_030", "SCRIPT_031", "SCRIPT_032", "SCRIPT_033", "SCRIPT_034", "SCRIPT_035", "SCRIPT_036"]);
const nanamiRecordIds = new Set(["SCRIPT_037", "SCRIPT_038"]);
const kuzeRecordIds = new Set(["SCRIPT_057", "SCRIPT_058", "SCRIPT_059", "SCRIPT_060"]);
const lateGameRecordIds = new Set(["SCRIPT_061", "SCRIPT_062", "SCRIPT_063"]);

function hasViewedAny(state, ids) {
  return state.viewedRecords.some((id) => ids.has(id));
}

function isAvailable(item, state) {
  switch (item.availability) {
    case "initial": return true;
    case "pastRecords": return hasViewedAny(state, pastRecordIds);
    case "mikageNanami": return hasViewedAny(state, nanamiRecordIds);
    case "crossSearch": return state.crossSearchUnlocked;
    case "kuzeRecords": return hasViewedAny(state, kuzeRecordIds);
    case "advancedSearch": return state.advancedCrossSearchUnlocked;
    case "lateGame": return hasViewedAny(state, lateGameRecordIds);
    case "analysisComplete": return state.dbAnalysisComplete;
    default: return false;
  }
}

export function availableSupportItems(state) {
  return supportContent.items.filter((item) => isAvailable(item, state));
}

export function supportItemById(id) {
  return supportContent.items.find((item) => item.id === id) ?? null;
}

export function revealSupportLevel(supportState, id, level) {
  const current = supportState.supportHintLevels[id] ?? 0;
  const nextLevel = Math.max(current, Math.min(3, Math.max(1, level)));
  return {
    ...supportState,
    supportViewed: true,
    supportHintLevels: { ...supportState.supportHintLevels, [id]: nextLevel }
  };
}
