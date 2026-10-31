import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn('Supabase environment variables are missing or using placeholders. Auth features will fail.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
