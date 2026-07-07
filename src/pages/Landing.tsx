import { Link } from "react-router-dom";
import { BookOpen, MessageSquareQuote, Sparkles, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Guided or open",
    body: "Structured, semi-structured, or unstructured — the AI follows your intent.",
  },
  {
    icon: MessageSquareQuote,
    title: "Adaptive probing",
    body: "Context-aware follow-ups that reach past first answers, without leading.",
  },
  {
    icon: Sparkles,
    title: "Configurable persona",
    body: "Choose a warm clinician, neutral academic, or your own tailored voice.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 font-serif text-lg">
          <MessagesSquare className="size-5 text-primary" />
          Interview Companion
        </span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth?mode=signin">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth?mode=signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="py-16 md:py-24">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            For researchers &amp; social scientists
          </p>
          <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-6xl">
            AI-assisted qualitative interviews, at the scale of a survey.
          </h1>
          <p className="prose-academic mt-6 text-lg text-muted-foreground">
            Design an interview guide, choose a persona and structure, and share a single link.
            Participants speak with a thoughtful AI interviewer. You get clean, searchable
            transcripts — ready for coding and analysis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth?mode=signup">Start a study</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth?mode=signin">I have an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 pb-20 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <f.icon className="mb-3 size-6 text-primary" />
              <h3 className="font-serif text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-muted-foreground">
          Built for academic research. Consent, ethics, and withdrawal built in.
        </div>
      </footer>
    </div>
  );
}
