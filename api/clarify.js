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

    const isEstonianInput = (value) => {
      const text = normalize(value);
      return (
        /[õäöü]/i.test(value) ||
        [
          "ma ", "mul ", "mulle ", "minu ", "ei ", "ja ", "vaja ", "pean ",
          "arst", "arve", "korista", "jaluta", "trenn", "pilet", "helista",
          "kirjuta", "vasta", "pesu", "õue", "koer", "kass", "lemmikloom"
        ].some((word) => text.includes(word))
      );
    };

    const estonian = isEstonianInput(input);

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
      "loe", "lugeda", "raamat", "õpi"
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

    const prohibitedOneStepKeywords = [
      "clean", "cleaning", "laundry", "tidy", "organize room",
      "walk the dog", "go for a walk", "walk", "run", "running", "exercise",
      "workout", "gym", "cook", "cooking", "study", "read the book",
      "korista", "koristada", "pesu", "jaluta", "jalutama", "koeraga jalutama",
      "jooksma", "trenn", "trenni", "jõusaal", "kokka", "süüa tegema",
      "õpi", "õppida", "loe raamatut"
    ];

  const isAppointment = (value) => includesAny(value, appointmentKeywords);
const isCommunication = (value) => includesAny(value, communicationKeywords);
const isPayment = (value) => includesAny(value, paymentKeywords);
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
    includesAny(value, petCareKeywords) ||
    /\bkoeraga\b/.test(text) ||
    /\bkoera\b.*\b(õue|välja|jalutama|metsa)\b/.test(text) ||
    /\b(dog)\b.*\b(walk|out|outside)\b/.test(text)
  );
};
    const isSelfCare = (value) => includesAny(value, selfCareKeywords);
    const isWait = (value) => includesAny(value, waitKeywords);
    const isLetGo = (value) => includesAny(value, letGoKeywords);
    const isAbstract = includesAny(input, abstractKeywords);

    const hasSeparators = /,|\n|;/.test(input);
    const hasStrongTaskSignal =
      isAppointment(input) ||
      isCommunication(input) ||
      isPayment(input) ||
      isTicket(input) ||
      isPetCare(input) ||
      isSelfCare(input) ||
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

