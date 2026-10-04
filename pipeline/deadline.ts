import "server-only";

export class PipelineDeadlineError extends Error {}

// One deadline across all validation retries, including generators that ignore cancellation.
export async function withDeadline<T>(ms: number, parent: AbortSignal | undefined,
  run: (signal: AbortSignal, remainingMs: () => number) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortParent: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    const stop = (error: Error) => { controller.abort(error); reject(error); };
    abortParent = () => stop(new DOMException("Model request cancelled.", "AbortError"));
    if (parent?.aborted) { abortParent(); return; }
    parent?.addEventListener("abort", abortParent, { once: true });
    timer = setTimeout(() => stop(new PipelineDeadlineError("Model request timed out. Follow the original diagram.")), ms);
  });
  try {
    const task = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return run(controller.signal, () => Math.max(1, Math.ceil(ms - (performance.now() - started))));
    });
    return await Promise.race([task, cancelled]);
  } finally {
    clearTimeout(timer);
    if (abortParent) parent?.removeEventListener("abort", abortParent);
  }
}
