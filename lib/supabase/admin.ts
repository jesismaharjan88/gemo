// Server-only admin client — uses the service role key, bypasses RLS and auth entirely.
// Never import this in client components or expose it to the browser.
// Use this for server-side scripts, migrations, and one-off test queries instead of
// createClient(), which calls auth.getUser() and can rate-limit the Supabase auth server.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
