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

Your job:
1. Write a short, warm summary.
2. Suggest one next step under 5 minutes.
3. Sort every clear item into categories:
   - ACT = only the most immediate practical actions
   - NOT_NOW = useful but less urgent, longer, optional, self-care, chores, errands, creative work, or better for later
   - LET_GO = emotional noise, self-judgment, or non-actionable worry

IMPORTANT PRIORITIZATION:
- Do NOT put everything into ACT.
- ACT should contain 1-3 items maximum.
- ACT should be reserved for things that reduce pressure immediately.
- Prefer communication and scheduling tasks for ACT.
- If there are appointments, bookings, calls, messages, or emails, choose those before errands or chores.
- Groceries, buying milk, cleaning, laundry, walking, exercise, reading, training, content creation, and general chores usually belong in NOT_NOW unless the user clearly says they are urgent or must happen today.
- next_step_under_5_min must be one of the ACT items when possible.
- If there is an appointment/scheduling task, it should usually be the next step.

STRONG ACT RULES:
- Appointment or scheduling tasks are ACT, regardless of language.
- Doctor, dentist, therapist, meeting, booking, reservation, appointment, calendar, or time-slot tasks should be ACT.
- Estonian examples like "arstiaeg", "pane aeg", "broneeri aeg", "lepi aeg kokku", "kohtumine", "hambaarst", "arsti juurde", and "helista arstile" should be ACT.
- Emails, messages, and calls are usually ACT unless clearly not urgent.
- Buying tickets for a specific event can be ACT if it seems time-sensitive.

LANGUAGE AND TEXT RULES:
- Return valid JSON only.
- Do not include markdown fences.
- Never drop clear tasks from the input.
- Every clear task or reminder must appear in items.
- Do not invent extra tasks.
- Do not translate item text.
- Keep task text in the same language and wording as the user wrote it when possible.
- Do not add a period, question mark, or exclamation mark at the end of next_step_under_5_min.
- Do not add a period, question mark, or exclamation mark at the end of item text.
- Do not say "the user said" or "the user mentioned".

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
      console.error("JSON parse failed. Raw model output:", raw);

      return res.status(200).json({
        summary:
          "I could not organize that clearly this time. Try again with a shorter brain dump",
        next_step_under_5_min: "Try again with a shorter brain dump",
        items: []
      });
    }

    if (
      !parsed ||
      typeof parsed.summary !== "string" ||
      typeof parsed.next_step_under_5_min !== "string" ||
      !Array.isArray(parsed.items)
    ) {
      return res.status(200).json({
        summary:
          "I could not organize that clearly this time. Try again with a shorter brain dump",
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
      "doctor",
      "dentist",
      "therapist",
      "appointment",
      "meeting",
      "book appointment",
      "schedule",
      "booking",
      "reservation",
      "reserve",
      "calendar",
      "time slot",
      "arst",
      "arsti",
      "arstile",
      "arstiaeg",
      "arsti aeg",
      "arsti juurde",
      "hambaarst",
      "hambaarsti",
      "terapeut",
      "teraapia",
      "kohtumine",
      "broneeri",
      "broneerida",
      "broneering",
      "pane aeg",
      "panna aeg",
      "lepi aeg",
      "leppida aeg",
      "aeg kokku"
    ];

    const communicationKeywords = [
      "email",
      "emails",
      "reply",
      "message",
      "messages",
      "call",
      "text",
      "sms",
      "e-mail",
      "e-mails",
      "kirjuta",
      "kirjutan",
      "vasta",
      "vastata",
      "e-kiri",
      "e-kirjad",
      "e-kirjadele",
      "meil",
      "meilid",
      "sõnum",
      "sõnumid",
      "helista",
      "kõne"
    ];

    const ticketKeywords = [
      "ticket",
      "tickets",
      "buy ticket",
      "buy tickets",
      "osta pilet",
      "osta piletid",
      "kinopilet",
      "kinopiletid"
    ];

    const notNowKeywords = [
      "milk",
      "groceries",
      "grocery",
      "clean",
      "laundry",
      "walk",
      "exercise",
      "workout",
      "gym",
      "train",
      "read",
      "reading",
      "video",
      "tiktok",
      "plan",
      "learn",
      "study",
      "meditate",
      "stretch",
      "piim",
      "piima",
      "toidupood",
      "poest",
      "osta piima",
      "korista",
      "koristada",
      "köök",
      "kööki",
      "pesu",
      "jalutama",
      "jaluta",
      "trenn",
      "trenni",
      "treeni",
      "loe",
      "lugeda",
      "raamat",
      "video",
      "tiktok",
      "planeeri",
      "õpi",
      "mediteeri",
      "venita"
    ];

    const isAppointment = (value) => includesAny(value, appointmentKeywords);
    const isCommunication = (value) => includesAny(value, communicationKeywords);
    const isTicket = (value) => includesAny(value, ticketKeywords);
    const isUsuallyNotNow = (value) => includesAny(value, notNowKeywords);

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

    cleanedItems = cleanedItems.map((item) => {
      if (item.category === "LET_GO") return item;

      if (
        isAppointment(item.text) ||
        isCommunication(item.text) ||
        isTicket(item.text)
      ) {
        return { ...item, category: "ACT" };
      }

      if (isUsuallyNotNow(item.text)) {
        return { ...item, category: "NOT_NOW" };
      }

      return item;
    });

    const scoreItem = (item) => {
      if (item.category === "LET_GO") return -100;
      if (isAppointment(item.text)) return 100;
      if (isCommunication(item.text)) return 90;
      if (isTicket(item.text)) return 80;
      if (isUsuallyNotNow(item.text)) return 10;
      return 40;
    };

    const actionableItems = cleanedItems.filter(
      (item) => item.category !== "LET_GO"
    );

    const sortedByPriority = [...actionableItems].sort(
      (a, b) => scoreItem(b) - scoreItem(a)
    );

    const actKeys = new Set(
      sortedByPriority
        .filter((item) => scoreItem(item) >= 40)
        .slice(0, 3)
        .map((item) => normalize(item.text))
    );

    cleanedItems = cleanedItems.map((item) => {
      if (item.category === "LET_GO") return item;

      if (actKeys.has(normalize(item.text))) {
        return { ...item, category: "ACT" };
      }

      return { ...item, category: "NOT_NOW" };
    });

    let actItems = cleanedItems.filter((item) => item.category === "ACT");

    if (actItems.length === 0 && actionableItems.length > 0) {
      const best = sortedByPriority[0];

      cleanedItems = cleanedItems.map((item) =>
        normalize(item.text) === normalize(best.text)
          ? { ...item, category: "ACT" }
          : item
      );

      actItems = cleanedItems.filter((item) => item.category === "ACT");
    }

    let nextStep = actItems[0]?.text || cleanText(parsed.next_step_under_5_min);

    const appointmentAct = actItems.find((item) => isAppointment(item.text));
    const communicationAct = actItems.find((item) => isCommunication(item.text));
    const ticketAct = actItems.find((item) => isTicket(item.text));

    if (appointmentAct) {
      nextStep = appointmentAct.text;
    } else if (communicationAct) {
      nextStep = communicationAct.text;
    } else if (ticketAct) {
      nextStep = ticketAct.text;
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
