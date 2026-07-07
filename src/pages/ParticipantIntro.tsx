import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { MODES, type Mode, type Study } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function ParticipantIntro() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: study, isLoading, isError } = useQuery({
    queryKey: ["public-study", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studies")
        .select(
          "id, title, description, persona_name, max_questions, participant_modes, consent_enabled, consent_text, collect_identity, data_use_notice, allow_withdrawal, status, share_active",
        )
        .eq("share_token", token!)
        .maybeSingle();
      if (error) throw error;
      return data as Partial<Study> | null;
    },
  });

  if (isLoading) return <Centered>Loading…</Centered>;
  if (isError || !study)
    return <Centered>This interview link isn’t available.</Centered>;
  if (study.status !== "live" || !study.share_active)
    return <Centered>This study isn’t currently accepting responses.</Centered>;

  const modes = (study.participant_modes as Mode[]) ?? ["text"];
  const chosenMode = mode ?? modes[0];

  async function begin() {
    if (study!.consent_enabled && !consent) {
      toast.error("Please agree to take part before beginning.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          study_id: study!.id!,
          mode: chosenMode,
          participant_name: study!.collect_identity ? name || null : null,
          participant_email: study!.collect_identity ? email || null : null,
          consent_given: !!consent,
          consent_text_snapshot: study!.consent_text ?? null,
        })
        .select("id, access_token")
        .single();
      if (error) throw error;
      navigate(`/i/${token}/chat?s=${data.id}&t=${data.access_token}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the interview.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center px-5 py-4">
        <Link to="/" className="flex items-center gap-2 font-serif">
          <MessagesSquare className="size-5 text-primary" />
          Interview Companion
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-16">
        <p className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">
          Research interview
        </p>
        <h1 className="font-serif text-3xl">{study.title}</h1>
        {study.description && (
          <p className="mt-3 text-muted-foreground">{study.description}</p>
        )}

        <div className="mt-6 rounded-xl bg-accent/40 p-4">
          <h2 className="font-medium">What to expect</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You’ll speak with {study.persona_name}, an AI interviewer. Up to about{" "}
            {study.max_questions} short questions, one at a time. There are no right or wrong
            answers.
          </p>
        </div>

        {study.data_use_notice && (
          <p className="mt-4 text-sm text-muted-foreground">
            Your responses are recorded and stored securely, and used only for this research.
            {study.allow_withdrawal && " You may withdraw at any time."}
          </p>
        )}

        {study.collect_identity && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        )}

        {modes.length > 1 && (
          <div className="mt-6">
            <Label>How would you like to answer?</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MODES.filter((m) => modes.includes(m.value)).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    chosenMode === m.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/40"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {study.consent_enabled && (
          <div className="mt-6 rounded-xl border p-4">
            {study.consent_text && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {study.consent_text}
              </p>
            )}
            <label className="mt-3 flex items-start gap-2 text-sm">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(!!v)}
                className="mt-0.5"
              />
              I have read and agree to take part in this interview.
            </label>
          </div>
        )}

        <Button
          className="mt-8 w-full"
          size="lg"
          onClick={begin}
          disabled={busy || (!!study.consent_enabled && !consent)}
        >
          {busy ? "Starting…" : "Begin interview"}
        </Button>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 text-center text-muted-foreground">
      {children}
    </div>
  );
}
