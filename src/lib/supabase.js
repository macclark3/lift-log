import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn(
    "Supabase env vars are missing. Copy .env.example to .env and fill in " +
    "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart `npm run dev`."
  );
}

export const supabase = createClient(url, key);
