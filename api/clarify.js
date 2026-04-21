export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { brainDump } = req.body || {};

    if (!brainDump || !String(brainDump).trim()) {
      return res.status(400).json({ error: "Missing brainDump" });
    }

    const webhookUrl =
      "https://hook.eu1.make.com/2bqwckw10kfqiuv4j6w9r1rhrkyp47ac";

    const makeResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        brainDump: String(brainDump).trim()
      })
    });

    const rawText = await makeResponse.text();

    if (!makeResponse.ok) {
      return res.status(makeResponse.status).json({
        error: `Make request failed: ${makeResponse.status}`,
        details: rawText
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        error: "Make did not return valid JSON",
        raw: rawText
      });
    }

    if (
      !parsed ||
      typeof parsed.summary !== "string" ||
      typeof parsed.next_step_under_5_min !== "string" ||
      !Array.isArray(parsed.items)
    ) {
      return res.status(500).json({
        error: "Unexpected response format from Make",
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
