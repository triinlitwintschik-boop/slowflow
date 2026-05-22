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

    const escapeRegExp = (value) =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const includesKeyword = (value, keyword) => {
      const text = normalize(value);
      const key = normalize(keyword);

      if (!key) return false;

      if (key.includes(" ")) {
        return text.includes(key);
      }

      const pattern = new RegExp(`(^|\\s)${escapeRegExp(key)}($|\\s)`, "i");
      return pattern.test(text);
    };

    const includesAny = (value, keywords) =>
      keywords.some((keyword) => includesKeyword(value, keyword));

    const splitInputIntoTasks = (value) =>
      String(value)
        .split(/,|\n|;/g)
        .map((item) => cleanText(item))
        .filter(Boolean);

    const originalTasks = splitInputIntoTasks(input);

    const isEstonianInput = (value) => {
      const text = normalize(value);
      return (
        /[õäöü]/i.test(value) ||
        [
          "ma", "mul", "mulle", "minu", "ei", "ja", "vaja", "pean",
          "arst", "arve", "korista", "jaluta", "trenn", "pilet", "helista",
          "kirjuta", "vasta", "pesu", "õue", "koer", "kass", "lemmikloom",
          "täna", "õhtuks", "homseks", "restoran", "broneeri", "osta",
          "maksa", "tee", "mine", "loe", "õpi", "sõbranna", "lae",
          "väsinud", "läbi", "kurnatud", "paanikas", "ärev"
        ].some((word) => includesKeyword(text, word))
      );
    };

    const estonian = isEstonianInput(input);

    const fallbackSummary = estonian
      ? "Sul on liiga palju asju korraga peas. Kõik ei vaja kohe praegu lahendamist"
      : "Your brain is holding too many things at once. Not everything needs your attention right now";

    const timeSensitiveKeywords = [
      "today", "tonight", "by tonight", "this evening", "tomorrow",
      "by tomorrow", "deadline", "due today", "due tomorrow", "urgent",
      "asap", "before", "at 5", "at 6", "at 7", "at 8", "at 9",
      "täna", "tänaseks", "õhtuks", "täna õhtuks", "õhtul", "homseks",
      "homme", "deadline", "tähtaeg", "kiire", "kell", "enne õhtut"
    ];

    const appointmentKeywords = [
      "doctor", "dentist", "therapist", "appointment", "meeting", "booking",
      "reservation", "reserve", "calendar", "schedule", "time slot",
      "restaurant", "book table", "book a table", "reserve table",
      "dinner reservation", "table tonight",
      "arst", "arsti", "arstile", "arstiaeg", "arsti aeg", "hambaarst",
      "hambaarsti", "hambaarstiaeg", "terapeut", "kohtumine", "broneeri",
      "broneerida", "broneering", "pane aeg", "panna aeg", "lepi aeg",
      "leppida aeg", "aeg kokku", "restoran", "restorani", "broneeri laud",
      "laud õhtuks", "broneeri restoran", "restoran õhtuks"
    ];

    const communicationKeywords = [
      "email", "emails", "reply", "message", "messages", "call", "text", "sms",
      "e-mail", "e-mails", "kirjuta", "vasta", "vastata", "e-kiri",
      "e-kirjad", "e-kirjadele", "meil", "meilid", "sõnum", "sõnumid",
      "helista", "kõne", "sõbranna", "sõbrannale", "emale", "isale"
    ];

    const paymentKeywords = [
      "pay bill", "pay bills", "pay invoice", "invoice", "bill", "bills",
      "electricity", "electricity bill",
      "arve", "arved", "maksa arve", "maksa arved", "maksa",
      "tasu arve", "tasuda arve", "üür", "elekter", "elektriarve"
    ];

    const shoppingKeywords = [
      "shopping list", "grocery list", "buy milk", "buy groceries", "groceries",
      "shopping", "milk", "food", "dinner", "party", "order", "buy",
      "ostunimekiri", "ostu nimekiri", "osta piima", "osta", "poenimekiri",
      "pood", "poodi", "toit", "söök", "õhtusöök", "õhtuse peo", "pidu",
      "peo jaoks", "piim", "telli", "tellida", "kaitsmed"
    ];

    const appSetupKeywords = [
      "download app", "install app", "parental control app", "set up app",
      "app to tablet", "tablet app",
      "lae app", "lae parental control app", "installi app", "pane app",
      "tahvlisse", "lapse tahvlisse", "parental control", "äpp", "api"
    ];

    const ticketKeywords = [
      "ticket", "tickets", "buy ticket", "buy tickets", "pilet", "piletid",
      "osta pilet", "osta piletid", "kinopilet", "kinopiletid"
    ];

    const petCareKeywords = [
      "dog", "walk dog", "walk the dog", "feed dog", "feed the dog",
      "cat", "feed cat", "feed the cat", "pet", "pets", "pet care",
      "litter box", "clean litter", "take dog out",
      "koer", "koera", "koeraga", "jaluta koeraga", "koeraga jalutama",
      "vii koer õue", "koer õue", "toida koera", "anna koerale süüa",
      "kass", "kassi", "toida kassi", "anna kassile süüa",
      "liivakast", "kassi liivakast", "lemmikloom", "lemmiklooma",
      "lemmikloomad", "koeraga metsa", "mine koeraga", "koeraga õue",
      "koeraga välja", "vii koer"
    ];

    const selfCareKeywords = [
      "gym", "workout", "exercise", "walk", "go for a walk", "run", "running",
      "bath", "take a bath", "shower", "meditate", "stretch", "rest", "sleep",
      "mental health", "fresh air", "breathe", "breathing",
      "trenn", "trenni", "treeni", "jõusaal", "jõusaali", "jalutama", "jaluta",
      "jalutuskäik", "jooksma", "jooks", "vann", "mine vanni", "vannis",
      "dušš", "duss", "mediteeri", "venita", "puhka", "maga", "uni",
      "õue", "värske õhk", "hinga", "hingamine"
    ];

    const waitKeywords = [
      "clean", "laundry", "read", "reading", "book", "video", "tiktok",
      "learn", "study", "korista", "koristada", "köök", "kööki", "pesu",
      "loe", "lugeda", "raamat", "õpi", "harjuta"
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

    const overloadKeywords = [
      "tired", "exhausted", "burned out", "burnt out", "overwhelmed",
      "too much", "can't think", "cant think", "drained", "numb",
      "everything feels heavy", "everything feels urgent", "everything is urgent",
      "everything feels like an emergency", "crying", "panic", "panicking",
      "stressed", "anxious", "shutdown", "meltdown", "i feel tired",
      "i am tired", "so tired", "really tired", "need a break",
      "feels urgent", "too urgent", "all urgent",

      "väsinud", "olen väsinud", "nii väsinud", "väga väsinud",
      "läbi", "täiesti läbi", "kõik käib üle pea", "ei jaksa",
      "liiga palju", "pea ei tööta", "pea jookseb kokku",
      "ülekoormus", "stressis", "ärev", "ärevus",
      "nutan", "paanikas", "kurnatud", "vajan pausi",
      "kõik tundub kiire", "kõik tundub pakiline", "kõik on kiire",
      "kõik tundub hädaolukord"
    ];

    const isTimeSensitive = (value) => includesAny(value, timeSensitiveKeywords);
    const isAppointment = (value) => includesAny(value, appointmentKeywords);
    const isCommunication = (value) => includesAny(value, communicationKeywords);
    const isPayment = (value) => includesAny(value, paymentKeywords);
    const isShopping = (value) => includesAny(value, shoppingKeywords);
    const isAppSetup = (value) => includesAny(value, appSetupKeywords);
    const isTicket = (value) => includesAny(value, ticketKeywords);

    const isPetCare = (value) => {
      const text = normalize(value);

      return (
        includesAny(value, petCareKeywords) ||
        /\bkoeraga\b/.test(text) ||
        /\bkoera\b.*\b(õue|välja|jalutama|metsa)\b/.test(text) ||
        /\bdog\b.*\b(walk|out|outside)\b/.test(text)
      );
    };

    const isSelfCare = (value) => includesAny(value, selfCareKeywords);
    const isWait = (value) => includesAny(value, waitKeywords);
    const isLetGo = (value) => includesAny(value, letGoKeywords);
    const isAbstract = includesAny(input, abstractKeywords);
    const isOverloaded = includesAny(input, overloadKeywords);

    const hasSeparators = /,|\n|;/.test(input);
    const hasStrongTaskSignal =
      isTimeSensitive(input) ||
      isAppointment(input) ||
      isCommunication(input) ||
      isPayment(input) ||
      isShopping(input) ||
      isAppSetup(input) ||
      isTicket(input) ||
      isPetCare(input) ||
      isSelfCare(input) ||
      isWait(input);

    const looksLikeTaskList =
      hasSeparators || originalTasks.length > 1 || hasStrongTaskSignal;

    const prompt = `
You organize a messy brain dump into calm clarity.

Return valid JSON only.

CRITICAL LANGUAGE RULE:
- Detect the language of the user's input.
- ALWAYS respond in the SAME language as the user's input.
- NEVER mix languages.
- NEVER answer in English if the input is Estonian.
- NEVER answer in Estonian if the input is English.
- If the input contains mostly Estonian words or Estonian letters (õ ä ö ü), respond fully in Estonian.
- The summary and all generated text MUST match the user's language exactly.

Rules:
- Write a short warm summary.
- Keep it calm and natural.
- Do not invent tasks.
- Do not translate tasks.
- Do not add punctuation at the end.
- If the input includes emotional overload, urgency, exhaustion, anxiety, or a feeling like everything is urgent, mention that this feeling is real but does not need to be solved immediately.
- Do not treat feelings as tasks.

Input:
"""${input}"""

Return exactly:
{
  "summary": "string"
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
            content: estonian
              ? "You return only valid JSON. All text values must be in Estonian. Do not treat feelings as tasks. No explanations."
              : "You return only valid JSON. All text values must be in English. Do not treat feelings as tasks. No explanations."
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
      summary: fallbackSummary
    };

    try {
      parsed = JSON.parse(
        String(raw).replace(/```json/gi, "").replace(/```/g, "").trim()
      );
    } catch {
      console.error("JSON parse failed:", raw);
    }

    const scoreTask = (text) => {
      if (isLetGo(text)) return -100;
      if (includesAny(text, overloadKeywords)) return -50;

      if (isTimeSensitive(text)) return 120;
      if (isAppointment(text)) return 110;
      if (isAppSetup(text)) return 108;
      if (isPayment(text)) return 105;
      if (isPetCare(text)) return 100;
      if (isCommunication(text)) return 95;
      if (isTicket(text)) return 90;

      if (isShopping(text)) {
        if (isTimeSensitive(text)) return 95;
        return 25;
      }

      if (isSelfCare(text)) return 70;
      if (isWait(text)) return 20;

      return 40;
    };

    const breakTask = estonian
      ? "Tee üks rahulik paus"
      : "Take one calm pause";

    const breakStep = estonian
      ? "Hinga korraks ja vali ainult üks asi korraga"
      : "Take a breath and focus on just one thing";

    const sortedTasks = [...originalTasks].sort(
      (a, b) => scoreTask(b) - scoreTask(a)
    );

    const actTasks = sortedTasks
      .filter((task) => {
        const score = scoreTask(task);

        if (isLetGo(task)) return false;
        if (includesAny(task, overloadKeywords)) return false;

        if (isShopping(task) && !isTimeSensitive(task) && !isAppSetup(task)) {
          return false;
        }

        return score >= 50;
      })
      .slice(0, isOverloaded ? 2 : 3);

    const finalActTasks = isOverloaded
      ? [breakTask, ...actTasks].slice(0, 3)
      : actTasks;

    const actKeys = new Set(finalActTasks.map((task) => normalize(task)));

    const items = [
      ...(isOverloaded
        ? [
            {
              text: breakTask,
              category: "ACT"
            }
          ]
        : []),
      ...originalTasks.map((task) => {
        if (isLetGo(task) && !hasStrongTaskSignal) {
          return { text: task, category: "NOT_NOW" };
        }

        if (includesAny(task, overloadKeywords)) {
          return { text: task, category: "NOT_NOW" };
        }

        if (actKeys.has(normalize(task))) {
          return { text: task, category: "ACT" };
        }

        return { text: task, category: "NOT_NOW" };
      })
    ].filter((item) => item.text && item.text !== "LET_GO");

    const makeMicroStep = (task) => {
      const text = normalize(task);

      if (isOverloaded && normalize(task) === normalize(breakTask)) {
        return breakStep;
      }

      if (isAppSetup(task)) {
        return estonian
          ? "Ava tahvel ja otsi app üles"
          : "Open the tablet and find the app";
      }

      if (isShopping(task)) {
        return estonian
          ? "Kirjuta ostunimekirja esimene asi"
          : "Write the first item on the shopping list";
      }

      if (isPetCare(task)) {
        if (
          text.includes("walk") ||
          text.includes("jaluta") ||
          text.includes("jalutama") ||
          text.includes("õue") ||
          text.includes("metsa")
        ) {
          return estonian
            ? "Pane rihm ukse juurde valmis"
            : "Put the leash by the door";
        }

        if (
          text.includes("feed") ||
          text.includes("toida") ||
          text.includes("süüa")
        ) {
          return estonian
            ? "Pane lemmiku toit valmis"
            : "Put the pet food ready";
        }

        if (text.includes("litter") || text.includes("liivakast")) {
          return estonian
            ? "Võta liivakasti puhastamiseks kott valmis"
            : "Get a bag ready for the litter box";
        }

        return estonian
          ? "Pane lemmiku asi ukse või kausi juurde valmis"
          : "Put one pet-care item ready";
      }

      if (isPayment(task)) {
        return estonian
          ? "Ava arve ja kontrolli summa üle"
          : "Open the bill and check the amount";
      }

      if (isCommunication(task)) {
        if (
          text.includes("call") ||
          text.includes("helista") ||
          text.includes("kõne")
        ) {
          return estonian
            ? "Ava kontakt ja kirjuta valmis üks lause"
            : "Open the contact and write one sentence first";
        }

        return estonian
          ? "Ava sõnum või e-kiri ja kirjuta esimene lause"
          : "Open the message or email and write the first sentence";
      }

      if (isAppointment(task)) {
        if (
          text.includes("restoran") ||
          text.includes("restaurant") ||
          text.includes("laud") ||
          text.includes("table")
        ) {
          return estonian
            ? "Ava restorani broneerimise leht"
            : "Open the restaurant booking page";
        }

        return estonian
          ? "Ava kalender ja vaata esimest vaba aega"
          : "Open your calendar and check the first free time";
      }

      if (isTicket(task)) {
        return estonian
          ? "Ava piletileht ja vaata esimest sobivat varianti"
          : "Open the ticket page and check the first suitable option";
      }

      if (isSelfCare(task)) {
        return estonian
          ? "Pane 5 minuti taimer käima ja alusta kõige väiksemast kohast"
          : "Set a 5-minute timer and start with the smallest part";
      }

      if (isTimeSensitive(task)) {
        return estonian
          ? "Ava see asi ja tee esimene väike liigutus"
          : "Open it and take the first small action";
      }

      return estonian
        ? "Pane 5 minuti taimer käima ja alusta kõige väiksemast kohast"
        : "Set a 5-minute timer and start with the smallest part";
    };

    if (isAbstract && !looksLikeTaskList) {
      const abstractStep = estonian
        ? "Kirjuta üles 3 väikest asja, mis võivad tähelepanu vajada"
        : "Write down 3 small things that might need your attention";

      return res.status(200).json({
        summary:
          cleanText(parsed.summary) ||
          (estonian
            ? "Tundub, et oled veidi kinni või segaduses. See on okei — kõike ei pea korraga lahendama"
            : "It sounds like you’re feeling stuck or unsure. That’s okay — you don’t need to figure everything out at once"),
        next_step_under_5_min: abstractStep,
        next_step_for: "",
        items: []
      });
    }

    const bestTask = isOverloaded
      ? breakTask
      : finalActTasks[0] || originalTasks[0] || "";

    const nextStep = makeMicroStep(bestTask);

    return res.status(200).json({
      summary: cleanText(parsed.summary) || fallbackSummary,
      next_step_under_5_min: cleanText(nextStep),
      next_step_for: cleanText(bestTask),
      items
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}