One small step rule:
- The next step must take under 5 minutes.
- It must be a starting action, not the full task.
- It must be physically small and immediately actionable.
- Do NOT suggest full activities like cleaning, exercising, walking the dog, going to the gym, cooking, studying, reading a book, doing laundry, or similar multi-step tasks.
- Instead, shrink them into a tiny starter action.
- Good examples:
  - Open the email draft
  - Write the first sentence
  - Put the bill on the table
  - Put on your shoes
  - Put the dog leash by the door
  - Pick up 3 items
  - Set a 5-minute timer

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
      summary: estonian
        ? "Sul on mitu asja korraga peas. Võtame sellest ainult ühe väikese järgmise sammu"
        : "You have a few things on your mind. Let’s pick one small next step",
      next_step_under_5_min: ""
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
      if (isAppointment(text)) return 100;
      if (isCommunication(text)) return 95;
      if (isPayment(text)) return 90;
      if (isPetCare(text)) return 88;
      if (isTicket(text)) return 85;
      if (isSelfCare(text)) return 80;
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

    const makeMicroStep = (task) => {
      const text = normalize(task);

      if (isAppointment(task)) {
        return estonian ? "Ava kalender ja vaata esimest vaba aega" : "Open your calendar and check the first free time";
      }

      if (isCommunication(task)) {
        if (text.includes("call") || text.includes("helista") || text.includes("kõne")) {
          return estonian ? "Ava kontakt ja kirjuta valmis üks lause" : "Open the contact and write one sentence first";
        }

        return estonian ? "Ava sõnum või e-kiri ja kirjuta esimene lause" : "Open the message or email and write the first sentence";
      }

      if (isPayment(task)) {
        return estonian ? "Ava arve ja kontrolli summa üle" : "Open the bill and check the amount";
      }

      if (isPetCare(task)) {
        if (
          text.includes("walk") ||
          text.includes("jaluta") ||
          text.includes("jalutama") ||
          text.includes("õue")
        ) {
          return estonian ? "Pane rihm ukse juurde valmis" : "Put the leash by the door";
        }

        if (
          text.includes("feed") ||
          text.includes("toida") ||
          text.includes("süüa")
        ) {
          return estonian ? "Pane lemmiku toit valmis" : "Put the pet food ready";
        }

        if (
          text.includes("litter") ||
          text.includes("liivakast")
        ) {
          return estonian ? "Võta liivakasti puhastamiseks kott valmis" : "Get a bag ready for the litter box";
        }

        return estonian ? "Pane lemmiku asi ukse või kausi juurde valmis" : "Put one pet-care item ready";
      }

      if (isTicket(task)) {
        return estonian ? "Ava piletileht ja vaata esimest sobivat varianti" : "Open the ticket page and check the first suitable option";
      }

      if (isSelfCare(task)) {
        if (
          text.includes("walk") ||
          text.includes("jaluta") ||
          text.includes("jalutama") ||
          text.includes("õue") ||
          text.includes("fresh air")
        ) {
          return estonian ? "Pane jalanõud valmis" : "Put your shoes by the door";
        }

        if (
          text.includes("gym") ||
          text.includes("workout") ||
          text.includes("exercise") ||
          text.includes("trenn") ||
          text.includes("trenni") ||
          text.includes("jõusaal")
        ) {
          return estonian ? "Pane trenniriided valmis" : "Put your workout clothes ready";
        }

        if (
          text.includes("bath") ||
          text.includes("vann") ||
          text.includes("shower") ||
          text.includes("dušš") ||
          text.includes("duss")
        ) {
          return estonian ? "Pane vann või dušš valmis" : "Turn on the bath or shower";
        }

        if (
          text.includes("sleep") ||
          text.includes("rest") ||
          text.includes("puhka") ||
          text.includes("maga") ||
          text.includes("uni")
        ) {
          return estonian ? "Pane telefon kõrvale kaheks minutiks" : "Put your phone away for two minutes";
        }

        return estonian ? "Tee üks rahulik hingetõmme ja vali üks väike algus" : "Take one slow breath and choose one tiny start";
      }

      if (isWait(task)) {
        if (
          text.includes("clean") ||
          text.includes("korista") ||
          text.includes("tidy")
        ) {
          return estonian ? "Korja üles 3 asja" : "Pick up 3 items";
        }

        if (
          text.includes("laundry") ||
          text.includes("pesu")
        ) {
          return estonian ? "Pane pesu ühte kohta kokku" : "Put the laundry in one place";
        }

        if (
          text.includes("read") ||
          text.includes("loe") ||
          text.includes("lugeda") ||
          text.includes("book") ||
          text.includes("raamat")
        ) {
          return estonian ? "Ava raamat või tekst õigest kohast" : "Open the book or text to the right page";
        }

        return estonian ? "Pane 5 minuti taimer käima ja alusta kõige väiksemast kohast" : "Set a 5-minute timer and start with the smallest part";
      }

      return estonian ? "Pane 5 minuti taimer käima ja alusta kõige väiksemast kohast" : "Set a 5-minute timer and start with the smallest part";
    };

    const isValidOneStep = (step) => {
      const value = cleanText(step);

      if (!value) return false;

      const text = normalize(value);
      const wordCount = value.split(/\s+/).filter(Boolean).length;

      if (wordCount > 14) return false;
      if (includesAny(value, prohibitedOneStepKeywords)) return false;

      const tooBroadPatterns = [
        /^clean\b/i,
        /^walk\b/i,
        /^walk the dog\b/i,
        /^exercise\b/i,
        /^work out\b/i,
        /^go to the gym\b/i,
        /^cook\b/i,
        /^study\b/i,
        /^read\b/i,
        /^do laundry\b/i,
        /^korista\b/i,
        /^jaluta\b/i,
        /^jaluta koeraga\b/i,
        /^mine jalutama\b/i,
        /^tee trenni\b/i,
        /^mine trenni\b/i,
        /^mine jõusaali\b/i,
        /^õpi\b/i,
        /^loe\b/i,
        /^pese pesu\b/i
      ];

      if (tooBroadPatterns.some((pattern) => pattern.test(value))) return false;

      const starterVerbs = [
        "open", "write", "put", "pick", "set", "check", "send", "start",
        "choose", "place", "turn", "take", "get",
        "ava", "kirjuta", "pane", "korja", "kontrolli", "vali", "alusta",
        "vaata", "tee", "võta"
      ];

      return starterVerbs.some((verb) => text.startsWith(verb));
    };

    const chooseBestTaskForStep = () =>
      finalActItems.find((item) => isAppointment(item.text))?.text ||
      finalActItems.find((item) => isCommunication(item.text))?.text ||
      finalActItems.find((item) => isPayment(item.text))?.text ||
      finalActItems.find((item) => isPetCare(item.text))?.text ||
      finalActItems.find((item) => isTicket(item.text))?.text ||
      finalActItems.find((item) => isSelfCare(item.text))?.text ||
      finalActItems[0]?.text ||
      originalTasks[0] ||
      "";

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

    const bestTask = chooseBestTaskForStep();

    let nextStep = cleanText(parsed.next_step_under_5_min);

    if (!isValidOneStep(nextStep)) {
      nextStep = makeMicroStep(bestTask);
    }

    if (!isValidOneStep(nextStep)) {
      nextStep = estonian
        ? "Pane 5 minuti taimer käima ja alusta kõige väiksemast kohast"
        : "Set a 5-minute timer and start with the smallest part";
    }

    return res.status(200).json({
      summary:
        cleanText(parsed.summary) ||
        (estonian
          ? "Sul on mitu asja korraga peas. Võtame sellest ainult ühe väikese järgmise sammu"
          : "You have a few things on your mind. Let’s pick one small next step"),
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
