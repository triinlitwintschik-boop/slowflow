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

    const splitInputIntoTasks = (value) =>
      String(value)
        .split(/,|\n|;/g)
        .map((item) => cleanText(item))
        .filter(Boolean);

    const originalTasks = splitInputIntoTasks(input);

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

    const waitKeywords = [
      "clean", "laundry", "walk", "exercise", "workout", "gym", "train",
      "read", "reading", "book", "video", "tiktok", "learn", "study",
      "meditate", "stretch", "korista", "koristada", "köök", "kööki",
      "pesu", "jalutama", "jaluta", "trenn", "trenni", "treeni", "loe",
      "lugeda", "raamat", "õpi", "mediteeri", "venita"
    ];

    const letGoKeywords = [
      "worry", "stress", "guilt", "ashamed", "overwhelmed", "anxious",
      "mure", "muretsen", "stress", "süü", "süümekad", "häbi",
      "olen halb", "ei jaksa", "kardan", "ärev", "ärevus"
    ];

    const abstractKeywords = [
      "don't know", "dont know", "i do not know", "lost", "confused", "stuck",
      "overwhelmed", "too much", "no idea", "ei tea", "segaduses",
      "ei saa aru", "kinni jooksnud", "pea on tühi", "liiga palju"
    ];

    const isAppointment = (value) => includesAny(value, appointmentKeywords);
    const isCommunication = (value) => includesAny(value, communicationKeywords);
    const isPayment = (value) => includesAny(value, paymentKeywords);
    const isTicket = (value) => includesAny(value, ticketKeywords);
    const isWait = (value) => includesAny(value, waitKeywords);
    const isLetGo = (value) => includesAny(value, letGoKeywords);
    const isAbstract = includesAny(input, abstractKeywords);

    const hasSeparators = /,|\n|;/.test(input);
    const hasStrongTaskSignal =
      isAppointment(input) ||
      isCommunication(input) ||
      isPayment(input) ||
      isTicket(input) ||
      isWait(input);

    const looksLikeTaskList =
      hasSeparators || originalTasks.length > 1 || hasStrongTaskSignal;

    const prompt = `
You organize a messy brain dump into calm clarity.

Return valid JSON only.

Language rule:
- Respond in the same language as the user input when clear.
- If the language is unclear, respond in English.
- Do not respond in a random third language.

Rules:
- Write a short warm summary.
- Suggest one next step.
- Do not invent tasks.
- Do not translate tasks.
- Do not add punctuation at the end.

Input:
"""${input}"""

Return exactly:
{
  "summary": "string",
  "next_step_under_5_min": "string"
}
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

    const raw = openAiData?.choices?.[0]?.message?.content || "";

    let parsed = {
      summary:
        "You have a few things on your mind. Let’s pick what needs attention first",
      next_step_under_5_min: ""
    };

    try {
      parsed = JSON.parse(
        String(raw).replace(/```json/gi, "").replace(/```/g, "").trim()
      );
    } catch {
      console.error("JSON parse failed:", raw);
    }

    if (isAbstract && !looksLikeTaskList) {
      return res.status(200).json({
        summary: cleanText(parsed.summary) ||
          "It sounds like you’re feeling stuck or unsure. That’s okay — you don’t need to figure everything out at once",
        next_step_under_5_min:
          "Write down 3 small things that might need your attention",
        items: []
      });
    }

    const scoreTask = (text) => {
      if (isLetGo(text)) return -100;
      if (isAppointment(text)) return 100;
      if (isCommunication(text)) return 95;
      if (isPayment(text)) return 90;
      if (isTicket(text)) return 85;
      if (isWait(text)) return 10;
      return 40;
    };

    const sortedTasks = [...originalTasks].sort(
      (a, b) => scoreTask(b) - scoreTask(a)
    );

    const actTasks = sortedTasks
      .filter((task) => scoreTask(task) >= 40)
      .slice(0, 3);

    const actKeys = new Set(actTasks.map((task) => normalize(task)));

    const items = originalTasks
      .map((task) => {
        if (isLetGo(task) && !hasStrongTaskSignal) {
          return { text: task, category: "LET_GO" };
        }

        if (actKeys.has(normalize(task))) {
          return { text: task, category: "ACT" };
        }

        return { text: task, category: "NOT_NOW" };
      })
      .filter((item) => item.text && item.text !== "LET_GO");

    const finalActItems = items.filter((item) => item.category === "ACT");

    let nextStep =
      finalActItems.find((item) => isAppointment(item.text))?.text ||
      finalActItems.find((item) => isCommunication(item.text))?.text ||
      finalActItems.find((item) => isPayment(item.text))?.text ||
      finalActItems.find((item) => isTicket(item.text))?.text ||
      finalActItems[0]?.text ||
      cleanText(parsed.next_step_under_5_min) ||
      originalTasks[0] ||
      "";

    return res.status(200).json({
      summary: cleanText(parsed.summary),
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
