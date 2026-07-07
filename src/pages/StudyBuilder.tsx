import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  MODES,
  PERSONA_PRESETS,
  STRUCTURE_OPTIONS,
  type AnswerType,
  type Mode,
  type Study,
  type SurveyItem,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function newToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function uid() {
  return crypto.randomUUID().slice(0, 8);
}

export default function StudyBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Study | null>(null);
  const loadedId = useRef<string | null>(null);

  const { data: study } = useQuery({
    queryKey: ["study", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studies")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Study;
    },
  });

  useEffect(() => {
    if (study && loadedId.current !== study.id) {
      setDraft(study);
      loadedId.current = study.id;
    }
  }, [study]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Study>) => {
      const { error } = await supabase.from("studies").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study", id] });
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("studies").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      navigate("/dashboard");
    },
  });

  if (!draft) return <p className="text-muted-foreground">Loading…</p>;

  const set = (patch: Partial<Study>) => setDraft({ ...draft, ...patch });
  const items = (draft.survey_items as unknown as SurveyItem[]) ?? [];
  const setItems = (next: SurveyItem[]) =>
    set({ survey_items: next as unknown as Study["survey_items"] });
  const modes = (draft.participant_modes as Mode[]) ?? ["text"];
  const toggleMode = (m: Mode) =>
    set({
      participant_modes: modes.includes(m)
        ? modes.filter((x) => x !== m)
        : [...modes, m],
    });

  const shareUrl = `${window.location.origin}/i/${draft.share_token}`;

  async function saveAll() {
    if (!draft) return;
    const { id: _id, owner_id, created_at, updated_at, ...patch } = draft;
    await save.mutateAsync(patch);
    toast.success("Saved");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <Badge variant={draft.status === "live" ? "default" : "secondary"}>
            {draft.status}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link to={`/studies/${id}/responses`}>Responses</Link>
          </Button>
        </div>
      </div>

      <input
        value={draft.title ?? ""}
        onChange={(e) => set({ title: e.target.value })}
        className="mb-6 w-full bg-transparent font-serif text-3xl outline-none"
        placeholder="Untitled study"
      />

      <Tabs defaultValue="design">
        <TabsList>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="consent">Consent &amp; ethics</TabsTrigger>
          <TabsTrigger value="share">Share &amp; publish</TabsTrigger>
        </TabsList>

        {/* DESIGN */}
        <TabsContent value="design" className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="What this study is about (shown to participants)."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Research questions</Label>
              <Textarea
                rows={4}
                value={draft.research_questions ?? ""}
                onChange={(e) => set({ research_questions: e.target.value })}
                placeholder="The underlying questions your study must answer."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interview guide</Label>
              <Textarea
                rows={8}
                value={draft.interview_guide ?? ""}
                onChange={(e) => set({ interview_guide: e.target.value })}
                placeholder="The questions and topics the AI should cover."
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <Label>Interview structure</Label>
            <div className="grid gap-2">
              {STRUCTURE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set({ structure_type: o.value })}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    draft.structure_type === o.value
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="text-sm text-muted-foreground">{o.help}</div>
                </button>
              ))}
            </div>
          </section>

          {draft.structure_type === "hybrid_survey" && (
            <section className="space-y-4 rounded-xl border bg-card p-5">
              <Label>Survey items &amp; probes</Label>
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No items yet. Add a survey question or a probe to begin.
                </p>
              )}
              {items.map((it, i) => (
                <SurveyItemEditor
                  key={it.id}
                  item={it}
                  index={i}
                  total={items.length}
                  onChange={(next) => setItems(items.map((x, j) => (j === i ? next : x)))}
                  onMove={(dir) => {
                    const j = i + dir;
                    if (j < 0 || j >= items.length) return;
                    const copy = [...items];
                    [copy[i], copy[j]] = [copy[j], copy[i]];
                    setItems(copy);
                  }}
                  onDelete={() => setItems(items.filter((_, j) => j !== i))}
                />
              ))}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setItems([
                      ...items,
                      { id: uid(), kind: "survey", prompt: "", question_type: "open" },
                    ])
                  }
                >
                  <Plus className="size-4" /> Survey question
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setItems([...items, { id: uid(), kind: "probe", prompt: "" }])
                  }
                >
                  <Plus className="size-4" /> Semi-structured probe
                </Button>
              </div>
            </section>
          )}

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div>
              <Label>Participant modes</Label>
              <p className="text-sm text-muted-foreground">
                Enable more than one to let participants choose.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleMode(m.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    modes.includes(m.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/40"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Max questions</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={draft.max_questions ?? 12}
                  onChange={(e) => set({ max_questions: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max duration (min)</Label>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={draft.max_duration_minutes ?? 30}
                  onChange={(e) => set({ max_duration_minutes: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target sample size</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.target_sample_size ?? 100}
                  onChange={(e) => set({ target_sample_size: Number(e.target.value) })}
                />
              </div>
            </div>
          </section>
        </TabsContent>

        {/* PERSONA */}
        <TabsContent value="persona">
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="space-y-1.5">
              <Label>Preset</Label>
              <Select
                value={
                  PERSONA_PRESETS.find((p) => p.tone === draft.persona_tone)?.key ?? "custom"
                }
                onValueChange={(key) => {
                  const p = PERSONA_PRESETS.find((x) => x.key === key);
                  if (p && p.key !== "custom")
                    set({ persona_tone: p.tone, persona_background: p.background });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_PRESETS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Interviewer name</Label>
              <Input
                value={draft.persona_name ?? ""}
                onChange={(e) => set({ persona_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Input
                value={draft.persona_tone ?? ""}
                onChange={(e) => set({ persona_tone: e.target.value })}
                placeholder="e.g. warm empathetic clinician"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Background &amp; style notes</Label>
              <Textarea
                rows={5}
                value={draft.persona_background ?? ""}
                onChange={(e) => set({ persona_background: e.target.value })}
                placeholder="How does this interviewer speak? What do they emphasize?"
              />
            </div>
          </section>
        </TabsContent>

        {/* CONSENT */}
        <TabsContent value="consent">
          <section className="space-y-5 rounded-xl border bg-card p-5">
            <ToggleRow
              label="Show consent screen before interview"
              checked={!!draft.consent_enabled}
              onChange={(v) => set({ consent_enabled: v })}
            />
            <ToggleRow
              label="Collect participant name and email"
              help="If off, sessions are fully anonymous."
              checked={!!draft.collect_identity}
              onChange={(v) => set({ collect_identity: v })}
            />
            <ToggleRow
              label="Show a data-use notice"
              checked={!!draft.data_use_notice}
              onChange={(v) => set({ data_use_notice: v })}
            />
            <ToggleRow
              label="Allow participants to withdraw and delete their data"
              checked={!!draft.allow_withdrawal}
              onChange={(v) => set({ allow_withdrawal: v })}
            />
            <div className="space-y-1.5">
              <Label>Consent text</Label>
              <Textarea
                rows={7}
                value={draft.consent_text ?? ""}
                onChange={(e) => set({ consent_text: e.target.value })}
                placeholder="Shown to participants before the interview begins."
              />
            </div>
          </section>
        </TabsContent>

        {/* SHARE */}
        <TabsContent value="share" className="space-y-6">
          <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
            {draft.status === "draft" && (
              <Button onClick={() => set({ status: "live" })}>
                <Radio className="size-4" /> Go live
              </Button>
            )}
            {draft.status === "live" && (
              <Button variant="outline" onClick={() => set({ status: "closed" })}>
                Close study
              </Button>
            )}
            {draft.status === "closed" && (
              <Button variant="outline" onClick={() => set({ status: "draft" })}>
                Move to draft
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={!!draft.share_active}
                onCheckedChange={(v) => set({ share_active: v })}
              />
              <span className="text-sm text-muted-foreground">
                Share link is {draft.share_active ? "active" : "inactive"}
              </span>
            </div>
          </section>

          <section className="grid gap-6 rounded-xl border bg-card p-5 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <Label>Participant link</Label>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => set({ share_token: newToken() })}
              >
                <RefreshCw className="size-4" /> Regenerate token
              </Button>
              {draft.status !== "live" && (
                <p className="text-sm text-muted-foreground">
                  The link only accepts responses when the study is live.
                </p>
              )}
            </div>
            <div className="text-center">
              <div className="rounded-lg border bg-white p-3">
                <QRCodeSVG value={shareUrl} size={140} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Scan to open</p>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex items-center justify-between border-t pt-5">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" /> Delete study
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this study?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the study and all its responses. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => del.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={saveAll} disabled={save.isPending}>
          <Save className="size-4" /> {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{label}</div>
        {help && <div className="text-sm text-muted-foreground">{help}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const ANSWER_TYPES: { value: AnswerType; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "single", label: "Single choice" },
  { value: "multi", label: "Multiple choice" },
  { value: "scale", label: "Scale" },
  { value: "boolean", label: "Yes / No" },
];

function SurveyItemEditor({
  item,
  index,
  total,
  onChange,
  onMove,
  onDelete,
}: {
  item: SurveyItem;
  index: number;
  total: number;
  onChange: (i: SurveyItem) => void;
  onMove: (dir: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">
          {index + 1}. {item.kind === "survey" ? "Survey" : "Probe"}
        </Badge>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <Select
          value={item.kind}
          onValueChange={(v) => onChange({ ...item, kind: v as SurveyItem["kind"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="survey">Survey</SelectItem>
            <SelectItem value="probe">Probe</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          rows={2}
          value={item.prompt}
          onChange={(e) => onChange({ ...item, prompt: e.target.value })}
          placeholder={item.kind === "survey" ? "The question" : "Topic to probe"}
        />
      </div>
      {item.kind === "survey" && (
        <div className="space-y-2">
          <Select
            value={item.question_type ?? "open"}
            onValueChange={(v) => onChange({ ...item, question_type: v as AnswerType })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANSWER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(item.question_type === "single" || item.question_type === "multi") && (
            <Textarea
              rows={3}
              value={(item.options ?? []).join("\n")}
              onChange={(e) =>
                onChange({ ...item, options: e.target.value.split("\n").filter(Boolean) })
              }
              placeholder="One option per line"
            />
          )}
          {item.question_type === "scale" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input
                type="number"
                value={item.scale_min ?? 1}
                onChange={(e) => onChange({ ...item, scale_min: Number(e.target.value) })}
                placeholder="Min"
              />
              <Input
                type="number"
                value={item.scale_max ?? 5}
                onChange={(e) => onChange({ ...item, scale_max: Number(e.target.value) })}
                placeholder="Max"
              />
              <Input
                value={item.scale_min_label ?? ""}
                onChange={(e) => onChange({ ...item, scale_min_label: e.target.value })}
                placeholder="Min label"
              />
              <Input
                value={item.scale_max_label ?? ""}
                onChange={(e) => onChange({ ...item, scale_max_label: e.target.value })}
                placeholder="Max label"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
