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

    const prompt = `
You organize a messy brain dump into calm, useful clarity.

The user may write:
- tasks
- worries
- emotions
- reminders
- vague thoughts
- mixed personal and practical notes

Your job:
1. Write a short, warm summary of what is going on.
2. Suggest one concrete next step that can be done in under 5 minutes.
3. Sort the rest into categories:
   - ACT = do soon / actionable
   - NOT_NOW = important but not for right now
   - LET_GO = emotional noise, self-judgment, or things better released

IMPORTANT NEXT STEP RULES:
- If the user already listed a simple actionable task (like "buy milk", "call someone", "send email"),
  reuse one of those as the next step instead of inventing a new one.
- Do NOT create extra planning steps if a direct action already exists.
- Prefer the simplest real-world action from the list.

STYLE RULES:
- Be gentle, calm, and practical.
- Sound human, not robotic.
- Do NOT write things like "The user mentioned" or "The user said".
- Do NOT repeat the whole input back.
- Keep the summary to 1-2 sentences max.
- The next step must be specific and realistic.
- Item text must be short and clean.
- Preserve the language of the user's input.
- Do NOT over-optimize or add planning steps.
- Prefer direct action over preparation.
- Return valid JSON only.

Categorization rules:
- ACT: concrete tasks the user can physically do or start soon.
- NOT_NOW: tasks that clearly depend on another time, deadline, waiting, or future context.
- LET_GO: emotions, worries, self-judgment, or things that are not actionable.
- If unsure between ACT and NOT_NOW, choose ACT.
- Calls, messages, errands, household tasks, and simple admin tasks should usually be ACT unless the user says they are for later.
- If a clear simple task already exists (like "buy milk"), do NOT create a new abstraction.
- Prefer selecting or slightly refining an existing task instead of inventing a new one.
- Do not drop actionable items from the input.
- Every clear task/reminder from the brain dump must appear in items.
- If the input says “call Kersti”, it must appear as an item.
- Do not merge separate tasks into the summary only.

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
"""${String(brainDump).trim()}"""
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a calm thinking assistant that returns only valid JSON."
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

    const cleanedItems = parsed.items
      .filter(
        (item) =>
          item &&
          typeof item.text === "string" &&
          ["ACT", "NOT_NOW", "LET_GO"].includes(item.category)
      )
      .map((item) => ({
        text: item.text.trim(),
        category: item.category
      }));

    // 🔥 SMART FIX: kui next step pole ACT listis → võta esimene ACT item
    const normalized = (v) =>
      String(v || "")
        .toLowerCase()
        .trim()
        .replace(/[.?!,]+$/, "");

    const actItems = cleanedItems.filter((i) => i.category === "ACT");

    let nextStep = parsed.next_step_under_5_min.trim();

    const existsInAct = actItems.some(
      (item) => normalized(item.text) === normalized(nextStep)
    );

    if (!existsInAct && actItems.length > 0) {
      nextStep = actItems[0].text;
    }

    const cleaned = {
      summary: parsed.summary.trim(),
      next_step_under_5_min: nextStep,
      items: cleanedItems
    };

    return res.status(200).json(cleaned);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}
