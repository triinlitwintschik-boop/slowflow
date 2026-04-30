import React, { useEffect, useMemo, useState } from "react";

const DONE_STORAGE_KEY = "slowflow-done-items";
const HISTORY_STORAGE_KEY = "slowflow-sessions";

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [doneItems, setDoneItems] = useState(() => {
    try {
      const saved = localStorage.getItem(DONE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase().replace(/[.?!,]+$/g, "");
  }

  function getItemKey(category, textValue) {
    return `${category}::${normalizeText(textValue)}`;
  }

  function isDone(category, textValue) {
    return !!doneItems[getItemKey(category, textValue)];
  }

  function toggleDone(category, textValue) {
    const key = getItemKey(category, textValue);
    setDoneItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    try {
      localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(doneItems));
    } catch {}
  }, [doneItems]);

  function saveSession(input, output) {
    const newSession = {
      id: Date.now(),
      input,
      result: output,
      createdAt: new Date().toISOString()
    };

    const updated = [newSession, ...history].slice(0, 5);
    setHistory(updated);

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  function loadSession(session) {
    setText(session.input);
    setResult(session.result);
    setError("");
    setCopied(false);
    setShowCopyMenu(false);
    setFocusMode(false);
  }

  function deleteSession(id) {
    const updated = history.filter((session) => session.id !== id);
    setHistory(updated);

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  function clearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
  }

  const actRaw = useMemo(
    () => result?.items?.filter((item) => item.category === "ACT") || [],
    [result]
  );

  const notNowRaw = useMemo(
    () => result?.items?.filter((item) => item.category === "NOT_NOW") || [],
    [result]
  );

  const letGoRaw = useMemo(
    () => result?.items?.filter((item) => item.category === "LET_GO") || [],
    [result]
  );

  const actWithoutDuplicate = actRaw;

  const act = useMemo(
    () => actWithoutDuplicate.filter((item) => !isDone("ACT", item.text)),
    [actWithoutDuplicate, doneItems]
  );

  const actDone = useMemo(
    () => actWithoutDuplicate.filter((item) => isDone("ACT", item.text)),
    [actWithoutDuplicate, doneItems]
  );

  const notNow = useMemo(
    () => notNowRaw.filter((item) => !isDone("NOT_NOW", item.text)),
    [notNowRaw, doneItems]
  );

  const notNowDone = useMemo(
    () => notNowRaw.filter((item) => isDone("NOT_NOW", item.text)),
    [notNowRaw, doneItems]
  );

  const letGo = useMemo(
    () => letGoRaw.filter((item) => !isDone("LET_GO", item.text)),
    [letGoRaw, doneItems]
  );

  const letGoDone = useMemo(
    () => letGoRaw.filter((item) => isDone("LET_GO", item.text)),
    [letGoRaw, doneItems]
  );

  const doneList = useMemo(
    () => [...actDone, ...notNowDone, ...letGoDone],
    [actDone, notNowDone, letGoDone]
  );

  const currentFocusTask = act[0];
  const hasResult = !!result;
  const hasAnyDoneItems = Object.values(doneItems).some(Boolean);

  function buildFormattedText(format = "plain", onlyAct = false) {
    if (!result) return "";

    const lines = [];

    function bullet(value) {
      if (format === "checklist") return `- [ ] ${value}`;
      if (format === "notion") return `☐ ${value}`;
      return `- ${value}`;
    }

    if (!onlyAct) {
      if (result.summary) {
        lines.push("What's going on");
        lines.push(result.summary);
        lines.push("");
      }

      if (result.next_step_under_5_min) {
        lines.push("One small step");
        lines.push(result.next_step_under_5_min);
        lines.push("");
      }

      lines.push("Sorted out");
    }

    if (act.length > 0) {
      lines.push("Do now");
      act.forEach((item) => lines.push(bullet(item.text)));
      lines.push("");
    }

    if (!onlyAct && notNow.length > 0) {
      lines.push("Not now");
      notNow.forEach((item) => lines.push(bullet(item.text)));
      lines.push("");
    }

    if (!onlyAct && letGo.length > 0) {
      lines.push("Let go");
      letGo.forEach((item) => lines.push(bullet(item.text)));
      lines.push("");
    }

    if (!onlyAct && doneList.length > 0) {
      lines.push("Done");
      doneList.forEach((item) => lines.push(bullet(item.text)));
    }

    return lines.join("\n").trim();
  }

  async function copyToClipboard(value, copiedValue) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(copiedValue);
      setShowCopyMenu(false);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error(err);
      setError("Error: Could not copy.");
    }
  }

  async function copySingleItem(textValue) {
    await copyToClipboard(textValue, `item:${textValue}`);
  }

  async function copyResult(format = "plain", onlyAct = false) {
    if (!result) return;
    const output = buildFormattedText(format, onlyAct);
    await copyToClipboard(output, onlyAct ? `${format}-act` : format);
  }

  async function shareResult() {
    if (!result) return;
    const output = buildFormattedText("plain");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "SlowFlow",
          text: output
        });
      } else {
        await copyToClipboard(output, "share-copy");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function clarify() {
    if (!text.trim()) {
      setError("Please write a few thoughts first.");
      return;
    }

    const input = text.trim();

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setCopied(false);
      setShowCopyMenu(false);
      setFocusMode(false);

      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ brainDump: input })
      });

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        let message = `Request failed: ${res.status}`;

        if (contentType.includes("application/json")) {
          const errorData = await res.json();
          message = errorData?.error || message;
        } else {
          const errorText = await res.text();
          if (errorText) message = errorText;
        }

        throw new Error(message);
      }

      const data = await res.json();
      setResult(data);
      saveSession(input, data);
    } catch (err) {
      console.error(err);
      setError("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setText("");
    setResult(null);
    setError("");
    setCopied(false);
    setShowCopyMenu(false);
    setFocusMode(false);
  }

  function clearDoneItems() {
    setDoneItems({});
    try {
      localStorage.removeItem(DONE_STORAGE_KEY);
    } catch {}
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      clarify();
    }
  }

  function getCopyButtonLabel() {
    if (!copied || typeof copied !== "string" || copied.startsWith("item:")) {
      return "Copy";
    }

    return "Copied ✓";
  }

  function completeFocusTask() {
    if (!currentFocusTask) return;
    toggleDone("ACT", currentFocusTask.text);
  }

  function renderLoadingCard(title, lines = 3) {
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>{title}</h3>
          <div style={styles.loadingBadge}>Thinking...</div>
        </div>

        <div style={styles.skeletonWrap}>
          {Array.from({ length: lines }).map((_, index) => (
            <div
              key={index}
              style={{
                ...styles.skeletonLine,
                width: index === lines - 1 ? "68%" : "100%",
                animation: "shimmer 1.6s ease-in-out infinite"
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderItem(textValue, variant, category, doneSection = false) {
    const done = isDone(category, textValue);

    const baseStyle =
      variant === "soft"
        ? styles.itemSoft
        : variant === "calm"
        ? styles.itemCalm
        : doneSection
        ? styles.itemDoneSection
        : styles.item;

    return (
      <div key={`${category}-${textValue}`} style={styles.itemRow}>
        <button
          type="button"
          onClick={() => toggleDone(category, textValue)}
          style={styles.itemMainButton}
        >
          <div
            style={{
              ...styles.checkCircle,
              ...(done ? styles.checkCircleDone : {})
            }}
          >
            {done ? "✓" : ""}
          </div>

          <div style={{ ...baseStyle, ...(done ? styles.itemDone : {}) }}>
            {textValue}
          </div>
        </button>

        {doneSection ? (
          <button
            type="button"
            onClick={() => toggleDone(category, textValue)}
            style={styles.inlineCopyButton}
          >
            Undo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => copySingleItem(textValue)}
            style={styles.inlineCopyButton}
          >
            {copied === `item:${textValue}` ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.badge}>SlowFlow</div>

          <h1 style={styles.title}>When your head is full, start here.</h1>

          <p style={styles.subtitle}>
            Dump everything on your mind. We’ll help you find one clear next
            step.
          </p>

          <p style={styles.punchline}>Stop overthinking. Start moving.</p>
        </div>

        <div style={styles.inputCard}>
          <label style={styles.label}>Brain dump</label>

          <textarea
            id="brain-input"
            placeholder="Buy milk, book doctor appointment, reply to emails, clean kitchen..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={styles.textarea}
          />

          <div style={styles.inputMeta}>
            <div style={styles.hint}>Cmd/Ctrl + Enter to clarify</div>
            <div style={styles.charCount}>{text.trim().length} chars</div>
          </div>

          <div style={styles.buttonRow}>
            <button
              type="button"
              onClick={clarify}
              disabled={loading}
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {})
              }}
            >
              {loading ? "Sorting..." : "Clear my mind"}
            </button>

            <button
              type="button"
              onClick={resetAll}
              disabled={loading}
              style={{
                ...styles.resetButton,
                ...(loading ? styles.resetButtonDisabled : {})
              }}
            >
              Reset
            </button>
          </div>

          <div style={styles.privacyNote}>
            Your text is used only to organize what you wrote.
          </div>
        </div>

        {error ? <div style={styles.errorCard}>{error}</div> : null}

        {loading ? (
          <>
            {renderLoadingCard("🧠 What's going on", 3)}
            {renderLoadingCard("⚡ One small step", 2)}
            {renderLoadingCard("📦 Sorted out", 4)}
          </>
        ) : (
          <>
            <div style={{ ...styles.card, animation: "floatIn 0.25s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>🧠 What's going on</h3>
                <div style={styles.sectionPill}>Summary</div>
              </div>

              {result?.summary ? (
                <p style={styles.text}>{result.summary}</p>
              ) : (
                <div style={styles.emptyState}>
                  <div style={styles.emptyTitle}>Nothing here yet.</div>
                  <div style={styles.emptyText}>
                    Start by writing what’s on your mind. Even messy is fine.
                  </div>
                </div>
              )}
            </div>

            <div style={{ ...styles.card, animation: "floatIn 0.3s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>⚡ One small step</h3>
                <div style={styles.sectionPill}>Under 5 min</div>
              </div>

              <p style={styles.stepBox}>
                {result?.next_step_under_5_min ||
                  "We’ll suggest one clear next step here."}
              </p>
            </div>

            {focusMode && hasResult ? (
              <div
                style={{ ...styles.focusCard, animation: "floatIn 0.25s ease" }}
              >
                <div style={styles.focusTop}>
                  <div>
                    <div style={styles.focusEyebrow}>Focus mode</div>
                    <h3 style={styles.focusTitle}>One thing. Right now.</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFocusMode(false)}
                    style={styles.smallGhostButton}
                  >
                    Exit
                  </button>
                </div>

                {currentFocusTask ? (
                  <>
                    <div style={styles.focusTask}>{currentFocusTask.text}</div>

                    <div style={styles.focusActions}>
                      <button
                        type="button"
                        onClick={() => copySingleItem(currentFocusTask.text)}
                        style={styles.secondaryFocusButton}
                      >
                        Copy
                      </button>

                      <button
                        type="button"
                        onClick={completeFocusTask}
                        style={styles.doneFocusButton}
                      >
                        Mark done
                      </button>
                    </div>

                    <div style={styles.focusHint}>
                      Do just this. You can come back for the next one.
                    </div>
                  </>
                ) : (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyTitle}>Nothing urgent left.</div>
                    <div style={styles.emptyText}>
                      You’ve cleared the Do now list. That counts.
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ ...styles.card, animation: "floatIn 0.35s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>📦 Sorted out</h3>

                <div style={styles.cardActions}>
                  <div style={styles.sectionPill}>Organized</div>

                  {hasResult && act.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setFocusMode(true)}
                      style={styles.focusButton}
                    >
                      Focus
                    </button>
                  ) : null}

                  {hasAnyDoneItems ? (
                    <button
                      type="button"
                      onClick={clearDoneItems}
                      style={styles.clearDoneButton}
                    >
                      Clear done
                    </button>
                  ) : null}

                  {hasResult ? (
                    <>
                      <div style={styles.copyMenuWrap}>
                        <button
                          type="button"
                          onClick={() => setShowCopyMenu(!showCopyMenu)}
                          style={styles.copyButton}
                        >
                          {getCopyButtonLabel()}
                        </button>

                        {showCopyMenu ? (
                          <div style={styles.copyMenu}>
                            <button
                              type="button"
                              onClick={() => copyResult("plain")}
                              style={styles.copyItem}
                            >
                              Copy plain text
                            </button>
                            <button
                              type="button"
                              onClick={() => copyResult("checklist")}
                              style={styles.copyItem}
                            >
                              Copy checklist
                            </button>
                            <button
                              type="button"
                              onClick={() => copyResult("notion")}
                              style={styles.copyItem}
                            >
                              Copy for Notion
                            </button>
                            <button
                              type="button"
                              onClick={() => copyResult("plain", true)}
                              style={styles.copyItem}
                            >
                              Copy Do now only
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={shareResult}
                        style={styles.copyButton}
                      >
                        Share
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {!hasResult ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyTitle}>Nothing sorted yet.</div>
                  <div style={styles.emptyText}>
                    Your thoughts will appear here as Do now, Not now, Let go,
                    and Done.
                  </div>
                </div>
              ) : null}

              {act.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}>
                    <h4 style={styles.groupTitle}>🚀 Do now</h4>
                    <div style={styles.groupCount}>{act.length}</div>
                  </div>

                  <div style={styles.list}>
                    {act.map((item) => renderItem(item.text, "default", "ACT"))}
                  </div>
                </div>
              ) : null}

              {notNow.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}>
                    <h4 style={styles.groupTitle}>🕓 Not now</h4>
                    <div style={styles.groupCount}>{notNow.length}</div>
                  </div>

                  <div style={styles.list}>
                    {notNow.map((item) =>
                      renderItem(item.text, "soft", "NOT_NOW")
                    )}
                  </div>
                </div>
              ) : null}

              {letGo.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}>
                    <h4 style={styles.groupTitle}>🧘 Let go</h4>
                    <div style={styles.groupCount}>{letGo.length}</div>
                  </div>

                  <div style={styles.list}>
                    {letGo.map((item) =>
                      renderItem(item.text, "calm", "LET_GO")
                    )}
                  </div>
                </div>
              ) : null}

              {doneList.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}>
                    <h4 style={styles.groupTitle}>✅ Done</h4>
                    <div style={styles.groupCount}>{doneList.length}</div>
                  </div>

                  <div style={styles.list}>
                    {actDone.map((item) =>
                      renderItem(item.text, "done", "ACT", true)
                    )}
                    {notNowDone.map((item) =>
                      renderItem(item.text, "done", "NOT_NOW", true)
                    )}
                    {letGoDone.map((item) =>
                      renderItem(item.text, "done", "LET_GO", true)
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}

        {history.length > 0 ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>🕘 Recent sessions</h3>
                <div style={styles.historySubtext}>Saved on this device</div>
              </div>

              <button type="button" onClick={clearHistory} style={styles.copyButton}>
                Clear all
              </button>
            </div>

            <div style={styles.historyList}>
              {history.map((session) => (
                <div key={session.id} style={styles.historyItem}>
                  <button
                    type="button"
                    onClick={() => loadSession(session)}
                    style={styles.historyMainButton}
                  >
                    <div style={styles.historyDate}>
                      {new Date(session.createdAt).toLocaleString()}
                    </div>

                    <div style={styles.historyText}>{session.input}</div>
                  </button>

                  <div style={styles.historyActions}>
                    <button
                      type="button"
                      onClick={() => loadSession(session)}
                      style={styles.historyActionButton}
                    >
                      Load
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteSession(session.id)}
                      style={styles.historyDeleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={styles.footer}>No pressure. Just one step at a time.</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px 12px 40px",
    background:
      "radial-gradient(circle at 50% -10%, rgba(125,211,252,0.12), transparent 40%), radial-gradient(circle at 80% 0%, rgba(56,189,248,0.08), transparent 45%), #020406"
  },
  container: {
    maxWidth: 440,
    margin: "0 auto",
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  hero: { marginBottom: 18 },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(125,211,252,0.08)",
    color: "#bae6fd",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 10,
    border: "1px solid rgba(125,211,252,0.16)",
    boxShadow: "0 0 18px rgba(56,189,248,0.12)"
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    margin: 0,
    color: "#f8fbff",
    letterSpacing: "-0.03em"
  },
  subtitle: {
    fontSize: 14,
    color: "#8ea3b7",
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 1.6
  },
  punchline: {
    fontSize: 13,
    color: "#bae6fd",
    marginTop: 0,
    marginBottom: 14,
    fontWeight: 700
  },
  inputCard: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
    border: "1px solid rgba(125,211,252,0.12)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.35)"
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#d6e6f5",
    marginBottom: 8
  },
  textarea: {
    width: "100%",
    minHeight: 150,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(125,211,252,0.14)",
    fontSize: 15,
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
    background: "rgba(255,255,255,0.03)",
    color: "#f8fbff",
    lineHeight: 1.55
  },
  inputMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
    gap: 8
  },
  hint: { fontSize: 11, color: "#6f879b" },
  charCount: { fontSize: 11, color: "#6f879b", whiteSpace: "nowrap" },
  buttonRow: { display: "flex", gap: 8 },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    border: "1px solid rgba(125,211,252,0.18)",
    background:
      "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 55%, #7dd3fc 100%)",
    color: "#041018",
    fontWeight: 800,
    fontSize: 14,
    boxShadow: "0 0 22px rgba(56,189,248,0.26)"
  },
  buttonDisabled: { opacity: 0.7, cursor: "default", boxShadow: "none" },
  resetButton: {
    padding: "16px 14px",
    borderRadius: 14,
    border: "1px solid rgba(125,211,252,0.12)",
    background: "rgba(255,255,255,0.03)",
    fontWeight: 700,
    fontSize: 14,
    color: "#d6e6f5"
  },
  resetButtonDisabled: { opacity: 0.7, cursor: "default" },
  privacyNote: { marginTop: 12, fontSize: 11, color: "#6f879b" },
  errorCard: {
    background: "rgba(127,29,29,0.18)",
    color: "#fecaca",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 13,
    border: "1px solid rgba(248,113,113,0.22)"
  },
  card: {
    background: "rgba(255,255,255,0.045)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    border: "1px solid rgba(125,211,252,0.1)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.3)"
  },
  focusCard: {
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.12), rgba(255,255,255,0.045))",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    padding: 18,
    borderRadius: 22,
    marginBottom: 12,
    border: "1px solid rgba(125,211,252,0.22)",
    boxShadow: "0 16px 36px rgba(56,189,248,0.12)"
  },
  focusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14
  },
  focusEyebrow: {
    fontSize: 11,
    color: "#7dd3fc",
    fontWeight: 800,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  },
  focusTitle: {
    margin: 0,
    fontSize: 20,
    color: "#f8fbff",
    letterSpacing: "-0.02em"
  },
  focusTask: {
    padding: 18,
    borderRadius: 16,
    background: "rgba(2,6,8,0.42)",
    border: "1px solid rgba(125,211,252,0.18)",
    color: "#f8fbff",
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1.35,
    marginBottom: 12
  },
  focusActions: { display: "flex", gap: 8 },
  secondaryFocusButton: {
    flex: 1,
    padding: 13,
    borderRadius: 13,
    border: "1px solid rgba(125,211,252,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#dbeafe",
    fontWeight: 800,
    cursor: "pointer"
  },
  doneFocusButton: {
    flex: 1.4,
    padding: 13,
    borderRadius: 13,
    border: "1px solid rgba(125,211,252,0.2)",
    background:
      "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 55%, #7dd3fc 100%)",
    color: "#041018",
    fontWeight: 900,
    cursor: "pointer"
  },
  focusHint: { marginTop: 10, color: "#8ea3b7", fontSize: 12, lineHeight: 1.5 },
  smallGhostButton: {
    border: "1px solid rgba(125,211,252,0.14)",
    background: "rgba(255,255,255,0.03)",
    color: "#a8bdd0",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer"
  },
  focusButton: {
    border: "1px solid rgba(125,211,252,0.22)",
    background: "rgba(56,189,248,0.1)",
    color: "#bae6fd",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10
  },
  cardTitle: { fontSize: 15, margin: 0, color: "#f8fbff" },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  sectionPill: {
    fontSize: 11,
    color: "#bae6fd",
    background: "rgba(125,211,252,0.08)",
    border: "1px solid rgba(125,211,252,0.18)",
    borderRadius: 999,
    padding: "4px 8px",
    whiteSpace: "nowrap"
  },
  loadingBadge: {
    fontSize: 11,
    color: "#bae6fd",
    background: "rgba(125,211,252,0.08)",
    border: "1px solid rgba(125,211,252,0.18)",
    borderRadius: 999,
    padding: "4px 8px",
    whiteSpace: "nowrap"
  },
  clearDoneButton: {
    border: "1px solid rgba(125,211,252,0.14)",
    background: "rgba(255,255,255,0.03)",
    color: "#a8bdd0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer"
  },
  copyMenuWrap: { position: "relative" },
  copyButton: {
    border: "1px solid rgba(125,211,252,0.16)",
    background: "rgba(255,255,255,0.03)",
    color: "#dbeafe",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer"
  },
  copyMenu: {
    position: "absolute",
    top: "115%",
    right: 0,
    minWidth: 185,
    background: "rgba(9,15,20,0.96)",
    border: "1px solid rgba(125,211,252,0.14)",
    borderRadius: 12,
    boxShadow: "0 14px 28px rgba(0,0,0,0.45)",
    padding: 6,
    zIndex: 20
  },
  copyItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "9px 10px",
    fontSize: 13,
    color: "#dbeafe",
    cursor: "pointer"
  },
  text: { fontSize: 14, color: "#c5d4e3", margin: 0, lineHeight: 1.7 },
  stepBox: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f8fbff",
    background: "rgba(125,211,252,0.05)",
    padding: "12px 14px",
    borderRadius: 12,
    margin: 0,
    border: "1px solid rgba(125,211,252,0.12)"
  },
  emptyState: { padding: "6px 0 2px" },
  emptyTitle: { fontSize: 14, fontWeight: 700, color: "#d6e6f5", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#8ea3b7", lineHeight: 1.6 },
  group: { marginTop: 14 },
  groupTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  groupTitle: { fontSize: 13, margin: 0, color: "#dbeafe" },
  groupCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: "rgba(125,211,252,0.08)",
    color: "#bae6fd",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(125,211,252,0.14)"
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  itemRow: { display: "flex", alignItems: "stretch", gap: 8 },
  itemMainButton: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left"
  },
  checkCircle: {
    width: 32,
    height: 32,
    minWidth: 32,
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.2)",
    background: "rgba(255,255,255,0.03)",
    color: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 700,
    marginTop: 2
  },
  checkCircleDone: {
    color: "#7dd3fc",
    border: "1px solid rgba(125,211,252,0.38)",
    boxShadow: "0 0 14px rgba(56,189,248,0.25)"
  },
  inlineCopyButton: {
    border: "1px solid rgba(125,211,252,0.12)",
    background: "rgba(255,255,255,0.03)",
    color: "#a8bdd0",
    borderRadius: 10,
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer"
  },
  item: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(125,211,252,0.12)",
    color: "#e6f3ff",
    fontSize: 14
  },
  itemSoft: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 12,
    background: "rgba(148,163,184,0.06)",
    border: "1px solid rgba(148,163,184,0.14)",
    color: "#cbd5e1",
    fontSize: 14
  },
  itemCalm: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 12,
    background: "rgba(125,211,252,0.06)",
    border: "1px solid rgba(125,211,252,0.18)",
    color: "#c6f1ff",
    fontSize: 14
  },
  itemDoneSection: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 12,
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(125,211,252,0.2)",
    color: "#a5c7df",
    fontSize: 14
  },
  itemDone: { textDecoration: "line-through", color: "#6f879b" },
  skeletonWrap: { display: "flex", flexDirection: "column", gap: 8 },
  skeletonLine: {
    height: 12,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(125,211,252,0.06) 25%, rgba(255,255,255,0.08) 50%, rgba(125,211,252,0.06) 75%)",
    backgroundSize: "200% 100%"
  },
  historySubtext: {
    marginTop: 3,
    fontSize: 11,
    color: "#6f879b"
  },
  historyList: { display: "flex", flexDirection: "column", gap: 8 },
  historyItem: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(125,211,252,0.12)",
    background: "rgba(255,255,255,0.03)"
  },
  historyMainButton: {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer"
  },
  historyDate: { fontSize: 11, color: "#6f879b", marginBottom: 5 },
  historyText: {
    fontSize: 13,
    color: "#dbeafe",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  historyActions: {
    display: "flex",
    gap: 8,
    marginTop: 10
  },
  historyActionButton: {
    flex: 1,
    border: "1px solid rgba(125,211,252,0.14)",
    background: "rgba(125,211,252,0.06)",
    color: "#dbeafe",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer"
  },
  historyDeleteButton: {
    flex: 1,
    border: "1px solid rgba(248,113,113,0.18)",
    background: "rgba(127,29,29,0.12)",
    color: "#fecaca",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer"
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#6f879b",
    marginTop: 8
  }
};
