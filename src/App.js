let parsed;

try {
  parsed = JSON.parse(raw);
} catch (err) {
  return res.status(500).json({
    error: "Model did not return valid JSON",
    raw
  });
}

if (
  !parsed ||
  typeof parsed.summary !== "string" ||
  typeof parsed.next_step_under_5_min !== "string" ||
  !Array.isArray(parsed.items)
) {
  return res.status(500).json({
    error: "Model returned JSON in unexpected format",
    raw: parsed
  });
}

const cleaned = {
  summary: parsed.summary.trim(),
  next_step_under_5_min: parsed.next_step_under_5_min.trim(),
  items: parsed.items
    .filter(
      (item) =>
        item &&
        typeof item.text === "string" &&
        ["ACT", "NOT_NOW", "LET_GO"].includes(item.category)
    )
    .map((item) => ({
      text: item.text.trim(),
      category: item.category
    }))
};

return res.status(200).json(cleaned);
