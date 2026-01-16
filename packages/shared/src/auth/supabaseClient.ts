import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

const nodeSupabaseUrl = typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined;
const nodeSupabaseAnonKey = typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || nodeSupabaseUrl || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || nodeSupabaseAnonKey || '';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type { User, Session };
