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
      String(value).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

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
          "maksa", "tee", "mine", "loe", "õpi", "sõbranna", "lae"
        ].some((word) => includesKeyword(text, word))
      );
    };

    const estonian = isEstonianInput(input);

    const fallbackSummary = estonian
      ? "Sul on mitu asja korraga peas. Võtame sellest ainult ühe väikese järgmise sammu"
      : "You have a few things on your mind. Let’s pick one small next step";

    const overloadKeywords = [
      "tired", "exhausted", "burned out", "burnt out", "overwhelmed",
      "too much", "can't think", "cant think", "drained", "numb",
      "everything feels heavy", "crying", "panic", "panicking",
      "stressed", "anxious", "shutdown", "meltdown",

      "väsinud", "läbi", "kõik käib üle pea", "ei jaksa",
      "liiga palju", "pea ei tööta", "pea jookseb kokku",
      "ülekoormus", "stressis", "ärev", "ärevus",
      "nutan", "paanikas", "kurnatud", "täiesti läbi"
    ];

    const isOverloaded = includesAny(input, overloadKeywords);

    return res.status(200).json({
      summary: cleanText(fallbackSummary),
      next_step_under_5_min: isOverloaded
        ? estonian
          ? "Pane telefon 5 minutiks käest ära"
          : "Put your phone down for 5 minutes"
        : estonian
          ? "Pane 5 minuti taimer käima ja alusta kõige väiksemast kohast"
          : "Set a 5-minute timer and start with the smallest part",
      next_step_for: isOverloaded
        ? estonian
          ? "Võta korraks paus"
          : "Take a short break"
        : originalTasks[0] || "",
      items: isOverloaded
        ? [
            {
              text: estonian
                ? "Võta korraks paus"
                : "Take a short break",
              category: "ACT"
            },
            ...originalTasks.map((task) => ({
              text: task,
              category: "NOT_NOW"
            }))
          ]
        : originalTasks.map((task, index) => ({
            text: task,
            category: index < 3 ? "ACT" : "NOT_NOW"
          }))
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Something went wrong"
    });
  }
}

