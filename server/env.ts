// Central place for configuration. Each service falls back to demo data independently,
// so you can wire up Google first and OpenRouter later (or the other way round).

const flag = (v: string | undefined) => v?.toLowerCase() === "true";

export const env = {
  googleKey: () => process.env.GOOGLE_PLACES_API_KEY?.trim() || "",
  openrouterKey: () => process.env.OPENROUTER_API_KEY?.trim() || "",
  // Netlify sets URL on deployed sites; locally we fall back to the dev server.
  appUrl: () => process.env.URL || "http://localhost:8888",
  reviewModel: () => process.env.OPENROUTER_MODEL_REVIEWS?.trim() || "anthropic/claude-haiku-4.5",
  allowedModels: () => {
    const list = (process.env.OPENROUTER_ALLOWED_MODELS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const def = env.reviewModel();
    return list.includes(def) ? list : [def, ...list];
  },
  mockGoogle: () => flag(process.env.USE_MOCKS) || !env.googleKey(),
  mockOpenRouter: () => flag(process.env.USE_MOCKS) || !env.openrouterKey(),
};
