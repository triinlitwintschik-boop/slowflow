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
   - ACT = do now / actionable soon
   - NOT_NOW = later / important but not now
   - LET_GO = emotional noise / self-judgment / non-actionable worry

RULES:
- Return valid JSON only.
- Do not include markdown fences.
- Never drop clear tasks from the input.
- Every clear task or reminder must appear in items.
- If unsure between ACT and NOT_NOW, choose ACT.
- Calls, messages, errands, household tasks, and simple admin tasks should usually be ACT.
- Do not invent extra planning steps.
- If the user already gave a simple task, reuse one as the next step.
- Preserve the language of the user's input.
- Do not say "the user said" or "the user mentioned".

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
        temperature: 0.2,
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

    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[.?!,]+$/g, "");

    let cleanedItems = parsed.items
      .filter(
        (item) =>
          item &&
          typeof item.text === "string" &&
          item.text.trim() &&
          ["ACT", "NOT_NOW", "LET_GO"].includes(item.category)
      )
      .map((item) => ({
        text: item.text.trim(),
        category: item.category
      }));

    let nextStep = parsed.next_step_under_5_min.trim();

    if (!nextStep) {
      const firstAct = cleanedItems.find((item) => item.category === "ACT");
      if (firstAct) nextStep = firstAct.text;
    }

    const normalizedNext = normalize(nextStep);

    if (normalizedNext) {
      const existsAnywhere = cleanedItems.some(
        (item) => normalize(item.text) === normalizedNext
      );

      if (!existsAnywhere) {
        cleanedItems.unshift({
          text: nextStep,
          category: "ACT"
        });
      } else {
        cleanedItems = cleanedItems.map((item) =>
          normalize(item.text) === normalizedNext
            ? { ...item, category: "ACT" }
            : item
        );
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
      summary: parsed.summary.trim(),
      next_step_under_5_min: nextStep,
      items: cleanedItems
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}
