import { createClient } from '@supabase/supabase-js';

// @ts-expect-error: Vite meta missing in types
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
// @ts-expect-error: Vite meta missing in types
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
// @ts-expect-error: Vite meta missing in types
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// Standard client - used for all normal operations
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client - used ONLY for creating auth users (requires service role key)
// This key bypasses RLS — only use for privileged admin operations
export const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            storageKey: 'sb-admin-auth-token'
        },
    })
    : null;
