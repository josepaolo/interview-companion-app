import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Mic,
  Radio,
  Send,
  Square,
  StopCircle,
  Type,
  AudioLines,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { participantClient } from "@/lib/supabase";
import {
  blobToBase64,
  nextInterviewerTurn,
  renderSurveyPrompt,
  synthesizeSpeech,
  transcribeAudio,
  type ChatTurn,
} from "@/lib/ai";
import type { Message, Mode, Study, SurveyItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ParticipantChat() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const sessionId = params.get("s") ?? "";
  const accessToken = params.get("t") ?? "";
  const sb = useMemo(() => participantClient(accessToken), [accessToken]);

  const [mode, setMode] = useState<Mode>("text");
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // media refs
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ["p-session", sessionId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("sessions")
        .select("id, study_id, status, mode, withdrawn, current_question_index")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data as Pick<
        any,
        "id" | "study_id" | "status" | "mode" | "withdrawn" | "current_question_index"
      >;
    },
  });

  const { data: study } = useQuery({
    enabled: !!session?.study_id,
    queryKey: ["p-study", session?.study_id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("studies")
        .select(
          "id, title, persona_name, persona_tone, persona_background, description, research_questions, interview_guide, structure_type, max_questions, participant_modes, survey_items, allow_withdrawal",
        )
        .eq("id", session!.study_id)
        .single();
      if (error) throw error;
      return data as Study;
    },
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["p-messages", sessionId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("messages")
        .select("id, role, text, audio_url, question_index, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  useEffect(() => {
    if (session?.mode) setMode(session.mode as Mode);
  }, [session?.mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const visible = (messages ?? []).filter((m) => m.role !== "system");
  const done = session?.status === "completed" || session?.status === "withdrawn";
  const lastMsg = visible[visible.length - 1];
  const participantTurn = !thinking && !done && (!lastMsg || lastMsg.role === "ai");

  // History for the AI, oldest→newest.
  function history(): ChatTurn[] {
    return visible.map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text ?? "",
    }));
  }

  async function completeSession() {
    await sb
      .from("sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    refetchSession();
  }

  // Produce the interviewer's next turn.
  async function advance() {
    if (!study) return;
    const current = (await refetchMessages()).data ?? [];
    const vis = current.filter((m) => m.role !== "system");
    const aiCount = vis.filter((m) => m.role === "ai").length;
    const hist: ChatTurn[] = vis.map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text ?? "",
    }));

    setThinking(true);
    try {
      let text = "";
      let ended = false;

      if (study.structure_type === "hybrid_survey") {
        const items = (study.survey_items as unknown as SurveyItem[]) ?? [];
        const idx = aiCount;
        if (idx >= items.length) {
          text =
            "Thank you so much for your thoughtful answers — that’s everything from my side. I really appreciate your time.";
          ended = true;
        } else {
          const item = items[idx];
          if (item.kind === "survey") {
            text = renderSurveyPrompt(item);
          } else {
            const r = await nextInterviewerTurn({
              study,
              mode,
              history: hist,
              askedSoFar: aiCount,
              probeTopic: item.prompt,
            });
            text = r.text;
          }
        }
      } else {
        const r = await nextInterviewerTurn({
          study,
          mode,
          history: hist,
          askedSoFar: aiCount,
        });
        text = r.text;
        ended = r.ended;
      }

      await sb.from("messages").insert({
        session_id: sessionId,
        role: "ai",
        text,
        question_index: aiCount,
      });
      await sb
        .from("sessions")
        .update({ current_question_index: aiCount + 1 })
        .eq("id", sessionId);
      await refetchMessages();
      if (ended) await completeSession();
      else if (mode === "voice") void speakThenListen(text);
    } catch (e: any) {
      toast.error(e?.message ?? "The interviewer had trouble responding.");
    } finally {
      setThinking(false);
    }
  }

  // Kick off the first question once everything is loaded.
  useEffect(() => {
    if (!study || !messages || startedRef.current || done) return;
    if (visible.length === 0) {
      startedRef.current = true;
      void advance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study, messages]);

  async function submitAnswer(text: string, audioUrl?: string) {
    if (!text.trim() && !audioUrl) return;
    setInput("");
    const idx = lastMsg?.question_index ?? 0;
    await sb.from("messages").insert({
      session_id: sessionId,
      role: "participant",
      text,
      audio_url: audioUrl ?? null,
      question_index: idx,
    });
    await refetchMessages();
    await advance();
  }

  // ---- Recording ----
  async function startRecording(auto = false) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        if (blob.size < 1200) return; // too short / silence
        setProcessing(true);
        try {
          const b64 = await blobToBase64(blob);
          const text = await transcribeAudio(b64, rec.mimeType);
          if (text) await submitAnswer(text);
        } catch (e: any) {
          toast.error(e?.message ?? "Could not transcribe that.");
        } finally {
          setProcessing(false);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      if (auto) autoStopOnSilence(stream, rec);
    } catch {
      toast.error("Microphone access is needed to record.");
    }
  }

  function stopRecording() {
    mediaRef.current?.state === "recording" && mediaRef.current.stop();
  }

  // Stop ~1.5s after speech ends (voice mode auto-flow).
  function autoStopOnSilence(stream: MediaStream, rec: MediaRecorder) {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let heard = false;
    let quietSince = 0;
    const started = performance.now();
    const tick = () => {
      if (rec.state !== "recording") {
        ctx.close();
        return;
      }
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      const rms = Math.sqrt(sum / buf.length) / 128;
      const now = performance.now();
      if (rms > 0.04) {
        heard = true;
        quietSince = 0;
      } else if (heard) {
        if (!quietSince) quietSince = now;
        else if (now - quietSince > 1500) {
          rec.stop();
          ctx.close();
          return;
        }
      }
      if (now - started > 60000) {
        rec.stop();
        ctx.close();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function speakThenListen(text: string) {
    try {
      setSpeaking(true);
      const url = await synthesizeSpeech(text);
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        if (!done) void startRecording(true);
      };
      audio.onerror = () => {
        setSpeaking(false);
        if (!done) void startRecording(true);
      };
      await audio.play();
    } catch {
      setSpeaking(false);
      if (!done) void startRecording(true);
    }
  }

  async function withdraw() {
    await sb.from("sessions").update({ status: "withdrawn", withdrawn: true }).eq("id", sessionId);
    refetchSession();
  }

  // Current hybrid survey widget (structured answer), if applicable.
  const surveyItem =
    study?.structure_type === "hybrid_survey" && participantTurn && lastMsg?.role === "ai"
      ? ((study.survey_items as unknown as SurveyItem[]) ?? [])[lastMsg.question_index ?? -1]
      : undefined;

  const enabledModes = (study?.participant_modes as Mode[]) ?? ["text"];

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <CheckCircle2 className="size-10 text-primary" />
        <h1 className="mt-4 font-serif text-2xl">
          {session?.status === "withdrawn" ? "Thank you" : "Interview complete"}
        </h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          {session?.status === "withdrawn"
            ? "Your responses have been marked for withdrawal."
            : "Thank you for sharing your time and reflections."}
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">Close</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b bg-paper/70 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="min-w-0">
            <p className="truncate font-serif">{study?.title}</p>
            <p className="text-xs text-muted-foreground">
              with {study?.persona_name} · Question {(session?.current_question_index ?? 0) || 1}{" "}
              of {study?.max_questions}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {enabledModes.length > 1 && (
              <div className="mr-1 hidden gap-1 sm:flex">
                {enabledModes.includes("text") && (
                  <ModeBtn active={mode === "text"} onClick={() => setMode("text")} icon={Type} />
                )}
                {enabledModes.includes("audio") && (
                  <ModeBtn active={mode === "audio"} onClick={() => setMode("audio")} icon={AudioLines} />
                )}
                {enabledModes.includes("voice") && (
                  <ModeBtn active={mode === "voice"} onClick={() => setMode("voice")} icon={Radio} />
                )}
              </div>
            )}
            {study?.allow_withdrawal && (
              <Button variant="ghost" size="sm" onClick={withdraw}>
                Withdraw
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={completeSession}>
              <StopCircle className="size-4" /> End
            </Button>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {visible.map((m) => (
            <div key={m.id} className={m.role === "ai" ? "" : "flex justify-end"}>
              <div
                className={
                  m.role === "ai"
                    ? "max-w-[85%] whitespace-pre-wrap rounded-2xl border bg-card p-3 text-sm"
                    : "max-w-[85%] whitespace-pre-wrap rounded-2xl border-l-4 border-primary bg-primary p-3 text-sm text-primary-foreground"
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {(thinking || speaking) && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
              <span className="size-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="size-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-paper/70 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {surveyItem && <SurveyWidget item={surveyItem} onSubmit={(t) => submitAnswer(t)} />}

          {mode === "voice" ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={!participantTurn && !recording}
                onClick={() => (recording ? stopRecording() : startRecording(false))}
                className={`flex size-20 items-center justify-center rounded-full transition-colors ${
                  recording
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground disabled:opacity-40"
                }`}
              >
                {processing ? (
                  <Loader2 className="size-7 animate-spin" />
                ) : recording ? (
                  <Square className="size-7" />
                ) : (
                  <Mic className="size-7" />
                )}
              </button>
              <p className="text-xs text-muted-foreground">
                {processing
                  ? "Transcribing…"
                  : speaking
                    ? "Interviewer is speaking…"
                    : recording
                      ? "Listening — pause when you’re done."
                      : thinking
                        ? "Interviewer is thinking…"
                        : "Tap to speak"}
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitAnswer(input);
                }}
                placeholder={participantTurn ? "Type your answer…" : "…"}
                disabled={!participantTurn}
                className="resize-none"
              />
              {mode === "audio" && (
                <Button
                  variant={recording ? "destructive" : "outline"}
                  size="icon"
                  disabled={(!participantTurn && !recording) || processing}
                  onClick={() => (recording ? stopRecording() : startRecording(false))}
                >
                  {processing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : recording ? (
                    <Square className="size-4" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </Button>
              )}
              <Button
                size="icon"
                disabled={!participantTurn || !input.trim()}
                onClick={() => submitAnswer(input)}
              >
                <Send className="size-4" />
              </Button>
            </div>
          )}
          {mode !== "voice" && (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {recording ? "Recording — tap the square to stop." : "Press ⌘/Ctrl + Enter to send"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md p-2 transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className="size-4" />
    </button>
  );
}

function SurveyWidget({
  item,
  onSubmit,
}: {
  item: SurveyItem;
  onSubmit: (text: string) => void;
}) {
  const [multi, setMulti] = useState<string[]>([]);
  const t = item.question_type;

  if (t === "single" && item.options?.length) {
    return (
      <div className="mb-3 flex flex-wrap gap-2">
        {item.options.map((o) => (
          <Button key={o} variant="outline" size="sm" onClick={() => onSubmit(o)}>
            {o}
          </Button>
        ))}
      </div>
    );
  }
  if (t === "multi" && item.options?.length) {
    return (
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {item.options.map((o) => {
            const on = multi.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => setMulti(on ? multi.filter((x) => x !== o) : [...multi, o])}
                className={`rounded-full border px-3 py-1 text-sm ${
                  on ? "border-primary bg-primary text-primary-foreground" : ""
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
        <Button size="sm" disabled={!multi.length} onClick={() => onSubmit(multi.join(", "))}>
          Submit selection
        </Button>
      </div>
    );
  }
  if (t === "scale") {
    const lo = item.scale_min ?? 1;
    const hi = item.scale_max ?? 5;
    const nums = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    return (
      <div className="mb-3">
        <div className="flex flex-wrap gap-2">
          {nums.map((n) => (
            <Button key={n} variant="outline" size="sm" onClick={() => onSubmit(String(n))}>
              {n}
            </Button>
          ))}
        </div>
        {(item.scale_min_label || item.scale_max_label) && (
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{item.scale_min_label}</span>
            <span>{item.scale_max_label}</span>
          </div>
        )}
      </div>
    );
  }
  if (t === "boolean") {
    return (
      <div className="mb-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onSubmit("Yes")}>
          Yes
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSubmit("No")}>
          No
        </Button>
      </div>
    );
  }
  return null;
}
