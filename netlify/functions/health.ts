import type { Config } from "@netlify/functions";
import type { HealthResponse } from "../../shared/types";
import { env } from "../../server/env";
import { json } from "../../server/http";

// Reports which services are live vs demo. Never returns keys.
export default async () => {
  const body: HealthResponse = {
    google: env.mockGoogle() ? "mock" : "live",
    openrouter: env.mockOpenRouter() ? "mock" : "live",
    models: { default: env.reviewModel(), allowed: env.allowedModels() },
  };
  return json(body);
};

export const config: Config = { path: "/api/health" };
