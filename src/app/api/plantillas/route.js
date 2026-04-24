import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const result = await supabaseAdmin
    .from("plantillas")
    .select("*")
    .order("nombre", { ascending: true });

  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ plantillas: result.data || [] });
}

export async function POST(req) {
  const body = await req.json();
  if (!body.nombre || !body.estructura) {
    return Response.json({ error: "Faltan nombre o estructura" }, { status: 400 });
  }
  const result = await supabaseAdmin
    .from("plantillas")
    .upsert({
      nombre: body.nombre.toLowerCase().trim(),
      estructura: body.estructura,
      descripcion: body.descripcion || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "nombre" })
    .select()
    .single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, plantilla: result.data });
}

export async function PATCH(req) {
  const body = await req.json();
  if (!body.id) return Response.json({ error: "Falta id" }, { status: 400 });

  const update = { updated_at: new Date().toISOString() };
  if (body.nombre !== undefined) update.nombre = body.nombre.toLowerCase().trim();
  if (body.estructura !== undefined) update.estructura = body.estructura;
  if (body.descripcion !== undefined) update.descripcion = body.descripcion;

  const result = await supabaseAdmin
    .from("plantillas")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, plantilla: result.data });
}

export async function DELETE(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
  const result = await supabaseAdmin.from("plantillas").delete().eq("id", id);
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
