import type { Budget, LatLng, Place, RankedPlace, ScoreBreakdown, SearchRequest } from "./types";

/** Score weights. Must sum to 1. See docs/specs/02-search-and-ranking.md. */
export const WEIGHTS = { quality: 0.4, relevance: 0.15, proximity: 0.15, priceFit: 0.15, sentiment: 0.15 } as const;

/** Prior strength for the Bayesian rating: how many "average" reviews every place starts with. */
export const PRIOR_REVIEWS = 100;

/** Places with fewer reviews than this are dropped as too noisy. */
export const MIN_REVIEWS = 10;

/** Per-person budget bands in INR. */
export const BUDGET_BANDS: Record<Exclude<Budget, "any">, [number, number]> = {
  low: [0, 300],
  mid: [300, 700],
  high: [700, 1500],
  premium: [1500, 4000],
};

/** Rough per-person INR estimates for Google's price levels, used only when no price range exists. */
export const PRICE_LEVEL_INR: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 250,
  PRICE_LEVEL_MODERATE: 550,
  PRICE_LEVEL_EXPENSIVE: 1100,
  PRICE_LEVEL_VERY_EXPENSIVE: 2200,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bayesian average: pulls ratings with few reviews toward the area mean. */
export function bayesianRating(rating: number, reviews: number, areaMean: number, prior = PRIOR_REVIEWS): number {
  return (reviews * rating + prior * areaMean) / (reviews + prior);
}

export function estimatePerPerson(place: Place): number | undefined {
  if (place.priceMin != null && place.priceMax != null) return (place.priceMin + place.priceMax) / 2;
  if (place.priceMin != null) return place.priceMin;
  if (place.priceLevel) return PRICE_LEVEL_INR[place.priceLevel];
  return undefined;
}

/** 1 = inside budget, decays outside it. Cheaper than budget is penalised less than pricier. Unknown = 0.5. */
export function priceFit(place: Place, budget: Budget): number {
  if (budget === "any") return 0.5;
  const est = estimatePerPerson(place);
  if (est == null) return 0.5;
  const [lo, hi] = BUDGET_BANDS[budget];
  if (est >= lo && est <= hi) return 1;
  if (est > hi) return clamp01(1 - (est - hi) / hi);
  return Math.max(0.4, 1 - (lo - est) / lo);
}

function passesFilters(place: Place, req: SearchRequest, distance: number): boolean {
  if (place.rating == null || place.reviewCount < MIN_REVIEWS) return false;
  if (distance > req.radiusKm) return false;
  // `undefined` means Google doesn't know, so we keep the place.
  if ((req.diet === "veg" || req.diet === "jain") && place.servesVeg === false) return false;
  if (req.meal === "now" && place.openNow === false) return false;
  if (req.meal === "lunch" && place.servesLunch === false) return false;
  if (req.meal === "dinner" && place.servesDinner === false) return false;
  return true;
}

function reasonsFor(place: Place, s: ScoreBreakdown, distance: number, budget: Budget): string[] {
  const out: string[] = [];
  if (s.adjustedRating >= 4.3 && place.reviewCount >= 200) {
    out.push(`Consistently rated across ${place.reviewCount.toLocaleString("en-IN")} reviews`);
  } else if (place.reviewCount < 50) {
    out.push("Few reviews, so the rating is less certain");
  }
  if (distance < 1) out.push(`Only ${Math.round(distance * 100) * 10} m away`);
  if (budget !== "any" && s.priceFit >= 0.95) out.push("Fits your budget");
  if (budget !== "any" && s.priceFit < 0.5) out.push("Likely above your budget");
  return out.slice(0, 3);
}

export function scorePlace(
  place: Place,
  distance: number,
  req: SearchRequest,
  areaMean: number,
  sentiment = 0.5,
): ScoreBreakdown {
  const adjustedRating = bayesianRating(place.rating ?? areaMean, place.reviewCount, areaMean);
  const quality = clamp01((adjustedRating - 1) / 4);
  // Google orders results by how well they match the dish; keep that signal so a nearby
  // café doesn't outrank a biryani place for "biryani". Unknown position = neutral.
  const relevance = place.searchRank == null ? 0.5 : clamp01(1 - place.searchRank / 20);
  const proximity = clamp01(1 - distance / req.radiusKm);
  const fit = priceFit(place, req.budget);
  const total =
    WEIGHTS.quality * quality +
    WEIGHTS.relevance * relevance +
    WEIGHTS.proximity * proximity +
    WEIGHTS.priceFit * fit +
    WEIGHTS.sentiment * sentiment;
  return { adjustedRating, quality, relevance, proximity, priceFit: fit, sentiment, total };
}

export function rankPlaces(places: Place[], req: SearchRequest, center: LatLng): RankedPlace[] {
  // Review-weighted mean, so a couple of hyped newcomers can't drag the prior up.
  const rated = places.filter((p) => p.rating != null && p.reviewCount > 0);
  const totalReviews = rated.reduce((sum, p) => sum + p.reviewCount, 0);
  const areaMean = totalReviews ? rated.reduce((sum, p) => sum + p.rating! * p.reviewCount, 0) / totalReviews : 4;

  return places
    .map((p) => ({ p, d: distanceKm(center, { lat: p.lat, lng: p.lng }) }))
    .filter(({ p, d }) => passesFilters(p, req, d))
    .map(({ p, d }) => {
      const score = scorePlace(p, d, req, areaMean);
      return { ...p, distanceKm: d, score, reasons: reasonsFor(p, score, d, req.budget) };
    })
    .sort((a, b) => b.score.total - a.score.total);
}

/** Re-score one place once its review sentiment is known (Phase 2). */
export function withSentiment(place: RankedPlace, sentiment: number): RankedPlace {
  const s = place.score;
  const total = s.total - WEIGHTS.sentiment * s.sentiment + WEIGHTS.sentiment * clamp01(sentiment);
  return { ...place, score: { ...s, sentiment: clamp01(sentiment), total } };
}
