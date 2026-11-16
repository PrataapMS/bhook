// Demo data so the whole UI works with no API keys. Places are generated around
// whatever location you search from, so distances and ranking behave realistically.
import type { AnalyzeRequest, LatLng, Place, ReviewAnalysis } from "../shared/types";

export const DEMO_CENTER: LatLng & { label: string } = { lat: 12.9352, lng: 77.6245, label: "Koramangala, Bengaluru (demo)" };

type Seed = [name: string, dKm: number, bearingDeg: number, rating: number, count: number, min: number, max: number, veg: boolean, dish: string, tags: string];

const SEEDS: Seed[] = [
  ["Meghana Corner Kitchen", 0.6, 30, 4.4, 3120, 350, 600, false, "chicken biryani", "biryani andhra north indian"],
  ["Hotel Annapoorna Tiffin Room", 0.9, 120, 4.5, 2210, 120, 250, true, "ghee podi idli", "south indian tiffin dosa"],
  ["Smoke Lane Grill", 1.4, 200, 4.8, 18, 900, 1400, false, "pork ribs", "grill barbecue"],
  ["Sri Krishna Bhavan", 2.1, 300, 4.2, 5400, 150, 300, true, "set dosa", "south indian thali dosa"],
  ["Dragon Wok Express", 1.1, 80, 3.9, 860, 300, 500, false, "chilli chicken", "chinese indo-chinese"],
  ["Third Wave Kaapi Co.", 0.4, 250, 4.3, 640, 400, 700, true, "filter coffee", "cafe coffee desserts"],
  ["Punjab Da Dhaba", 2.7, 160, 4.1, 1980, 450, 800, false, "dal makhani", "north indian punjabi thali"],
  ["Napoli Wood Fired", 1.8, 10, 4.6, 410, 800, 1300, true, "margherita", "pizza italian"],
  ["Andhra Spice Mess", 2.4, 340, 4.3, 1520, 250, 450, false, "gongura mutton", "andhra biryani south indian thali"],
  ["Rasoi Thali House", 1.2, 290, 4.0, 730, 300, 500, true, "unlimited thali", "thali north indian gujarati"],
  ["Coastal Curry Point", 3.6, 60, 4.4, 990, 500, 900, false, "fish thali", "seafood coastal thali"],
  ["Sweet Truth Desserts", 0.8, 180, 4.2, 300, 200, 400, true, "kunafa", "desserts cafe"],
];

function offset(center: LatLng, km: number, bearingDeg: number): LatLng {
  const b = (bearingDeg * Math.PI) / 180;
  const dLat = (km * Math.cos(b)) / 111;
  const dLng = (km * Math.sin(b)) / (111 * Math.cos((center.lat * Math.PI) / 180));
  return { lat: center.lat + dLat, lng: center.lng + dLng };
}

/** Mimics Google's relevance ordering: seeds whose tags match the cuisine come first. */
export function mockPlaces(center: LatLng, cuisine = ""): Place[] {
  const q = cuisine.toLowerCase().trim();
  const matches = (s: Seed) => q !== "" && (s[9].includes(q) || s[8].includes(q) || s[0].toLowerCase().includes(q));
  const ordered = [...SEEDS].sort((a, b) => Number(matches(b)) - Number(matches(a)));

  return ordered.map((seed, i) => {
    const [name, km, bearing, rating, count, min, max, veg, dish] = seed;
    const k = SEEDS.indexOf(seed); // stable per place, independent of ordering
    const pos = offset(center, km, bearing);
    return {
      id: `demo-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      name,
      address: `${(km * 100).toFixed(0)} Demo Road`,
      ...pos,
      rating,
      reviewCount: count,
      priceMin: min,
      priceMax: max,
      currency: "INR",
      openNow: k !== 4,
      servesLunch: true,
      servesDinner: k !== 1,
      servesVeg: veg ? true : k % 2 === 0,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lng}`,
      category: "Restaurant",
      searchRank: i,
      reviews: [
        { rating: 5, text: `The ${dish} is the reason to come. Generous portions.`, author: "Demo reviewer", when: "2 weeks ago" },
        { rating: 4, text: `Good ${dish}, but expect a 20 minute wait at peak lunch.`, author: "Demo reviewer", when: "1 month ago" },
        { rating: 3, text: "Service was slow on a weekend and the AC wasn't working.", author: "Demo reviewer", when: "3 months ago" },
      ],
    };
  });
}

export function mockAnalysis(req: AnalyzeRequest): ReviewAnalysis {
  const dish = req.reviews[0]?.text.match(/The (.+?) is/)?.[1] ?? "house special";
  return {
    verdict: `Go for the ${dish}; arrive early to skip the peak-hour queue.`,
    pros: ["Signature dish praised repeatedly", "Generous portions"],
    cons: ["Slow service at peak times"],
    mustOrder: [dish],
    redFlags: [],
    sentiment: 0.72,
    trend: "steady",
    model: "demo",
    mock: true,
  };
}
