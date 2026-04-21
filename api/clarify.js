export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { brainDump } = req.body || {};

    if (!brainDump || !String(brainDump).trim()) {
      return res.status(400).json({ error: "Missing brainDump" });
    }

    const input = String(brainDump).trim();

    // -----------------------------
    // 1. TRY MAKE WEBHOOK
    // -----------------------------
    try {
      const makeRes = await fetch(
        "https://hook.eu1.make.com/2bqwckw10kfqiuv4j6w9r1rhrkyp47ac",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ brainDump: input })
        }
      );

      const text = await makeRes.text();

      if (makeRes.ok) {
        let parsed;

        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("Make returned invalid JSON");
        }

        let payload = parsed;

        if (Array.isArray(payload)) payload = payload[0];
        if (payload?.data) payload = payload.data;

        if (
          payload &&
          typeof payload.summary === "string" &&
          typeof payload.next_step_under_5_min === "string" &&
          Array.isArray(payload.items)
        ) {
          return res.status(200).json({
            summary: payload.summary.trim(),
            next_step_under_5_min:
              payload.next_step_under_5_min.trim(),
            items: payload.items.map((i) => ({
              text: i.text.trim(),
              category: i.category
            }))
          });
        }
      }

      throw new Error("Make response unusable");
    } catch (makeError) {
      console.warn("⚠️ Make failed, using fallback:", makeError.message);
    }

    // -----------------------------
    // 2. FALLBACK → OPENAI
    // -----------------------------
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY AND Make failed"
      });
    }

    const prompt = `
You organize a messy brain dump into calm, useful clarity.

Your job:
1. Write a short, warm summary
2. Suggest ONE step under 5 minutes
3. Sort into:
   ACT / NOT_NOW / LET_GO

Rules:
- Calm, human tone
- No "the user said"
- Keep it short
- Return ONLY JSON

Format:
{
  "summary": "string",
  "next_step_under_5_min": "string",
  "items": [
    { "text": "string", "category": "ACT" | "NOT_NOW" | "LET_GO" }
  ]
}

Brain dump:
"""${input}"""
`;

    const aiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.5,
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
      }
    );

    const aiData = await aiRes.json();

    if (!aiRes.ok) {
      return res.status(aiRes.status).json({
        error: aiData?.error?.message || "OpenAI failed"
      });
    }

    const raw = aiData?.choices?.[0]?.message?.content;

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "Fallback AI returned invalid JSON",
        raw
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Something went wrong"
    });
  }
}
