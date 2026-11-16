import type { ApiError } from "../shared/types";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const fail = (status: number, error: string, detail?: string) =>
  json({ error, detail } satisfies ApiError, status);

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Error carrying an HTTP status from an upstream API. Never include keys in messages. */
export class UpstreamError extends Error {
  constructor(
    public service: "google" | "openrouter",
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof UpstreamError) {
    const status = err.status === 429 ? 429 : 502;
    return fail(status, `${err.service} request failed (${err.status})`, err.message);
  }
  console.error(err);
  return fail(500, "Unexpected server error");
}
