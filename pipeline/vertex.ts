import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Thrown when the Google Cloud settings are missing or broken; the API routes turn it into a 503.
export class VertexConfigError extends Error {}

const ServiceAccount = z.object({
  type: z.literal("service_account"),
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().startsWith("-----BEGIN"),
});

let client: GoogleGenAI | undefined;

// One shared Vertex AI client, created on first use from the settings in .env.local.
export function getVertexClient(): GoogleGenAI {
  if (client) return client;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!project) throw new VertexConfigError("GOOGLE_CLOUD_PROJECT is not set.");
  if (!raw) throw new VertexConfigError("GOOGLE_SERVICE_ACCOUNT_JSON is not set.");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new VertexConfigError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  const key = ServiceAccount.safeParse(json);
  if (!key.success) throw new VertexConfigError("GOOGLE_SERVICE_ACCOUNT_JSON is not a service-account key.");

  client = new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials: key.data } });
  return client;
}