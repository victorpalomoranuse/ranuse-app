import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.warn("Faltan variables de Supabase en el entorno");
}

export const supabase = createClient(url, anon);

export const supabaseAdmin = serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : supabase;
