import { createClient } from '@supabase/supabase-js';

// NOTE: In a production environment, these should be in a .env file.
// Ideally: process.env.VITE_SUPABASE_URL and process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
