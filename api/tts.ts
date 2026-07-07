import OpenAI from "openai";

const DEFAULT_INSTRUCTIONS =
  "Speak as a warm, calm, curious academic interviewer — thoughtful and human, with brief natural pauses between clauses. Use clear, professional Standard English, an unhurried pace, and gentle intonation. Never robotic or announcer-like.";

/** Text-to-speech for voice mode. Returns MP3 audio bytes. */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res
      .status(500)
      .json({ error: "Voice isn't configured — add OPENAI_API_KEY to your .env." });
  }

  const { text, voice, instructions } = (req.body ?? {}) as {
    text?: string;
    voice?: string;
    instructions?: string;
  };
  if (!text || !text.trim()) return res.status(400).json({ error: "Missing text" });

  const client = new OpenAI({ apiKey: key });
  try {
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: (voice as any) ?? "alloy",
      input: text,
      instructions: instructions ?? DEFAULT_INSTRUCTIONS,
      response_format: "mp3",
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("content-type", "audio/mpeg");
    res.status(200).end(buffer);
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status === 429 && /quota|billing/i.test(String(err?.message ?? ""))) {
      return res.status(503).json({
        error:
          "Voice is temporarily unavailable — the study's voice credits have run out. (Researcher: top up your OpenAI account at platform.openai.com → Billing.)",
      });
    }
    return res
      .status(status)
      .json({ error: err?.message ?? "Text-to-speech failed." });
  }
}
