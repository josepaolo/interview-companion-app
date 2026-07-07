import Anthropic from "@anthropic-ai/sdk";

// Prompt construction is inlined (no relative import) so this file works both in
// the local Vite dev middleware and as a native-ESM Vercel serverless function.

interface StudyPrompt {
  persona_name: string;
  persona_tone: string;
  persona_background?: string | null;
  title: string;
  description?: string | null;
  research_questions?: string | null;
  interview_guide?: string | null;
  structure_type: string;
  max_questions: number;
}

const voiceRules = [
  `Delivery: this interview is happening OUT LOUD, spoken back and forth in real time. Write for the ear, not the page.`,
  `- Keep each turn short: 1-2 sentences, ideally under 30 words. Never monologue.`,
  `- Use natural spoken English: contractions, everyday words, light hedges ("okay", "got it", "that makes sense").`,
  `- Occasionally begin with a short acknowledgement ("Interesting.", "Thanks for sharing that.") before the next question.`,
  `- Never say numbers, bullets, headings, or "question one", "next question". Just ask.`,
  `- No emoji, no markdown, no parentheses, no stage directions.`,
  `- Pronounceable punctuation only: commas, periods, question marks. Avoid semicolons and em-dashes.`,
].join("\n");

function buildSystemPrompt(study: StudyPrompt, mode: "text" | "audio" | "voice"): string {
  const structureRule =
    study.structure_type === "structured"
      ? "Ask the guide questions verbatim, in order, with minimal deviation. Do not add follow-ups unless the participant is unclear."
      : study.structure_type === "unstructured"
        ? "Explore the research questions conversationally. No fixed script. Follow the participant's lead."
        : "Follow the interview guide as a loose sequence. Ask adaptive follow-up probes when answers are shallow or intriguing.";

  return [
    `You are ${study.persona_name}, an AI research interviewer.`,
    `Tone and manner: ${study.persona_tone}.`,
    study.persona_background ? `Background: ${study.persona_background}` : "",
    `You are conducting a qualitative research interview titled "${study.title}".`,
    study.description ? `Study context: ${study.description}` : "",
    study.research_questions
      ? `Underlying research questions:\n${study.research_questions}`
      : "",
    study.interview_guide ? `Interview guide:\n${study.interview_guide}` : "",
    `Interview style: ${structureRule}`,
    mode === "voice" ? voiceRules : "",
    `Rules:`,
    `- Ask ONE question at a time. Keep questions short and open.`,
    `- Do not lead the participant, do not put words in their mouth.`,
    `- Acknowledge briefly (one short sentence) before the next question when it feels natural.`,
    `- Never invent facts about the participant.`,
    `- Never pressure an answer; a participant may decline any question.`,
    `- Hard cap: no more than ${study.max_questions} interviewer questions total.`,
    `- When you have covered the topics or reached the cap, output on a final line exactly: [END_OF_INTERVIEW]`,
    `- Output plain conversational text. No markdown headings, no numbered lists in your reply.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildProbePrompt(study: StudyPrompt, topic: string): string {
  return [
    `You are ${study.persona_name}, an AI research interviewer with a ${study.persona_tone} manner.`,
    `Study: "${study.title}".`,
    `Ask exactly ONE open, conversational question that opens this topic with the participant:`,
    topic,
    `Keep it short and natural. Do not summarise, do not list. Do NOT output [END_OF_INTERVIEW].`,
  ].join("\n");
}

interface ChatBody {
  study: StudyPrompt;
  mode?: "text" | "audio" | "voice";
  messages?: { role: "user" | "assistant"; content: string }[];
  askedSoFar?: number;
  probeTopic?: string;
}

/**
 * The AI interviewer's next turn. Stateless relay: the browser sends the study
 * config + conversation so far, we call Claude, and return the next question.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({
      error:
        "The interviewer isn't configured yet — add ANTHROPIC_API_KEY to your .env (see README).",
    });
  }

  const body = (req.body ?? {}) as ChatBody;
  const study = body.study;
  if (!study) return res.status(400).json({ error: "Missing study config" });

  const mode = body.mode ?? "text";
  const history = body.messages ?? [];
  const askedSoFar = body.askedSoFar ?? 0;
  const model = process.env.INTERVIEW_MODEL || "claude-sonnet-5";

  // Claude requires the conversation to start with a user turn and alternate.
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: "[The participant is ready to begin. Please conduct the interview.]",
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let system: string;
  if (body.probeTopic) {
    system = buildProbePrompt(study, body.probeTopic);
  } else {
    system = buildSystemPrompt(study, mode);
    if (askedSoFar >= study.max_questions) {
      system +=
        "\nYou have reached the maximum number of questions. Thank the participant warmly in 1-2 sentences and end with [END_OF_INTERVIEW] on its own line.";
    }
  }

  const client = new Anthropic({ apiKey: key });

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system,
      messages,
    });
    const raw = response.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    const ended = /\[END_OF_INTERVIEW\]/i.test(raw);
    const text = raw.replace(/\[END_OF_INTERVIEW\]/gi, "").trim();
    return res.status(200).json({ text, ended: body.probeTopic ? false : ended });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const detail = String(err?.message ?? "");
    // Billing exhaustion comes back as a 400 "credit balance is too low".
    if (/credit balance/i.test(detail)) {
      return res.status(503).json({
        error:
          "The interview is temporarily unavailable — the study's AI credits have run out. (Researcher: top up your Anthropic account at console.anthropic.com → Billing.)",
      });
    }
    if (status === 429)
      return res
        .status(429)
        .json({ error: "The interviewer is busy — please try again in a moment." });
    if (status === 401)
      return res
        .status(401)
        .json({ error: "The AI key is invalid. Check ANTHROPIC_API_KEY." });
    return res.status(500).json({ error: err?.message ?? "The interviewer hit an error." });
  }
}
