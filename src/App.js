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

  useEffect(() => {
    try {
      localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(doneItems));
    } catch {}
  }, [doneItems]);

  const actRaw = useMemo(
    () => result?.items?.filter((i) => i.category === "ACT") || [],
    [result]
  );

  const notNowRaw = useMemo(
    () => result?.items?.filter((i) => i.category === "NOT_NOW") || [],
    [result]
  );

  const letGoRaw = useMemo(
    () => result?.items?.filter((i) => i
