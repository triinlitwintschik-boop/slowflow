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
   - ACT = the most immediate practical actions
   - NOT_NOW = useful but less urgent, longer, creative, optional, self-care, chores, or better for later
   - LET_GO = emotional noise, self-judgment, or non-actionable worry

CORE PRIORITIZATION RULES:
- Do NOT put everything into ACT.
- ACT should usually contain 1-3 items.
- If many tasks seem urgent, choose only the most impactful 1-3.
- Use ACT for tasks that are time-sensitive, unblock something, require another person, or are quick practical obligations.
- Use NOT_NOW for longer tasks, optional tasks, creative work, self-care, chores, exercise, reading, learning, planning, and general “nice to do” items.
- Use LET_GO only for worries, guilt, self-criticism, vague pressure, or things that are not actionable.

STRONG ACT RULES:
- Emails, messages, and calls are usually ACT unless clearly not urgent.
- Appointment or scheduling tasks are usually ACT, regardless of language.
- Doctor, dentist, therapist, meeting, booking, reservation, appointment, calendar, or time-slot tasks should be ACT.
- Estonian examples like "arstiaeg", "pane aeg", "broneeri aeg", "lepi aeg kokku", "kohtumine", "hambaarst", "arsti juurde", and "helista arstile" should be ACT.
- Buying tickets for a specific event can be ACT if it seems time-sensitive.
- next_step_under_5_min must be one of the ACT items when possible.

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
        temperature: 0.1,
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
    } catch (error) {
      console.error("JSON parse failed. Raw model output:", raw);

      return res.status(200).json({
        summary: "I could not organize that clearly this time. Try again with a shorter brain dump",
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

    const isAppointmentOrScheduling = (value) => {
      const text = normalize(value);

      const keywords = [
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
        "buy ticket",
        "buy tickets",
        "tickets",
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
        "aeg kokku",
        "osta pilet",
        "osta piletid",
        "kinopilet",
        "kinopiletid",
        "helista arstile",
        "helista hambaarstile"
      ];

      return keywords.some((keyword) => text.includes(keyword));
    };

    const isCommunication = (value) => {
      const text = normalize(value);

      const keywords = [
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

      return keywords.some((keyword) => text.includes(keyword));
    };

    const isUsuallyNotNow = (value) => {
      const text = normalize(value);

      const keywords = [
        "walk",
        "exercise",
        "workout",
        "gym",
        "train",
        "read",
        "reading",
        "clean",
        "laundry",
        "video",
        "tiktok",
        "plan",
        "learn",
        "study",
        "meditate",
        "stretch",
        "jalutama",
        "jaluta",
        "trenn",
        "trenni",
        "treeni",
        "loe",
        "lugeda",
        "raamat",
        "korista",
        "koristada",
        "pesu",
        "video",
        "tiktok",
        "planeeri",
        "õpi",
        "mediteeri",
        "venita"
      ];

      return keywords.some((keyword) => text.includes(keyword));
    };

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

      if (isAppointmentOrScheduling(item.text) || isCommunication(item.text)) {
        return { ...item, category: "ACT" };
      }

      if (isUsuallyNotNow(item.text)) {
        return { ...item, category: "NOT_NOW" };
      }

      return item;
    });

    let actItems = cleanedItems.filter((item) => item.category === "ACT");

    if (actItems.length > 3) {
      const protectedItems = actItems.filter(
        (item) =>
          isAppointmentOrScheduling(item.text) || isCommunication(item.text)
      );

      const normalActItems = actItems.filter(
        (item) =>
          !isAppointmentOrScheduling(item.text) && !isCommunication(item.text)
      );

      const keepActKeys = new Set(
        [...protectedItems, ...normalActItems]
          .slice(0, 3)
          .map((item) => normalize(item.text))
      );

      cleanedItems = cleanedItems.map((item) => {
        if (item.category !== "ACT") return item;

        if (keepActKeys.has(normalize(item.text))) {
          return item;
        }

        return { ...item, category: "NOT_NOW" };
      });
    }

    actItems = cleanedItems.filter((item) => item.category === "ACT");

    if (actItems.length === 0 && cleanedItems.length > 0) {
      const firstActionable = cleanedItems.find(
        (item) => item.category !== "LET_GO"
      );

      if (firstActionable) {
        cleanedItems = cleanedItems.map((item) =>
          normalize(item.text) === normalize(firstActionable.text)
            ? { ...item, category: "ACT" }
            : item
        );
      }
    }

    actItems = cleanedItems.filter((item) => item.category === "ACT");

    let nextStep = cleanText(parsed.next_step_under_5_min);

    if (!nextStep && actItems.length > 0) {
      nextStep = actItems[0].text;
    }

    const normalizedNext = normalize(nextStep);

    if (normalizedNext) {
      const matchingItem = cleanedItems.find(
        (item) => normalize(item.text) === normalizedNext
      );

      if (matchingItem && matchingItem.category !== "ACT") {
        const actCount = cleanedItems.filter((item) => item.category === "ACT")
          .length;

        if (
          actCount < 3 ||
          isAppointmentOrScheduling(matchingItem.text) ||
          isCommunication(matchingItem.text)
        ) {
          cleanedItems = cleanedItems.map((item) =>
            normalize(item.text) === normalizedNext
              ? { ...item, category: "ACT" }
              : item
          );
        }
      }

      if (!matchingItem) {
        const actCount = cleanedItems.filter((item) => item.category === "ACT")
          .length;

        if (
          actCount < 3 ||
          isAppointmentOrScheduling(nextStep) ||
          isCommunication(nextStep)
        ) {
          cleanedItems.unshift({
            text: nextStep,
            category: "ACT"
          });
        }
      }
    }

    actItems = cleanedItems.filter((item) => item.category === "ACT");

    if (!actItems.some((item) => normalize(item.text) === normalize(nextStep))) {
      nextStep = actItems[0]?.text || nextStep;
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
