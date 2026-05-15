import React, { useEffect, useMemo, useState } from "react";

const DONE_STORAGE_KEY = "slowflow-done-items";
const HISTORY_STORAGE_KEY = "slowflow-sessions";
const DAILY_SKIP_STORAGE_KEY = "slowflow-daily-skipped-items";
const TODAY_FEEL_STORAGE_KEY = "slowflow-today-feels-like";
const TODAY_KEY = new Date().toISOString().slice(0, 10);
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/bJebJ1fBA5NN7GO9ysak000";

export default function App() {
  const [showApp, setShowApp] = useState(() => {
    try {
      return window.location.hash === "#app";
    } catch {
      return false;
    }
  });

  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [animatingDoneKey, setAnimatingDoneKey] = useState("");

  const [todayFeelsLike, setTodayFeelsLike] = useState(() => {
    try {
      const saved = localStorage.getItem(TODAY_FEEL_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed?.date === TODAY_KEY && parsed?.value) return parsed.value;
      return "okay";
    } catch {
      return "okay";
    }
  });

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

  const [skippedCarryKeys, setSkippedCarryKeys] = useState(() => {
    try {
      const saved = localStorage.getItem(DAILY_SKIP_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed?.date === TODAY_KEY && Array.isArray(parsed.keys)) return parsed.keys;
      return [];
    } catch {
      return [];
    }
  });

  function openStripeCheckout() {
    try {
      window.open(STRIPE_PAYMENT_LINK, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = STRIPE_PAYMENT_LINK;
    }
  }

  function openApp() {
    setShowApp(true);
    try {
      window.location.hash = "app";
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => document.getElementById("brain-input")?.focus(), 250);
    } catch {}
  }

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
    const currentlyDone = !!doneItems[key];

    if (currentlyDone) {
      setDoneItems((prev) => ({ ...prev, [key]: false }));
      return;
    }

    setAnimatingDoneKey(key);

    setTimeout(() => {
      setDoneItems((prev) => ({ ...prev, [key]: true }));
      setAnimatingDoneKey("");
    }, 220);
  }

  function markOneSmallStepDone() {
    if (!result?.next_step_for) return;
    toggleDone("ACT", result.next_step_for);
  }

  useEffect(() => {
    try {
      localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(doneItems));
    } catch {}
  }, [doneItems]);

  useEffect(() => {
    try {
      localStorage.setItem(
        DAILY_SKIP_STORAGE_KEY,
        JSON.stringify({ date: TODAY_KEY, keys: skippedCarryKeys })
      );
    } catch {}
  }, [skippedCarryKeys]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TODAY_FEEL_STORAGE_KEY,
        JSON.stringify({ date: TODAY_KEY, value: todayFeelsLike })
      );
    } catch {}
  }, [todayFeelsLike]);

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
    openApp();
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

  const todayActLimit = todayFeelsLike === "busy" ? 2 : 3;

  const actRawAll = useMemo(
    () => result?.items?.filter((item) => item.category === "ACT") || [],
    [result]
  );

  const visibleActRaw = useMemo(
    () => actRawAll.slice(0, todayActLimit),
    [actRawAll, todayActLimit]
  );

  const overflowActRaw = useMemo(
    () => actRawAll.slice(todayActLimit),
    [actRawAll, todayActLimit]
  );

  const notNowRawBase = useMemo(
    () => result?.items?.filter((item) => item.category === "NOT_NOW") || [],
    [result]
  );

  const notNowRaw = useMemo(
    () => [...overflowActRaw, ...notNowRawBase],
    [overflowActRaw, notNowRawBase]
  );

  const letGoRaw = useMemo(
    () => result?.items?.filter((item) => item.category === "LET_GO") || [],
    [result]
  );

  const allCurrentItemKeys = useMemo(() => {
    const allItems = result?.items || [];
    return new Set(allItems.map((item) => getItemKey(item.category, item.text)));
  }, [result]);

  const allCurrentTextKeys = useMemo(() => {
    const allItems = result?.items || [];
    return new Set(allItems.map((item) => normalizeText(item.text)));
  }, [result]);

  const act = useMemo(
    () => visibleActRaw.filter((item) => !isDone("ACT", item.text)),
    [visibleActRaw, doneItems]
  );

  const actDone = useMemo(
    () => actRawAll.filter((item) => isDone("ACT", item.text)),
    [actRawAll, doneItems]
  );

  const notNow = useMemo(
    () =>
      notNowRaw.filter((item) => {
        const category = overflowActRaw.includes(item) ? "ACT" : "NOT_NOW";
        return !isDone(category, item.text);
      }),
    [notNowRaw, overflowActRaw, doneItems]
  );

  const notNowDone = useMemo(
    () => notNowRawBase.filter((item) => isDone("NOT_NOW", item.text)),
    [notNowRawBase, doneItems]
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

  const carryOverItems = useMemo(() => {
    const seen = new Set();
    const skipped = new Set(skippedCarryKeys);

    return history
      .flatMap((session) => session?.result?.items || [])
      .filter((item) => item.category === "ACT")
      .filter((item) => {
        const actKey = getItemKey("ACT", item.text);
        const textKey = normalizeText(item.text);

        if (seen.has(actKey)) return false;
        if (skipped.has(actKey)) return false;
        if (allCurrentItemKeys.has(actKey)) return false;
        if (allCurrentTextKeys.has(textKey)) return false;
        if (isDone("ACT", item.text)) return false;

        seen.add(actKey);
        return true;
      })
      .slice(0, 3);
  }, [history, doneItems, skippedCarryKeys, allCurrentItemKeys, allCurrentTextKeys]);

  const currentFocusTask = act[0];
  const hasResult = !!result;
  const hasAnyDoneItems = Object.values(doneItems).some(Boolean);

  function addCarryToInput(textValue) {
    const value = String(textValue || "").trim();
    if (!value) return;

    setText((prev) => {
      if (!prev.trim()) return value;
      if (normalizeText(prev).includes(normalizeText(value))) return prev;
      return `${prev.trim()}, ${value}`;
    });
    openApp();
  }

  function skipCarryItem(textValue) {
    const key = getItemKey("ACT", textValue);

    setSkippedCarryKeys((prev) => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
  }

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

        if (result.next_step_for) {
          lines.push("→ for: " + result.next_step_for);
        }

        lines.push("");
      }

      lines.push("Sorted out");
    }

    if (act.length > 0) {
      lines.push("Do today");
      act.forEach((item) => lines.push(bullet(item.text)));
      lines.push("");
    }

    if (!onlyAct && notNow.length > 0) {
      lines.push("Not for now");
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
        await navigator.share({ title: "SlowFlow", text: output });
      } else {
        await copyToClipboard(output, "share-copy");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function escapeIcsText(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function addToCalendar(step, relatedTask = "") {
    if (!step) return;

    const start = new Date();
    const end = new Date(start.getTime() + 5 * 60 * 1000);
    const formatDate = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const description = relatedTask ? `SlowFlow step for: ${relatedTask}` : "SlowFlow one small step";

    const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SlowFlow//One Small Step//EN
BEGIN:VEVENT
UID:${Date.now()}@slowflow
SUMMARY:${escapeIcsText("SlowFlow: " + step)}
DESCRIPTION:${escapeIcsText(description)}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
END:VEVENT
END:VCALENDAR
    `.trim();

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "slowflow-step.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        headers: { "Content-Type": "application/json" },
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
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") clarify();
  }

  function getCopyButtonLabel() {
    if (!copied || typeof copied !== "string" || copied.startsWith("item:")) return "Copy";
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
    const key = getItemKey(category, textValue);
    const isAnimating = animatingDoneKey === key;

    const baseStyle =
      variant === "soft"
        ? styles.itemSoft
        : variant === "calm"
        ? styles.itemCalm
        : doneSection
        ? styles.itemDoneSection
        : styles.item;

    return (
      <div
        key={`${category}-${textValue}`}
        style={{ ...styles.itemRow, ...(isAnimating ? styles.itemRowDoneAnimation : {}) }}
      >
        <button type="button" onClick={() => toggleDone(category, textValue)} style={styles.itemMainButton}>
          <div style={{ ...styles.checkCircle, ...(done || isAnimating ? styles.checkCircleDone : {}) }}>
            {done || isAnimating ? "✓" : ""}
          </div>
          <div style={{ ...baseStyle, ...(done ? styles.itemDone : {}) }}>{textValue}</div>
        </button>

        {doneSection ? (
          <button type="button" onClick={() => toggleDone(category, textValue)} style={styles.inlineCopyButton}>
            Undo
          </button>
        ) : (
          <button type="button" onClick={() => copySingleItem(textValue)} style={styles.inlineCopyButton}>
            {copied === `item:${textValue}` ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    );
  }

  function renderCarryOverItem(item) {
    const key = getItemKey("ACT", item.text);

    return (
      <div key={key} style={styles.dailyItem}>
        <div style={styles.dailyItemText}>{item.text}</div>
        <div style={styles.dailyActions}>
          <button type="button" onClick={() => toggleDone("ACT", item.text)} style={styles.dailyDoneButton}>
            Done
          </button>
          <button type="button" onClick={() => addCarryToInput(item.text)} style={styles.dailyStillButton}>
            Still here
          </button>
          <button type="button" onClick={() => skipCarryItem(item.text)} style={styles.dailyNotTodayButton}>
            Not today
          </button>
        </div>
      </div>
    );
  }

  function renderLandingPage() {
    return (
      <div style={styles.page}>
        {renderGlobalStyle()}
        <div style={styles.landingContainer}>
          <div style={styles.nav}>
            <div style={styles.brandMark}>SlowFlow</div>
            <div style={styles.navActions}>
              <button type="button" onClick={openApp} style={styles.navButton}>Open app</button>
              <button type="button" onClick={openStripeCheckout} style={styles.navUpgradeButton}>Upgrade</button>
            </div>
          </div>

          <section style={styles.landingHero}>
            <div style={styles.badge}>Calm clarity for overwhelmed brains</div>
            <h1 style={styles.landingTitle}>
              When your head is full,
              <br />
              <span style={styles.landingTitleAccent}>start here.</span>
            </h1>
            <p style={styles.landingSubtitle}>
              Dump everything on your mind. SlowFlow helps you turn mental clutter into one clear next step.
            </p>
            <div style={styles.landingActions}>
              <button type="button" onClick={openApp} style={styles.primaryCta}>Try SlowFlow</button>
              <button type="button" onClick={openStripeCheckout} style={styles.secondaryCta}>Get Unlimited — €5.99/month</button>
              <div style={styles.ctaNote}>Free daily reset included. Upgrade when you want unlimited clarity.</div>
            </div>
          </section>

          <section style={styles.previewGrid}>
            <div style={styles.previewCardLarge}>
              <div style={styles.previewLabel}>Brain dump</div>
              <div style={styles.previewText}>Write everything on your mind.<br />No filter. No structure.<br />Just get it out.</div>
              <div style={styles.previewButton}>Clear my mind</div>
            </div>
            <div style={styles.previewCard}>
              <div style={styles.previewLabel}>⚡ One small step</div>
              <div style={styles.previewStep}>We’ll suggest one small step under 5 minutes.<br />You can actually do it.</div>
            </div>
            <div style={styles.previewCard}>
              <div style={styles.previewLabel}>📦 Sorted out</div>
              <div style={styles.previewListItem}>🚀 Do today</div>
              <div style={styles.previewListItemMuted}>🕓 Not for now</div>
              <div style={styles.previewListItemMuted}>🧘 Let go</div>
            </div>
          </section>

          <section style={styles.landingSection}>
            <h2 style={styles.sectionTitle}>Your brain isn’t lazy. It’s overloaded.</h2>
            <p style={styles.sectionText}>
              SlowFlow is not another complicated productivity system. It helps you stop spiraling, sort the noise, and start with one tiny action.
            </p>
            <div style={styles.featureGrid}>
              <div style={styles.featureCard}>Built for overwhelmed brains</div>
              <div style={styles.featureCard}>One step under 5 min</div>
              <div style={styles.featureCard}>Gentle daily reset</div>
              <div style={styles.featureCard}>More clarity, less noise</div>
            </div>
          </section>

          <section style={styles.finalCta}>
            <h2 style={styles.finalTitle}>Start with what’s already in your head.</h2>
            <p style={styles.finalText}>Try the daily reset first. Upgrade to SlowFlow Unlimited when you want more space for your thoughts.</p>
            <div style={styles.finalActions}>
              <button type="button" onClick={openApp} style={styles.primaryCta}>Open SlowFlow</button>
              <button type="button" onClick={openStripeCheckout} style={styles.secondaryCta}>Get Unlimited</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderGlobalStyle() {
    return (
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes donePop {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.96); opacity: 0.7; }
          100% { transform: scale(1.02); opacity: 1; }
        }
      `}</style>
    );
  }

  if (!showApp) return renderLandingPage();

  return (
    <div style={styles.page}>
      {renderGlobalStyle()}
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.topRow}>
            <div style={styles.badge}>SlowFlow</div>
            <div style={styles.appTopActions}>
              <button type="button" onClick={openStripeCheckout} style={styles.linkButton}>Upgrade</button>
              <button type="button" onClick={() => setShowApp(false)} style={styles.linkButton}>Home</button>
            </div>
          </div>
          <h1 style={styles.title}>When your head is full, start here.</h1>
          <p style={styles.subtitle}>Dump everything on your mind. We’ll help you find one clear next step.</p>
          <p style={styles.punchline}>Stop overthinking. Start moving.</p>
        </div>

        <div style={styles.todayCard}>
          <div style={styles.todayLabel}>Today feels like</div>
          <div style={styles.todayOptions}>
            {[["light", "Light"], ["okay", "Okay"], ["busy", "Busy"]].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTodayFeelsLike(value)}
                style={{ ...styles.todayOption, ...(todayFeelsLike === value ? styles.todayOptionActive : {}) }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={styles.todayHint}>
            {todayFeelsLike === "busy" ? "Keeping today extra small: max 2 Do today items" : "Keeping today focused: max 3 Do today items"}
          </div>
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
            <button type="button" onClick={clarify} disabled={loading} style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}>
              {loading ? "Sorting..." : "Clear my mind"}
            </button>
            <button type="button" onClick={resetAll} disabled={loading} style={{ ...styles.resetButton, ...(loading ? styles.resetButtonDisabled : {}) }}>
              Reset
            </button>
          </div>
          <div style={styles.privacyNote}>Your text is used only to organize what you wrote.</div>
        </div>

        {error ? <div style={styles.errorCard}>{error}</div> : null}

        {!loading ? (
          <div style={{ ...styles.card, animation: "floatIn 0.22s ease" }}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>🌅 Start today</h3>
                <div style={styles.dailySubtext}>{carryOverItems.length > 0 ? "These were still open from recent sessions." : "Nothing carried over. Fresh start."}</div>
              </div>
              <div style={styles.sectionPill}>{carryOverItems.length}</div>
            </div>
            {carryOverItems.length > 0 ? (
              <div style={styles.dailyList}>{carryOverItems.map((item) => renderCarryOverItem(item))}</div>
            ) : (
              <div style={styles.emptyText}>You can begin with a fresh brain dump.</div>
            )}
          </div>
        ) : null}

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
                  <div style={styles.emptyText}>Start by writing what’s on your mind. Even messy is fine.</div>
                </div>
              )}
            </div>

            <div style={{ ...styles.card, animation: "floatIn 0.3s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>⚡ One small step</h3>
                <div style={styles.sectionPill}>Under 5 min</div>
              </div>
              <p style={styles.stepBox}>{result?.next_step_under_5_min || "We’ll suggest one clear next step here."}</p>
              {result?.next_step_for ? <div style={styles.stepFor}>→ for: {result.next_step_for}</div> : null}
              {result?.next_step_under_5_min ? (
                <div style={styles.stepActions}>
                  <button type="button" onClick={markOneSmallStepDone} style={styles.stepDoneButton}>Done</button>
                  <button type="button" onClick={() => addToCalendar(result.next_step_under_5_min, result.next_step_for)} style={styles.calendarButton}>+ Add to calendar</button>
                </div>
              ) : null}
            </div>

            {focusMode && hasResult ? (
              <div style={{ ...styles.focusCard, animation: "floatIn 0.25s ease" }}>
                <div style={styles.focusTop}>
                  <div>
                    <div style={styles.focusEyebrow}>Focus mode</div>
                    <h3 style={styles.focusTitle}>One thing. Right now.</h3>
                  </div>
                  <button type="button" onClick={() => setFocusMode(false)} style={styles.smallGhostButton}>Exit</button>
                </div>
                {currentFocusTask ? (
                  <>
                    <div style={styles.focusTask}>{currentFocusTask.text}</div>
                    <div style={styles.focusActions}>
                      <button type="button" onClick={() => copySingleItem(currentFocusTask.text)} style={styles.secondaryFocusButton}>Copy</button>
                      <button type="button" onClick={completeFocusTask} style={styles.doneFocusButton}>Mark done</button>
                    </div>
                    <div style={styles.focusHint}>Do just this. You can come back for the next one.</div>
                  </>
                ) : (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyTitle}>Nothing urgent left.</div>
                    <div style={styles.emptyText}>You’ve cleared the Do today list. That counts.</div>
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ ...styles.card, animation: "floatIn 0.35s ease" }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>📦 Sorted out</h3>
                <div style={styles.cardActions}>
                  <div style={styles.sectionPill}>Organized</div>
                  {hasResult && act.length > 0 ? <button type="button" onClick={() => setFocusMode(true)} style={styles.focusButton}>Focus</button> : null}
                  {hasAnyDoneItems ? <button type="button" onClick={clearDoneItems} style={styles.clearDoneButton}>Clear done</button> : null}
                  {hasResult ? (
                    <>
                      <div style={styles.copyMenuWrap}>
                        <button type="button" onClick={() => setShowCopyMenu(!showCopyMenu)} style={styles.copyButton}>{getCopyButtonLabel()}</button>
                        {showCopyMenu ? (
                          <div style={styles.copyMenu}>
                            <button type="button" onClick={() => copyResult("plain")} style={styles.copyItem}>Copy plain text</button>
                            <button type="button" onClick={() => copyResult("checklist")} style={styles.copyItem}>Copy checklist</button>
                            <button type="button" onClick={() => copyResult("notion")} style={styles.copyItem}>Copy for Notion</button>
                            <button type="button" onClick={() => copyResult("plain", true)} style={styles.copyItem}>Copy Do today only</button>
                          </div>
                        ) : null}
                      </div>
                      <button type="button" onClick={shareResult} style={styles.copyButton}>Share</button>
                    </>
                  ) : null}
                </div>
              </div>

              {!hasResult ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyTitle}>Nothing sorted yet.</div>
                  <div style={styles.emptyText}>Your thoughts will appear here as Do today, Not for now, Let go, and Done.</div>
                </div>
              ) : null}

              {act.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}><h4 style={styles.groupTitle}>🚀 Do today</h4><div style={styles.groupCount}>{act.length}</div></div>
                  <div style={styles.list}>{act.map((item) => renderItem(item.text, "default", "ACT"))}</div>
                </div>
              ) : null}

              {notNow.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}><h4 style={styles.groupTitle}>🕓 Not for now</h4><div style={styles.groupCount}>{notNow.length}</div></div>
                  <div style={styles.softHint}>These can stay out of your head for now.</div>
                  <div style={styles.list}>
                    {notNow.map((item) => {
                      const isOverflowAct = overflowActRaw.includes(item);
                      return renderItem(item.text, "soft", isOverflowAct ? "ACT" : "NOT_NOW");
                    })}
                  </div>
                </div>
              ) : null}

              {letGo.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}><h4 style={styles.groupTitle}>🧘 Let go</h4><div style={styles.groupCount}>{letGo.length}</div></div>
                  <div style={styles.list}>{letGo.map((item) => renderItem(item.text, "calm", "LET_GO"))}</div>
                </div>
              ) : null}

              {doneList.length > 0 ? (
                <div style={styles.group}>
                  <div style={styles.groupTop}><h4 style={styles.groupTitle}>✅ Done</h4><div style={styles.groupCount}>{doneList.length}</div></div>
                  <div style={styles.list}>
                    {actDone.map((item) => renderItem(item.text, "done", "ACT", true))}
                    {notNowDone.map((item) => renderItem(item.text, "done", "NOT_NOW", true))}
                    {letGoDone.map((item) => renderItem(item.text, "done", "LET_GO", true))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}

        {history.length > 0 ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div><h3 style={styles.cardTitle}>🕘 Recent sessions</h3><div style={styles.historySubtext}>Saved on this device</div></div>
              <button type="button" onClick={clearHistory} style={styles.copyButton}>Clear all</button>
            </div>
            <div style={styles.historyList}>
              {history.map((session) => (
                <div key={session.id} style={styles.historyItem}>
                  <button type="button" onClick={() => loadSession(session)} style={styles.historyMainButton}>
                    <div style={styles.historyDate}>{new Date(session.createdAt).toLocaleString()}</div>
                    <div style={styles.historyText}>{session.input}</div>
                  </button>
                  <div style={styles.historyActions}>
                    <button type="button" onClick={() => loadSession(session)} style={styles.historyActionButton}>Load</button>
                    <button type="button" onClick={() => deleteSession(session.id)} style={styles.historyDeleteButton}>Delete</button>
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
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  landingContainer: {
    maxWidth: 920,
    margin: "0 auto",
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 46,
    paddingBottom: 18,
    borderBottom: "1px solid rgba(125,211,252,0.08)"
  },
  brandMark: { color: "#eaf3ff", fontWeight: 400, fontSize: 18, letterSpacing: "-0.01em" },
  navActions: {
    display: "flex",
    alignItems: "center",
    gap: 8
  },
  navButton: {
    border: "1px solid rgba(125,211,252,0.16)",
    background: "rgba(125,211,252,0.08)",
    color: "#dbeafe",
    borderRadius: 999,
    padding: "9px 14px",
    fontSize: 12,
    fontWeight: 400,
    cursor: "pointer"
  },
  navUpgradeButton: {
    border: "1px solid rgba(125,211,252,0.18)",
    background: "rgba(255,255,255,0.025)",
    color: "#a9bbce",
    borderRadius: 999,
    padding: "9px 14px",
    fontSize: 12,
    fontWeight: 400,
    cursor: "pointer"
  },
  landingHero: {
    textAlign: "center",
    maxWidth: 720,
    margin: "0 auto 38px",
    animation: "floatIn 0.3s ease"
  },
  landingTitle: {
    fontSize: "clamp(36px, 6.4vw, 62px)",
    lineHeight: 1.15,
    margin: "18px 0 18px",
    color: "#eaf3ff",
    letterSpacing: "0.01em",
    fontWeight: 300
  },
  landingTitleAccent: {
    color: "#7dd3fc",
    fontWeight: 300
  },
  landingSubtitle: {
    maxWidth: 520,
    margin: "0 auto",
    color: "#a9bbce",
    fontSize: 17,
    lineHeight: 1.7,
    fontWeight: 300
  },
  landingActions: { marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  primaryCta: {
    border: "1px solid rgba(125,211,252,0.18)",
    background: "linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%)",
    color: "#041018",
    borderRadius: 14,
    padding: "13px 24px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "0 0 22px rgba(56,189,248,0.18)"
  },
  ctaNote: { color: "#6f879b", fontSize: 12 },
  secondaryCta: {
    border: "1px solid rgba(125,211,252,0.14)",
    background: "rgba(255,255,255,0.025)",
    color: "#cbd5e1",
    borderRadius: 14,
    padding: "12px 18px",
    fontSize: 13,
    fontWeight: 400,
    cursor: "pointer"
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 14,
    margin: "28px auto 36px",
    maxWidth: 780
  },
  previewCardLarge: {
    gridRow: "span 2",
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(125,211,252,0.12)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 12px 28px rgba(0,0,0,0.18)"
  },
  previewCard: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(125,211,252,0.12)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 12px 28px rgba(0,0,0,0.16)"
  },
  previewLabel: { color: "#dbeafe", fontSize: 14, fontWeight: 400, marginBottom: 12 },
  previewText: {
    minHeight: 116,
    color: "#cbd5e1",
    background: "rgba(2,6,8,0.28)",
    border: "1px solid rgba(125,211,252,0.1)",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.65,
    fontSize: 14,
    fontWeight: 300
  },
  previewButton: {
    marginTop: 12,
    textAlign: "center",
    borderRadius: 12,
    padding: 12,
    background: "rgba(56,189,248,0.08)",
    color: "#bae6fd",
    fontWeight: 400,
    fontSize: 13
  },
  previewStep: {
    color: "#dbeafe",
    background: "rgba(125,211,252,0.04)",
    border: "1px solid rgba(125,211,252,0.1)",
    borderRadius: 14,
    padding: 13,
    fontWeight: 300,
    lineHeight: 1.55
  },
  previewListItem: {
    color: "#dbeafe",
    background: "rgba(255,255,255,0.035)",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    fontWeight: 300
  },
  previewListItemMuted: {
    color: "#9fb2c6",
    background: "rgba(148,163,184,0.045)",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    fontWeight: 300
  },
  landingSection: {
    textAlign: "center",
    maxWidth: 760,
    margin: "38px auto",
    padding: "24px 0"
  },
  sectionTitle: {
    color: "#eaf3ff",
    fontSize: "clamp(26px, 4.2vw, 38px)",
    lineHeight: 1.18,
    letterSpacing: "-0.02em",
    margin: "0 0 14px",
    fontWeight: 300
  },
  sectionText: { color: "#9fb2c6", fontSize: 15, lineHeight: 1.75, margin: "0 auto", maxWidth: 620, fontWeight: 300 },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
    marginTop: 22
  },
  featureCard: {
    border: "1px solid rgba(125,211,252,0.1)",
    background: "rgba(255,255,255,0.025)",
    color: "#cbd5e1",
    borderRadius: 18,
    padding: 15,
    fontWeight: 300
  },
  finalCta: {
    textAlign: "center",
    border: "1px solid rgba(125,211,252,0.12)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 28,
    padding: "34px 18px",
    marginTop: 24
  },
  finalTitle: { color: "#eaf3ff", margin: "0 0 12px", fontSize: 28, letterSpacing: "-0.02em", fontWeight: 300 },
  finalText: { color: "#9fb2c6", fontSize: 14, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 18px", fontWeight: 300 },
  finalActions: { display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" },
  hero: { marginBottom: 18 },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  appTopActions: { display: "flex", alignItems: "center", gap: 8 },
  linkButton: {
    border: "1px solid rgba(125,211,252,0.12)",
    background: "rgba(255,255,255,0.03)",
    color: "#a8bdd0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer"
  },
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
  title: { fontSize: 30, fontWeight: 800, margin: 0, color: "#f8fbff", letterSpacing: "-0.03em" },
  subtitle: { fontSize: 14, color: "#8ea3b7", marginTop: 8, marginBottom: 8, lineHeight: 1.6 },
  punchline: { fontSize: 13, color: "#bae6fd", marginTop: 0, marginBottom: 14, fontWeight: 700 },
  todayCard: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(125,211,252,0.1)", borderRadius: 18, padding: 12, marginBottom: 12 },
  todayLabel: { fontSize: 12, fontWeight: 800, color: "#d6e6f5", marginBottom: 8 },
  todayOptions: { display: "flex", gap: 8 },
  todayOption: { flex: 1, border: "1px solid rgba(125,211,252,0.12)", background: "rgba(255,255,255,0.03)", color: "#a8bdd0", borderRadius: 999, padding: "8px 9px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  todayOptionActive: { background: "rgba(56,189,248,0.12)", color: "#bae6fd", border: "1px solid rgba(125,211,252,0.24)" },
  todayHint: { marginTop: 8, fontSize: 11, color: "#6f879b", lineHeight: 1.45 },
  inputCard: { background: "rgba(255,255,255,0.04)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", padding: 16, borderRadius: 22, marginBottom: 14, border: "1px solid rgba(125,211,252,0.12)", boxShadow: "0 14px 34px rgba(0,0,0,0.35)" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#d6e6f5", marginBottom: 8 },
  textarea: { width: "100%", minHeight: 150, padding: 14, borderRadius: 16, border: "1px solid rgba(125,211,252,0.14)", fontSize: 15, boxSizing: "border-box", resize: "vertical", outline: "none", background: "rgba(255,255,255,0.03)", color: "#f8fbff", lineHeight: 1.55 },
  inputMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12, gap: 8 },
  hint: { fontSize: 11, color: "#6f879b" },
  charCount: { fontSize: 11, color: "#6f879b", whiteSpace: "nowrap" },
  buttonRow: { display: "flex", gap: 8 },
  button: { flex: 1, padding: 16, borderRadius: 14, border: "1px solid rgba(125,211,252,0.18)", background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 55%, #7dd3fc 100%)", color: "#041018", fontWeight: 800, fontSize: 14, boxShadow: "0 0 22px rgba(56,189,248,0.26)" },
  buttonDisabled: { opacity: 0.7, cursor: "default", boxShadow: "none" },
  resetButton: { padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(125,211,252,0.12)", background: "rgba(255,255,255,0.03)", fontWeight: 700, fontSize: 14, color: "#d6e6f5" },
  resetButtonDisabled: { opacity: 0.7, cursor: "default" },
  privacyNote: { marginTop: 12, fontSize: 11, color: "#6f879b" },
  errorCard: { background: "rgba(127,29,29,0.18)", color: "#fecaca", padding: 12, borderRadius: 14, marginBottom: 12, fontSize: 13, border: "1px solid rgba(248,113,113,0.22)" },
  card: { background: "rgba(255,255,255,0.045)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", padding: 16, borderRadius: 20, marginBottom: 12, border: "1px solid rgba(125,211,252,0.1)", boxShadow: "0 12px 28px rgba(0,0,0,0.3)" },
  dailySubtext: { marginTop: 3, fontSize: 11, color: "#6f879b" },
  dailyList: { display: "flex", flexDirection: "column", gap: 10 },
  dailyItem: { padding: 12, borderRadius: 14, border: "1px solid rgba(125,211,252,0.12)", background: "rgba(255,255,255,0.03)" },
  dailyItemText: { color: "#e6f3ff", fontSize: 14, fontWeight: 700, marginBottom: 10, lineHeight: 1.45 },
  dailyActions: { display: "flex", gap: 7, flexWrap: "wrap" },
  dailyDoneButton: { flex: 1, minWidth: 70, border: "1px solid rgba(125,211,252,0.22)", background: "rgba(56,189,248,0.1)", color: "#bae6fd", borderRadius: 999, padding: "8px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  dailyStillButton: { flex: 1.2, minWidth: 85, border: "1px solid rgba(125,211,252,0.16)", background: "rgba(255,255,255,0.03)", color: "#dbeafe", borderRadius: 999, padding: "8px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  dailyNotTodayButton: { flex: 1, minWidth: 78, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(148,163,184,0.06)", color: "#a8bdd0", borderRadius: 999, padding: "8px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  stepFor: { marginTop: 8, fontSize: 12, color: "#8ea3b7", lineHeight: 1.5 },
  stepActions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  stepDoneButton: { border: "1px solid rgba(125,211,252,0.22)", background: "rgba(56,189,248,0.1)", color: "#bae6fd", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  calendarButton: { border: "1px solid rgba(125,211,252,0.16)", background: "rgba(255,255,255,0.03)", color: "#dbeafe", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  softHint: { color: "#8ea3b7", fontSize: 12, marginBottom: 8, lineHeight: 1.5 },
  focusCard: { background: "linear-gradient(180deg, rgba(56,189,248,0.12), rgba(255,255,255,0.045))", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", padding: 18, borderRadius: 22, marginBottom: 12, border: "1px solid rgba(125,211,252,0.22)", boxShadow: "0 16px 36px rgba(56,189,248,0.12)" },
  focusTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  focusEyebrow: { fontSize: 11, color: "#7dd3fc", fontWeight: 800, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" },
  focusTitle: { margin: 0, fontSize: 20, color: "#f8fbff", letterSpacing: "-0.02em" },
  focusTask: { padding: 18, borderRadius: 16, background: "rgba(2,6,8,0.42)", border: "1px solid rgba(125,211,252,0.18)", color: "#f8fbff", fontSize: 20, fontWeight: 800, lineHeight: 1.35, marginBottom: 12 },
  focusActions: { display: "flex", gap: 8 },
  secondaryFocusButton: { flex: 1, padding: 13, borderRadius: 13, border: "1px solid rgba(125,211,252,0.14)", background: "rgba(255,255,255,0.04)", color: "#dbeafe", fontWeight: 800, cursor: "pointer" },
  doneFocusButton: { flex: 1.4, padding: 13, borderRadius: 13, border: "1px solid rgba(125,211,252,0.2)", background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 55%, #7dd3fc 100%)", color: "#041018", fontWeight: 900, cursor: "pointer" },
  focusHint: { marginTop: 10, color: "#8ea3b7", fontSize: 12, lineHeight: 1.5 },
  smallGhostButton: { border: "1px solid rgba(125,211,252,0.14)", background: "rgba(255,255,255,0.03)", color: "#a8bdd0", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  focusButton: { border: "1px solid rgba(125,211,252,0.22)", background: "rgba(56,189,248,0.1)", color: "#bae6fd", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 },
  cardTitle: { fontSize: 15, margin: 0, color: "#f8fbff" },
  cardActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  sectionPill: { fontSize: 11, color: "#bae6fd", background: "rgba(125,211,252,0.08)", border: "1px solid rgba(125,211,252,0.18)", borderRadius: 999, padding: "4px 8px", whiteSpace: "nowrap" },
  loadingBadge: { fontSize: 11, color: "#bae6fd", background: "rgba(125,211,252,0.08)", border: "1px solid rgba(125,211,252,0.18)", borderRadius: 999, padding: "4px 8px", whiteSpace: "nowrap" },
  clearDoneButton: { border: "1px solid rgba(125,211,252,0.14)", background: "rgba(255,255,255,0.03)", color: "#a8bdd0", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  copyMenuWrap: { position: "relative" },
  copyButton: { border: "1px solid rgba(125,211,252,0.16)", background: "rgba(255,255,255,0.03)", color: "#dbeafe", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  copyMenu: { position: "absolute", top: "115%", right: 0, minWidth: 185, background: "rgba(9,15,20,0.96)", border: "1px solid rgba(125,211,252,0.14)", borderRadius: 12, boxShadow: "0 14px 28px rgba(0,0,0,0.45)", padding: 6, zIndex: 20 },
  copyItem: { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, padding: "9px 10px", fontSize: 13, color: "#dbeafe", cursor: "pointer" },
  text: { fontSize: 14, color: "#c5d4e3", margin: 0, lineHeight: 1.7 },
  stepBox: { fontSize: 15, fontWeight: 700, color: "#f8fbff", background: "rgba(125,211,252,0.05)", padding: "12px 14px", borderRadius: 12, margin: 0, border: "1px solid rgba(125,211,252,0.12)" },
  emptyState: { padding: "6px 0 2px" },
  emptyTitle: { fontSize: 14, fontWeight: 700, color: "#d6e6f5", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#8ea3b7", lineHeight: 1.6 },
  group: { marginTop: 14 },
  groupTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  groupTitle: { fontSize: 13, margin: 0, color: "#dbeafe" },
  groupCount: { minWidth: 22, height: 22, borderRadius: 999, background: "rgba(125,211,252,0.08)", color: "#bae6fd", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(125,211,252,0.14)" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  itemRow: { display: "flex", alignItems: "stretch", gap: 8 },
  itemRowDoneAnimation: { animation: "donePop 0.22s ease" },
  itemMainButton: { flex: 1, display: "flex", alignItems: "center", gap: 10, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" },
  checkCircle: { width: 32, height: 32, minWidth: 32, borderRadius: 999, border: "1px solid rgba(125,211,252,0.2)", background: "rgba(255,255,255,0.03)", color: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, marginTop: 2, transition: "all 0.2s ease" },
  checkCircleDone: { color: "#7dd3fc", border: "1px solid rgba(125,211,252,0.38)", boxShadow: "0 0 14px rgba(56,189,248,0.25)" },
  inlineCopyButton: { border: "1px solid rgba(125,211,252,0.12)", background: "rgba(255,255,255,0.03)", color: "#a8bdd0", borderRadius: 10, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  item: { flex: 1, padding: "11px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(125,211,252,0.12)", color: "#e6f3ff", fontSize: 14 },
  itemSoft: { flex: 1, padding: "11px 12px", borderRadius: 12, background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.14)", color: "#cbd5e1", fontSize: 14 },
  itemCalm: { flex: 1, padding: "11px 12px", borderRadius: 12, background: "rgba(125,211,252,0.06)", border: "1px solid rgba(125,211,252,0.18)", color: "#c6f1ff", fontSize: 14 },
  itemDoneSection: { flex: 1, padding: "11px 12px", borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(125,211,252,0.2)", color: "#a5c7df", fontSize: 14 },
  itemDone: { textDecoration: "line-through", color: "#6f879b" },
  skeletonWrap: { display: "flex", flexDirection: "column", gap: 8 },
  skeletonLine: { height: 12, borderRadius: 999, background: "linear-gradient(90deg, rgba(125,211,252,0.06) 25%, rgba(255,255,255,0.08) 50%, rgba(125,211,252,0.06) 75%)", backgroundSize: "200% 100%" },
  historySubtext: { marginTop: 3, fontSize: 11, color: "#6f879b" },
  historyList: { display: "flex", flexDirection: "column", gap: 8 },
  historyItem: { padding: 12, borderRadius: 14, border: "1px solid rgba(125,211,252,0.12)", background: "rgba(255,255,255,0.03)" },
  historyMainButton: { width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer" },
  historyDate: { fontSize: 11, color: "#6f879b", marginBottom: 5 },
  historyText: { fontSize: 13, color: "#dbeafe", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  historyActions: { display: "flex", gap: 8, marginTop: 10 },
  historyActionButton: { flex: 1, border: "1px solid rgba(125,211,252,0.14)", background: "rgba(125,211,252,0.06)", color: "#dbeafe", borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  historyDeleteButton: { flex: 1, border: "1px solid rgba(248,113,113,0.18)", background: "rgba(127,29,29,0.12)", color: "#fecaca", borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  footer: { textAlign: "center", fontSize: 11, color: "#6f879b", marginTop: 8 }
};
