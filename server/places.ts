import type { LatLng, Place, Review, SearchRequest } from "../shared/types";
import { UpstreamError } from "./http";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * Field mask for restaurant search. Requesting `places.reviews` (plus the serves* fields)
 * bills every call at the "Text Search Enterprise + Atmosphere" SKU. That's deliberate:
 * one call returns up to 20 places WITH reviews, so Phase 2 needs no extra Place Details calls.
 * See docs/specs/06-cost-and-guardrails.md before adding fields.
 */
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.priceRange",
  "places.currentOpeningHours.openNow",
  "places.servesLunch",
  "places.servesDinner",
  "places.servesVegetarianFood",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
  "places.reviews",
].join(",");

/** Cheapest useful mask for turning a typed area into coordinates (Text Search Pro SKU). */
const AREA_FIELDS = "places.location,places.formattedAddress";

async function searchText(apiKey: string, body: object, fieldMask: string): Promise<any[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text.slice(0, 300);
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {
      /* keep raw text */
    }
    throw new UpstreamError("google", res.status, message);
  }
  const data = (await res.json()) as { places?: any[] };
  return data.places ?? [];
}

export async function resolveArea(apiKey: string, area: string): Promise<(LatLng & { label: string }) | null> {
  const [hit] = await searchText(apiKey, { textQuery: area, pageSize: 1, regionCode: "IN" }, AREA_FIELDS);
  if (!hit?.location) return null;
  return { lat: hit.location.latitude, lng: hit.location.longitude, label: hit.formattedAddress ?? area };
}

export function buildQuery(req: SearchRequest): string {
  const dish = req.cuisine.trim();
  const diet = req.diet === "veg" ? "pure veg " : req.diet === "jain" ? "jain food " : "";
  return `${diet}${dish ? `${dish} ` : ""}restaurant`;
}

export async function searchRestaurants(apiKey: string, req: SearchRequest, center: LatLng): Promise<Place[]> {
  const body = {
    textQuery: buildQuery(req),
    pageSize: 20,
    languageCode: "en",
    regionCode: "IN",
    // Bias, not restrict: Text Search only restricts to rectangles. We filter by real distance later.
    locationBias: {
      circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(req.radiusKm * 1000, 50000) },
    },
    ...(req.meal === "now" ? { openNow: true } : {}),
  };
  const raw = await searchText(apiKey, body, SEARCH_FIELDS);
  return raw.map((p, i) => ({ ...toPlace(p), searchRank: i }));
}

function toReview(r: any): Review {
  return {
    rating: r.rating ?? 0,
    text: r.text?.text ?? r.originalText?.text ?? "",
    author: r.authorAttribution?.displayName ?? "Google user",
    authorUri: r.authorAttribution?.uri,
    when: r.relativePublishTimeDescription ?? "",
    publishTime: r.publishTime,
  };
}

const units = (money: any): number | undefined => (money?.units != null ? Number(money.units) : undefined);

export function toPlace(p: any): Place {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unnamed place",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    rating: p.rating,
    reviewCount: p.userRatingCount ?? 0,
    priceLevel: p.priceLevel,
    priceMin: units(p.priceRange?.startPrice),
    priceMax: units(p.priceRange?.endPrice),
    currency: p.priceRange?.startPrice?.currencyCode,
    openNow: p.currentOpeningHours?.openNow,
    servesLunch: p.servesLunch,
    servesDinner: p.servesDinner,
    servesVeg: p.servesVegetarianFood,
    mapsUri: p.googleMapsUri,
    websiteUri: p.websiteUri,
    category: p.primaryTypeDisplayName?.text,
    reviews: (p.reviews ?? []).map(toReview).filter((r: Review) => r.text),
  };
}
