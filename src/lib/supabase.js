import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.error(
    "[supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Configúralas en Vercel → Settings → Environment Variables."
  );
}

if (!serviceKey) {
  console.warn(
    "[supabase] Falta SUPABASE_SERVICE_ROLE_KEY. Las APIs del servidor usarán la anon key y " +
      "respetarán RLS, así que puede que no puedas escribir en las tablas."
  );
}

export const supabase = createClient(url || "", anon || "");

export const supabaseAdmin = serviceKey
  ? createClient(url || "", serviceKey, { auth: { persistSession: false } })
  : supabase;
