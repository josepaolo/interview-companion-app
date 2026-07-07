import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

/** Gate: sends unauthenticated visitors to /auth, preserving where they wanted to go. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?mode=signin&redirect=${redirect}`} replace />;
  }
  return <Outlet />;
}

/** Chrome for authenticated researcher pages: header + sign out. */
export function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/auth?mode=signin");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-paper/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-serif text-lg">
            <MessagesSquare className="size-5 text-primary" />
            Interview Companion
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
