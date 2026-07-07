import OpenAI, { toFile } from "openai";

function extFromMime(mime: string): string {
  const m = (mime || "").split(";")[0].trim();
  if (m === "audio/webm") return "webm";
  if (m === "audio/mp4" || m === "audio/x-m4a" || m === "audio/m4a") return "m4a";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/wav" || m === "audio/x-wav") return "wav";
  if (m === "audio/ogg") return "ogg";
  return "webm";
}

/** Speech-to-text: takes a base64 audio clip, returns the transcript. */
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

  const { audio_base64, mime } = (req.body ?? {}) as {
    audio_base64?: string;
    mime?: string;
  };
  if (!audio_base64) return res.status(400).json({ error: "Missing audio" });

  const client = new OpenAI({ apiKey: key });
  try {
    const bytes = Buffer.from(audio_base64, "base64");
    const file = await toFile(bytes, `recording.${extFromMime(mime || "")}`, {
      type: mime || "audio/webm",
    });
    const result = await client.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file,
    });
    return res.status(200).json({ text: (result.text ?? "").trim() });
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
      .json({ error: err?.message ?? "Transcription failed." });
  }
}
