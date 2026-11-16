import type { RankedPlace, ReviewAnalysis } from "../../shared/types";

export type AnalysisState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: ReviewAnalysis }
  | { status: "error"; message: string };

interface Props {
  place: RankedPlace;
  rank: number;
  analysis: AnalysisState;
  onAnalyze: () => void;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function priceLabel(p: RankedPlace): string | null {
  if (p.priceMin != null && p.priceMax != null) return `${inr(p.priceMin)}–${inr(p.priceMax)} a head`;
  if (p.priceMin != null) return `from ${inr(p.priceMin)} a head`;
  const map: Record<string, string> = {
    PRICE_LEVEL_INEXPENSIVE: "₹",
    PRICE_LEVEL_MODERATE: "₹₹",
    PRICE_LEVEL_EXPENSIVE: "₹₹₹",
    PRICE_LEVEL_VERY_EXPENSIVE: "₹₹₹₹",
  };
  return p.priceLevel ? map[p.priceLevel] ?? null : null;
}

function distanceLabel(km: number) {
  return km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`;
}

export function PlaceCard({ place, rank, analysis, onAnalyze }: Props) {
  const price = priceLabel(place);
  const featured = rank === 1;

  return (
    <article className={featured ? "slip slip--featured" : "slip"} aria-labelledby={`p-${place.id}`}>
      <div className="slip__head">
        <span className="slip__rank" aria-label={`Rank ${rank}`}>
          {rank}
        </span>
        <div>
          <h3 id={`p-${place.id}`}>{place.name}</h3>
          <p className="slip__sub">{[place.category, place.address].filter(Boolean).join(", ")}</p>
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>Rating</dt>
          <dd>
            {place.rating?.toFixed(1)} <span aria-hidden>★</span>{" "}
            <span className="muted">({place.reviewCount.toLocaleString("en-IN")})</span>
          </dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{distanceLabel(place.distanceKm)}</dd>
        </div>
        {price && (
          <div>
            <dt>Price</dt>
            <dd>{price}</dd>
          </div>
        )}
        {place.openNow != null && (
          <div>
            <dt>Status</dt>
            <dd className={place.openNow ? "open" : "closed"}>{place.openNow ? "Open now" : "Closed now"}</dd>
          </div>
        )}
      </dl>

      {place.reasons.length > 0 && (
        <ul className="reasons">
          {place.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div className="summary" aria-live="polite">
        {analysis.status === "loading" && <p className="muted">Reading the reviews…</p>}
        {analysis.status === "error" && <p className="error">{analysis.message}</p>}
        {analysis.status === "done" && (
          <>
            <p className="summary__verdict">{analysis.data.verdict}</p>
            {analysis.data.mustOrder.length > 0 && (
              <p>
                <strong>Order:</strong> {analysis.data.mustOrder.join(", ")}
              </p>
            )}
            {analysis.data.cons.length > 0 && (
              <p>
                <strong>Downsides:</strong> {analysis.data.cons.join("; ")}
              </p>
            )}
            {analysis.data.redFlags.length > 0 && (
              <p className="error">
                <strong>Watch out:</strong> {analysis.data.redFlags.join("; ")}
              </p>
            )}
            {analysis.data.trend === "declining" && <p className="error">Recent reviews are worse than older ones.</p>}
          </>
        )}
      </div>

      <div className="actions">
        {place.mapsUri && (
          <a className="btn btn--primary" href={place.mapsUri} target="_blank" rel="noreferrer">
            Directions
          </a>
        )}
        {place.websiteUri && (
          <a className="btn" href={place.websiteUri} target="_blank" rel="noreferrer">
            Website
          </a>
        )}
        {(analysis.status === "idle" || analysis.status === "error") && place.reviews.length > 0 && (
          <button type="button" className="btn" onClick={onAnalyze}>
            {analysis.status === "error" ? "Try summary again" : "Summarise reviews"}
          </button>
        )}
      </div>
    </article>
  );
}
