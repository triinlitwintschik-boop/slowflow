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
    } catch {
      // ignore localStorage errors
    }
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
    () => result?.items?.filter((i) => i.category === "LET_GO") || [],
    [result]
  );

  const normalizedNextStep = useMemo(() => {
    return normalizeText(result?.next_step_under_5_min || "");
  }, [result]);

  const actWithoutDuplicate = useMemo(() => {
    return actRaw.filter(
      (item) => normalizeText(item.text) !== normalizedNextStep
    );
  }, [actRaw, normalizedNextStep]);

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
      setError("Please write a
