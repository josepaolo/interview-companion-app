import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Message, Session } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Transcript() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();

  const { data: session } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return data as Session;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  const visible = (messages ?? []).filter((m) => m.role !== "system");
  const who = session?.participant_name || session?.participant_email || "Anonymous participant";

  function download(kind: "txt" | "json") {
    if (!visible.length) return;
    let content: string;
    if (kind === "json") {
      content = JSON.stringify({ session, messages: visible }, null, 2);
    } else {
      content = visible
        .map((m) => `${m.role === "ai" ? "Interviewer" : "Participant"}: ${m.text}`)
        .join("\n\n");
    }
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${sessionId?.slice(0, 8)}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Link
        to={`/studies/${id}/responses`}
        className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to responses
      </Link>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl">{who}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{session?.status}</Badge>
            <span className="capitalize">{session?.mode} mode</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => download("txt")}>
            <FileDown className="size-4" /> Text
          </Button>
          <Button variant="outline" size="sm" onClick={() => download("json")}>
            <FileDown className="size-4" /> JSON
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages recorded.</p>
        )}
        {visible.map((m) => (
          <div key={m.id} className={m.role === "ai" ? "" : "flex justify-end"}>
            <div
              className={
                m.role === "ai"
                  ? "max-w-[85%] rounded-xl border bg-card p-3 text-sm"
                  : "max-w-[85%] rounded-xl border-l-4 border-primary bg-primary p-3 text-sm text-primary-foreground"
              }
            >
              {m.text}
              {m.audio_url && (
                <audio controls src={m.audio_url} className="mt-2 w-full" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
