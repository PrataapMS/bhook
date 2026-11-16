// Types shared by the PWA (src/) and the Netlify functions (server/, netlify/functions/).

export type Meal = "now" | "lunch" | "dinner";
export type Diet = "any" | "veg" | "jain";
export type Budget = "any" | "low" | "mid" | "high" | "premium";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SearchRequest {
  /** GPS position. Either this or `area` is required. */
  location?: LatLng;
  /** Typed area, e.g. "Koramangala, Bengaluru". */
  area?: string;
  /** Cuisine or dish. Empty string means "surprise me". */
  cuisine: string;
  meal: Meal;
  budget: Budget;
  diet: Diet;
  radiusKm: number;
}

export interface Review {
  rating: number;
  text: string;
  author: string;
  authorUri?: string;
  /** Google's relative label, e.g. "2 weeks ago". */
  when: string;
  publishTime?: string;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  reviewCount: number;
  /** Google enum, e.g. PRICE_LEVEL_MODERATE. */
  priceLevel?: string;
  /** Per-person range in `currency`, when Google has one. */
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  openNow?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesVeg?: boolean;
  mapsUri?: string;
  websiteUri?: string;
  category?: string;
  /** 0-based position in Google's relevance-ordered results for the query. */
  searchRank?: number;
  reviews: Review[];
}

export interface ScoreBreakdown {
  adjustedRating: number;
  quality: number;
  relevance: number;
  proximity: number;
  priceFit: number;
  sentiment: number;
  total: number;
}

export interface RankedPlace extends Place {
  distanceKm: number;
  score: ScoreBreakdown;
  reasons: string[];
}

export interface SearchResponse {
  center: LatLng & { label?: string };
  query: string;
  results: RankedPlace[];
  /** True when demo data was served instead of Google. */
  mock: boolean;
}

export interface AnalyzeRequest {
  placeId: string;
  name: string;
  reviews: Review[];
  /** Optional OpenRouter slug; must be in OPENROUTER_ALLOWED_MODELS. */
  model?: string;
}

export interface ReviewAnalysis {
  verdict: string;
  pros: string[];
  cons: string[];
  mustOrder: string[];
  redFlags: string[];
  /** 0 (very negative) to 1 (very positive). */
  sentiment: number;
  trend: "improving" | "steady" | "declining" | "unknown";
  model: string;
  mock: boolean;
}

export type MenuMethod = "website" | "web_search";

export interface MenuRequest {
  placeId: string;
  name: string;
  address: string;
  websiteUri?: string;
  /** Optional OpenRouter slug; must be in OPENROUTER_ALLOWED_MODELS. */
  model?: string;
}

export interface MenuItem {
  name: string;
  /** Rupees, as printed by the source. Missing means the source didn't show one. */
  price?: number;
  section?: string;
  veg?: boolean;
}

export interface MenuResult {
  status: "found" | "partial" | "not_found";
  items: MenuItem[];
  /** e.g. "Most mains ₹280–420". */
  priceNote?: string;
  sources: { url: string; title?: string }[];
  /** ISO date the data was extracted. */
  asOf: string;
  method: MenuMethod;
  model: string;
  /** Short reason when not found, e.g. "No website listed". */
  reason?: string;
  cached: boolean;
  mock: boolean;
}

export interface HealthResponse {
  google: "live" | "mock";
  openrouter: "live" | "mock";
  models: { default: string; allowed: string[] };
}

export interface ApiError {
  error: string;
  detail?: string;
}
