import { z } from "zod";

/** Validated environment variables. Reads `NEXT_PUBLIC_*` for client + server, others server-only. */
const schema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("https://hail-scout-production.up.railway.app"),
  NEXT_PUBLIC_TILES_BASE_URL: z.string().url().default("https://tiles.hailscout.com"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_MAP_CENTER_LAT: z.coerce.number().default(39.8),
  NEXT_PUBLIC_MAP_CENTER_LNG: z.coerce.number().default(-98.58),
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: z.coerce.number().default(4),
  NEXT_PUBLIC_ENABLE_CANVASSING: z.coerce.boolean().default(false),
  NEXT_PUBLIC_ENABLE_REPORTS: z.coerce.boolean().default(false),
  NEXT_PUBLIC_ENABLE_AI_FEATURES: z.coerce.boolean().default(false),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_TILES_BASE_URL: process.env.NEXT_PUBLIC_TILES_BASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_MAP_CENTER_LAT: process.env.NEXT_PUBLIC_MAP_CENTER_LAT,
  NEXT_PUBLIC_MAP_CENTER_LNG: process.env.NEXT_PUBLIC_MAP_CENTER_LNG,
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM,
  NEXT_PUBLIC_ENABLE_CANVASSING: process.env.NEXT_PUBLIC_ENABLE_CANVASSING,
  NEXT_PUBLIC_ENABLE_REPORTS: process.env.NEXT_PUBLIC_ENABLE_REPORTS,
  NEXT_PUBLIC_ENABLE_AI_FEATURES: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES,
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.warn("env validation issues:", parsed.error.flatten().fieldErrors);
}

export const env = parsed.success ? parsed.data : schema.parse({});
