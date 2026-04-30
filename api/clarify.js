export default async function handler(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    // === AI CALL ===
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a calm, helpful assistant that organizes messy thoughts into simple actions.

IMPORTANT:
- Detect the language of the user input and respond in the SAME language.
- Keep wording natural in that language.

Return JSON only.

Structure:
{
  "summary": "short calming summary",
  "nextStep": "one very small action",
  "tasks": [
    { "text": "...", "category": "ACT" | "LATER" }
  ]
}

Rules:
- "ACT" = important OR time-sensitive OR mental load reducing
- "LATER" = can wait, low urgency

STRONG ACT RULES:
- Appointments, bookings, deadlines → ACT
- Communication (calls, emails, messages) → ACT
- Tickets, reservations → ACT
- Payment and bills → ACT

Examples:
- "pane arsti aeg" → ACT
- "helista emale" → ACT
- "osta kinopilet" → ACT
- "maksa arved" → ACT

Keep nextStep simple and under 5 minutes if possible.
No punctuation at the end of nextStep.
`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    let parsed;

    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    // === PRIORITIZATION LOGIC ===

    const includesAny = (text, keywords) => {
      const lower = text.toLowerCase();
      return keywords.some((k) => lower.includes(k));
    };

    const appointmentKeywords = [
      "appointment",
      "book",
      "schedule",
      "doctor",
      "dentist",
      "meeting",
      "reserve",
      "pane aeg",
      "broneeri",
      "arsti aeg",
      "hambaarst",
    ];

    const communicationKeywords = [
      "call",
      "email",
      "reply",
      "text",
      "message",
      "helista",
      "kirjuta",
      "vasta",
      "sõnum",
    ];

    const ticketKeywords = [
      "ticket",
      "tickets",
      "book ticket",
      "reservation",
      "pilet",
      "kinopilet",
    ];

    const paymentKeywords = [
      "pay",
      "bill",
      "bills",
      "invoice",
      "rent",
      "electricity",
      "arve",
      "arved",
      "maksa",
      "tasu",
      "üür",
      "elekter",
    ];

    const isAppointment = (t) => includesAny(t, appointmentKeywords);
    const isCommunication = (t) => includesAny(t, communicationKeywords);
    const isTicket = (t) => includesAny(t, ticketKeywords);
    const isPayment = (t) => includesAny(t, paymentKeywords);

    // Score fallback (kui AI eksib)
    const scoreItem = (text) => {
      if (isAppointment(text)) return 100;
      if (isCommunication(text)) return 95;
      if (isTicket(text)) return 90;
      if (isPayment(text)) return 85;

      if (text.includes("clean") || text.includes("korista")) return 40;
      if (text.includes("walk") || text.includes("jaluta")) return 30;

      return 50;
    };

    const tasks = parsed.tasks.map((item) => {
      if (
        isAppointment(item.text) ||
        isCommunication(item.text) ||
        isTicket(item.text) ||
        isPayment(item.text)
      ) {
        return { ...item, category: "ACT" };
      }

      const score = scoreItem(item.text);
      return {
        ...item,
        category: score >= 70 ? "ACT" : "LATER",
      };
    });

    // === CLEAN NEXT STEP (remove dot if exists) ===
    const cleanNextStep = parsed.nextStep.replace(/\.$/, "");

    return res.status(200).json({
      summary: parsed.summary,
      nextStep: cleanNextStep,
      tasks,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
