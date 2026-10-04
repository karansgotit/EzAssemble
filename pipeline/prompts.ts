import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(process.cwd(), "pipeline", "prompts");

// Reads pipeline/prompts/<name>.md and fills each {{var}}. Text goes in as-is; lists and objects become pretty JSON.
export function loadPrompt(name: string, vars: Record<string, unknown> = {}): string {
  const template = readFileSync(join(PROMPTS_DIR, `${name}.md`), "utf8");
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`Prompt "${name}" needs {{${key}}}, but it wasn't given.`);
    const value = vars[key];
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  });
}