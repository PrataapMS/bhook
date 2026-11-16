import { describe, expect, it } from "vitest";
import { bayesianRating, distanceKm, priceFit, rankPlaces, withSentiment } from "./ranking";
import type { Place, SearchRequest } from "./types";

const center = { lat: 12.9716, lng: 77.5946 };
const req: SearchRequest = { location: center, cuisine: "Biryani", meal: "lunch", budget: "mid", diet: "any", radiusKm: 3 };

const place = (over: Partial<Place>): Place => ({
  id: over.id ?? "p",
  name: over.name ?? "Place",
  address: "",
  lat: center.lat + 0.005,
  lng: center.lng,
  rating: 4.2,
  reviewCount: 500,
  reviews: [],
  ...over,
});

describe("bayesianRating", () => {
  it("pulls small samples toward the mean", () => {
    expect(bayesianRating(4.8, 12, 4.1)).toBeLessThan(bayesianRating(4.4, 3000, 4.1));
  });
});

describe("distanceKm", () => {
  it("is roughly 1.1 km per 0.01 deg latitude", () => {
    expect(distanceKm(center, { lat: center.lat + 0.01, lng: center.lng })).toBeCloseTo(1.11, 1);
  });
});

describe("priceFit", () => {
  it("is 1 inside the band and lower above it", () => {
    expect(priceFit(place({ priceMin: 400, priceMax: 600 }), "mid")).toBe(1);
    expect(priceFit(place({ priceMin: 1200, priceMax: 1600 }), "mid")).toBeLessThan(0.5);
  });
  it("is neutral when price is unknown", () => {
    expect(priceFit(place({}), "mid")).toBe(0.5);
  });
});

describe("rankPlaces", () => {
  it("ranks a well-reviewed place above a hyped newcomer", () => {
    const ranked = rankPlaces(
      [
        place({ id: "new", rating: 4.9, reviewCount: 15 }),
        place({ id: "steady", rating: 4.4, reviewCount: 2500 }),
        place({ id: "avg1", rating: 4.0, reviewCount: 1800 }),
        place({ id: "avg2", rating: 3.9, reviewCount: 1200 }),
      ],
      req,
      center,
    );
    expect(ranked[0].id).toBe("steady");
  });

  it("drops places outside the radius, with too few reviews, or not serving lunch", () => {
    const ranked = rankPlaces(
      [
        place({ id: "far", lat: center.lat + 0.1 }),
        place({ id: "tiny", reviewCount: 3 }),
        place({ id: "nolunch", servesLunch: false }),
        place({ id: "ok" }),
      ],
      req,
      center,
    );
    expect(ranked.map((p) => p.id)).toEqual(["ok"]);
  });

  it("updates total when sentiment arrives", () => {
    const [p] = rankPlaces([place({})], req, center);
    expect(withSentiment(p, 1).score.total).toBeGreaterThan(p.score.total);
  });
});

describe("relevance", () => {
  it("keeps Google's match order from being swamped by proximity", () => {
    const ranked = rankPlaces(
      [
        place({ id: "cafe-next-door", searchRank: 15, lat: center.lat + 0.001 }),
        place({ id: "biryani-place", searchRank: 0, lat: center.lat + 0.008 }),
      ],
      req,
      center,
    );
    expect(ranked[0].id).toBe("biryani-place");
  });
});
