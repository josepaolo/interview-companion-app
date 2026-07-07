import type { Mode, Study, SurveyItem } from "@/lib/types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** The fields the AI proxy needs — a safe subset of the study. */
function studyPromptFields(study: Study) {
  return {
    persona_name: study.persona_name,
    persona_tone: study.persona_tone,
    persona_background: study.persona_background,
    title: study.title,
    description: study.description,
    research_questions: study.research_questions,
    interview_guide: study.interview_guide,
    structure_type: study.structure_type,
    max_questions: study.max_questions,
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(msg.error || "Request failed");
  }
  return res.json();
}

/** Ask Claude for the interviewer's next question. */
export async function nextInterviewerTurn(opts: {
  study: Study;
  mode: Mode;
  history: ChatTurn[];
  askedSoFar: number;
  probeTopic?: string;
}): Promise<{ text: string; ended: boolean }> {
  return postJson("/api/chat", {
    study: studyPromptFields(opts.study),
    mode: opts.mode,
    messages: opts.history,
    askedSoFar: opts.askedSoFar,
    probeTopic: opts.probeTopic,
  });
}

/** Transcribe a recorded answer. */
export async function transcribeAudio(audioBase64: string, mime: string): Promise<string> {
  const { text } = await postJson<{ text: string }>("/api/transcribe", {
    audio_base64: audioBase64,
    mime,
  });
  return text;
}

/** Get spoken audio (MP3 blob URL) for a line of interviewer text. */
export async function synthesizeSpeech(text: string): Promise<string> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Render a hybrid survey item as a spoken/typed prompt (no AI call needed). */
export function renderSurveyPrompt(item: SurveyItem): string {
  const p = item.prompt.trim();
  const t = item.question_type;
  if (t === "single" && item.options?.length) {
    return `${p}\n\nPlease choose one:\n${item.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
  }
  if (t === "multi" && item.options?.length) {
    return `${p}\n\nSelect all that apply:\n${item.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
  }
  if (t === "scale") {
    const lo = item.scale_min ?? 1;
    const hi = item.scale_max ?? 5;
    const lol = item.scale_min_label ? ` (${item.scale_min_label})` : "";
    const hil = item.scale_max_label ? ` (${item.scale_max_label})` : "";
    return `${p}\n\nOn a scale from ${lo}${lol} to ${hi}${hil}, what would you say?`;
  }
  if (t === "boolean") return `${p}\n\n(Yes or No — feel free to add a sentence of context.)`;
  return p;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = reader.result as string;
      resolve(s.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
