export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { brainDump } = req.body || {};

    if (!brainDump || !String(brainDump).trim()) {
      return res.status(400).json({ error: "Missing brainDump" });
    }

    const webhookUrl = process.env.MAKE_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(500).json({ error: "Missing MAKE_WEBHOOK_URL" });
    }

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

    try {
      const json = JSON.parse(rawText);
      return res.status(200).json(json);
    } catch (parseError) {
      return res.status(502).json({
        error: "Make did not return valid JSON",
        details: rawText
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unexpected server error"
    });
  }
}
