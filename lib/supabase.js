import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Browser client — singleton, uses anon key, RLS applies, session stored in localStorage.
let _browser = null;
export function getBrowserClient() {
  if (!_browser) {
    if (!url || !anonKey) throw new Error('Supabase env vars not configured');
    _browser = createClient(url, anonKey, {
      auth: { persistSession: true, storageKey: 'mod_session' },
    });
  }
  return _browser;
}

// Server client — uses service role key, bypasses RLS.
// Use only inside API routes for verified-user operations or cross-user reads.
export function getServerClient() {
  if (!url || !serviceKey) throw new Error('Supabase server env vars not configured');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verify a JWT from an Authorization header and return the user_id.
// Throws if the token is missing or invalid.
export async function getUserFromToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing auth token');
  const token = authHeader.slice(7);
  // Use anon client so Supabase validates the JWT against the project's secret.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new Error('Invalid or expired token');
  return data.user.id;
}
