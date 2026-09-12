import { googleProvider } from "./google.ts";
import { microsoftProvider } from "./microsoft.ts";
import type { IntegrationProvider } from "./types.ts";

export const providers: Record<string, IntegrationProvider> = {
  google: googleProvider,
  microsoft: microsoftProvider,
};
