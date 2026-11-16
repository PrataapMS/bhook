import type {
  AnalyzeRequest,
  ApiError,
  HealthResponse,
  MenuMethod,
  MenuRequest,
  MenuResult,
  ReviewAnalysis,
  SearchRequest,
  SearchResponse,
} from "../shared/types";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  } catch {
    throw new Error("You're offline, or the server can't be reached.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as ApiError | null;
    throw new Error(err?.detail ? `${err.error}: ${err.detail}` : err?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  health: () => call<HealthResponse>("/api/health"),
  search: (req: SearchRequest) => call<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify(req) }),
  analyze: (req: AnalyzeRequest) => call<ReviewAnalysis>("/api/analyze", { method: "POST", body: JSON.stringify(req) }),
  menu: (method: MenuMethod, req: MenuRequest) =>
    call<MenuResult>(`/api/menu?method=${method}`, { method: "POST", body: JSON.stringify(req) }),
};
