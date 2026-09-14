// Deno's `npm:` specifier is resolved by Deno itself at runtime (the Edge
// Functions actually run under Deno, not Node) - it is not a scheme
// TypeScript's "bundler" moduleResolution (used for the Vite/Vitest side of
// this project) understands, so a Deno-targeted file that imports
// `npm:@supabase/supabase-js@2` fails tsc with "Cannot find module" the
// moment a test file reaches it via a relative import (as
// tokenRefresh.test.ts does for tokenRefresh.ts). This ambient declaration
// only exists to satisfy that type-check; it has no effect on Deno's own
// resolution of the real specifier at runtime. The real package is already
// a project dependency (used by the frontend), so its types are reused
// as-is rather than duplicated.
declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
