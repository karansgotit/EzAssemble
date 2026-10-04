// SHR-01: checks this machine's Vertex AI setup with ONE real Gemini call (a fraction of a cent).
// Usage: npm run check:vertex -- [model-id]
// Reads .env.local the same way Next.js does, so a pass here means the API routes can authenticate.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ApiError, GoogleGenAI } from "@google/genai";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";

const DEFAULT_MODEL = "gemini-2.5-flash";
const TEST_IMAGE = "assets/kallax-crops/step-03.png";

const ServiceAccount = z.object({
  type: z.literal("service_account"),
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().startsWith("-----BEGIN"),
});

const Probe = z.object({
  stepNumber: z.number().int(),
  summary: z.string(),
});

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function readEnv() {
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!project) fail("GOOGLE_CLOUD_PROJECT is empty. Set it in .env.local (copy .env.example).");
  if (!raw) fail("GOOGLE_SERVICE_ACCOUNT_JSON is empty. Paste the key JSON in .env.local as ONE line.");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    fail(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste it as one line, bare or wrapped in " +
        "'single quotes' (double quotes break it).",
    );
  }
  const parsed = ServiceAccount.safeParse(json);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    fail(`GOOGLE_SERVICE_ACCOUNT_JSON is not a service-account key:\n  - ${problems.join("\n  - ")}`);
  }
  return { project, location, credentials: parsed.data };
}

function hint(status: number, model: string, location: string): string {
  if (status === 401) return "The key was rejected. Was it deleted or disabled? Create a new JSON key.";
  if (status === 403)
    return "Enable the Vertex AI API on the project, and give the service account the 'Vertex AI User' role.";
  if (status === 404)
    return `Model "${model}" isn't available in location "${location}". Try another id or location.`;
  if (status === 429) return "Quota exceeded. Wait a minute, or check the project's Vertex AI quotas.";
  return "See the message above.";
}

async function listGeminiModels(ai: GoogleGenAI): Promise<void> {
  try {
    const names: string[] = [];
    for await (const m of await ai.models.list({ config: { pageSize: 100 } })) {
      if (m.name?.includes("gemini")) names.push(m.name.replace("publishers/google/models/", ""));
    }
    console.log(`\nGemini models listed for this project (${names.length}):`);
    for (const name of names.sort()) console.log(`  ${name}`);
  } catch (e) {
    console.warn(`\n(Couldn't list models: ${e instanceof Error ? e.message.slice(0, 200) : String(e)})`);
  }
}

async function main() {
  const model = process.argv[2] || DEFAULT_MODEL;
  const { project, location, credentials } = readEnv();

  console.log(`project          ${project}`);
  console.log(`location         ${location}`);
  console.log(`service account  ${credentials.client_email}`);
  if (credentials.project_id !== project) {
    console.warn(`! The key belongs to project "${credentials.project_id}", not "${project}".`);
  }

  const ai = new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials } });

  const image = readFileSync(join(process.cwd(), TEST_IMAGE)).toString("base64");
  const started = Date.now();
  let text: string | undefined;
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: "This is one step of an IKEA manual. Give the printed step number and a one-sentence summary." },
            { inlineData: { mimeType: "image/png", data: image } },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(Probe),
      },
    });
    text = res.text;
    const u = res.usageMetadata;
    console.log(`\nmodel            ${model}`);
    console.log(`latency          ${Date.now() - started} ms`);
    console.log(
      `tokens           in ${u?.promptTokenCount ?? "?"} · out ${u?.candidatesTokenCount ?? "?"} · thinking ${u?.thoughtsTokenCount ?? 0}`,
    );
  } catch (e) {
    if (e instanceof ApiError) fail(`Vertex AI returned ${e.status}: ${e.message.slice(0, 400)}\n  → ${hint(e.status, model, location)}`);
    fail(`The call failed before reaching Vertex AI: ${e instanceof Error ? e.message : String(e)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text ?? "");
  } catch {
    fail(`The model didn't return JSON: ${text?.slice(0, 200)}`);
  }
  const probe = Probe.safeParse(json);
  if (!probe.success) fail(`The JSON didn't match the schema: ${JSON.stringify(json)}`);
  console.log(`answer           ${JSON.stringify(probe.data)}`);

  await listGeminiModels(ai);
  console.log("\n✓ Vertex AI works from this machine.");
}

main();
