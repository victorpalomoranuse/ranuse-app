import { supabaseAdmin } from "@/lib/supabase";

function checkAuth(req) {
  const expected = process.env.FINANZAS_PASSWORD;
  if (!expected) return true;
  return req.headers.get("x-finanzas-password") === expected;
}
function unauth() { return Response.json({ error: "No autorizado" }, { status: 401 }); }

export async function GET(req) {
  if (!checkAuth(req)) return unauth();
  const { data, error } = await supabaseAdmin
    .from("categorias_finanzas").select("*").order("tipo").order("nombre");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ categorias: data });
}

export async function POST(req) {
  if (!checkAuth(req)) return unauth();
  const body = await req.json();
  if (!body.nombre || !body.tipo) return Response.json({ error: "Faltan nombre o tipo" }, { status: 400 });
  if (!["ingreso", "gasto"].includes(body.tipo)) return Response.json({ error: "Tipo inválido" }, { status: 400 });
  const result = await supabaseAdmin.from("categorias_finanzas").insert({
    nombre: body.nombre.trim(),
    tipo: body.tipo,
    color: body.color || null,
  }).select().single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, categoria: result.data });
}

export async function DELETE(req) {
  if (!checkAuth(req)) return unauth();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
  const result = await supabaseAdmin.from("categorias_finanzas").delete().eq("id", id);
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
