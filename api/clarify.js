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

Return valid JSON only.

Your job:
1. Write a short, warm summary.
2. Suggest one next step under 5 minutes.
3. Sort every clear item into:
   - ACT
   - NOT_NOW
   - LET_GO

PRIORITY RULES:
- ACT means Do today.
- NOT_NOW means Can wait.
- LET_GO means non-actionable worry or self-judgment.
- Do NOT put everything into ACT.
- ACT should usually contain 1-3 items.
- Prefer communication, scheduling, appointments, bills, payments, deadlines, bookings, and tickets for ACT.
- Chores, reading, exercise, walking, cleaning, laundry, self-care, creative work, and general errands usually belong in NOT_NOW unless clearly urgent.

STRONG ACT EXAMPLES:
- doctor, dentist, therapist, appointment, booking, meeting, reservation
- pane arstiaeg, pane hambaarstiaeg, broneeri aeg, kohtumine
- call, email, reply, message
- helista, vasta e-kirjadele, kirjuta
- pay bills, invoice, rent, electricity
- maksa arved, tasu arve, maksa üür, elektriarve
- ticket, tickets, buy ticket
- osta pilet, osta kinopilet

TEXT RULES:
- Never drop clear tasks from the input.
- Do not invent tasks.
- Keep task text in the same language as the user wrote it.
- Do not translate item text.
- Do not add punctuation at the end of item text or next_step_under_5_min.

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
        temperature: 0.05,
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

    const openAiData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: openAiData?.error?.message || "OpenAI request failed"
      });
    }

    const raw = openAiData?.choices?.[0]?.message?.content;

    if (!raw) {
      return res.status(500).json({ error: "No response from model" });
    }

    const cleanedRaw = String(raw)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(cleanedRaw);
    } catch {
      console.error("JSON parse failed:", raw);
      return res.status(200).json({
        summary: "I could not organize that clearly this time. Try again with a shorter brain dump",
        next_step_under_5_min: "Try again with a shorter brain dump",
        items: []
      });
    }

    const cleanText = (value) =>
      String(value || "")
        .trim()
        .replace(/[.?!]+$/g, "");

    const normalize = (value) =>
      cleanText(value).toLowerCase().replace(/[,\s]+/g, " ");

    const includesAny = (value, keywords) => {
      const text = normalize(value);
      return keywords.some((keyword) => text.includes(keyword));
    };

    const appointmentKeywords = [
      "doctor", "dentist", "therapist", "appointment", "meeting", "booking",
      "reservation", "reserve", "calendar", "schedule", "time slot",
      "arst", "arsti", "arstile", "arstiaeg", "arsti aeg", "hambaarst",
      "hambaarsti", "hambaarstiaeg", "terapeut", "kohtumine", "broneeri",
      "broneerida", "broneering", "pane aeg", "panna aeg", "lepi aeg",
      "leppida aeg", "aeg kokku"
    ];

    const communicationKeywords = [
      "email", "emails", "reply", "message", "messages", "call", "text", "sms",
      "e-mail", "e-mails", "kirjuta", "vasta", "vastata", "e-kiri",
      "e-kirjad", "e-kirjadele", "meil", "meilid", "sõnum", "sõnumid",
      "helista", "kõne"
    ];

    const paymentKeywords = [
      "pay bill", "pay bills", "pay invoice", "invoice", "bill", "bills",
      "rent", "electricity", "electricity bill", "arve", "arved",
      "maksa arve", "maksa arved", "maksa", "tasu arve", "tasuda arve",
      "üür", "elekter", "elektriarve"
    ];

    const ticketKeywords = [
      "ticket", "tickets", "buy ticket", "buy tickets", "pilet", "piletid",
      "osta pilet", "osta piletid", "kinopilet", "kinopiletid"
    ];

    const usuallyWaitKeywords = [
      "clean", "laundry", "walk", "exercise", "workout", "gym", "train",
      "read", "reading", "book", "video", "tiktok", "learn", "study",
      "meditate", "stretch", "korista", "koristada", "köök", "kööki",
      "pesu", "jalutama", "jaluta", "trenn", "trenni", "treeni", "loe",
      "lugeda", "raamat", "õpi", "mediteeri", "venita"
    ];

    const isAppointment = (value) => includesAny(value, appointmentKeywords);
    const isCommunication = (value) => includesAny(value, communicationKeywords);
    const isPayment = (value) => includesAny(value, paymentKeywords);
    const isTicket = (value) => includesAny(value, ticketKeywords);
    const isUsuallyWait = (value) => includesAny(value, usuallyWaitKeywords);

    let items = Array.isArray(parsed.items)
      ? parsed.items
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
          }))
      : [];

    items = items.map((item) => {
      if (item.category === "LET_GO") return item;

      if (
        isAppointment(item.text) ||
        isCommunication(item.text) ||
        isPayment(item.text) ||
        isTicket(item.text)
      ) {
        return { ...item, category: "ACT" };
      }

      if (isUsuallyWait(item.text)) {
        return { ...item, category: "NOT_NOW" };
      }

      return item;
    });

    const scoreItem = (item) => {
      if (item.category === "LET_GO") return -100;
      if (isAppointment(item.text)) return 100;
      if (isCommunication(item.text)) return 95;
      if (isPayment(item.text)) return 90;
      if (isTicket(item.text)) return 85;
      if (isUsuallyWait(item.text)) return 10;
      return 40;
    };

    const actionable = items.filter((item) => item.category !== "LET_GO");
    const sorted = [...actionable].sort((a, b) => scoreItem(b) - scoreItem(a));

    const actKeys = new Set(
      sorted
        .filter((item) => scoreItem(item) >= 40)
        .slice(0, 3)
        .map((item) => normalize(item.text))
    );

    items = items.map((item) => {
      if (item.category === "LET_GO") return item;

      if (actKeys.has(normalize(item.text))) {
        return { ...item, category: "ACT" };
      }

      return { ...item, category: "NOT_NOW" };
    });

    let actItems = items.filter((item) => item.category === "ACT");

    if (actItems.length === 0 && sorted.length > 0) {
      const best = sorted[0];
      items = items.map((item) =>
        normalize(item.text) === normalize(best.text)
          ? { ...item, category: "ACT" }
          : item
      );
      actItems = items.filter((item) => item.category === "ACT");
    }

    let nextStep = actItems[0]?.text || cleanText(parsed.next_step_under_5_min);

    const appointmentAct = actItems.find((item) => isAppointment(item.text));
    const communicationAct = actItems.find((item) => isCommunication(item.text));
    const paymentAct = actItems.find((item) => isPayment(item.text));
    const ticketAct = actItems.find((item) => isTicket(item.text));

    if (appointmentAct) nextStep = appointmentAct.text;
    else if (communicationAct) nextStep = communicationAct.text;
    else if (paymentAct) nextStep = paymentAct.text;
    else if (ticketAct) nextStep = ticketAct.text;

    const seen = new Set();

    items = items.filter((item) => {
      const key = `${normalize(item.text)}::${item.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.status(200).json({
      summary: cleanText(parsed.summary || ""),
      next_step_under_5_min: cleanText(nextStep),
      items
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}
