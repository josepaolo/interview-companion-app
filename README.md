# Interview Companion 2.0

An AI-conducted qualitative research interview platform. Researchers design an
interview guide, choose a persona and structure, and share a single link.
Participants speak with a thoughtful AI interviewer — by text, audio, or full
voice — and you get clean, searchable transcripts ready for coding and analysis.

Built for the SIFMA Facilities Management AI Roadmap study, but general-purpose.

---

## Running it on your Mac (the easy way)

1. **Add your AI keys.** Open the `.env` file in this folder with any text editor
   and paste in your keys:
   - `ANTHROPIC_API_KEY="…"` — powers the interviewer.
     Get one at <https://console.anthropic.com> → **API Keys** (add a little
     billing credit first; interviews cost a few cents each).
   - `OPENAI_API_KEY="…"` — powers the spoken voice + transcription (only needed
     for audio/voice modes). Get one at <https://platform.openai.com/api-keys>.
2. **Double-click `Start Interview Companion.command`.**
   The first run installs everything (about a minute), then the app opens at
   <http://localhost:8080/>. Leave that Terminal window open while you use it.
   Close it (or press Ctrl+C) to stop.

> If macOS blocks the launcher the first time, right-click it → **Open** → **Open**.

### Or run it from the terminal

```bash
cd ~/Documents/SIFMA/interview-companion-app
npm install       # first time only
npm run dev       # → http://localhost:8080/
```

---

## Using it

1. **Sign up** with an email + password (no confirmation email needed).
2. **New study** → fill in the description, research questions, and interview
   guide. Pick a **structure** (structured / semi-structured / unstructured /
   hybrid survey), a **persona**, and which **modes** participants can use.
3. **Consent & ethics** tab — toggle the consent screen, anonymity, data-use
   notice, and withdrawal.
4. **Share & publish** tab — click **Go live**, then copy the participant link or
   share the QR code.
5. Watch responses land on the **dashboard**; open **Responses** → a session to
   read the transcript, or **Export CSV** for analysis.

---

## How it fits together

- **Frontend:** Vite + React + TypeScript (a plain single-page app).
- **Data & accounts:** Supabase (project `oqgikgkrdjpeqbszchnj`) via the browser
  client. Row-level security scopes each researcher to their own studies and each
  participant to their own session.
- **AI:** a small server-side proxy in `api/` keeps your keys secret.
  - `api/chat.ts` — the interviewer, via Anthropic Claude (`claude-sonnet-5` by
    default; set `INTERVIEW_MODEL` in `.env` to change it).
  - `api/tts.ts` / `api/transcribe.ts` — OpenAI text-to-speech and transcription.
  Locally these run inside the dev server. In production they deploy as
  serverless functions.

## Deploying (optional)

Deploy to [Vercel](https://vercel.com): import this folder, add the four env
vars from `.env` in the project settings, and deploy. `vercel.json` already wires
SPA routing and the `/api` functions.

## Notes

- The Supabase anon key in `.env` is public-facing by design (safe to ship).
  **Never** commit an OpenAI or Anthropic key — `.gitignore` already excludes
  `.env`.
- Voice mode records with your browser's microphone and works best in Chrome.
