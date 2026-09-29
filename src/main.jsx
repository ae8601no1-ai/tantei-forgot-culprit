import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Database, RotateCcw, Search as SearchIcon, ShieldCheck, Terminal } from "lucide-react";
import canonical from "./data/canonical-script.json" with { type: "json" };
import { initialState, search } from "./lib/engine.js";
import "./styles.css";

const SAVE_KEY = "kuze-private-investigation-db-v1";
const recordContent = Object.fromEntries(canonical.records.map((record) => [record.id, record]));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved ? { ...initialState, ...saved, unlockedFeatures: { ...initialState.unlockedFeatures, ...saved.unlockedFeatures } } : initialState;
  } catch {
    return initialState;
  }
}

function RichText({ text }) {
  const renderInline = (line) => line.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <React.Fragment key={index}>{part}</React.Fragment>);
  return <div className="rich-text">{text.split("\n").map((line, index) => {
    if (line.startsWith("## ")) return <h3 key={index}>{renderInline(line.slice(3))}</h3>;
    if (line.startsWith("# ")) return <h2 key={index}>{renderInline(line.slice(2))}</h2>;
    return line ? <p key={index}>{renderInline(line)}</p> : <div className="blank-line" key={index} />;
  })}</div>;
}

function App() {
  const [state, setState] = useState(initialState);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ status: "START", title: "GAME START", body: canonical.gameStart.body });
  const [eventQueue, setEventQueue] = useState([]);
  const [showEnding, setShowEnding] = useState(false);

  useEffect(() => { setState(loadState()); setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }, [ready, state]);

  const currentRecord = result.recordId ? recordContent[result.recordId] : null;
  const activeEvent = eventQueue[0] ? canonical.systemEvents.find((event) => event.id === eventQueue[0]) : null;
  const mode = state.unlockedFeatures.advancedCrossSearch ? "ADVANCED CROSS SEARCH" : state.unlockedFeatures.crossSearch ? "CROSS SEARCH" : "SEARCH";
  const history = useMemo(() => state.searchHistory ?? [], [state.searchHistory]);

  function runSearch(value = query) {
    const outcome = search(value, state);
    setState(outcome.state);
    setResult(outcome.result);
    setEventQueue(outcome.events ?? []);
    setQuery("");
    if (outcome.state.completed && !state.completed) setShowEnding(true);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function reset() {
    if (!window.confirm("保存された調査記録を消去しますか？")) return;
    localStorage.removeItem(SAVE_KEY);
    setState(initialState);
    setResult({ status: "START", title: "GAME START", body: canonical.gameStart.body });
    setShowEnding(false);
  }

  if (!ready) return <main className="loading">DATABASE RECOVERY...</main>;

  return <main className="app-shell">
    <div className="scanlines" aria-hidden="true" />
    <header className="masthead">
      <div className="brand"><Database /><div><b>KUZE PRIVATE INVESTIGATION DATABASE</b><span>CASE ID：KN-2026-08</span></div></div>
      <div className="status"><ShieldCheck /> DATABASE ONLINE</div>
    </header>

    <div className="workspace">
      <aside className="history-panel">
        <h2>SEARCH HISTORY</h2>
        {history.length ? <ol>{history.map((title) => <li key={title}><button onClick={() => runSearch(title)}>{title}</button></li>)}</ol> : <p>NO HISTORY</p>}
        {state.completed && <div className="completion"><span>DATABASE COMPLETION</span><strong>{state.viewedRecords.length} / {canonical.records.length}</strong><button onClick={() => setShowEnding(true)}>FINAL REPORT</button></div>}
        <button className="reset" onClick={reset}><RotateCcw /> RESET DATA</button>
      </aside>

      <section className="terminal-panel">
        <form className="search-box" onSubmit={(event) => { event.preventDefault(); runSearch(); }}>
          <label htmlFor="database-search"><Terminal /> {mode}</label>
          <div><input id="database-search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" spellCheck={false} placeholder="検索キーを入力" autoFocus /><button type="submit"><SearchIcon /> SEARCH</button></div>
          {state.unlockedFeatures.crossSearch && <small>複数検索では検索語の間に全角スペースを使用</small>}
        </form>

        <article className={`result-card status-${result.status.toLowerCase()}`}>
          <div className="result-label"><span>SEARCH RESULT</span><span>{result.status}</span></div>
          <h1>{currentRecord?.title ?? result.title ?? "DATABASE MESSAGE"}</h1>
          <RichText text={currentRecord?.body ?? result.body} />
          {result.suggestion && <button className="suggestion" onClick={() => runSearch(result.suggestion)}>「{result.suggestion}」を検索</button>}
        </article>
      </section>
    </div>

    {activeEvent && <div className="modal-backdrop"><section className="system-event"><span>SYSTEM EVENT</span><RichText text={activeEvent.body} /><button onClick={() => setEventQueue(eventQueue.slice(1))}>ENABLE</button></section></div>}

    {showEnding && <div className="ending-screen"><button className="return-db" onClick={() => setShowEnding(false)}>DATABASEへ戻る</button><section><h1>CASE RECONSTRUCTION</h1><RichText text={canonical.ending.caseReconstruction.body} /></section><section><h1>PERSONAL NOTE</h1><RichText text={canonical.ending.personalNote.body} /></section><section className="final-card"><RichText text={canonical.ending.finalCard.body} /></section></div>}

    <footer>GOTO ARG LAB｜体験型ミステリー</footer>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
