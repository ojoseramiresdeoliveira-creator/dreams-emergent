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

// Per-request client scoped to the user's JWT — RLS policies apply.
// Use for all owner-scoped reads/writes in API routes.
export function getRlsClient(token) {
  if (!url || !anonKey) throw new Error('Supabase env vars not configured');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Verify a JWT from an Authorization header and return { userId, token }.
// Throws AuthError (statusCode 401) if the token is missing or invalid.
export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 401;
  }
}

export async function getUserFromToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) throw new AuthError('Missing auth token');
  const token = authHeader.slice(7);
  // Use anon client so Supabase validates the JWT against the project's secret.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new AuthError('Invalid or expired token');
  return { userId: data.user.id, token };
}
