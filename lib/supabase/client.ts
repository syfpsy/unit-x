import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client. Only public env vars are used — the
 * anon key is safe to ship to the client; RLS is what actually gates
 * access.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase env missing on the client.');
  }
  return createBrowserClient(url, anonKey);
}
