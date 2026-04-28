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

The user may write:
- tasks
- worries
- emotions
- reminders
- vague thoughts

Your job:
1. Write a short, warm summary.
2. Suggest one next step under 5 minutes.
3. Sort everything else:

ACT = do now  
NOT_NOW = later  
LET_GO = emotional noise  

RULES:
- NEVER drop tasks from input
- EVERY task must appear in items
- If unsure → ACT
- Calls/messages/errands → ACT
- Do NOT invent tasks
- Reuse existing tasks for next step

Return JSON only:
{
  "summary": "string",
  "next_step_under_5_min": "string",
  "items": [{ "text": "string", "category": "ACT" | "NOT_NOW" | "LET_GO" }]
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
            content:
              "You return ONLY valid JSON. No explanations."
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

console.log("RAW MODEL RESPONSE:", raw);

    if (!raw) {
      return res.status(500).json({ error: "No response from model" });
    }

    return res.status(200).json({
  DEBUG_RAW: raw
});

    const normalize = (str) =>
      String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[.?!,]/g, "");

    let items = parsed.items
      .filter(
        (i) =>
          i &&
          typeof i.text === "string" &&
          ["ACT", "NOT_NOW", "LET_GO"].includes(i.category)
      )
      .map((i) => ({
        text: i.text.trim(),
        category: i.category
      }));

    let nextStep = parsed.next_step_under_5_min?.trim() || "";

    // 🔥 FIX: ensure next step ALWAYS in ACT
    const normalizedNext = normalize(nextStep);

    const exists = items.some(
      (i) => normalize(i.text) === normalizedNext
    );

    if (!exists && nextStep) {
      items.unshift({
        text: nextStep,
        category: "ACT"
      });
    } else {
      items = items.map((i) => {
        if (normalize(i.text) === normalizedNext) {
          return { ...i, category: "ACT" };
        }
        return i;
      });
    }

    // fallback if AI gives no next step
    if (!nextStep) {
      const firstAct = items.find((i) => i.category === "ACT");
      if (firstAct) nextStep = firstAct.text;
    }

    // remove duplicates
    const seen = new Set();
    items = items.filter((i) => {
      const key = normalize(i.text) + i.category;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.status(200).json({
      summary: parsed.summary || "",
      next_step_under_5_min: nextStep,
      items
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Something went wrong"
    });
  }
}
