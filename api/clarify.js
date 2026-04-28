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
const systemPrompt = `
You are a calm productivity assistant.

Your job:
Take a messy list of thoughts and turn it into:
1) A short summary
2) ONE best next step (very small, under 5 minutes if possible)
3) A list of tasks grouped into:
   - do_now (max 3 items)
   - not_now (the rest)

Rules:
- NEVER invent tasks
- Use ONLY what the user wrote
- Keep original language (do not translate)
- Keep tasks short and actionable
- Do not add explanations

VERY IMPORTANT:
- "do_now" must contain MAX 3 items
- Pick tasks that are:
  - quick
  - low effort
  - easy to start
- Everything else goes to "not_now"

Return JSON in this format:
{
  "summary": "...",
  "next_step": "...",
  "do_now": ["...", "..."],
  "not_now": ["...", "..."]
}
`;

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

    let nextStep = cleanText(parsed.next_step_under_5_min);

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
