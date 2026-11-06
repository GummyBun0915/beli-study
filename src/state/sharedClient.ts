import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const sharedClient = url && key ? createClient(url, key, { auth: {
  flowType: 'pkce',
  persistSession: true,
  autoRefreshToken: true,
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  // Hash routes such as #/feed are not auth callbacks and must not clear a stored session.
  detectSessionInUrl: (_url, params) => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#/')) return false;
    return Boolean(params.access_token || params.error || params.error_description || params.error_code);
  },
} }) : null;
