import type { Config } from "@netlify/functions";
import { rankPlaces } from "../../shared/ranking";
import type { SearchRequest, SearchResponse } from "../../shared/types";
import { env } from "../../server/env";
import { fail, handleError, json, readJson } from "../../server/http";
import { DEMO_CENTER, mockPlaces } from "../../server/mocks";
import { buildQuery, resolveArea, searchRestaurants } from "../../server/places";

const MEALS = ["now", "lunch", "dinner"];
const DIETS = ["any", "veg", "jain"];
const BUDGETS = ["any", "low", "mid", "high", "premium"];

function validate(body: Partial<SearchRequest> | null): SearchRequest | string {
  if (!body) return "Body must be JSON";
  const hasLoc = Number.isFinite(body.location?.lat) && Number.isFinite(body.location?.lng);
  const area = typeof body.area === "string" ? body.area.trim().slice(0, 120) : "";
  if (!hasLoc && !area) return "Send either location or area";
  return {
    location: hasLoc ? body.location : undefined,
    area: area || undefined,
    cuisine: typeof body.cuisine === "string" ? body.cuisine.trim().slice(0, 60) : "",
    meal: MEALS.includes(body.meal as string) ? body.meal! : "now",
    diet: DIETS.includes(body.diet as string) ? body.diet! : "any",
    budget: BUDGETS.includes(body.budget as string) ? body.budget! : "any",
    radiusKm: Math.min(10, Math.max(0.5, Number(body.radiusKm) || 3)),
  };
}

export default async (req: Request) => {
  if (req.method !== "POST") return fail(405, "Use POST");
  const parsed = validate(await readJson<Partial<SearchRequest>>(req));
  if (typeof parsed === "string") return fail(400, parsed);

  try {
    const mock = env.mockGoogle();
    let center: SearchResponse["center"];

    if (parsed.location) {
      center = { ...parsed.location, label: "your location" };
    } else if (mock) {
      center = DEMO_CENTER;
    } else {
      const hit = await resolveArea(env.googleKey(), parsed.area!);
      if (!hit) return fail(404, `Couldn't find "${parsed.area}". Try adding the city name.`);
      center = hit;
    }

    const places = mock ? mockPlaces(center, parsed.cuisine) : await searchRestaurants(env.googleKey(), parsed, center);
    const response: SearchResponse = {
      center,
      query: buildQuery(parsed),
      results: rankPlaces(places, parsed, center),
      mock,
    };
    return json(response);
  } catch (err) {
    return handleError(err);
  }
};

export const config: Config = { path: "/api/search" };
