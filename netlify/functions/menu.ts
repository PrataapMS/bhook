import type { Config } from "@netlify/functions";
import type { MenuMethod, MenuRequest } from "../../shared/types";
import { env } from "../../server/env";
import { fail, handleError, json, readJson } from "../../server/http";
import { menuFromWebSearch, menuFromWebsite } from "../../server/menu";
import { readMenu, writeMenu } from "../../server/menuCache";
import { mockMenu } from "../../server/mocks";

/** Under netlify dev's 30 s sync limit, leaving room to respond. */
const BUDGET_MS = 25_000;

// Two steps, called by the client one after the other so each request stays inside the timeout:
// POST /api/menu?method=website, then ?method=web_search only if the website had nothing.
export default async (req: Request) => {
  if (req.method !== "POST") return fail(405, "Use POST");
  const method = new URL(req.url).searchParams.get("method") as MenuMethod | null;
  if (method !== "website" && method !== "web_search") return fail(400, "method must be website or web_search");

  const body = await readJson<MenuRequest>(req);
  if (!body?.placeId || !body.name) return fail(400, "Send placeId, name and address");

  const request: MenuRequest = {
    placeId: String(body.placeId).slice(0, 200),
    name: String(body.name).slice(0, 120),
    address: String(body.address ?? "").slice(0, 300),
    websiteUri: typeof body.websiteUri === "string" ? body.websiteUri.slice(0, 500) : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
  };

  if (env.mockOpenRouter()) return json(mockMenu(request, method));

  const cached = await readMenu(request.placeId);
  if (cached) return json(cached);

  const signal = AbortSignal.timeout(BUDGET_MS);
  try {
    const result = method === "website" ? await menuFromWebsite(request, signal) : await menuFromWebSearch(request, signal);
    await writeMenu(request.placeId, result);
    return json(result);
  } catch (err) {
    if (signal.aborted) return fail(504, "Menu lookup timed out", "Try again; the source was slow to respond");
    return handleError(err);
  }
};

export const config: Config = { path: "/api/menu" };
