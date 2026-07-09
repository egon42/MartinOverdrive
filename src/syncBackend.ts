// Supabase backend for cross-device sync (see SYNC-SETUP.md for the one-time setup).
//
// These two constants are PUBLIC BY DESIGN. The anon/publishable key is meant to ship in
// the browser bundle — access is gated by Row-Level Security + the secret sync code, not by
// hiding this key. Committing them (even in a public repo) is exactly how Supabase intends
// the anon key to be used. Do NOT put the service_role key here.
//
// After creating the Supabase project and running the SQL from SYNC-SETUP.md, paste the
// project URL and anon key below.
export const SUPABASE_URL = 'https://lhsbdabaumtpqwzfqqvx.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_vC57T197oplU5mxb5pCL_g_4DvyCMMG'

/** True once the constants above have been filled in with a real project. Lets the UI show
 * a "sync isn't set up yet" message instead of firing doomed requests at a placeholder. */
export function isBackendConfigured(): boolean {
  return !SUPABASE_URL.includes('YOUR_PROJECT_REF') && !SUPABASE_ANON_KEY.startsWith('YOUR_')
}

export function sbHeaders(): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}
