import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Session, Study } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  abandoned: "Abandoned",
};

export default function Responses() {
  const { id } = useParams<{ id: string }>();

  const { data: study } = useQuery({
    queryKey: ["study", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studies")
        .select("id, title")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Pick<Study, "id" | "title">;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("study_id", id!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });

  const total = sessions?.length ?? 0;
  const completed = sessions?.filter((s) => s.status === "completed").length ?? 0;

  async function exportCsv() {
    if (!sessions?.length) return;
    const ids = sessions.map((s) => s.id);
    const { data: msgs } = await supabase
      .from("messages")
      .select("session_id, role, text, question_index, created_at")
      .in("session_id", ids)
      .order("created_at", { ascending: true });
    const rows: string[][] = [
      ["session_id", "participant", "mode", "status", "role", "q_index", "text", "at"],
    ];
    const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
    for (const m of (msgs as any[]) ?? []) {
      if (m.role === "system") continue;
      const s = byId[m.session_id];
      rows.push([
        m.session_id,
        s?.participant_name || s?.participant_email || "Anonymous",
        s?.mode ?? "",
        s?.status ?? "",
        m.role,
        String(m.question_index ?? ""),
        m.text ?? "",
        m.created_at ?? "",
      ]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${study?.title ?? "study"}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <div>
      <Link
        to={`/studies/${id}`}
        className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to study
      </Link>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl">{study?.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} responses · {completed} completed ·{" "}
            {total ? Math.round((completed / total) * 100) : 0}% completion
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!total}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.started_at
                      ? formatDistanceToNow(new Date(s.started_at), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {s.participant_name || s.participant_email || (
                      <span className="text-muted-foreground">Anonymous</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{s.mode}</TableCell>
                  <TableCell>Q{s.current_question_index ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "completed" ? "default" : "secondary"}>
                      {STATUS[s.status] ?? s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/studies/${id}/sessions/${s.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-20 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No responses yet. Share your link to start collecting.
          </p>
        </div>
      )}
    </div>
  );
}
