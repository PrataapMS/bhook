import type { Config } from "@netlify/functions";
import type { AnalyzeRequest } from "../../shared/types";
import { env } from "../../server/env";
import { fail, handleError, json, readJson } from "../../server/http";
import { mockAnalysis } from "../../server/mocks";
import { analyzeReviews } from "../../server/openrouter";

export default async (req: Request) => {
  if (req.method !== "POST") return fail(405, "Use POST");
  const body = await readJson<AnalyzeRequest>(req);
  if (!body?.placeId || !body.name || !Array.isArray(body.reviews)) {
    return fail(400, "Send placeId, name and reviews");
  }
  if (body.reviews.length === 0) return fail(422, "No reviews to analyse for this place");

  // Reviews come from the client (they were returned by /api/search), so cap and sanitise them.
  const request: AnalyzeRequest = {
    placeId: String(body.placeId).slice(0, 200),
    name: String(body.name).slice(0, 120),
    model: typeof body.model === "string" ? body.model : undefined,
    reviews: body.reviews.slice(0, 10).map((r) => ({
      rating: Number(r.rating) || 0,
      text: String(r.text ?? "").slice(0, 1500),
      author: String(r.author ?? ""),
      when: String(r.when ?? ""),
      publishTime: typeof r.publishTime === "string" ? r.publishTime : undefined,
    })),
  };

  try {
    return json(env.mockOpenRouter() ? mockAnalysis(request) : await analyzeReviews(request));
  } catch (err) {
    return handleError(err);
  }
};

export const config: Config = { path: "/api/analyze" };
