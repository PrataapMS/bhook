import type { MenuResult, RankedPlace, ReviewAnalysis } from "../../shared/types";
import { MENU_PREVIEW, groupMenu, hostOf, isMustOrder } from "../menu";

export type AnalysisState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: ReviewAnalysis }
  | { status: "error"; message: string };

export type MenuState =
  | { status: "idle" }
  | { status: "loading"; stage: "website" | "web_search" }
  | { status: "done"; data: MenuResult }
  | { status: "error"; message: string };

interface Props {
  place: RankedPlace;
  rank: number;
  analysis: AnalysisState;
  menu: MenuState;
  onAnalyze: () => void;
  onMenu: () => void;
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

const asOfLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function MenuBlock({ menu, mustOrder, hasPrice }: { menu: MenuState; mustOrder: string[]; hasPrice: boolean }) {
  if (menu.status === "idle") return null;
  if (menu.status === "loading") {
    return (
      <p className="muted">{menu.stage === "website" ? "Checking the restaurant's website…" : "Searching the web for a menu…"}</p>
    );
  }
  if (menu.status === "error") return <p className="error">{menu.message}</p>;

  const m = menu.data;
  if (m.status === "not_found") {
    return (
      <p className="muted">
        Menu not found online{m.reason ? ` (${m.reason.toLowerCase()})` : ""}.
        {hasPrice ? " The price above is Google's estimate." : ""}
      </p>
    );
  }

  const more = m.items.length - MENU_PREVIEW;
  return (
    <>
      <p className="menu__head">
        <strong>{m.status === "partial" ? "Partial menu" : "Menu"}</strong>
        {m.priceNote && <span>{m.priceNote}</span>}
      </p>
      {groupMenu(m.items).map((g) => (
        <div key={g.section ?? ""} className="menu__group">
          {g.section && <p className="menu__section">{g.section}</p>}
          <ul className="menu__items">
            {g.items.map((item) => {
              const pick = isMustOrder(item.name, mustOrder);
              return (
                <li key={item.name} className={pick ? "menu__item menu__item--pick" : "menu__item"}>
                  {item.veg != null && (
                    <span className={item.veg ? "veg veg--yes" : "veg veg--no"} title={item.veg ? "Veg" : "Non-veg"}>
                      <span className="sr-only">{item.veg ? "Veg" : "Non-veg"}</span>
                    </span>
                  )}
                  <span className="menu__name">
                    {item.name}
                    {pick && <span className="menu__tag">reviewers' pick</span>}
                  </span>
                  <span className="menu__price">{item.price != null ? inr(item.price) : <span className="muted">no price</span>}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {more > 0 && <p className="muted">{more} more on the source page.</p>}
      <p className="menu__source">
        {m.sources.length === 1 ? "Source: " : "Sources: "}
        {m.sources.map((src, i) => (
          <span key={src.url}>
            {i > 0 && ", "}
            <a href={src.url} target="_blank" rel="noreferrer">
              {hostOf(src.url)}
            </a>
          </span>
        ))}
        . As of {asOfLabel(m.asOf)}.{m.mock && " Demo data."}
      </p>
    </>
  );
}

export function PlaceCard({ place, rank, analysis, menu, onAnalyze, onMenu }: Props) {
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

      <div className="menu" aria-live="polite">
        <MenuBlock menu={menu} mustOrder={analysis.status === "done" ? analysis.data.mustOrder : []} hasPrice={price != null} />
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
        {(menu.status === "idle" || menu.status === "error") && (
          <button type="button" className="btn" onClick={onMenu}>
            {menu.status === "error" ? "Try menu again" : "Menu and prices"}
          </button>
        )}
      </div>
    </article>
  );
}
