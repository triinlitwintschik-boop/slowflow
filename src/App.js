const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const memoryStore = global.rateLimitStore || new Map();
global.rateLimitStore = memoryStore;

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = memoryStore.get(ip);

  if (!entry) {
    memoryStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return false;
  }

  if (now > entry.resetAt) {
    memoryStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count += 1;
  memoryStore.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientIp = getClientIp(req);

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: "Too many requests. Please wait a minute and try again."
    });
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
    } catch {
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
