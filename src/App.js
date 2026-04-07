import React, { useMemo, useState } from "react";

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const act = useMemo(
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

  async function clarify() {
    if (!text.trim()) {
      setError("Please write a few thoughts first.");
      return;
    }

    try {
      setLoading(true);
      setError("");

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
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      clarify();
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.badge}>SlowFlow</div>
          <h1 style={styles.title}>Clear your mind</h1>
          <p style={styles.subtitle}>One small step at a time.</p>
        </div>

        <div style={styles.inputCard}>
          <textarea
            placeholder="Write everything on your mind..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={styles.textarea}
          />

          <div style={styles.hint}>Cmd/Ctrl + Enter to clarify</div>

          <div style={styles.buttonRow}>
            <button
              onClick={clarify}
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "default" : "pointer"
              }}
            >
              {loading ? "Sorting..." : "Clarify"}
            </button>

            <button
              onClick={resetAll}
              disabled={loading}
              style={{
                ...styles.resetButton,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "default" : "pointer"
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {error ? <div style={styles.errorCard}>{error}</div> : null}

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🧠 What’s going on</h3>
          <p style={styles.text}>
            {result?.summary || "Write something and press clarify"}
          </p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚡ One small step</h3>
          <p style={styles.stepBox}>
            {result?.next_step_under_5_min || "We’ll suggest a tiny step here"}
          </p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📦 Sorted out</h3>

          {act.length === 0 && notNow.length === 0 && letGo.length === 0 && (
            <div style={styles.emptyText}>
              Your thoughts will be sorted here ✨
            </div>
          )}

          {act.length > 0 && (
            <div style={styles.group}>
              <h4 style={styles.groupTitle}>🚀 Do now</h4>
              <div style={styles.list}>
                {act.map((item, idx) => (
                  <div key={idx} style={styles.item}>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {notNow.length > 0 && (
            <div style={styles.group}>
              <h4 style={styles.groupTitle}>🕓 Not now</h4>
              <div style={styles.list}>
                {notNow.map((item, idx) => (
                  <div key={idx} style={styles.itemSoft}>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {letGo.length > 0 && (
            <div style={styles.group}>
              <h4 style={styles.groupTitle}>🧘 Let go</h4>
              <div style={styles.list}>
                {letGo.map((item, idx) => (
                  <div key={idx} style={styles.itemCalm}>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>No pressure. Just one step at a time.</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: "#f8fafc",
    minHeight: "100vh",
    padding: "20px 12px 40px"
  },
  container: {
    maxWidth: 420,
    margin: "0 auto",
    fontFamily: "system-ui, sans-serif"
  },
  hero: {
    marginBottom: 16
  },
  badge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    background: "#fff",
    color: "#6366f1",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 10
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 6
  },
  inputCard: {
    background: "#fff",
    padding: 14,
    borderRadius: 18,
    marginBottom: 14
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    fontSize: 15,
    boxSizing: "border-box",
    resize: "vertical"
  },
  hint: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 10
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
    background: "#6366f1",
    color: "white",
    fontWeight: 700
  },
  resetButton: {
    padding: "16px 14px",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#fff",
    fontWeight: 600
  },
  errorCard: {
    background: "#fff1f2",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13
  },
  card: {
    background: "#fff",
    padding: 14,
    borderRadius: 18,
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 14,
    marginBottom: 8
  },
  text: {
    fontSize: 14,
    color: "#334155",
    margin: 0,
    lineHeight: 1.6
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b"
  },
  stepBox: {
    fontSize: 15,
    fontWeight: 600,
    background: "#f1f5f9",
    padding: "10px 12px",
    borderRadius: 10,
    margin: 0
  },
  group: {
    marginTop: 10
  },
  groupTitle: {
    fontSize: 13,
    marginBottom: 6
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 6
  },
  item: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#f8fafc"
  },
  itemSoft: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#fafafa"
  },
  itemCalm: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#f0fdf4"
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 6
  }
};
