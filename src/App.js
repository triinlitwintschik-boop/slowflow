import React, { useEffect, useMemo, useState } from "react";

const DONE_STORAGE_KEY = "slowflow-done-items";

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [doneItems, setDoneItems] = useState(() => {
    try {
      const saved = localStorage.getItem(DONE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const actRaw = useMemo(
    () => result?.items?.filter((i) => i.category === "ACT") || [],
    [result]
  );

  const notNow = useMemo(
    () => result?.items?.filter((i) => i.category === "NOT_NOW") || [],
    [result]
  );

  const letGo = useMemo(
    () => result?.items?.filter((i) => i.category === "LET_GO") || [],
    [result]
  );

  const normalizedNextStep = useMemo(() => {
    return normalizeText(result?.next_step_under_5_min || "");
  }, [result]);

  const act = useMemo(() => {
    return actRaw.filter(
      (item) => normalizeText(item.text) !== normalizedNextStep
    );
  }, [actRaw, normalizedNextStep]);

  useEffect(() => {
    try {
      localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(doneItems));
    } catch {
      // ignore localStorage errors
    }
  }, [doneItems]);

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[.?!,]+$/g, "");
  }

  function getItemKey(category, textValue) {
    return `${category}::${normalizeText(textValue)}`;
  }

  function isDone(category, textValue) {
    return !!doneItems[getItemKey(category, textValue)];
  }

  function toggleDone(category, textValue) {
    const key = getItemKey(category, textValue);
    setDoneItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  async function copySingleItem(textValue) {
    try {
      await navigator.clipboard.writeText(textValue);
      setCopied(`item:${textValue}`);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
      setError("Error: Could not copy item.");
    }
  }

  async function clarify() {
    if (!text.trim()) {
      setError("Please write a few thoughts first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setCopied(false);
      setShowCopyMenu(false);

      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ brainDump: text.trim() })
      });

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        let message = `Request failed: ${res.status}`;

        if (contentType.includes("application/json")) {
          const errorData = await res.json();
          message = errorData?.error || message;
        } else {
          const errorText = await res.text();
          if (errorText) {
            message = errorText;
          }
        }

        throw new Error(message);
      }

      const data = await res.json();
      setResult(data);
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
  }

  function clearDoneItems() {
    setDoneItems({});
    try {
      localStorage.removeItem(DONE_STORAGE_KEY);
    } catch {
      // ignore localStorage errors
    }
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      clarify();
    }
  }

  async function copyResult(format = "plain") {
    if (!result) return;

    const lines = [];

    const bullet = (value) => {
      if (format === "checklist") return `- [ ] ${value}`;
      if (format === "notion") return `☐ ${value}`;
      return `- ${value}`;
    };

    if (result.summary) {
      lines.push("What’s going on");
      lines.push(result.summary);
      lines.push("");
    }

    if (result.next_step_under_5_min) {
      lines.push("One small step");
      lines.push(result.next_step_under_5_min);
      lines.push("");
    }

    lines.push("Sorted out");

    if (act.length > 0) {
      lines.push("Do now");
      act.forEach((item) => lines.push(bullet(item.text)));
      lines.push("");
    }

    if (notNow.length > 0) {
      lines.push("Not now");
      notNow.forEach((item) => lines.push(bullet(item.text)));
      lines.push("");
    }

    if (letGo.length > 0) {
      lines.push("Let go");
      letGo.forEach((item) => lines.push(bullet(item.text)));
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(format);
      setShowCopyMenu(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      setError("Error: Could not copy result.");
    }
  }

  function renderLoadingCard(title, lines = 3) {
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>{title}</h3>
          <div style={styles.loadingBadge}>Thinking...</div>
        </div>

        <div style={styles.skeletonWrap}>
          {Array.from({ length: lines }).map((_, idx) => (
            <div
              key={idx}
              style={{
                ...styles.skeletonLine,
                width: idx === lines - 1 ? "68%" : "100%",
                animation: "shimmer 1.4s ease-in-out infinite"
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderItem(textValue, variant, category) {
    const done = isDone(category, textValue);

    const baseStyle =
      variant === "soft"
        ? styles.itemSoft
        : variant === "calm"
        ? styles.itemCalm
        : styles.item;

    return (
      <div
        key={`${category}-${textValue}`}
        style={{
          ...styles.itemRow,
          ...(done ? styles.itemRowDone : {})
        }}
      >
        <button
          type="button"
          onClick={() => toggleDone(category, textValue)}
          style={styles.itemMainButton}
        >
          <div style={styles.checkCircle}>{done ? "✓" : ""}</div>

          <div
            style={{
              ...baseStyle,
              ...(done ? styles.itemDone : {})
            }}
          >
            {textValue}
          </div>
        </button>

        <button
          type="button"
          onClick={() => copySingleItem(textValue)}
          style={styles.inlineCopyButton}
        >
          {copied === `item:${textValue}` ? "Copied" : "Copy"}
        </button>
      </div>
    );
  }

  const hasResult = !!result;
  const hasAnyDoneItems = Object.values(doneItems).some(Boolean);

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
          <h1 style={styles.title}>Turn mental noise into one clear step</h1>
          <p style={styles.subtitle}>
            Empty your mind, gently sort what matters, and move forward without
            pressure.
          </p>
        </div>

        <div style={styles.inputCard}>
          <label style={styles.label}>Brain dump</label>

          <textarea
            placeholder="Write everything on your mind..."
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
              onClick={clarify}
              disabled={loading}
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {})
              }}
            >
              {loading ? "Sorting..." : "Clarify"}
            </button>

            <button
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
            {renderLoadingCard("🧠 What’s going on", 3)}
            {renderLoadingCard("⚡ One small step", 2)}
            {renderLoadingCard("📦 Sorted out", 4)}
          </>
        ) : (
          <>
            <div style={{ ...styles.card, animation: "floatIn 0.25s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>🧠 What’s going on</h3>
                <div style={styles.sectionPill}>Summary</div>
              </div>

              <p style={styles.text}>
                {result?.summary || "Write something and press clarify"}
              </p>
            </div>

            <div style={{ ...styles.card, animation: "floatIn 0.3s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>⚡ One small step</h3>
                <div style={styles.sectionPill}>Under 5 min</div>
              </div>

              <p style={styles.stepBox}>
                {result?.next_step_under_5_min ||
                  "We’ll suggest a tiny step here"}
              </p>
            </div>

            <div style={{ ...styles.card, animation: "floatIn 0.35s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>📦 Sorted out</h3>
                <div style={styles.cardActions}>
                  <div style={styles.sectionPill}>Organized</div>

                  {hasAnyDoneItems ? (
                    <button onClick={clearDoneItems} style={styles.clearDoneButton}>
                      Clear done
                    </button>
                  ) : null}

                  {hasResult ? (
                    <div style={styles.copyMenuWrap}>
                      <button
                        onClick={() => setShowCopyMenu(!showCopyMenu)}
                        style={styles.copyButton}
                      >
                        {copied &&
                        typeof copied === "string" &&
                        !copied.startsWith("item:")
                          ? `Copied (${copied})`
                          : "Copy as"}
                      </button>

                      {showCopyMenu && (
                        <div style={styles.copyMenu}>
                          <button
                            onClick={() => copyResult("plain")}
                            style={styles.copyItem}
                          >
                            Plain text
                          </button>
                          <button
                            onClick={() => copyResult("checklist")}
                            style={styles.copyItem}
                          >
                            Checklist
                          </button>
                          <button
                            onClick={() => copyResult("notion")}
                            style={styles.copyItem}
                          >
                            Notion style
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {!hasResult && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyTitle}>Nothing sorted yet</div>
                  <div style={styles.emptyText}>
                    Your thoughts will appear here as Do now, Not now, and Let
                    go.
                  </div>
                </div>
              )}

              {act.length > 0 && (
                <div style={styles.group}>
                  <div style={styles.groupTop}>
                    <h4 style={styles.groupTitle}>🚀 Do now</h4>
                    <div style={styles.groupCount}>{act.length}</div>
                  </div>

                  <div style={styles.list}>
                    {act.map((item) => renderItem(item.text, "default", "ACT"))}
                  </div>
                </div>
              )}

              {notNow.length > 0 && (
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
              )}

              {letGo.length > 0 && (
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
              )}
            </div>
          </>
        )}

        <div style={styles.footer}>No pressure. Just one step at a time.</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background:
      "radial-gradient(circle at top, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)",
    minHeight: "100vh",
    padding: "24px 12px 40px"
  },
  container: {
    maxWidth: 440,
    margin: "0 auto",
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  hero: {
    marginBottom: 18
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#6366f1",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 10,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 14px rgba(15,23,42,0.06)"
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    margin: 0,
    color: "#111827",
    letterSpacing: "-0.03em"
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 0,
    lineHeight: 1.6
  },
  inputCard: {
    background: "rgba(255,255,255,0.92)",
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)"
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 8
  },
  textarea: {
    width: "100%",
    minHeight: 150,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #dbe3ef",
    fontSize: 15,
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
    background: "#ffffff",
    color: "#111827",
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
  hint: {
    fontSize: 11,
    color: "#94a3b8"
  },
  charCount: {
    fontSize: 11,
    color: "#94a3b8",
    whiteSpace: "nowrap"
  },
  buttonRow: {
    display: "flex",
    gap: 8
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    boxShadow: "0 8px 18px rgba(99,102,241,0.22)",
    transition: "all 0.2s ease"
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "default",
    boxShadow: "none"
  },
  resetButton: {
    padding: "16px 14px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 600,
    fontSize: 14,
    color: "#374151"
  },
  resetButtonDisabled: {
    opacity: 0.7,
    cursor: "default"
  },
  privacyNote: {
    marginTop: 12,
    fontSize: 11,
    color: "#9ca3af"
  },
  errorCard: {
    background: "#fff1f2",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 13,
    border: "1px solid #fecdd3"
  },
  card: {
    background: "rgba(255,255,255,0.94)",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 15,
    margin: 0,
    color: "#111827"
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  sectionPill: {
    fontSize: 11,
    color: "#6366f1",
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    borderRadius: 999,
    padding: "4px 8px",
    whiteSpace: "nowrap"
  },
  loadingBadge: {
    fontSize: 11,
    color: "#6d28d9",
    background: "#f5f3ff",
    border: "1px solid #ddd6fe",
    borderRadius: 999,
    padding: "4px 8px",
    whiteSpace: "nowrap"
  },
  clearDoneButton: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#6b7280",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer"
  },
  copyMenuWrap: {
    position: "relative"
  },
  copyButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
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
    minWidth: 150,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 12px 24px rgba(15,23,42,0.12)",
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
    color: "#374151",
    cursor: "pointer"
  },
  text: {
    fontSize: 14,
    color: "#334155",
    margin: 0,
    lineHeight: 1.65
  },
  stepBox: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1f2937",
    background: "#f8fafc",
    padding: "12px 14px",
    borderRadius: 12,
    margin: 0,
    border: "1px solid #e2e8f0"
  },
  emptyState: {
    padding: "6px 0 2px"
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#4b5563",
    marginBottom: 4
  },
  emptyText: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 1.6
  },
  group: {
    marginTop: 14
  },
  groupTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  groupTitle: {
    fontSize: 13,
    margin: 0,
    color: "#374151"
  },
  groupCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  },
  itemRow: {
    display: "flex",
    alignItems: "stretch",
    gap: 8
  },
  itemRowDone: {
    opacity: 0.72
  },
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
    width: 22,
    height: 22,
    minWidth: 22,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#22c55e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    marginTop: 2
  },
  inlineCopyButton: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#6b7280",
    borderRadius: 10,
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer"
  },
  item: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#1f2937",
    fontSize: 14
  },
  itemSoft: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 12,
    background: "#fafaf9",
    border: "1px solid #e7e5e4",
    color: "#374151",
    fontSize: 14
  },
  itemCalm: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 12,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontSize: 14
  },
  itemDone: {
    textDecoration: "line-through",
    color: "#94a3b8",
    background: "#f8fafc",
    border: "1px solid #e5e7eb"
  },
  skeletonWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  },
  skeletonLine: {
    height: 12,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, #eef2f7 25%, #f8fafc 50%, #eef2f7 75%)",
    backgroundSize: "200% 100%"
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 8
  }
};
