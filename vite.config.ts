import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

/**
 * Local dev API: mounts /api/* handlers inside the Vite dev server so the app
 * and the secure AI proxy run from a single `npm run dev`. In production these
 * same handlers are served as serverless functions (see /api/*.ts).
 */
function apiPlugin(env: Record<string, string>): Plugin {
  // Make non-VITE secrets (API keys) visible to the handlers via process.env.
  for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "INTERVIEW_MODEL"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }
  return {
    name: "interview-companion-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();
        const route = req.url.split("?")[0].replace(/\/$/, "");
        const name = route.slice("/api/".length);
        if (!/^[a-z][a-z0-9_-]*$/.test(name)) return next();
        const file = path.resolve(__dirname, "api", `${name}.ts`);
        if (!fs.existsSync(file)) return next();
        try {
          const mod = await server.ssrLoadModule(file);
          const body = await readJson(req);
          await mod.default({ method: req.method, body }, makeRes(res));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: err?.message ?? "Server error" }));
        }
      });
    },
  };
}

function readJson(req: any): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve({});
      }
    });
  });
}

// Minimal Vercel-style res shim so one handler works in dev and prod.
function makeRes(res: any) {
  return {
    setHeader: (k: string, v: string) => res.setHeader(k, v),
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(obj: any) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(obj));
    },
    end: (data?: any) => res.end(data),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), apiPlugin(env)],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: { port: 8080, host: true },
    preview: { port: 8080 },
  };
});
