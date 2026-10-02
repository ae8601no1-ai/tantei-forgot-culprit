import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, ArrowLeft, Database, FileAudio, KeyRound, Mail, RotateCcw, Search as SearchIcon, ShieldCheck, Terminal } from "lucide-react";
import canonical from "./data/canonical-script.json" with { type: "json" };
import recordMedia from "./data/record-media.json" with { type: "json" };
import { completeGame, completeUnlockEvent, completeUnsavedAudio01, completeUnsavedAudio02, initialState, returnToTop, search } from "./lib/engine.js";
import "./styles.css";
import "./additions.css";

const SAVE_KEY = "kuze-private-investigation-db-final-63";
const AUTH_KEY = "kuze-private-investigation-db-authorized";
const AUTH_CODE = "KN-2026-08";
const DATA_VERSION = "FINAL-63-UNSAVED-AUDIO-2026-09-30";
const recordContent = Object.fromEntries(canonical.records.map((record) => [record.id, record]));
const databaseAnalysisEvent = {
  id: "DATABASE_ANALYSIS_COMPLETE",
  body: "DATABASE RECONSTRUCTION\n\n事件関連記録の照合が完了しました。\n\n保存済みデータから復元可能な調査記録を確認しています。\n\n……\n\n……\n\nSEARCHABLE DATABASE：ANALYSIS COMPLETE\n\n保存済み調査データの解析が完了しました。\n\nWARNING\n\nデータベース外に未登録データを検出しました。\n\n一時保存領域を確認しています。\n\n……\n\n2 AUDIO FILES FOUND\n\nデータベースへの保存処理が完了していない音声記録が存在します。"
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved?.dataVersion === DATA_VERSION ? { ...initialState, ...saved } : initialState;
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

function RecordMedia({ media, onExpand }) {
  if (!media) return null;
  return <figure className="record-media">
    <div className="media-label">{media.label}</div>
    <button type="button" onClick={onExpand} aria-label={`${media.label}を拡大表示`}>
      <img src={media.src} alt={media.alt} />
      <span>{media.actionLabel ?? "EXPAND MAP"}</span>
    </button>
    <figcaption>{media.caption}</figcaption>
  </figure>;
}

function App() {
  const [state, setState] = useState(initialState);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ status: "START", title: "RECOVERED CASE FILE", body: canonical.gameStart.body });
  const [eventQueue, setEventQueue] = useState([]);
  const [view, setView] = useState("database");
  const [expandedMedia, setExpandedMedia] = useState(null);
  const [accessStage, setAccessStage] = useState("loading");
  const [authCode, setAuthCode] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    setState(loadState());
    setAccessStage(localStorage.getItem(AUTH_KEY) === "accepted" ? "database" : "mail");
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }, [ready, state]);

  const currentRecord = result.recordId ? recordContent[result.recordId] : null;
  const currentMedia = currentRecord ? recordMedia[currentRecord.id] : null;
  const activeEvent = eventQueue[0] ? (canonical.systemEvents.find((event) => event.id === eventQueue[0]) ?? (eventQueue[0] === databaseAnalysisEvent.id ? databaseAnalysisEvent : null)) : null;
  const mode = state.advancedCrossSearchUnlocked ? "ADVANCED CROSS SEARCH" : state.crossSearchUnlocked ? "CROSS SEARCH" : "SEARCH";
  const history = useMemo(() => state.searchHistory ?? [], [state.searchHistory]);

  function runSearch(value = query) {
    const outcome = search(value, state);
    setState(outcome.state);
    setResult(outcome.result);
    setEventQueue(outcome.events ?? []);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function goTop() {
    const outcome = returnToTop(state, currentRecord?.id);
    setState(outcome.state);
    setResult({ status: "START", title: "RECOVERED CASE FILE", body: canonical.gameStart.body });
    setEventQueue(outcome.events);
    setView("database");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function closeSystemEvent() {
    const outcome = completeUnlockEvent(state, activeEvent?.id);
    setState(outcome.state);
    setEventQueue([]);
    setResult({ status: "START", title: "RECOVERED CASE FILE", body: canonical.gameStart.body });
    setView("database");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function reset() {
    if (!window.confirm("保存された調査記録を消去しますか？")) return;
    localStorage.removeItem(SAVE_KEY);
    setState(initialState);
    setResult({ status: "START", title: "RECOVERED CASE FILE", body: canonical.gameStart.body });
    setView("database");
    setEventQueue([]);
  }

  if (!ready) return <main className="loading">DATABASE RECOVERY...</main>;

  if (accessStage === "mail") return <main className="access-shell">
    <div className="access-noise" aria-hidden="true" />
    <section className="mail-window">
      <div className="mail-toolbar"><Mail /><span>SECURE MAIL / RECEIVED</span></div>
      <dl className="mail-meta">
        <div><dt>送信日時</dt><dd>2026年9月2日　21:51</dd></div>
        <div><dt>差出人</dt><dd>久世冬真</dd></div>
        <div><dt>件名</dt><dd>調査記録の確認依頼</dd></div>
      </dl>
      <div className="mail-body">
        <p>このメールは、指定した時刻に自動送信されるよう設定しています。</p>
        <p>私は今、黒凪島である事件を調査しています。</p>
        <p>調査はほぼ終わりました。<br />ただ、最終報告書を作成する前に、確認しておきたいことがあります。</p>
        <p>万が一、私が報告できない状態になった場合、残された調査記録を確認してください。</p>
        <p>記録は専用データベースに保存されています。<br />認証コードは、この依頼を受け取った方へ別の方法でお渡ししています。</p>
        <p>データベースに残されたすべての情報を照合し、私が何を突き止めたのか確認してください。</p>
        <p>私の記憶ではなく、記録を信じてください。</p>
        <p className="mail-signature">久世冬真</p>
      </div>
      <button className="access-primary" onClick={() => { setAccessStage("auth"); window.scrollTo(0, 0); }}>調査記録へアクセス</button>
    </section>
    <footer><span>このページはARG用です。全ての個人名。地名はフィクションです。</span><span>GOTO ARG LAB｜体験型ミステリー</span></footer>
  </main>;

  if (accessStage === "auth") return <main className="access-shell">
    <div className="access-noise" aria-hidden="true" />
    <section className="auth-window">
      <KeyRound />
      <span className="auth-kicker">KUZE PRIVATE INVESTIGATION DATABASE</span>
      <h1>RESTRICTED ACCESS</h1>
      <p>このデータベースには、未解決事件に関する<br />人物情報、音声記録、現場資料が保存されています。</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (authCode.trim().toUpperCase() === AUTH_CODE) {
          setAuthError(false);
          setAccessStage("recovery");
        } else {
          setAuthError(true);
        }
      }}>
        <label htmlFor="authorization-code">AUTHORIZATION CODE</label>
        <input id="authorization-code" value={authCode} onChange={(event) => { setAuthCode(event.target.value); setAuthError(false); }} autoComplete="off" spellCheck={false} autoFocus />
        {authError && <p className="auth-error" role="alert">AUTHENTICATION FAILED<br /><small>認証コードを確認してください。</small></p>}
        <button className="access-primary" type="submit">認証する</button>
      </form>
      <button className="access-secondary" onClick={() => { setAccessStage("mail"); setAuthError(false); }}>メールへ戻る</button>
    </section>
    <footer><span>このページはARG用です。全ての個人名。地名はフィクションです。</span><span>GOTO ARG LAB｜体験型ミステリー</span></footer>
  </main>;

  if (accessStage === "recovery") return <main className="access-shell">
    <div className="access-noise" aria-hidden="true" />
    <section className="recovery-window">
      <ShieldCheck />
      <span>AUTHENTICATION ACCEPTED</span>
      <h1>CASE ID：KN-2026-08</h1>
      <div className="recovery-log"><p>調査記録を復旧しています。</p><p>……</p><p>DATABASE ONLINE</p></div>
      <button className="access-primary" onClick={() => { localStorage.setItem(AUTH_KEY, "accepted"); setAccessStage("database"); window.scrollTo(0, 0); }}>復旧された記録を開く</button>
    </section>
    <footer><span>このページはARG用です。全ての個人名。地名はフィクションです。</span><span>GOTO ARG LAB｜体験型ミステリー</span></footer>
  </main>;

  return <main className="app-shell">
    <div className="scanlines" aria-hidden="true" />
    <header className="masthead">
      <div className="brand"><Database /><div><b>KUZE PRIVATE INVESTIGATION DATABASE</b><span>CASE ID：KN-2026-08</span></div></div>
      <div className="status"><ShieldCheck /><span>DATABASE ONLINE</span><b>PAGE {view === "database" && currentRecord ? String(currentRecord.number).padStart(2, "0") : "00"} / {canonical.records.length}</b></div>
    </header>

    {view === "database" && <div className="workspace">
      <aside className="history-panel">
        <h2>SEARCH HISTORY</h2>
        {history.length ? <ol>{history.map((title) => <li key={title}><button onClick={() => runSearch(title)}>{title}</button></li>)}</ol> : <p>NO HISTORY</p>}
        {state.gameCompleted && <div className="completion"><span>RECONSTRUCTION COMPLETE</span><strong>100%</strong><button onClick={() => setView("ending")}>FINAL REPORT</button></div>}
        <button className="reset" onClick={reset}><RotateCcw /> RESET DATA</button>
      </aside>

      <section className="terminal-panel">
        {result.status === "START" && <div className="mode-status" aria-label="検索機能の状態">
          {state.crossSearchUnlocked && <span>CROSS SEARCH MODE：ACTIVE</span>}
          {state.advancedCrossSearchUnlocked && <span>ADVANCED CROSS SEARCH MODE：ACTIVE</span>}
        </div>}
        {result.status === "START" && state.dbAnalysisComplete && <button className="unsaved-alert" onClick={() => setView("audio-cache")}>
          <AlertTriangle /><span><b>保存完了していない音声記録</b><small>RECOVERED：2 FILES</small></span>
        </button>}
        <form className="search-box" onSubmit={(event) => { event.preventDefault(); runSearch(); }}>
          <label htmlFor="database-search"><Terminal /> {mode}</label>
          <div><input id="database-search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" spellCheck={false} placeholder="検索キーを入力" autoFocus /><button type="submit"><SearchIcon /> SEARCH</button></div>
          {state.crossSearchUnlocked && <small>複数検索では検索語の間に全角スペースを使用</small>}
        </form>

        <article className={`result-card status-${result.status.toLowerCase()}`}>
          <div className="result-label"><span>SEARCH RESULT</span><span>{currentRecord ? `PAGE ${String(currentRecord.number).padStart(2, "0")} / ${canonical.records.length}` : `PAGE 00 / ${canonical.records.length}`}　{result.status}</span></div>
          <h1>{currentRecord?.title ?? result.title ?? "DATABASE MESSAGE"}</h1>
          <RichText text={currentRecord?.body ?? result.body} />
          <RecordMedia media={currentMedia} onExpand={() => setExpandedMedia(currentMedia)} />
          {result.status !== "START" && <button className="back-top" onClick={goTop}><ArrowLeft /> データベースTOPへ戻る</button>}
        </article>
      </section>
    </div>}

    {view === "audio-cache" && <section className="special-screen audio-cache-screen">
      <span className="special-kicker">RECOVERED TEMPORARY DATA</span>
      <h1>UNSAVED AUDIO CACHE</h1>
      <RichText text={canonical.unsavedAudio.intro.body} />
      <div className="audio-files">
        <button onClick={() => setView("audio-01")}><FileAudio /><span><b>UNSAVED AUDIO 01</b><small>AVAILABLE</small></span></button>
        <button disabled={!state.unsavedAudio01Viewed} onClick={() => setView("audio-02")}><FileAudio /><span><b>UNSAVED AUDIO 02</b><small>{state.unsavedAudio01Viewed ? "AVAILABLE" : "LOCKED"}</small></span></button>
      </div>
      <button className="back-top" onClick={goTop}><ArrowLeft /> データベースTOPへ戻る</button>
    </section>}

    {view === "audio-01" && <section className="special-screen audio-record-screen">
      <span className="special-kicker">UNSAVED AUDIO CACHE / 01</span>
      <h1>UNSAVED AUDIO 01</h1>
      <RichText text={canonical.unsavedAudio.file01.body} />
      <button className="advance-special" onClick={() => { setState(completeUnsavedAudio01(state)); setView("audio-cache"); window.scrollTo(0, 0); }}>END OF FILE｜CACHEへ戻る</button>
      <button className="back-top" onClick={goTop}><ArrowLeft /> データベースTOPへ戻る</button>
    </section>}

    {view === "audio-02" && <section className="special-screen audio-record-screen">
      <span className="special-kicker">UNSAVED AUDIO CACHE / 02</span>
      <h1>UNSAVED AUDIO 02</h1>
      <RichText text={canonical.unsavedAudio.file02.body} />
      <button className="advance-special" onClick={() => { setState(completeUnsavedAudio02(state)); setView("recovery"); window.scrollTo(0, 0); }}>AUDIO DATA LOST｜復旧記録を確認</button>
      <button className="back-top" onClick={goTop}><ArrowLeft /> データベースTOPへ戻る</button>
    </section>}

    {view === "recovery" && <section className="special-screen recovery-screen">
      <span className="special-kicker">UNSAVED AUDIO CACHE　2/2　RECOVERY COMPLETE</span>
      <h1>SYSTEM RECOVERY RECORD</h1>
      <RichText text={canonical.systemRecovery.body} />
      <button className="advance-special" onClick={() => { setState(completeGame(state)); setView("ending"); window.scrollTo(0, 0); }}>CASE RECONSTRUCTIONへ</button>
      <button className="back-top" onClick={goTop}><ArrowLeft /> データベースTOPへ戻る</button>
    </section>}

    {activeEvent && <div className="modal-backdrop"><section className="system-event"><span>{activeEvent.id === databaseAnalysisEvent.id ? "SYSTEM EVENT" : "SYSTEM UPDATE"}</span><RichText text={activeEvent.body} /><button onClick={closeSystemEvent}>データベースTOPへ</button></section></div>}

    {expandedMedia && <div className="media-modal" role="dialog" aria-modal="true" aria-label={expandedMedia.label} onClick={() => setExpandedMedia(null)}>
      <button className="media-close" onClick={() => setExpandedMedia(null)}>CLOSE ×</button>
      <img src={expandedMedia.src} alt={expandedMedia.alt} onClick={(event) => event.stopPropagation()} />
    </div>}

    {view === "ending" && <div className="ending-screen"><button className="return-db" onClick={goTop}>DATABASEへ戻る</button><section><h1>CASE RECONSTRUCTION</h1><RichText text={canonical.ending.caseReconstruction.body} /></section><section><h1>RECOVERED CASE FILE</h1><RichText text={canonical.ending.gameStartReprise.body} /></section><section className="reconstruction-meter"><h1>RECONSTRUCTION COMPLETE</h1><RichText text={canonical.ending.reconstructionComplete.body} /></section><section><h1>PERSONAL NOTE</h1><RichText text={canonical.ending.personalNote.body} /></section><section className="final-card"><RichText text={canonical.ending.finalCard.body} /></section></div>}

    <footer><span>このページはARG用です。全ての個人名。地名はフィクションです。</span><span>GOTO ARG LAB｜体験型ミステリー</span></footer>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
