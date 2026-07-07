import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, MessageSquare, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import type { Study } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  live: "Live",
  closed: "Closed",
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: studies } = useQuery({
    queryKey: ["studies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studies")
        .select("id, title, description, status, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Pick<Study, "id" | "title" | "description" | "status" | "updated_at">[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["study-stats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("study_id, status");
      if (error) throw error;
      const map: Record<string, { total: number; completed: number }> = {};
      for (const s of data as { study_id: string; status: string }[]) {
        map[s.study_id] ??= { total: 0, completed: 0 };
        map[s.study_id].total++;
        if (s.status === "completed") map[s.study_id].completed++;
      }
      return map;
    },
  });

  const createStudy = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("studies")
        .insert({ owner_id: user!.id, title: "Untitled study" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      navigate(`/studies/${id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create study"),
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Your studies</h1>
        <Button onClick={() => createStudy.mutate()} disabled={createStudy.isPending}>
          <Plus className="size-4" />
          New study
        </Button>
      </div>

      {studies && studies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {studies.map((s) => {
            const st = stats?.[s.id];
            const pct = st && st.total ? Math.round((st.completed / st.total) * 100) : 0;
            return (
              <Link
                key={s.id}
                to={`/studies/${s.id}`}
                className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-xl">{s.title}</h2>
                  <Badge variant={s.status === "live" ? "default" : "secondary"}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </div>
                {s.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4" />
                    {st?.total ?? 0} responses
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="size-4" />
                    {pct}% completion
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card/50 py-20 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-serif text-lg">No studies yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first study to start collecting interviews.
          </p>
          <Button className="mt-5" onClick={() => createStudy.mutate()}>
            <Plus className="size-4" />
            New study
          </Button>
        </div>
      )}
    </div>
  );
}
