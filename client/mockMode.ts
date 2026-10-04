// Mock mode: answer the AI calls from the saved KALLAX manual instead of calling Gemini.
// No AI calls, no cost, no internet needed. Set NEXT_PUBLIC_MOCK_AI=1 in .env.local (or on the host) and rebuild.
export function isMockAiOn(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_AI === "1";
}
