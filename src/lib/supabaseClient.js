import { createClient } from '@supabase/supabase-js'
import { offlineSupabase } from '../data/offline-store';

// Get offline status from localStorage, default to false (online)
const isOffline = localStorage.getItem('wmc_use_offline') === 'true';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!isOffline && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Supabase URL or Anon Key is missing. Check your .env file.')
}

export const supabase = isOffline ? offlineSupabase : createClient(supabaseUrl, supabaseAnonKey)
