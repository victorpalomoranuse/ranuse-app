import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const result = await supabaseAdmin
    .from("objetivos")
    .select("*")
    .order("periodo", { ascending: true });

  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }
  return Response.json({ objetivos: result.data || [] });
}

export async function PATCH(req) {
  const body = await req.json();
  if (!body.id) {
    return Response.json({ error: "Falta id" }, { status: 400 });
  }
  const update = { updated_at: new Date().toISOString() };
  const campos = ["prospeccion", "interesados", "ventas", "facturacion"];
  for (const c of campos) {
    if (body[c] !== undefined) update[c] = Number(body[c]) || 0;
  }
  const result = await supabaseAdmin
    .from("objetivos")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, objetivo: result.data });
}
