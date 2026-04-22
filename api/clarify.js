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

The input may contain:
- tasks
- worries
- reminders
- feelings
- half-finished thoughts
- mixed personal and practical notes

Your job:
1. Write a short, warm summary of what is going on.
2. Suggest ONE concrete next step that can be done in under 5 minutes.
3. Sort the remaining thoughts into categories:
   - ACT = actionable soon
   - NOT_NOW = important, but not for right now
   - LET_GO = emotional noise, self-judgment, or things better released

Important rules:
- Be gentle, calm, practical, and human.
- Do NOT say things like "The user said" or "The user mentioned".
- Do NOT repeat the full input back.
- Summary must be 1-2 short sentences.
- Next step must be realistic and specific.
- Item text must be short and clean.
- Preserve the language of the input.
- Return valid JSON only.
- Do not include markdown fences.

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
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are a calm assistant that returns only valid JSON."
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}
