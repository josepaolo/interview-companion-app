import type { Database } from "@/lib/database.types";

export type Study = Database["public"]["Tables"]["studies"]["Row"];
export type StudyUpdate = Database["public"]["Tables"]["studies"]["Update"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];

export type StructureType =
  | "structured"
  | "semi_structured"
  | "unstructured"
  | "hybrid_survey";

export type Mode = "text" | "audio" | "voice";
export type StudyStatus = "draft" | "live" | "closed";

export type SurveyItemKind = "survey" | "probe";
export type AnswerType = "open" | "single" | "multi" | "scale" | "boolean";

/** One item in a hybrid survey-interview (stored in studies.survey_items JSONB). */
export interface SurveyItem {
  id: string;
  kind: SurveyItemKind;
  prompt: string;
  question_type?: AnswerType;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
}

export interface PersonaPreset {
  key: string;
  label: string;
  tone: string;
  background: string;
}

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    key: "clinician",
    label: "Warm empathetic clinician",
    tone: "warm, empathetic clinician",
    background:
      "Speaks gently and unhurriedly, validates feelings, leaves space for the participant to reflect. Never clinical or cold.",
  },
  {
    key: "academic",
    label: "Neutral academic researcher",
    tone: "neutral, precise academic researcher",
    background:
      "Professional and even-handed. Curious about specifics and evidence. Avoids leading the participant to any view.",
  },
  {
    key: "peer",
    label: "Curious peer",
    tone: "friendly, curious peer",
    background:
      "Conversational and relaxed, like a knowledgeable colleague. Uses plain language and genuine interest.",
  },
  {
    key: "journalist",
    label: "Concise journalist",
    tone: "concise, incisive journalist",
    background:
      "Asks sharp, economical questions and follows up on the interesting thread. Respectful but gets to the point.",
  },
  { key: "custom", label: "Custom", tone: "", background: "" },
];

export const STRUCTURE_OPTIONS: {
  value: StructureType;
  label: string;
  help: string;
}[] = [
  {
    value: "structured",
    label: "Structured",
    help: "The AI asks your guide questions verbatim, in order, with minimal deviation.",
  },
  {
    value: "semi_structured",
    label: "Semi-structured",
    help: "The AI follows your guide but adds adaptive follow-up probes when answers are shallow.",
  },
  {
    value: "unstructured",
    label: "Unstructured",
    help: "The AI explores your research questions conversationally, following the participant's lead.",
  },
  {
    value: "hybrid_survey",
    label: "Hybrid survey-interview",
    help: "Fixed survey questions plus semi-structured probes, in an order you set.",
  },
];

export const MODES: { value: Mode; label: string; help: string }[] = [
  { value: "text", label: "Text chat", help: "Participants type their answers." },
  {
    value: "audio",
    label: "Audio (record & type)",
    help: "Participants can record answers that are transcribed, or type.",
  },
  {
    value: "voice",
    label: "Real-time voice",
    help: "The interviewer speaks each question aloud and listens for the answer, hands-free.",
  },
];
