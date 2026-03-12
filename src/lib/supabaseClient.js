import { createClient } from '@supabase/supabase-js'
import { offlineSupabase } from '../data/offline-store';

const isOffline = false; // Use real Supabase with credentials from .env

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!isOffline && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Supabase URL or Anon Key is missing. Check your .env file.')
}

export const supabase = isOffline ? offlineSupabase : createClient(supabaseUrl, supabaseAnonKey)
