export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { brainDump } = req.body || {};

    if (!brainDump || !String(brainDump).trim()) {
      return res.status(400).json({ error: "Missing brainDump" });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const input = String(brainDump).trim();

    const prompt = `
You organize a messy brain dump into calm, useful clarity.

Your job:
1. Write a short, warm summary.
2. Suggest one next step under 5 minutes.
3. Sort every clear item into categories:
   - ACT = the most immediate practical actions
   - NOT_NOW = useful but less urgent, longer, creative, optional, or better for later
   - LET_GO = emotional noise, self-judgment, or non-actionable worry

RULES:
- Return valid JSON only.
- Do not include markdown fences.
- Never drop clear tasks from the input.
- Every clear task or reminder must appear in items.
- Do not invent extra tasks.
- Do not translate item text.
- Keep task text in the same language and wording as the user wrote it when possible.
- Do not add a period, question mark, or exclamation mark at the end of next_step_under_5_min.
- Do not add a period, question mark, or exclamation mark at the end of item text.
- Do not say "the user said" or "the user mentioned".
- ACT must contain maximum 3 items.
- If there are more than 3 actionable tasks, put only the 1-3 most immediate, simple, practical tasks in ACT.
- Put the rest of the actionable tasks into NOT_NOW.
- Creative tasks, reading, learning, training, planning, content creation, and optional self-improvement usually belong in NOT_NOW unless the user clearly says they must be done now.
- Household chores, errands, messages, calls, and emails can be ACT if they are simple and immediate.
- next_step_under_5_min must be one of the ACT items when possible.

Return exactly this JSON shape:
{
  "summary": "string",
  "next_step_under_5_min": "string",
  "items": [
    {
      "text": "string",
      "category": "ACT" | "NOT_NOW" | "LET_GO"
    }
  ]
}

Brain dump:
"""${input}"""
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.15,
        messages: [
          {
            role: "system",
            content: "You return only valid JSON. No explanations."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed"
      });
    }

    const raw = data?.choices?.[0]?.message?.content;

    if (!raw) {
      return res.status(500).json({ error: "No response from model" });
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
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

    const cleanText = (value) =>
      String(value || "")
        .trim()
        .replace(/[.?!]+$/g, "");

    const normalize = (value) =>
      cleanText(value).toLowerCase().replace(/[,\s]+/g, " ");

    let cleanedItems = parsed.items
      .filter(
        (item) =>
          item &&
          typeof item.text === "string" &&
          item.text.trim() &&
          ["ACT", "NOT_NOW", "LET_GO"].includes(item.category)
      )
      .map((item) => ({
        text: cleanText(item.text),
        category: item.category
      }));

    let actItems = cleanedItems.filter((item) => item.category === "ACT");
    const overflowActItems = actItems.slice(3);

    if (overflowActItems.length > 0) {
      const overflowSet = new Set(overflowActItems.map((item) => normalize(item.text)));

      cleanedItems = cleanedItems.map((item) => {
        if (item.category === "ACT" && overflowSet.has(normalize(item.text))) {
          return { ...item, category: "NOT_NOW" };
        }

        return item;
      });
    }

    let nextStep = cleanText(parsed.next_step_under_5_min);

    actItems = cleanedItems.filter((item) => item.category === "ACT");

    if (!nextStep && actItems.length > 0) {
      nextStep = actItems[0].text;
    }

    const normalizedNext = normalize(nextStep);

    if (normalizedNext) {
      const matchingItem = cleanedItems.find(
        (item) => normalize(item.text) === normalizedNext
      );

      if (matchingItem && matchingItem.category !== "ACT" && actItems.length < 3) {
        cleanedItems = cleanedItems.map((item) =>
          normalize(item.text) === normalizedNext
            ? { ...item, category: "ACT" }
            : item
        );
      }

      if (!matchingItem && actItems.length < 3) {
        cleanedItems.unshift({
          text: nextStep,
          category: "ACT"
        });
      }

      actItems = cleanedItems.filter((item) => item.category === "ACT");

      if (!actItems.some((item) => normalize(item.text) === normalizedNext)) {
        nextStep = actItems[0]?.text || nextStep;
      }
    }

    const seen = new Set();

    cleanedItems = cleanedItems.filter((item) => {
      const key = `${normalize(item.text)}::${item.category}`;

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    return res.status(200).json({
      summary: cleanText(parsed.summary),
      next_step_under_5_min: cleanText(nextStep),
      items: cleanedItems
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}
