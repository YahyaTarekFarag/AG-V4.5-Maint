import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
const supabaseServiceKey = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// Standard client - used for all normal operations
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client - used ONLY for creating auth users (requires service role key)
// This key bypasses RLS — only use for privileged admin operations
export const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    : null;
