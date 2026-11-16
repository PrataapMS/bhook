import { useEffect, useRef, useState } from "react";
import { withSentiment } from "../shared/ranking";
import type { Budget, Diet, HealthResponse, LatLng, Meal, RankedPlace, SearchResponse } from "../shared/types";
import { cacheKey, readCached, writeCached } from "./analysisCache";
import { api } from "./api";
import { ChipGroup } from "./components/ChipGroup";
import { type AnalysisState, type MenuState, PlaceCard } from "./components/PlaceCard";
import { BUDGETS, CUISINES, DIETS, MEALS, RADII, defaultMeal } from "./options";

const AUTO_SUMMARISE = 3;
const MODEL_KEY = "bhook:model";

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: ignore */
    }
  },
};

type LocState = { status: "none" } | { status: "locating" } | { status: "ok"; pos: LatLng } | { status: "error"; message: string };

export function App() {
  const [loc, setLoc] = useState<LocState>({ status: "none" });
  const [area, setArea] = useState("");
  const [cuisine, setCuisine] = useState("Biryani");
  const [customDish, setCustomDish] = useState("");
  const [meal, setMeal] = useState<Meal>(defaultMeal());
  const [budget, setBudget] = useState<Budget>("mid");
  const [diet, setDiet] = useState<Diet>("any");
  const [radiusKm, setRadiusKm] = useState(3);

  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [places, setPlaces] = useState<RankedPlace[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const [menus, setMenus] = useState<Record<string, MenuState>>({});

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [model, setModel] = useState(() => storage.get(MODEL_KEY) ?? "");
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const activeModel = health?.models.allowed.includes(model) ? model : health?.models.default;
  const dish = customDish.trim() || cuisine;
  const canSearch = loc.status === "ok" || area.trim().length > 1;

  // Offer a re-rank (never reshuffle automatically) once no summary is in flight and the
  // sentiment-adjusted order differs from what's on screen.
  const anyLoading = Object.values(analyses).some((a) => a.status === "loading");
  const anyDone = Object.values(analyses).some((a) => a.status === "done");
  const reranked = [...places].sort((a, b) => b.score.total - a.score.total);
  const canRerank = !anyLoading && anyDone && reranked.some((p, i) => p.id !== places[i].id);

  function locate() {
    if (!("geolocation" in navigator)) {
      setLoc({ status: "error", message: "This browser can't share location. Type an area instead." });
      return;
    }
    setLoc({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ status: "ok", pos: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (e) =>
        setLoc({
          status: "error",
          message:
            e.code === e.PERMISSION_DENIED
              ? "Location is blocked for this site. Allow it in browser settings, or type an area."
              : "Couldn't get your location. Type an area instead.",
        }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function summarise(place: RankedPlace) {
    const key = cacheKey(place.id, activeModel ?? "default", place.reviews);
    const cached = readCached(key);
    if (cached) {
      setAnalyses((a) => ({ ...a, [place.id]: { status: "done", data: cached } }));
      setPlaces((list) => list.map((p) => (p.id === place.id ? withSentiment(p, cached.sentiment) : p)));
      return;
    }
    setAnalyses((a) => ({ ...a, [place.id]: { status: "loading" } }));
    try {
      const data = await api.analyze({ placeId: place.id, name: place.name, reviews: place.reviews, model: activeModel });
      writeCached(key, data);
      setAnalyses((a) => ({ ...a, [place.id]: { status: "done", data } }));
      // Sentiment feeds the score, but we don't reshuffle cards while someone is reading them.
      setPlaces((list) => list.map((p) => (p.id === place.id ? withSentiment(p, data.sentiment) : p)));
    } catch (e) {
      setAnalyses((a) => ({ ...a, [place.id]: { status: "error", message: (e as Error).message } }));
    }
  }

  // Never automatic: the web-search step is the most expensive call in the app (spec 04).
  async function lookupMenu(place: RankedPlace) {
    const set = (m: MenuState) => setMenus((all) => ({ ...all, [place.id]: m }));
    const req = { placeId: place.id, name: place.name, address: place.address, websiteUri: place.websiteUri, model: activeModel };
    set({ status: "loading", stage: "website" });
    try {
      let data = await api.menu("website", req);
      // A cached web-search answer comes back with method "web_search"; don't pay for it twice.
      if (data.status === "not_found" && data.method === "website") {
        set({ status: "loading", stage: "web_search" });
        data = await api.menu("web_search", req);
      }
      set({ status: "done", data });
    } catch (e) {
      set({ status: "error", message: (e as Error).message });
    }
  }

  async function search() {
    setSearching(true);
    setError(null);
    try {
      const res = await api.search({
        location: loc.status === "ok" ? loc.pos : undefined,
        area: loc.status === "ok" ? undefined : area.trim(),
        cuisine: dish,
        meal,
        budget,
        diet,
        radiusKm,
      });
      setResult(res);
      setPlaces(res.results);
      setAnalyses({});
      setMenus({});
      requestAnimationFrame(() => resultsRef.current?.focus());
      res.results.slice(0, AUTO_SUMMARISE).filter((p) => p.reviews.length).forEach(summarise);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  if (result) {
    return (
      <main className="page">
        <header className="topbar">
          <button type="button" className="link" onClick={() => setResult(null)}>
            Change search
          </button>
          <span className="wordmark wordmark--small">Bhook</span>
        </header>

        <section ref={resultsRef} tabIndex={-1} className="results" aria-labelledby="results-title">
          <h1 id="results-title" className="results__title">
            {places.length === 0
              ? `Nothing matched within ${radiusKm} km`
              : `${places.length} ${places.length === 1 ? "place" : "places"} for ${dish || "a good meal"}`}
          </h1>
          <p className="muted">Near {result.center.label ?? "you"}. Best match first.</p>
          {result.mock && <p className="notice">Demo data. Add a Google Places key to see real restaurants.</p>}
          {canRerank && (
            <button type="button" className="btn btn--wide" onClick={() => setPlaces(reranked)}>
              Re-rank with review insights
            </button>
          )}

          {places.length === 0 ? (
            <div className="empty">
              <p>Try a wider distance, a different cuisine, or "Any" budget.</p>
              <button type="button" className="btn btn--primary" onClick={() => setResult(null)}>
                Change search
              </button>
            </div>
          ) : (
            <ol className="list">
              {places.map((p, i) => (
                <li key={p.id}>
                  <PlaceCard
                    place={p}
                    rank={i + 1}
                    analysis={analyses[p.id] ?? { status: "idle" }}
                    menu={menus[p.id] ?? { status: "idle" }}
                    onAnalyze={() => summarise(p)}
                    onMenu={() => lookupMenu(p)}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="footer">
          <p>Places data from Google Maps. Review summaries and menus are AI-extracted and can be wrong; check the source.</p>
          {health && health.models.allowed.length > 1 && (
            <label className="field field--inline">
              <span>Summary model</span>
              <select
                value={activeModel}
                onChange={(e) => {
                  setModel(e.target.value);
                  storage.set(MODEL_KEY, e.target.value);
                }}
              >
                {health.models.allowed.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
        </footer>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <span className="wordmark">Bhook</span>
        <p className="hero__line">Tell it what you're craving. It reads the reviews so you don't have to.</p>
      </header>

      <section className="panel" aria-labelledby="where">
        <h2 id="where">Where are you?</h2>
        <button type="button" className="btn btn--primary btn--wide" onClick={locate} disabled={loc.status === "locating"}>
          {loc.status === "locating" ? "Finding you…" : loc.status === "ok" ? "Using your location" : "Use my location"}
        </button>
        {loc.status === "error" && <p className="error">{loc.message}</p>}
        <label className="field">
          <span>Or type an area</span>
          <input
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              if (loc.status === "ok") setLoc({ status: "none" });
            }}
            placeholder="Indiranagar, Bengaluru"
            autoComplete="off"
          />
        </label>
      </section>

      <section className="panel" aria-labelledby="what">
        <h2 id="what">What do you feel like eating?</h2>
        <ChipGroup label="Cuisine" options={CUISINES} value={customDish ? "__custom" : cuisine} onChange={(v) => {
          setCuisine(v);
          setCustomDish("");
        }} />
        <label className="field">
          <span>Or name a dish</span>
          <input value={customDish} onChange={(e) => setCustomDish(e.target.value)} placeholder="Ghee roast dosa" autoComplete="off" />
        </label>
        <ChipGroup label="When" options={MEALS} value={meal} onChange={setMeal} />
        <ChipGroup label="Budget per person" options={BUDGETS} value={budget} onChange={setBudget} />
        <ChipGroup label="Food" options={DIETS} value={diet} onChange={setDiet} />
        <ChipGroup label="How far" options={RADII} value={radiusKm} onChange={setRadiusKm} />
      </section>

      <div className="cta">
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn btn--primary btn--wide" onClick={search} disabled={!canSearch || searching}>
          {searching ? "Searching…" : canSearch ? "Find places" : "Add a location to search"}
        </button>
      </div>
    </main>
  );
}
