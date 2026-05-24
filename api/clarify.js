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
      "helista", "kõne", "sõbranna", "sõbrannale", "emale", "isale",
      "client", "customer", "kliendile", "klient"
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
      "feels urgent", "too urgent", "all urgent", "4 hours of sleep",
      "four hours of sleep", "not enough sleep", "running on",

      "väsinud", "olen väsinud", "nii väsinud", "väga väsinud",
      "läbi", "täiesti läbi", "kõik käib üle pea", "ei jaksa",
      "liiga palju", "pea ei tööta", "pea jookseb kokku",
      "ülekoormus", "stressis", "ärev", "ärevus",
      "nutan", "paanikas", "kurnatud", "vajan pausi",
      "kõik tundub kiire", "kõik tundub pakiline", "kõik on kiire",
      "kõik tundub hädaolukord", "vähe maganud"
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

Core rules:
- Do not invent new tasks.
- Do not add details that are not implied by the user.
- Stay semantically close to the user's words.
- Rewrite only for clarity, calmness, and actionability.

Summary rules:
- The summary must sound human, calm, and observant.
- The summary must reflect the user's situation, not describe what the app is doing.
- Never write generic tool language like "Organize tasks and observations for clarity".
- Never use phrases like "organize tasks", "for clarity", "task management", or "productivity".
- Keep the summary to 1 short sentence, or 2 short sentences maximum.
- Mention that not everything needs attention right now when the input contains overload, urgency, tiredness, or too many open loops.

Good summaries:
- "Your brain is trying to hold too many things at once"
- "A few things need attention, but not everything is urgent"
- "You seem mentally overloaded right now"
- "Some things matter today. The rest can wait"
- "You are carrying a lot, but only a few things need action right now"
- Do not diagnose, moralize, coach too much, or sound like therapy.
- Do not add punctuation at the end.
- Emotional states are not action items.
- If something is a feeling, body state, tiredness, or urgency state, put it into NOT_NOW and rewrite it as a neutral observation, not an instruction.
- NOT_NOW items should reduce pressure. They should not sound like new tasks.
- If something is an actionable task, rewrite it into a short, calm action phrase.
- Remove heavy wording like "need to", "have to", "forgot to", "I must", "I should".

Categories:
- ACT = concrete actions that genuinely need attention today.
- NOT_NOW = things that can wait, emotional states, tiredness, mental noise, or context that does not require immediate action. Use observation-style wording, not command-style wording.
- LET_GO = guilt, shame, worry, or pressure that can be released.

Good rewrites:
- "forgot to send the invoice" → "Send the invoice"
- "need to finish presentation for tomorrow" → "Continue tomorrow's presentation"
- "reply to 14 unread emails" → "Reply to the most important email"
- "call the client back" → "Call the client"
- "running on 4 hours of sleep" → "You are running on very little sleep"
- "everything feels urgent" → "Not everything needs action right now"
- "my inbox is a disaster" → "Reply to the most important email"

Bad rewrites:
- Do not turn "running on 4 hours of sleep" into "Fix your sleep schedule"
- Do not turn "running on 4 hours of sleep" into "Prioritize rest today" if it is in NOT_NOW, because that sounds like another task
- Do not turn feelings into big self-improvement tasks.
- Do not create advice that the user did not ask for.

Input:
"""${input}"""

Split the input into the same number of items as the user wrote, unless one line clearly contains several comma-separated tasks.

