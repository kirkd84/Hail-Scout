import { z } from "zod";

const envSchema = z.object({
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  API_BASE_URL: z.string().url(),
  TILES_BASE_URL: z.string().url(),
  ENVIRONMENT: z.enum(["development", "preview", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function getEnvVars(): Env {
  const raw = {
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
    API_BASE_URL: process.env.API_BASE_URL || "https://api.hailscout.com/v1",
    TILES_BASE_URL: process.env.TILES_BASE_URL || "https://tiles.hailscout.com",
    ENVIRONMENT: (process.env.ENVIRONMENT || "development") as "development" | "preview" | "production",
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Environment validation failed:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = getEnvVars();