Return exactly:
{
  "summary": "string",
  "items": [
    {
      "original": "string from the user",
      "text": "short rewritten version",
      "category": "ACT or NOT_NOW or LET_GO"
    }
  ]
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
              ? "You return only valid JSON. All text values must be in Estonian. Do not invent tasks. Do not treat feelings as tasks. No explanations."
              : "You return only valid JSON. All text values must be in English. Do not invent tasks. Do not treat feelings as tasks. No explanations."
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
      summary: fallbackSummary,
      items: []
    };

    const cleanSummary = (value) => {
      const summary = cleanText(value);
      const genericSummaryPhrases = [
        "organize tasks and observations for clarity",
        "organize tasks",
        "for clarity",
        "task management",
        "productivity"
      ];

      if (!summary) return fallbackSummary;

      const lower = summary.toLowerCase();

      if (genericSummaryPhrases.some((phrase) => lower.includes(phrase))) {
        return isOverloaded
          ? fallbackSummary
          : estonian
          ? "Mõni asi vajab tähelepanu, aga mitte kõik korraga"
          : "A few things need attention, but not everything at once";
      }

      return summary;
    };

    try {
      parsed = JSON.parse(
        String(raw).replace(/```json/gi, "").replace(/```/g, "").trim()
      );
    } catch {
      console.error("JSON parse failed:", raw);
    }

    const fallbackRewriteTaskText = (task) => {
      const original = cleanText(task);
      const text = normalize(original);

      if (!original) return "";
      if (includesAny(original, overloadKeywords)) {
        if (text.includes("sleep") || text.includes("maganud")) {
          return estonian
            ? "Oled tavalisest vähem maganud"
            : "You are running on very little sleep";
        }
        if (text.includes("urgent") || text.includes("kiire") || text.includes("pakiline")) {
          return estonian
            ? "Kõik ei vaja kohe tegutsemist"
            : "Not everything needs action right now";
        }
        if (text.includes("tired") || text.includes("exhausted") || text.includes("väsinud") || text.includes("kurnatud")) {
          return estonian
            ? "Oled praegu tavalisest väsinum"
            : "You are more tired than usual right now";
        }
        return original;
      }

      if (text.includes("forgot to send") && text.includes("invoice")) {
        return estonian ? "Saada arve ära" : "Send the invoice";
      }

      if (text.includes("need to finish") && text.includes("presentation")) {
        return estonian ? "Jätka homset esitlust" : "Continue tomorrow's presentation";
      }

      if (text.includes("finish presentation") && text.includes("tomorrow")) {
        return estonian ? "Jätka homset esitlust" : "Continue tomorrow's presentation";
      }

      if (text.includes("reply to") && text.includes("unread email")) {
        return estonian ? "Vasta kõige olulisemale e-kirjale" : "Reply to the most important email";
      }

      if (text.includes("call the client back") || text.includes("call client back")) {
        return estonian ? "Helista kliendile" : "Call the client";
      }

      const removableStarts = [
        "i forgot to ",
        "forgot to ",
        "i need to ",
        "need to ",
        "i have to ",
        "have to ",
        "i must ",
        "must ",
        "i should ",
        "should "
      ];

      let rewritten = original;
      const lower = rewritten.toLowerCase();
      const prefix = removableStarts.find((item) => lower.startsWith(item));

      if (prefix) {
        rewritten = rewritten.slice(prefix.length);
      }

      rewritten = cleanText(rewritten);
      if (!rewritten) return original;

      return rewritten.charAt(0).toUpperCase() + rewritten.slice(1);
    };

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

    const startsLikeAction = (value) => {
      const text = normalize(value);
      const actionStarts = [
        "send", "continue", "finish", "reply", "call", "book", "pay", "open",
        "write", "check", "buy", "order", "schedule", "choose", "start",
        "saada", "jätka", "lõpeta", "vasta", "helista", "broneeri", "maksa",
        "ava", "kirjuta", "kontrolli", "osta", "telli", "vali", "alusta"
      ];

      return actionStarts.some((word) => text.startsWith(word + " ") || text === word);
    };

    const softenNotNowText = (original, rewritten) => {
      const originalText = normalize(original);
      const rewrittenText = normalize(rewritten);

      if (originalText.includes("sleep") || originalText.includes("maganud")) {
        return estonian
          ? "Oled tavalisest vähem maganud"
          : "You are running on very little sleep";
      }

      if (originalText.includes("inbox") || originalText.includes("postkast") || originalText.includes("meilikast")) {
        return estonian
          ? "Su postkast tundub praegu ülekoormav"
          : "Your inbox feels overwhelming right now";
      }

      if (originalText.includes("urgent") || originalText.includes("kiire") || originalText.includes("pakiline")) {
        return estonian
          ? "Kõik ei vaja kohe tegutsemist"
          : "Not everything needs action right now";
      }

      if (
        originalText.includes("tired") ||
        originalText.includes("exhausted") ||
        originalText.includes("väsinud") ||
        originalText.includes("kurnatud")
      ) {
        return estonian
          ? "Oled praegu tavalisest väsinum"
          : "You are more tired than usual right now";
      }

      if (startsLikeAction(rewrittenText)) {
        const softenedOriginal = cleanText(original);
        if (softenedOriginal.toLowerCase().startsWith("my ")) {
          return "Your " + softenedOriginal.slice(3);
        }
        if (softenedOriginal.toLowerCase().startsWith("i am ")) {
          return "You are " + softenedOriginal.slice(5);
        }
        if (softenedOriginal.toLowerCase().startsWith("i'm ")) {
          return "You are " + softenedOriginal.slice(4);
        }
        if (softenedOriginal.toLowerCase().startsWith("i feel ")) {
          return "You feel " + softenedOriginal.slice(7);
        }
        return softenedOriginal;
      }

      const softened = cleanText(rewritten);
      if (softened.toLowerCase().startsWith("my ")) {
        return "Your " + softened.slice(3);
      }
      if (softened.toLowerCase().startsWith("i am ")) {
        return "You are " + softened.slice(5);
      }
      if (softened.toLowerCase().startsWith("i'm ")) {
        return "You are " + softened.slice(4);
      }
      if (softened.toLowerCase().startsWith("i feel ")) {
        return "You feel " + softened.slice(7);
      }
      return softened;
    };

    const safeCategory = (original, requestedCategory, rewrittenText = "") => {
      const category = ["ACT", "NOT_NOW", "LET_GO"].includes(requestedCategory)
        ? requestedCategory
        : "NOT_NOW";

      if (includesAny(original, overloadKeywords)) return "NOT_NOW";
      if (isLetGo(original) && !hasStrongTaskSignal) return "LET_GO";

      if (category === "ACT") {
        if (isShopping(original) && !isTimeSensitive(original) && !isAppSetup(original)) {
          return "NOT_NOW";
        }

        if (scoreTask(original) < 50) {
          return "NOT_NOW";
        }
      }

      if (category === "NOT_NOW" && startsLikeAction(rewrittenText)) {
        if (scoreTask(original) >= 50 && !includesAny(original, overloadKeywords)) {
          return "ACT";
        }
      }

      return category;
    };

    const aiItemsByOriginal = new Map();

    if (Array.isArray(parsed.items)) {
      parsed.items.forEach((item) => {
        const original = cleanText(item?.original || "");
        const text = cleanText(item?.text || "");
        const category = item?.category;

        if (!original || !text) return;

        aiItemsByOriginal.set(normalize(original), {
          original,
          text,
          category
        });
      });
    }

    const sortedTasks = [...originalTasks].sort(
      (a, b) => scoreTask(b) - scoreTask(a)
    );

    const fallbackActTasks = sortedTasks
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

    const fallbackActKeys = new Set(fallbackActTasks.map((task) => normalize(task)));

    const baseItems = originalTasks.map((task) => {
      const aiItem = aiItemsByOriginal.get(normalize(task));
      const rewrittenText = cleanText(aiItem?.text) || fallbackRewriteTaskText(task);

      let category = aiItem?.category;

      if (!category) {
        if (isLetGo(task) && !hasStrongTaskSignal) {
          category = "LET_GO";
        } else if (includesAny(task, overloadKeywords)) {
          category = "NOT_NOW";
        } else if (fallbackActKeys.has(normalize(task))) {
          category = "ACT";
        } else {
          category = "NOT_NOW";
        }
      }

      const finalCategory = safeCategory(task, category, rewrittenText);
      const finalText = finalCategory === "NOT_NOW"
        ? softenNotNowText(task, rewrittenText)
        : rewrittenText;

      return {
        original: task,
        text: finalText,
        category: finalCategory
      };
    });

    const itemsWithBreak = isOverloaded
      ? [
          {
            original: breakTask,
            text: breakTask,
            category: "ACT"
          },
          ...baseItems
        ]
      : baseItems;

    const seen = new Set();
    const items = itemsWithBreak
      .filter((item) => item.text && item.text !== "LET_GO")
      .filter((item) => {
        const key = `${item.category}::${normalize(item.text)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const actItems = items.filter((item) => item.category === "ACT");
    const extraActItems = actItems.slice(isOverloaded ? 3 : 3);
    const extraActKeys = new Set(extraActItems.map((item) => normalize(item.text)));

    const cappedItems = items.map((item) => {
      if (item.category === "ACT" && extraActKeys.has(normalize(item.text))) {
        return { ...item, category: "NOT_NOW" };
      }

      return item;
    });

    const makeMicroStep = (item) => {
      const original = item?.original || item?.text || "";
      const text = normalize(original);

      if (isOverloaded && normalize(item?.text) === normalize(breakTask)) {
        return breakStep;
      }

      if (isAppSetup(original)) {
        return estonian
          ? "Ava tahvel ja otsi app üles"
          : "Open the tablet and find the app";
      }

      if (isShopping(original)) {
        return estonian
          ? "Kirjuta ostunimekirja esimene asi"
          : "Write the first item on the shopping list";
      }

      if (isPetCare(original)) {
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

      if (isPayment(original)) {
        return estonian
          ? "Ava arve ja kontrolli summa üle"
          : "Open the bill and check the amount";
      }

      if (isCommunication(original)) {
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

      if (isAppointment(original)) {
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

      if (isTicket(original)) {
        return estonian
          ? "Ava piletileht ja vaata esimest sobivat varianti"
          : "Open the ticket page and check the first suitable option";
      }

      if (isSelfCare(original)) {
        return estonian
          ? "Pane 5 minuti taimer käima ja alusta kõige väiksemast kohast"
          : "Set a 5-minute timer and start with the smallest part";
      }

      if (isTimeSensitive(original)) {
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

    const bestItem = cappedItems.find((item) => item.category === "ACT") || cappedItems[0];
    const nextStep = makeMicroStep(bestItem);

    return res.status(200).json({
      summary: cleanSummary(parsed.summary),
      next_step_under_5_min: cleanText(nextStep),
      next_step_for: cleanText(bestItem?.text || ""),
      items: cappedItems.map((item) => ({
        text: cleanText(item.text),
        category: item.category
      }))
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}
